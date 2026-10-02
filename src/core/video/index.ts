// 시나리오 하나를 녹화해 자막·내레이션이 들어간 mp4로 만든다.
// TTS 사전 생성 → 녹화(장면마다 자막 표시·조작·음성 길이만큼 대기) → ffmpeg 합성
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Page } from 'playwright'
import { defaultAuthFile } from '../capture.ts'
import { DEFAULT_VIEWPORT, loadManual, type ManualRef, type Viewport } from '../manual.ts'
import { isAllowedRequest } from '../safety.ts'
import { compose } from './compose.ts'
import { Director } from './director.ts'
import { MASK_ATTR, overlayScript } from './overlay.ts'
import { startRecording, type Recording } from './recorder.ts'
import { sceneHasContent } from './edit.ts'
import { applyVars, loadVideo, videoVars, type Target, type VideoScenario } from './scenario.ts'
import { locate, runSteps } from './steps.ts'
import { readingTime, toSrt, toVtt, type Cue } from './subtitles.ts'
import { createProvider, narrate, type Clip, type TtsConfig, type TtsProvider } from './tts/index.ts'

export * from './compose.ts'
export * from './describe.ts'
export * from './director.ts'
export * from './edit.ts'
export * from './overlay.ts'
export * from './record.ts'
export * from './recorder.ts'
export * from './scenario.ts'
export * from './steps.ts'
export * from './subtitles.ts'
export * from './tts/index.ts'
export * from './tts/model.ts'

// 음성이 끝난 뒤 다음 장면까지 쉬는 시간
const GAP_MS = 400
const CARD_MS = 2500

export type VideoStage = 'tts' | 'prepare' | 'record' | 'compose' | 'cleanup'

export interface VideoProgress {
  stage: VideoStage
  message: string
  // 지금 실행 중인 장면·단계 (0부터)
  scene?: number
  step?: number
}

export interface VideoOptions extends ManualRef {
  id: string
  // 없으면 manuals/<manual>/videos/<id>.yaml
  scenario?: VideoScenario
  // 없으면 manual.yaml capture.baseUrl
  baseUrl?: string
  viewport?: Viewport
  authFile?: string
  // 유지되는 Chrome 프로필로 연다 (authFile 대신). BO는 접속할 때마다 토큰을 갱신해서,
  // 저장한 storageState로 새 컨텍스트를 여러 번 열면 예전 토큰으로 접속해 로그아웃된다
  profileDir?: string
  // false면 내레이션 없이 자막만. 없으면 manual.yaml video.tts. provider를 직접 넘길 수도 있다 (테스트)
  tts?: false | TtsConfig | TtsProvider
  // Kokoro 모델 위치. 기본 <root>/.video-cache/models. localModel이면 내려받지 않는다 (앱)
  modelDir?: string
  localModel?: boolean
  // 기본 PATH의 ffmpeg
  ffmpegPath?: string
  // <root> 기준. 기본 dist/videos
  outDir?: string
  headed?: boolean
  // true면 브라우저를 띄워 실행만 해 본다 (음성·녹화·파일 없음). 시나리오 작성 중 확인용
  preview?: boolean
  // 이 장면(0부터)부터 녹화한다. 앞 장면 단계는 녹화 없이 빠르게 재생해 화면 상태를 맞춘다
  fromScene?: number
  // 음성이 없는 장면의 대기 배율 (테스트에서 줄인다)
  pace?: number
  // 요소를 찾거나 기다리는 최대 시간. STG가 느릴 때를 감안해 기본 15초
  stepTimeout?: number
  // {stamp} 등 시나리오 변수. 기본 videoVars()
  vars?: Record<string, string>
  signal?: AbortSignal
  onProgress?: (event: VideoProgress) => void
}

export interface VideoResult {
  // preview면 없다
  mp4?: string
  srt?: string
  vtt?: string
  cues: Cue[]
  durationMs: number
  // mutates가 아니어서 막은 쓰기 요청
  blockedRequests: string[]
}

export function videoWorkDir({ root, manual }: ManualRef, id: string) {
  return resolve(root, '.video', manual, id)
}

export function videoCacheDir({ root }: Pick<ManualRef, 'root'>) {
  return resolve(root, '.video-cache')
}

