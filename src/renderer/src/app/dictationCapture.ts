import type { DictationMicrophonePermissionStatus } from '../../../shared/dictation'

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const MIN_CAPTURE_SECONDS = 0.3
const SILENCE_PEAK_THRESHOLD = 0.0001
const SILENCE_RMS_THRESHOLD = 0.00001

export type DictationAudioInputDevice = {
  deviceId: string
  isDefault: boolean
  label: string
}

export type WavCaptureOptions = {
  preferredDeviceId?: string | null
}

export type WavCapture = {
  stop: () => Promise<{
    audioData: ArrayBuffer
    sampleRate: number
  }>
}

type AudioLevel = {
  peak: number
  rms: number
  sampleCount: number
}

export async function listDictationAudioInputDevices(): Promise<DictationAudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  const devices = await navigator.mediaDevices.enumerateDevices()
  let microphoneIndex = 0

  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device) => {
      microphoneIndex += 1

      return {
        deviceId: device.deviceId,
        isDefault: device.deviceId === 'default',
        label: getDeviceDisplayLabel(device, microphoneIndex)
      }
    })
}

export async function getDictationAudioInputPermissionStatus(): Promise<DictationMicrophonePermissionStatus> {
  const statusFromDevices = await inferAudioInputPermissionStatusFromDevices()
  if (statusFromDevices !== 'unknown') return statusFromDevices

  return queryBrowserMicrophonePermissionStatus()
}

export async function startWavCapture({
  preferredDeviceId
}: WavCaptureOptions = {}): Promise<WavCapture> {
  const stream = await openPreferredAudioStream(preferredDeviceId ?? null)

  if (canUseWebAudioCapture()) {
    try {
      return await startScriptProcessorCapture(stream)
    } catch (error) {
      stopStream(stream)
      throw error
    }
  }

  if (typeof MediaRecorder !== 'undefined') {
    try {
      return startMediaRecorderCapture(stream)
    } catch {
      stopStream(stream)
      throw new Error('This Electron build could not start microphone recording.')
    }
  }

  stopStream(stream)
  throw new Error('This Electron build does not expose microphone recording APIs.')
}

export async function requestDictationAudioInputAccess(): Promise<void> {
  const stream = await openPreferredAudioStream(null)
  stopStream(stream)
}

async function inferAudioInputPermissionStatusFromDevices(): Promise<DictationMicrophonePermissionStatus> {
  if (!navigator.mediaDevices?.enumerateDevices) return 'unknown'

  try {
    const audioInputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'audioinput'
    )
    if (audioInputDevices.length === 0) return 'unknown'

    return audioInputDevices.some((device) => device.label.trim()) ? 'granted' : 'not-determined'
  } catch {
    return 'unknown'
  }
}

async function queryBrowserMicrophonePermissionStatus(): Promise<DictationMicrophonePermissionStatus> {
  if (!navigator.permissions?.query) return 'unknown'

  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    if (status.state === 'granted') return 'granted'
    if (status.state === 'denied') return 'denied'
    if (status.state === 'prompt') return 'not-determined'
  } catch {
    return 'unknown'
  }

  return 'unknown'
}

function startMediaRecorderCapture(stream: MediaStream): WavCapture {
  const mimeType = getSupportedRecorderMimeType()
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  const inputLabel = getStreamInputLabel(stream)
  const chunks: Blob[] = []
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = () => {
      reject(new Error('Microphone capture failed while recording.'))
    }
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }))
    }
  })

  recorder.start(100)

  return {
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop()

      try {
        const blob = await stopped
        if (blob.size <= 0) throw new Error('No microphone audio was captured.')

        const encodedAudio = await blob.arrayBuffer()
        const audioContext = createAudioContext()
        try {
          const audioBuffer = await audioContext.decodeAudioData(encodedAudio.slice(0))
          const samples = new Float32Array(audioBuffer.getChannelData(0))
          const level = measureAudioLevel([samples])
          assertEnoughAudio(level.sampleCount, audioBuffer.sampleRate)
          assertAudibleAudio(level, inputLabel)

          return {
            audioData: encodeWav([samples], audioBuffer.sampleRate),
            sampleRate: audioBuffer.sampleRate
          }
        } finally {
          await audioContext.close()
        }
      } finally {
        stopStream(stream)
      }
    }
  }
}

async function startScriptProcessorCapture(stream: MediaStream): Promise<WavCapture> {
  const audioContext = createAudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const silentGain = audioContext.createGain()
  const chunks: Float32Array[] = []
  const inputLabel = getStreamInputLabel(stream)

  silentGain.gain.value = 0
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
  }
  source.connect(processor)
  processor.connect(silentGain)
  silentGain.connect(audioContext.destination)
  await audioContext.resume()

  return {
    stop: async () => {
      const sampleRate = audioContext.sampleRate
      processor.disconnect()
      source.disconnect()
      silentGain.disconnect()
      stopStream(stream)
      await audioContext.close()
      const level = measureAudioLevel(chunks)
      assertEnoughAudio(level.sampleCount, sampleRate)
      assertAudibleAudio(level, inputLabel)

      return {
        audioData: encodeWav(chunks, sampleRate),
        sampleRate
      }
    }
  }
}

