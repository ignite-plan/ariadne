// STG에서 기록: 화면이 보이는 Chrome을 띄우고, 고른 장면까지의 단계를 빠르게 재생한 뒤 기획자의 조작을 기록한다.
// STG 저장 허용이 아니면 쓰기 요청을 막는다 (Claude STG 탐색과 같은 규칙)
import type { BrowserContext } from 'playwright'
import { loadManual, type ManualRef } from '../../../src/core/manual.ts'
import { isAllowedRequest, isTelemetryRequest } from '../../../src/core/safety.ts'
import { openProfile } from '../../../src/core/session.ts'
import { Director } from '../../../src/core/video/director.ts'
import { videoViewport } from '../../../src/core/video/index.ts'
import { attachRecorder, type RecordEvent } from '../../../src/core/video/record.ts'
import { applyVars, loadVideo, videoVars } from '../../../src/core/video/scenario.ts'
import { runSteps } from '../../../src/core/video/steps.ts'

export type RecordSessionEvent = RecordEvent | { kind: 'ready' }

export interface RecordOptions extends ManualRef {
  id: string
  // 이 장면(0부터)에 단계를 붙인다. 그 앞 장면과 이 장면의 기존 단계는 먼저 재생한다
  scene: number
  baseUrl: string
  // 로그인 세션(유지되는 Chrome 프로필)
  profileDir: string
  onEvent: (event: RecordSessionEvent) => void
}

let current: BrowserContext | undefined

export function isRecording() {
  return Boolean(current)
}

// 브라우저를 닫으면 close에서 앱에 'stop'을 한 번 보낸다
export async function stopRecording() {
  await current?.close().catch(() => {})
}

export async function startRecording({ id, scene, baseUrl, profileDir, onEvent, ...ref }: RecordOptions) {
  if (current) throw new Error('이미 기록하고 있습니다')
  const scenario = applyVars(loadVideo(ref, id), videoVars())
  if (!scenario.scenes[scene]) throw new Error(`장면 ${scene + 1}이 없습니다`)
  // 영상과 같은 크기로 기록해야 몇 번째(nth)·위치가 맞는다
  const viewport = videoViewport(loadManual(ref))
  const { context, page } = await openProfile(profileDir, { headless: false, viewport, debugPort: process.env.ARIADNE_E2E_RECORD_PORT })
  current = context
  // 기록 끝, 앱에서 멈춤, 기획자가 Chrome 창을 닫음 모두 여기로 온다
  context.on('close', () => {
    if (current === context) current = undefined
    onEvent({ kind: 'stop' })
  })
  try {
    if (!scenario.mutates) {
      await context.route('**/*', (route) => {
        const request = route.request()
        if (isAllowedRequest(request.method(), request.url())) return route.continue()
        if (!isTelemetryRequest(request.url())) {
          onEvent({ kind: 'warning', message: `데이터를 바꾸는 요청을 막았습니다: ${request.method()} ${new URL(request.url()).pathname}` })
        }
        return route.abort('blockedbyclient')
      })
    }
    page.setDefaultTimeout(15_000)
    page.on('close', () => void context.close().catch(() => {}))
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
        if (event.kind === 'stop') return void context.close().catch(() => {})
        onEvent(event)
      },
    })
    onEvent({ kind: 'ready' })
  } catch (error) {
    await context.close().catch(() => {})
    throw error
  }
}
