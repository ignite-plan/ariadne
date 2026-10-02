// 가이드 영상 만들기·음성 미리듣기. TTS 추론과 녹화가 main을 멈추지 않게 utilityProcess에서 돌린다
import { join } from 'node:path'
import { createProvider, narrate, renderVideo, StepError, videoCacheDir, type TtsConfig, type VideoOptions } from '../../src/core/video/index.ts'

export type WorkerRenderOptions = Omit<VideoOptions, 'signal' | 'onProgress' | 'tts'> & { tts?: false | TtsConfig }

export type WorkerRequest =
  | { op: 'render'; options: WorkerRenderOptions }
  | { op: 'speak'; root: string; text: string; tts: TtsConfig; modelDir: string }
  | { op: 'cancel' }

export type WorkerMessage =
  | { progress: unknown }
  | { result: unknown }
  | { error: string; scene?: number | 'cleanup'; step?: number }

const post = (message: WorkerMessage) => process.parentPort.postMessage(message)
const controller = new AbortController()

async function handle(request: Exclude<WorkerRequest, { op: 'cancel' }>) {
  if (request.op === 'render') {
    return renderVideo({ ...request.options, signal: controller.signal, onProgress: (progress) => post({ progress }) })
  }
  const provider = await createProvider(request.tts, { modelDir: request.modelDir, localOnly: true })
  const clips = await narrate([request.text], provider, join(videoCacheDir({ root: request.root }), 'tts'))
  return clips.get(request.text)!
}

process.parentPort.on('message', ({ data }: { data: WorkerRequest }) => {
  if (data.op === 'cancel') return controller.abort(new Error('취소했습니다'))
  handle(data).then(
    (result) => post({ result }),
    (error: Error) =>
      post(error instanceof StepError ? { error: error.message, scene: error.scene, step: error.step } : { error: error.message }),
  )
})
