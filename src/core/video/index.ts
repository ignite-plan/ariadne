// 시나리오 하나를 녹화해 자막·내레이션이 들어간 mp4로 만든다.
// TTS 사전 생성 → 녹화(장면마다 자막 표시·조작·음성 길이만큼 대기) → ffmpeg 합성
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { defaultAuthFile } from '../capture.ts'
import { DEFAULT_VIEWPORT, loadManual, manualDir, type ManualRef, type Viewport } from '../manual.ts'
import { compose } from './compose.ts'
import { Director } from './director.ts'
import { overlayScript } from './overlay.ts'
import { startRecording } from './recorder.ts'
import type { VideoScenario } from './scenario.ts'
import { readingTime, toSrt, toVtt, type Cue } from './subtitles.ts'
import { createProvider, narrate, type Clip, type TtsConfig, type TtsProvider } from './tts/index.ts'

export * from './compose.ts'
export * from './director.ts'
export * from './overlay.ts'
export * from './recorder.ts'
export * from './scenario.ts'
export * from './subtitles.ts'
export * from './tts/index.ts'

// 음성이 끝난 뒤 다음 장면까지 쉬는 시간
const GAP_MS = 400
const CARD_MS = 2500

export type VideoStage = 'tts' | 'record' | 'compose'

export interface VideoOptions extends ManualRef {
  id: string
  // 없으면 manuals/<manual>/videos/<id>.ts를 import
  scenario?: VideoScenario
  // 없으면 manual.yaml capture.baseUrl
  baseUrl?: string
  viewport?: Viewport
  authFile?: string
  // false면 내레이션 없이 자막만. 없으면 manual.yaml video.tts. provider를 직접 넘길 수도 있다 (테스트)
  tts?: false | TtsConfig | TtsProvider
  // <root> 기준. 기본 dist/videos
  outDir?: string
  headed?: boolean
  // 음성이 없는 장면의 대기 배율 (테스트에서 줄인다)
  pace?: number
  onProgress?: (event: { stage: VideoStage; message: string }) => void
}

export interface VideoResult {
  mp4: string
  srt: string
  vtt: string
  cues: Cue[]
  durationMs: number
}

export function videoWorkDir({ root, manual }: ManualRef, id: string) {
  return resolve(root, '.video', manual, id)
}

export function videoCacheDir({ root }: Pick<ManualRef, 'root'>) {
  return resolve(root, '.video-cache')
}

export function listVideos(ref: ManualRef) {
  const dir = join(manualDir(ref), 'videos')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort()
}

export async function loadVideo(ref: ManualRef, id: string) {
  const file = join(manualDir(ref), 'videos', `${id}.ts`)
  if (!existsSync(file)) throw new Error(`시나리오 없음: ${file}`)
  const { default: scenario } = (await import(pathToFileURL(file).href)) as { default: VideoScenario }
  return scenario
}

