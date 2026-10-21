// 가이드 영상 만들기·음성 미리듣기. TTS 추론과 녹화가 main을 멈추지 않게 utilityProcess에서 돌린다
import { join } from 'node:path'
import { cdpTab } from '../../src/core/session.ts'
import { createProvider, narrate, renderVideo, stepFailure, videoCacheDir, type TtsConfig, type VideoOptions } from '../../src/core/video/index.ts'
import type { WorkerReply } from './worker.ts'

export type WorkerRenderOptions = Omit<VideoOptions, 'signal' | 'onProgress' | 'tts' | 'openTab'> & {
  tts?: false | TtsConfig
  // 공유 Chrome 주소 (127.0.0.1). 있으면 거기에 탭을 열어 녹화한다. 없으면 프로필로 Chrome을 단독으로 띄운다 (미리보기)
  cdpEndpoint?: string
}

export type WorkerRequest =
  | { op: 'render'; options: WorkerRenderOptions }
  | { op: 'speak'; root: string; text: string; tts: TtsConfig; modelDir: string }
  | { op: 'cancel' }

export type WorkerMessage = WorkerReply<unknown>

const post = (message: WorkerMessage) => process.parentPort.postMessage(message)
const controller = new AbortController()

// 처리 못 한 오류로 worker가 죽으면 main에는 종료 코드만 남는다. 진짜 메시지를 결과로 보낸다
process.on('uncaughtException', (error) => post(stepFailure(error)))
// 녹화 흐름 밖의 거절(예: Playwright가 대화상자를 자동으로 닫다 실패)은 main처럼 넘어가고 녹화를 계속한다
process.on('unhandledRejection', (reason) => console.error('[video-worker]', reason))

async function handle(request: Exclude<WorkerRequest, { op: 'cancel' }>) {
  if (request.op === 'render') {
    const { cdpEndpoint, ...options } = request.options
    return renderVideo({
      ...options,
      openTab: cdpEndpoint ? cdpTab(cdpEndpoint) : undefined,
      signal: controller.signal,
      onProgress: (progress) => post({ progress }),
    })
  }
  const provider = await createProvider(request.tts, { modelDir: request.modelDir, localOnly: true })
  const clips = await narrate([request.text], provider, join(videoCacheDir({ root: request.root }), 'tts'))
  return clips.get(request.text)!
}

process.parentPort.on('message', ({ data }: { data: WorkerRequest }) => {
  if (data.op === 'cancel') return controller.abort(new Error('취소했습니다'))
  handle(data).then(
    (result) => post({ result }),
    (error) => post(stepFailure(error)),
  )
})
