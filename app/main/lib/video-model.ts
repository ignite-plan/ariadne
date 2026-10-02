// 내레이션 음성 모델(Kokoro, 약 90MB)을 받는다. 사내 TLS 프록시 때문에 main에서 net.fetch로 받고,
// worker의 TTS는 받은 파일만 읽는다 (localModel)
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { KOKORO_FILES, KOKORO_MODEL, kokoroFileUrl, kokoroReady } from '../../../src/core/video/tts/model.ts'

export interface ModelProgress {
  file: string
  index: number
  count: number
  loaded: number
  total?: number
}

export function modelStatus(dir: string) {
  const ready = kokoroReady(dir)
  const bytes = ready ? KOKORO_FILES.reduce((sum, f) => sum + statSync(join(dir, KOKORO_MODEL, f)).size, 0) : 0
  return { ready, bytes }
}

export async function downloadModel(
  dir: string,
  fetch: (url: string) => Promise<Response>,
  onProgress?: (progress: ModelProgress) => void,
  url: (file: string) => string = kokoroFileUrl,
) {
  for (const [index, file] of KOKORO_FILES.entries()) {
    const target = join(dir, KOKORO_MODEL, file)
    if (existsSync(target)) continue
    mkdirSync(dirname(target), { recursive: true })
    const res = await fetch(url(file))
    if (!res.ok || !res.body) throw new Error(`음성 모델을 받지 못했습니다 (${res.status}): ${file}`)
    const total = Number(res.headers.get('content-length')) || undefined
    let loaded = 0
    let last = 0
    const body = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>)
    body.on('data', (chunk: Buffer) => {
      loaded += chunk.length
      // 너무 자주 보내지 않는다 (1MB마다)
      if (loaded - last >= 1 << 20 || loaded === total) {
        last = loaded
        onProgress?.({ file, index, count: KOKORO_FILES.length, loaded, total })
      }
    })
    // 받다가 끊겨도 깨진 파일이 남지 않게 .part로 받은 뒤 옮긴다
    const partial = `${target}.part`
    try {
      await pipeline(body, createWriteStream(partial))
      if (total && statSync(partial).size !== total) throw new Error(`음성 모델 파일이 덜 받아졌습니다: ${file}`)
      renameSync(partial, target)
    } catch (error) {
      rmSync(partial, { force: true })
      throw error
    }
    onProgress?.({ file, index, count: KOKORO_FILES.length, loaded, total })
  }
  return modelStatus(dir)
}
