type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const MIN_CAPTURE_SECONDS = 0.3

export type WavCapture = {
  stop: () => Promise<{
    audioData: ArrayBuffer
    sampleRate: number
  }>
}

export async function startWavCapture(): Promise<WavCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false
    }
  })

  if (typeof MediaRecorder !== 'undefined') {
    try {
      return startMediaRecorderCapture(stream)
    } catch {
      stopStream(stream)
      throw new Error('This Electron build could not start microphone recording.')
    }
  }

  return startScriptProcessorCapture(stream)
}

function startMediaRecorderCapture(stream: MediaStream): WavCapture {
  const mimeType = getSupportedRecorderMimeType()
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
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
      stopStream(stream)

      const blob = await stopped
      if (blob.size <= 0) throw new Error('No microphone audio was captured.')

      const encodedAudio = await blob.arrayBuffer()
      const audioContext = createAudioContext()
      try {
        const audioBuffer = await audioContext.decodeAudioData(encodedAudio.slice(0))
        const samples = new Float32Array(audioBuffer.getChannelData(0))
        assertEnoughAudio(samples.length, audioBuffer.sampleRate)

        return {
          audioData: encodeWav([samples], audioBuffer.sampleRate),
          sampleRate: audioBuffer.sampleRate
        }
      } finally {
        await audioContext.close()
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
      const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0)
      assertEnoughAudio(sampleCount, sampleRate)

      return {
        audioData: encodeWav(chunks, sampleRate),
        sampleRate
      }
    }
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

function getSupportedRecorderMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm']

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
}

function assertEnoughAudio(sampleCount: number, sampleRate: number): void {
  if (sampleCount / sampleRate >= MIN_CAPTURE_SECONDS) return

  throw new Error('Hold the dictation bind a little longer before releasing it.')
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