export async function renderVideo({
  id,
  scenario: scenarioOption,
  baseUrl: baseUrlOption,
  viewport: viewportOption,
  authFile,
  tts: ttsOption,
  outDir = 'dist/videos',
  headed = false,
  pace = 1,
  onProgress,
  ...ref
}: VideoOptions): Promise<VideoResult> {
  const manual = loadManual(ref)
  const scenario = scenarioOption ?? (await loadVideo(ref, id))
  const baseUrl = baseUrlOption || manual.capture?.baseUrl
  if (!baseUrl) throw new Error('녹화 대상 주소가 없습니다. manual.yaml capture.baseUrl을 지정하세요')
  const viewport = viewportOption ?? manual.capture?.viewport ?? DEFAULT_VIEWPORT
  const auth = authFile ?? defaultAuthFile(ref)
  if (!existsSync(auth)) throw new Error(`${auth} 없음. 로그인 먼저 실행`)
  const work = videoWorkDir(ref, scenario.id)
  mkdirSync(work, { recursive: true })
  const output = resolve(ref.root, outDir)
  mkdirSync(output, { recursive: true })

  // 1. 내레이션
  const tts = ttsOption === false ? undefined : (ttsOption ?? manual.video?.tts ?? {})
  let clips = new Map<string, Clip>()
  if (tts) {
    const lines = [scenario.intro, ...scenario.scenes.map((s) => s.say)].filter((s): s is string => !!s)
    const cache = videoCacheDir(ref)
    const provider = 'synthesize' in tts ? tts : await createProvider(tts, join(cache, 'models'))
    clips = await narrate(lines, provider, join(cache, 'tts'), ({ index, total, cached }) =>
      onProgress?.({ stage: 'tts', message: `${index + 1}/${total}${cached ? ' (cache)' : ''}` }),
    )
  }

  // 2. 녹화
  const cues: Cue[] = []
  const audio: { file: string; at: number }[] = []
  const video = join(work, 'screen.mp4')
  let durationMs = 0
  const browser = await chromium.launch({ channel: 'chrome', headless: !headed })
  try {
    const context = await browser.newContext({ storageState: auth, viewport, deviceScaleFactor: 1, locale: 'en-US' })
    await context.addInitScript({ content: overlayScript({ mask: scenario.mask }) })
    const page = await context.newPage()
    const v = new Director(page, { baseUrl, mutates: scenario.mutates })
    // 시작 카드 뒤에 깔릴 첫 화면. 세션 확인도 겸한다
    await v.goto('/')
    await v.placeCursor(viewport.width / 2, viewport.height / 2)
    await v.card(scenario.title, manual.title)

    const recording = await startRecording(page, video, viewport)
    const now = () => Date.now() - recording.t0
    const hold = async (start: number, text: string | undefined, clip: Clip | undefined, minimum = 0) => {
      const length = clip ? clip.ms + GAP_MS : text ? readingTime(text) * pace : 0
      const remaining = Math.max(length, minimum) - (now() - start)
      if (remaining > 0) await page.waitForTimeout(remaining)
    }
    try {
      onProgress?.({ stage: 'record', message: 'intro' })
      const introClip = scenario.intro ? clips.get(scenario.intro) : undefined
      await v.caption(scenario.intro ?? null)
      await hold(0, scenario.intro, introClip, CARD_MS * pace)
      if (scenario.intro) cues.push({ start: 0, end: now(), text: scenario.intro })
      if (introClip) audio.push({ file: introClip.file, at: 0 })
      await v.caption(null)
      await v.card(null)
      await page.waitForTimeout(400)

      for (const [index, scene] of scenario.scenes.entries()) {
        onProgress?.({ stage: 'record', message: `scene ${index + 1}/${scenario.scenes.length}` })
        const text = scene.caption ?? scene.say
        const clip = scene.say ? clips.get(scene.say) : undefined
        const start = now()
        await v.caption(text ?? null)
        if (clip) audio.push({ file: clip.file, at: start })
        try {
          await scene.do?.(v)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(`scene ${index + 1} (${text ?? 'no caption'}): ${message}`, { cause: error })
        }
        await hold(start, text, clip)
        if (text) cues.push({ start, end: now(), text })
      }
      await v.caption(null)
      await page.waitForTimeout(800)
    } finally {
      durationMs = (await recording.stop()).durationMs
    }
    if (scenario.cleanup) {
      onProgress?.({ stage: 'record', message: 'cleanup' })
      await scenario.cleanup(new Director(page, { baseUrl, mutates: true, pace: 0 }))
    }
  } finally {
    await browser.close()
  }

  // 3. 합성
  onProgress?.({ stage: 'compose', message: 'ffmpeg' })
  const srt = join(output, `${scenario.id}.srt`)
  const vtt = join(output, `${scenario.id}.vtt`)
  const mp4 = join(output, `${scenario.id}.mp4`)
  writeFileSync(srt, toSrt(cues))
  writeFileSync(vtt, toVtt(cues))
  writeFileSync(join(work, 'timeline.json'), JSON.stringify({ durationMs, cues, audio }, null, 2))
  await compose({ video, audio, srt: cues.length ? srt : undefined, durationMs, out: mp4 })
  return { mp4, srt, vtt, cues, durationMs }
}
