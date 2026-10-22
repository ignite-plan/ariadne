// 시나리오 단계 실행. Target → Playwright locator, 단계 → Director 조작
import type { Locator, Page } from 'playwright'
import { Director } from './director.ts'
import { describeStep } from './describe.ts'
import type { Scene, Step, Target } from './scenario.ts'

type Role = Parameters<Page['getByRole']>[0]

// all: nth가 없으면 조건에 맞는 요소 전체 (mask용)
export function locate(scope: Page | Locator, target: Target, { all = false } = {}): Locator {
  const base = target.within ? locate(scope, target.within) : scope
  const exact = target.exact
  let locator: Locator
  if (target.role) locator = base.getByRole(target.role as Role, target.name ? { name: target.name, exact } : {})
  else if (target.label) locator = base.getByLabel(target.label, { exact })
  else if (target.placeholder) locator = base.getByPlaceholder(target.placeholder, { exact })
  else if (target.text) locator = base.getByText(target.text, { exact })
  else throw new Error('요소를 찾을 조건이 없습니다')
  if (all && target.nth === undefined) return locator
  return locator.nth(target.nth ?? 0)
}

export class StepError extends Error {
  constructor(
    readonly scene: number | 'cleanup',
    readonly step: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

// 실패를 화면에 보일 값으로 (IPC·worker는 Error의 필드를 전달하지 않는다). StepError면 장면·단계 번호를 담는다
export function stepFailure(error: unknown): { error: string; scene?: number | 'cleanup'; step?: number } {
  const message = error instanceof Error ? error.message : String(error)
  return error instanceof StepError ? { error: message, scene: error.scene, step: error.step } : { error: message }
}

export async function runStep(v: Director, step: Step) {
  const page = v.page
  if ('open' in step) return v.goto(step.open)
  if ('waitFor' in step) {
    await locate(page, step.waitFor).waitFor()
    return page.waitForLoadState('networkidle').catch(() => {})
  }
  if ('click' in step) return v.click(locate(page, step.click))
  if ('hover' in step) return v.hover(locate(page, step.hover))
  if ('scroll' in step) return v.scroll(locate(page, step.scroll))
  if ('type' in step) return v.type(locate(page, step.type.target), step.type.text)
  if ('choose' in step) return v.choose(locate(page, step.choose.target), step.choose.option)
  if ('select' in step) return v.select(locate(page, step.select.target), step.select.value)
  if ('highlight' in step) return v.highlight(locate(page, step.highlight.target), step.highlight.ms)
  if ('upload' in step) return v.upload(locate(page, step.upload.target), step.upload.file)
  return v.pause(step.pause)
}

// 단계 목록을 실행하고, 실패하면 몇 번째 장면·단계인지 담아 던진다
export async function runSteps(
  v: Director,
  steps: Step[],
  scene: number | 'cleanup',
  { signal, onStep }: { signal?: AbortSignal; onStep?: (index: number) => void | Promise<void> } = {},
) {
  for (const [index, step] of steps.entries()) {
    signal?.throwIfAborted()
    try {
      await onStep?.(index)
      await runStep(v, step)
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      const where = scene === 'cleanup' ? '정리' : `장면 ${scene + 1}`
      const message = (error instanceof Error ? error.message : String(error)).split('\n')[0]
      throw new StepError(scene, index, `${where} 단계 ${index + 1} (${describeStep(step)}): ${message}`, { cause: error })
    }
  }
}

export interface ReplayOptions {
  baseUrl: string
  mutates?: boolean
  // 자막·강조를 그린다 (영상 만들기). 기록 브라우저·Claude 탐색에는 overlay가 없다
  overlay?: boolean
  // upload 단계의 파일 경로 기준 (매뉴얼 폴더)
  filesDir?: string
  signal?: AbortSignal
  onScene?: (index: number) => void
}

// 장면들의 단계를 기다림 없이 이어서 재생해, 다음 장면이 시작되는 화면을 만든다.
// 영상을 중간 장면부터 만들 때, STG에서 기록할 때, Claude가 장면 하나를 채울 때 같이 쓴다
export async function replayScenes(page: Page, scenes: Scene[], { baseUrl, mutates = false, overlay = false, filesDir, signal, onScene }: ReplayOptions) {
  const v = new Director(page, { baseUrl, mutates, pace: 0, overlay, filesDir })
  for (const [index, scene] of scenes.entries()) {
    onScene?.(index)
    await runSteps(v, scene.steps, index, { signal })
  }
}
