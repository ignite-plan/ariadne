// utilityProcess worker 하나에 요청 하나를 맡긴다. progress 메시지는 넘겨 주고, 처음 온 결과·오류 메시지로 끝낸다
import { utilityProcess } from 'electron'

export type WorkerReply<R> = { progress: unknown } | { result: R } | { error: string; scene?: number | 'cleanup'; step?: number }

export function forkWorker<R>(
  workerPath: string,
  serviceName: string,
  request: unknown,
  { onProgress, crashed }: { onProgress?: (progress: unknown) => void; crashed: (code: number) => string },
) {
  const child = utilityProcess.fork(workerPath, [], { serviceName })
  const done = new Promise<Exclude<WorkerReply<R>, { progress: unknown }>>((resolve) => {
    let settled = false
    child.on('message', (message: WorkerReply<R>) => {
      if ('progress' in message) return onProgress?.(message.progress)
      settled = true
      resolve(message)
      child.kill()
    })
    child.on('exit', (code) => {
      if (!settled) resolve({ error: crashed(code) })
    })
  })
  child.postMessage(request)
  return { child, done }
}