async function openPreferredAudioStream(preferredDeviceId: string | null): Promise<MediaStream> {
  const stream = await requestAudioStream(preferredDeviceId ?? 'default')

  if (preferredDeviceId) return stream

  return switchAwayFromContinuityMicrophone(stream)
}

async function requestAudioStream(deviceId: string): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        deviceId: deviceId === 'default' ? { ideal: 'default' } : { exact: deviceId }
      }
    })
  } catch {
    if (deviceId !== 'default') {
      throw new Error('Could not start the selected microphone for dictation.')
    }

    return navigator.mediaDevices.getUserMedia({ audio: true })
  }
}

async function switchAwayFromContinuityMicrophone(stream: MediaStream): Promise<MediaStream> {
  const currentLabel = getStreamInputLabel(stream)
  if (!isContinuityMicrophoneLabel(currentLabel)) return stream

  const replacementDevice = (await listDictationAudioInputDevices()).find(
    (device) =>
      !device.isDefault &&
      !isContinuityMicrophoneLabel(device.label) &&
      isBuiltInMicrophoneLabel(device.label)
  )

  if (!replacementDevice) return stream

  try {
    const replacementStream = await requestAudioStream(replacementDevice.deviceId)
    stopStream(stream)
    return replacementStream
  } catch {
    return stream
  }
}

function createAudioContext(): AudioContext {
  const windowWithAudioContext = window as AudioContextWindow
  const AudioContextConstructor =
    windowWithAudioContext.AudioContext ?? windowWithAudioContext.webkitAudioContext

  if (!AudioContextConstructor) {
    throw new Error('This Electron build does not expose Web Audio recording APIs.')
  }

  return new AudioContextConstructor()
}

function canUseWebAudioCapture(): boolean {
  const windowWithAudioContext = window as AudioContextWindow

  return Boolean(windowWithAudioContext.AudioContext ?? windowWithAudioContext.webkitAudioContext)
}

function getSupportedRecorderMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm']

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
}

function getDeviceDisplayLabel(device: MediaDeviceInfo, index: number): string {
  const label = device.label.trim()
  if (label) return label

  return device.deviceId === 'default' ? 'System default microphone' : `Microphone ${index}`
}

function getStreamInputLabel(stream: MediaStream): string {
  return stream.getAudioTracks()[0]?.label?.trim() || 'selected microphone'
}

function isContinuityMicrophoneLabel(label: string): boolean {
  return /\b(?:iphone|ipad|continuity)\b/i.test(label)
}

function isBuiltInMicrophoneLabel(label: string): boolean {
  return /\b(?:built-in|internal|macbook|imac|mac mini|mac studio|studio display)\b/i.test(label)
}

function assertEnoughAudio(sampleCount: number, sampleRate: number): void {
  if (sampleCount / sampleRate >= MIN_CAPTURE_SECONDS) return

  throw new Error('Hold the dictation bind a little longer before releasing it.')
}

function assertAudibleAudio(level: AudioLevel, inputLabel: string): void {
  if (level.peak > SILENCE_PEAK_THRESHOLD || level.rms > SILENCE_RMS_THRESHOLD) return

  throw new Error(
    `Pixel recorded silence from ${inputLabel}. Check macOS microphone permission or choose another input in Dictation.`
  )
}

function measureAudioLevel(chunks: Float32Array[]): AudioLevel {
  let peak = 0
  let sampleCount = 0
  let squaredTotal = 0

  for (const chunk of chunks) {
    for (const sample of chunk) {
      const absoluteSample = Math.abs(sample)
      peak = Math.max(peak, absoluteSample)
      squaredTotal += sample * sample
    }
    sampleCount += chunk.length
  }

  return {
    peak,
    rms: Math.sqrt(squaredTotal / Math.max(1, sampleCount)),
    sampleCount
  }
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

function encodeWav(chunks: Float32Array[], sampleRate: number): ArrayBuffer {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const bytesPerSample = 2
  const channelCount = 1
  const dataBytes = sampleCount * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  let offset = 0

  offset = writeAscii(view, offset, 'RIFF')
  view.setUint32(offset, 36 + dataBytes, true)
  offset += 4
  offset = writeAscii(view, offset, 'WAVE')
  offset = writeAscii(view, offset, 'fmt ')
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, channelCount, true)
  offset += 2
  view.setUint32(offset, sampleRate, true)
  offset += 4
  view.setUint32(offset, sampleRate * channelCount * bytesPerSample, true)
  offset += 4
  view.setUint16(offset, channelCount * bytesPerSample, true)
  offset += 2
  view.setUint16(offset, 16, true)
  offset += 2
  offset = writeAscii(view, offset, 'data')
  view.setUint32(offset, dataBytes, true)
  offset += 4

  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clampedSample = Math.max(-1, Math.min(1, sample))
      view.setInt16(
        offset,
        clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff,
        true
      )
      offset += 2
    }
  }

  return buffer
}

function writeAscii(view: DataView, offset: number, value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }

  return offset + value.length
}
