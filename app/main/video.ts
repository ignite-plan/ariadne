// video-worker를 띄워 영상 만들기·음성 미리듣기를 맡긴다. 영상 만들기는 한 번에 하나
import { utilityProcess, type UtilityProcess } from 'electron'
import type { Clip, VideoProgress, VideoResult } from '../../src/core/video/index.ts'
import type { VideoRunResult } from '../shared/api.ts'
import type { WorkerMessage, WorkerRenderOptions, WorkerRequest } from './video-worker.ts'
import workerPath from './video-worker?modulePath'

function fork(request: WorkerRequest, onProgress?: (progress: VideoProgress) => void) {
  const child = utilityProcess.fork(workerPath, [], { serviceName: 'Ariadne Video' })
  const done = new Promise<WorkerMessage>((resolve) => {
    let settled = false
    child.on('message', (message: WorkerMessage) => {
      if ('progress' in message) return onProgress?.(message.progress as VideoProgress)
      settled = true
      resolve(message)
      child.kill()
    })
    child.on('exit', (code) => {
      if (!settled) resolve({ error: `영상 프로세스가 비정상 종료했습니다 (code ${code})` })
    })
  })
  child.postMessage(request)
  return { child, done }
}

let running: UtilityProcess | undefined

export async function runVideo(options: WorkerRenderOptions, onProgress: (progress: VideoProgress) => void): Promise<VideoRunResult> {
  if (running) throw new Error('이미 영상을 만들고 있습니다')
  const { child, done } = fork({ op: 'render', options }, onProgress)
  running = child
  try {
    const message = await done
    if ('error' in message) return { ok: false, error: message.error, scene: message.scene, step: message.step }
    const result = (message as { result: VideoResult }).result
    return { ok: true, ...result }
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
  const message = await fork(request).done
  if ('error' in message) throw new Error(message.error)
  return (message as { result: Clip }).result
}