export function videoOutputs({ root }: Pick<ManualRef, 'root'>, id: string, outDir = 'dist/videos') {
  const dir = resolve(root, outDir)
  return { mp4: join(dir, `${id}.mp4`), srt: join(dir, `${id}.srt`), vtt: join(dir, `${id}.vtt`) }
}

async function applyMask(page: Page, targets: Target[] | undefined) {
  for (const target of targets ?? []) {
    await locate(page, target, { all: true })
      .evaluateAll((els, attr) => els.forEach((el) => el.setAttribute(attr, '')), MASK_ATTR)
      .catch(() => {})
  }
}

export async function renderVideo({
  id,
  scenario: scenarioOption,
  baseUrl: baseUrlOption,
  viewport: viewportOption,
  authFile,
  profileDir,
  tts: ttsOption,
  modelDir,
  localModel,
  ffmpegPath,
  outDir,
  headed,
  preview = false,
  fromScene = 0,
  pace = 1,
  stepTimeout = 15_000,
  vars,
  signal,
  onProgress,
  ...ref
}: VideoOptions): Promise<VideoResult> {
  const manual = loadManual(ref)
  const scenario = applyVars(scenarioOption ?? loadVideo(ref, id), vars ?? videoVars())
  if (!scenario.scenes.length) throw new Error('장면이 없습니다')
  // 비어 있는 채로 만들면 시작 카드만 있는 영상이 나온다
  if (!scenario.scenes.some(sceneHasContent)) {
    throw new Error('장면이 모두 비어 있습니다. 내레이션을 쓰거나 단계를 넣은 뒤 만드세요')
  }
  if (fromScene < 0 || fromScene >= scenario.scenes.length) throw new Error(`장면 ${fromScene + 1}이 없습니다`)
  const baseUrl = baseUrlOption || manual.capture?.baseUrl
  if (!baseUrl) throw new Error('녹화 대상 주소가 없습니다. manual.yaml capture.baseUrl을 지정하세요')
  const viewport = viewportOption ?? manual.capture?.viewport ?? DEFAULT_VIEWPORT
  const auth = authFile ?? defaultAuthFile(ref)
  if (!profileDir && !existsSync(auth)) throw new Error(`${auth} 없음. 로그인 먼저 실행`)
  const work = videoWorkDir(ref, scenario.id)
  mkdirSync(work, { recursive: true })
  const outputs = videoOutputs(ref, scenario.id, outDir)

  // 1. 내레이션
  const tts = preview || ttsOption === false ? undefined : (ttsOption ?? manual.video?.tts ?? {})
  let clips = new Map<string, Clip>()
  if (tts) {
    const scenes = scenario.scenes.slice(fromScene)
    const lines = [fromScene ? undefined : scenario.intro, ...scenes.map((s) => s.say)].filter((s): s is string => !!s)
    const cache = videoCacheDir(ref)
    const provider =
      'synthesize' in tts ? tts : await createProvider(tts, { modelDir: modelDir ?? join(cache, 'models'), localOnly: localModel })
    clips = await narrate(lines, provider, join(cache, 'tts'), ({ index, total, cached }) => {
      signal?.throwIfAborted()
      onProgress?.({ stage: 'tts', message: `음성 ${index + 1}/${total}${cached ? ' (캐시)' : ''}` })
    })
  }

  // 2. 녹화
  const cues: Cue[] = []
  const audio: { file: string; at: number }[] = []
  const blockedRequests: string[] = []
  const video = join(work, 'screen.mp4')
  let durationMs = 0
  const headless = !(headed ?? preview)
  const options = { viewport, deviceScaleFactor: 1, locale: 'en-US' }
  const browser = profileDir ? undefined : await chromium.launch({ channel: 'chrome', headless })
  const context = profileDir
    ? await chromium.launchPersistentContext(profileDir, { channel: 'chrome', headless, ...options })
    : await browser!.newContext({ storageState: auth, ...options })
  const closeAll = () => (browser ? browser.close() : context.close()).catch(() => {})
  const abort = () => void closeAll()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    signal?.throwIfAborted()
    await context.addInitScript({ content: overlayScript({ personal: scenario.maskPersonal }) })
    if (!scenario.mutates) {
      await context.route('**/*', (route) => {
        const request = route.request()
        if (isAllowedRequest(request.method(), request.url())) return route.continue()
        blockedRequests.push(`${request.method()} ${request.url()}`)
        return route.abort('blockedbyclient')
      })
    }
    const page = (profileDir && context.pages()[0]) || (await context.newPage())
    page.setDefaultTimeout(stepTimeout)
    const v = new Director(page, { baseUrl, mutates: scenario.mutates })
    // 시작 카드 뒤에 깔릴 첫 화면. 세션 확인도 겸한다
    onProgress?.({ stage: 'prepare', message: 'STG 열기' })
    await v.goto('/')
    if (fromScene) {
      const fast = new Director(page, { baseUrl, mutates: scenario.mutates, pace: 0 })
      for (const [index, scene] of scenario.scenes.slice(0, fromScene).entries()) {
        onProgress?.({ stage: 'prepare', message: `장면 ${index + 1} 빠르게 재생`, scene: index })
        await runSteps(fast, scene.steps, index, { signal })
      }
    }
    await applyMask(page, scenario.mask)
    await v.placeCursor(viewport.width / 2, viewport.height / 2)
    if (!fromScene) await v.card(scenario.title, manual.title)

    const recording: Recording | undefined = preview ? undefined : await startRecording(page, video, viewport, { ffmpegPath })
    const t0 = recording?.t0 ?? Date.now()
    const now = () => Date.now() - t0
    const hold = async (start: number, text: string | undefined, clip: Clip | undefined, minimum = 0) => {
      const length = clip ? clip.ms + GAP_MS : text ? readingTime(text) * pace : 0
      const remaining = Math.max(length, minimum) - (now() - start)
      if (remaining > 0) await page.waitForTimeout(remaining)
    }
    try {
      if (!fromScene) {
        onProgress?.({ stage: 'record', message: '시작 카드' })
        const introClip = scenario.intro ? clips.get(scenario.intro) : undefined
        await v.caption(scenario.intro ?? null)
        await hold(0, scenario.intro, introClip, CARD_MS * pace)
        if (scenario.intro) cues.push({ start: 0, end: now(), text: scenario.intro })
        if (introClip) audio.push({ file: introClip.file, at: 0 })
        await v.caption(null)
        await v.card(null)
        await page.waitForTimeout(400)
      }

      for (let index = fromScene; index < scenario.scenes.length; index++) {
        const scene = scenario.scenes[index]
        const text = scene.caption ?? scene.say
        const clip = scene.say ? clips.get(scene.say) : undefined
        const start = now()
        await v.caption(text ?? null)
        if (clip) audio.push({ file: clip.file, at: start })
        await runSteps(v, scene.steps, index, {
          signal,
          onStep: async (step) => {
            onProgress?.({ stage: 'record', message: `장면 ${index + 1}/${scenario.scenes.length}`, scene: index, step })
            await applyMask(page, scenario.mask)
          },
        })
        await applyMask(page, scenario.mask)
        await hold(start, text, clip)
        if (text) cues.push({ start, end: now(), text })
      }
      await v.caption(null)
      await page.waitForTimeout(800)
    } finally {
      durationMs = recording ? (await recording.stop()).durationMs : now()
    }
    if (scenario.cleanup?.length) {
      onProgress?.({ stage: 'cleanup', message: '테스트 데이터 정리' })
      await runSteps(new Director(page, { baseUrl, mutates: true, pace: 0 }), scenario.cleanup, 'cleanup')
    }
  } catch (error) {
    if (signal?.aborted) throw new Error('취소했습니다', { cause: error })
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    await closeAll()
  }
  if (preview) return { cues, durationMs, blockedRequests }

  // 3. 합성
  onProgress?.({ stage: 'compose', message: '영상 합치기' })
  mkdirSync(resolve(outputs.mp4, '..'), { recursive: true })
  writeFileSync(outputs.srt, toSrt(cues))
  writeFileSync(outputs.vtt, toVtt(cues))
  writeFileSync(join(work, 'timeline.json'), JSON.stringify({ durationMs, cues, audio, blockedRequests }, null, 2))
  await compose({ video, audio, srt: cues.length ? outputs.srt : undefined, durationMs, out: outputs.mp4, ffmpegPath })
  return { ...outputs, cues, durationMs, blockedRequests }
}
