// 내레이션 음성 생성. 같은 문장·음성은 .video-cache/tts에 캐시한다.
// 사내 TLS 프록시 때문에 모델 다운로드·API 호출은 node --use-system-ca 로 실행해야 한다 (package.json 스크립트)
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'

export interface TtsConfig {
  // kokoro: 로컬 모델(기본, 키 없음) / openai: OPENAI_API_KEY 필요
  provider?: 'kokoro' | 'openai'
  voice?: string
  speed?: number
}

export interface TtsProvider {
  // 캐시 키에 들어가는 이름 (provider + voice + speed)
  key: string
  synthesize(text: string, file: string): Promise<void>
}

export interface Clip {
  file: string
  ms: number
}

export interface ProviderOptions {
  // Kokoro 모델 위치
  modelDir: string
  // true면 모델을 내려받지 않고 modelDir에 있는 것만 쓴다 (앱: main이 net.fetch로 미리 받음)
  localOnly?: boolean
}

export async function createProvider(config: TtsConfig, options: ProviderOptions): Promise<TtsProvider> {
  if (config.provider === 'openai') {
    const { openaiProvider } = await import('./openai.ts')
    return openaiProvider(config)
  }
  const { kokoroProvider } = await import('./kokoro.ts')
  return kokoroProvider(config, options)
}

// WAV 헤더로 길이(ms)를 잰다. ffmpeg-static에는 ffprobe가 없다
export function wavDuration(buffer: Buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('WAV 파일이 아닙니다')
  let byteRate = 0
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16)
    if (id === 'data') {
      if (!byteRate) throw new Error('WAV fmt 정보가 없습니다')
      // 스트리밍으로 만든 WAV는 크기 칸이 0이나 0xFFFFFFFF다. 그때는 파일 끝까지
      const bytes = size && size !== 0xffffffff ? Math.min(size, buffer.length - offset - 8) : buffer.length - offset - 8
      return Math.round((bytes / byteRate) * 1000)
    }
    offset += 8 + size + (size % 2)
  }
  throw new Error('WAV data가 없습니다')
}

export function audioDuration(file: string) {
  return wavDuration(readFileSync(file))
}

// 문장마다 wav를 만든다. 캐시에 있으면 다시 만들지 않는다
export async function narrate(
  lines: string[],
  provider: TtsProvider,
  cacheDir: string,
  onProgress?: (event: { index: number; total: number; cached: boolean }) => void,
) {
  mkdirSync(cacheDir, { recursive: true })
  const clips = new Map<string, Clip>()
  const unique = [...new Set(lines)]
  for (const [index, text] of unique.entries()) {
    const hash = createHash('sha1').update(`${provider.key}\n${text}`).digest('hex').slice(0, 16)
    const file = join(cacheDir, `${hash}.wav`)
    const cached = existsSync(file)
    onProgress?.({ index, total: unique.length, cached })
    if (!cached) {
      // 중간에 끊겨도 깨진 파일이 캐시에 남지 않게 한다
      const partial = `${file}.part.wav`
      await provider.synthesize(text, partial)
      renameSync(partial, file)
    }
    clips.set(text, { file, ms: audioDuration(file) })
  }
  return clips
}
