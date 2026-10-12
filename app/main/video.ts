// video-worker를 띄워 영상 만들기·음성 미리듣기를 맡긴다. 영상 만들기는 한 번에 하나
import type { UtilityProcess } from 'electron'
import type { Clip, VideoProgress, VideoResult } from '../../src/core/video/index.ts'
import type { VideoRunResult } from '../shared/api.ts'
import type { WorkerRenderOptions, WorkerRequest } from './video-worker.ts'
import workerPath from './video-worker?modulePath'
import { forkWorker } from './worker.ts'

const fork = <R>(request: WorkerRequest, onProgress?: (progress: VideoProgress) => void) =>
  forkWorker<R>(workerPath, 'Ariadne Video', request, {
    onProgress: (progress) => onProgress?.(progress as VideoProgress),
    crashed: (code) => `영상 프로세스가 비정상 종료했습니다 (code ${code})`,
  })

let running: UtilityProcess | undefined

export async function runVideo(options: WorkerRenderOptions, onProgress: (progress: VideoProgress) => void): Promise<VideoRunResult> {
  if (running) throw new Error('이미 영상을 만들고 있습니다')
  const { child, done } = fork<VideoResult>({ op: 'render', options }, onProgress)
  running = child
  try {
    const message = await done
    if ('error' in message) return { ok: false, error: message.error, scene: message.scene, step: message.step }
    return { ok: true, ...message.result }
  } finally {
    running = undefined
  }
}

// worker가 브라우저를 닫고 끝내게 한다. 10초 안에 안 끝나면 강제로 끝낸다
export function cancelVideo() {
  const child = running
  if (!child) return
  child.postMessage({ op: 'cancel' } satisfies WorkerRequest)
  setTimeout(() => {
    if (running === child) child.kill()
  }, 10_000)
}

export async function speak(request: Extract<WorkerRequest, { op: 'speak' }>): Promise<Clip> {
  const message = await fork<Clip>(request).done
  if ('error' in message) throw new Error(message.error)
  return message.result
}
