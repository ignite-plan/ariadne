// 내레이션 음성 생성. 같은 문장·음성은 .video-cache/tts에 캐시한다.
// 사내 TLS 프록시 때문에 모델 다운로드·API 호출은 node --use-system-ca 로 실행해야 한다 (package.json 스크립트)
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
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

export async function createProvider(config: TtsConfig, modelDir: string): Promise<TtsProvider> {
  if (config.provider === 'openai') {
    const { openaiProvider } = await import('./openai.ts')
    return openaiProvider(config)
  }
  const { kokoroProvider } = await import('./kokoro.ts')
  return kokoroProvider(config, modelDir)
}

export function audioDuration(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
    encoding: 'utf8',
  })
  return Math.round(Number(out.trim()) * 1000)
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
