// STG에서 기록: 화면이 보이는 Chrome을 띄우고, 고른 장면까지의 단계를 빠르게 재생한 뒤 기획자의 조작을 기록한다.
// STG 저장 허용이 아니면 쓰기 요청을 막는다 (Claude STG 탐색과 같은 규칙)
import { chromium, type Browser } from 'playwright'
import { DEFAULT_VIEWPORT, loadManual, type ManualRef } from '../../../src/core/manual.ts'
import { isAllowedRequest } from '../../../src/core/safety.ts'
import { Director } from '../../../src/core/video/director.ts'
import { attachRecorder, type RecordEvent } from '../../../src/core/video/record.ts'
import { applyVars, loadVideo, videoVars } from '../../../src/core/video/scenario.ts'
import { runSteps } from '../../../src/core/video/steps.ts'

export type RecordSessionEvent = RecordEvent | { kind: 'ready' }

export interface RecordOptions extends ManualRef {
  id: string
  // 이 장면(0부터)에 단계를 붙인다. 그 앞 장면과 이 장면의 기존 단계는 먼저 재생한다
  scene: number
  baseUrl: string
  authFile: string
  onEvent: (event: RecordSessionEvent) => void
}

let current: Browser | undefined

export function isRecording() {
  return Boolean(current)
}

// 브라우저를 닫으면 disconnected에서 앱에 'stop'을 한 번 보낸다
export async function stopRecording() {
  await current?.close().catch(() => {})
}

export async function startRecording({ id, scene, baseUrl, authFile, onEvent, ...ref }: RecordOptions) {
  if (current) throw new Error('이미 기록하고 있습니다')
  const scenario = applyVars(loadVideo(ref, id), videoVars())
  if (!scenario.scenes[scene]) throw new Error(`장면 ${scene + 1}이 없습니다`)
  const viewport = loadManual(ref).capture?.viewport ?? DEFAULT_VIEWPORT
  // E2E가 기록 브라우저를 조작할 수 있게 디버깅 포트를 연다 (평소에는 없음)
  const port = process.env.ARIADNE_E2E_RECORD_PORT
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: port ? [`--remote-debugging-port=${port}`] : [] })
  current = browser
  // 기록 끝, 앱에서 멈춤, 기획자가 Chrome 창을 닫음 모두 여기로 온다
  browser.on('disconnected', () => {
    if (current === browser) current = undefined
    onEvent({ kind: 'stop' })
  })
  try {
    const context = await browser.newContext({ storageState: authFile, viewport, deviceScaleFactor: 1, locale: 'en-US' })
    if (!scenario.mutates) {
      await context.route('**/*', (route) => {
        const request = route.request()
        if (isAllowedRequest(request.method(), request.url())) return route.continue()
        onEvent({ kind: 'warning', message: `데이터를 바꾸는 요청을 막았습니다: ${request.method()} ${new URL(request.url()).pathname}` })
        return route.abort('blockedbyclient')
      })
    }
    const page = await context.newPage()
    page.setDefaultTimeout(15_000)
    page.on('close', () => void browser.close().catch(() => {}))
    const v = new Director(page, { baseUrl, mutates: scenario.mutates, pace: 0, overlay: false })
    await v.goto('/')
    const before = scenario.scenes.slice(0, scene + 1)
    for (const [index, s] of before.entries()) {
      try {
        await runSteps(v, s.steps, index)
      } catch (error) {
        onEvent({ kind: 'warning', message: `앞 단계를 재생하다 멈췄습니다. 지금 화면에서 이어서 기록합니다: ${(error as Error).message}` })
        break
      }
    }
    // 화면 열기 단계가 아직 없으면 지금 화면을 첫 단계로 넣는다
    if (!before.some((s) => s.steps.some((step) => 'open' in step))) {
      const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
      const path = page.url().startsWith(base.href) ? `/${page.url().slice(base.href.length)}` : '/'
      onEvent({ kind: 'step', step: { open: path } })
    }
    await attachRecorder(page, {
      mutates: scenario.mutates,
      onEvent: (event) => {
        if (event.kind === 'stop') return void browser.close().catch(() => {})
        onEvent(event)
      },
    })
    onEvent({ kind: 'ready' })
  } catch (error) {
    await browser.close().catch(() => {})
    throw error
  }
}
