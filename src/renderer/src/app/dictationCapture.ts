type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

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
  const windowWithAudioContext = window as AudioContextWindow
  const AudioContextConstructor =
    windowWithAudioContext.AudioContext ?? windowWithAudioContext.webkitAudioContext

  if (!AudioContextConstructor) {
    stopStream(stream)
    throw new Error('This Electron build does not expose Web Audio recording APIs.')
  }

  const audioContext = new AudioContextConstructor()
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

  return {
    stop: async () => {
      processor.disconnect()
      source.disconnect()
      silentGain.disconnect()
      stopStream(stream)
      await audioContext.close()

      return {
        audioData: encodeWav(chunks, audioContext.sampleRate),
        sampleRate: audioContext.sampleRate
      }
    }
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
