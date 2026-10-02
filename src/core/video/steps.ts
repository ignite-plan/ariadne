// 시나리오 단계 실행. Target → Playwright locator, 단계 → Director 조작
import type { Locator, Page } from 'playwright'
import type { Director } from './director.ts'
import { describeStep } from './describe.ts'
import type { Step, Target } from './scenario.ts'

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
