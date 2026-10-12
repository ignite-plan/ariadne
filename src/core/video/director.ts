// 시나리오가 쓰는 조작 헬퍼. 사람이 조작하는 것처럼 커서를 옮기고, 누를 곳을 강조한 뒤 누른다.
import type { Locator, Page } from 'playwright'
import { isBlockedLabel } from '../safety.ts'
import { gotoStg } from '../stg-url.ts'
import type { OverlayApi } from './overlay.ts'

export class MutationBlockedError extends Error {}

export interface DirectorOptions {
  baseUrl: string
  // false면 저장/삭제류 버튼(safety.ts isBlockedLabel) 클릭을 막는다
  mutates?: boolean
  // 1이면 정상 속도, 0이면 대기 없이 (테스트용)
  pace?: number
  // false면 자막·강조를 그리지 않는다 (overlay가 없는 기록 브라우저에서 단계를 다시 재생할 때)
  overlay?: boolean
}

type Target = Locator | string

// 화면 아래 자막이 덮는 높이. 누르거나 강조할 곳은 이 위에 오게 한다
const CAPTION_ZONE = 160

export class Director {
  private cursor = { x: 0, y: 0 }
  private readonly baseUrl: string
  private readonly mutates: boolean
  private readonly pace: number
  private readonly drawOverlay: boolean

  constructor(
    readonly page: Page,
    { baseUrl, mutates = false, pace = 1, overlay = true }: DirectorOptions,
  ) {
    this.baseUrl = baseUrl
    this.mutates = mutates
    this.pace = pace
    this.drawOverlay = overlay
  }

  // baseUrl 기준 경로로 이동. 로그인 페이지로 튕기면 세션 만료로 멈춘다
  async goto(path: string) {
    await gotoStg(this.page, this.baseUrl, path)
    await this.page.waitForLoadState('networkidle')
  }

  // 화면 준비 완료까지 기다린다
  async ready(target: Target) {
    await this.locate(target).first().waitFor()
    await this.page.waitForLoadState('networkidle')
  }

  async pause(ms: number) {
    await this.wait(ms)
  }

  async hover(target: Target) {
    const locator = await this.moveTo(target)
    await locator.hover()
  }

  async click(target: Target) {
    const locator = this.locate(target).first()
    if (!this.mutates) {
      const label = (await locator.getAttribute('aria-label')) ?? (await locator.innerText().catch(() => ''))
      if (isBlockedLabel(label)) {
        throw new MutationBlockedError(`"${label.trim()}"은(는) 데이터를 바꿀 수 있는 버튼이라 'STG에 실제 저장 허용' 시나리오에서만 누를 수 있습니다`)
      }
    }
    await this.moveTo(locator)
    await this.highlightBox(locator, 450)
    await this.wait(250)
    await locator.click()
    await this.wait(300)
  }

  // 한 글자씩 입력한다
  async type(target: Target, text: string, { clear = true } = {}) {
    const locator = this.locate(target).first()
    await this.moveTo(locator)
    await locator.click()
    if (clear) await locator.fill('')
    await locator.pressSequentially(text, { delay: 55 * this.pace })
    await this.wait(250)
  }

  async select(target: Target, value: string | string[]) {
    const locator = this.locate(target).first()
    await this.moveTo(locator)
    await this.highlightBox(locator, 400)
    await locator.selectOption(value)
    await this.wait(300)
  }

  // HDS(MUI) Select: 드롭다운을 열고 옵션을 고른다
  async choose(trigger: Target, option: string) {
    await this.click(trigger)
    await this.click(this.page.getByRole('option', { name: option, exact: true }))
  }

  // 대상을 화면 가운데로 부드럽게 스크롤
  async scroll(target: Target) {
    const locator = this.locate(target).first()
    await locator.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }))
    await this.wait(700)
  }

  // 커서를 옮기고 대상을 잠시 강조한다 (누르지 않음)
  async highlight(target: Target, ms = 1500) {
    const locator = await this.moveTo(target)
    await this.highlightBox(locator, ms)
    await this.wait(ms)
  }

  // 대상 가운데로 커서를 옮긴다. 거리에 따라 300~900ms
  async moveTo(target: Target) {
    const locator = this.locate(target).first()
    await this.bringIntoView(locator)
    const box = await locator.boundingBox()
    if (!box) throw new Error(`화면에 보이지 않는 대상: ${locator}`)
    // 화면보다 긴 요소는 보이는 부분(자막 위)의 가운데로 간다
    const view = this.page.viewportSize() ?? { width: box.x + box.width, height: box.y + box.height }
    const clamp = (from: number, to: number, max: number) => {
      const a = Math.max(from, 0)
      const b = Math.min(to, max)
      return b > a ? (a + b) / 2 : (from + to) / 2
    }
    const to = {
      x: clamp(box.x, box.x + box.width, view.width),
      y: clamp(box.y, box.y + box.height, view.height - CAPTION_ZONE),
    }
    const from = this.cursor
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const duration = Math.min(900, Math.max(300, distance * 0.7)) * this.pace
    const steps = Math.max(1, Math.round(duration / 16))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      await this.page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e)
      if (this.pace) await this.page.waitForTimeout(16)
    }
    this.cursor = to
    return locator
  }

  // 대상이 자막 위에 잘 보이게 세로로만 스크롤한다. 이미 잘 보이면 움직이지 않는다.
  // 화면보다 넓은 요소(상세 패널 등) 때문에 화면 전체가 가로로 밀리지 않도록 가로 위치는 되돌린다
  private async bringIntoView(locator: Locator) {
    await locator.evaluate((el, captionZone) => {
      const rect = el.getBoundingClientRect()
      const safe = innerHeight - captionZone
      const tall = rect.height > safe * 0.8
      // 긴 요소는 위쪽이 화면 위 절반에 보이면, 작은 요소는 전체가 자막 위에 보이면 그대로 둔다
      if (tall ? rect.top >= 0 && rect.top < innerHeight / 2 : rect.top >= 0 && rect.bottom <= safe) return
      const saved: [Element, number][] = []
      for (let node = el.parentElement; node; node = node.parentElement) saved.push([node, node.scrollLeft])
      if (document.scrollingElement) saved.push([document.scrollingElement, document.scrollingElement.scrollLeft])
      el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest' })
      for (const [node, left] of saved) node.scrollLeft = left
    }, CAPTION_ZONE)
  }

  // 녹화 시작 전 커서를 화면 가운데에 둔다
  async placeCursor(x: number, y: number) {
    await this.page.mouse.move(x, y)
    this.cursor = { x, y }
  }

  async caption(text: string | null) {
    await this.overlay('caption', [text])
  }

  async card(title: string | null, subtitle?: string) {
    await this.overlay('card', [title, subtitle])
  }

  private async highlightBox(locator: Locator, ms: number) {
    const box = await locator.boundingBox()
    if (box) await this.overlay('highlight', [box, ms * this.pace])
  }

  private async overlay<K extends keyof OverlayApi>(method: K, args: Parameters<OverlayApi[K]>) {
    if (!this.drawOverlay) return
    // 페이지 이동 직후에는 overlay가 아직 없을 수 있다
    await this.page.waitForFunction(() => '__ariadneVideo' in window)
    await this.page.evaluate(
      ([name, values]) => {
        const api = (window as unknown as { __ariadneVideo: Record<string, (...a: unknown[]) => void> }).__ariadneVideo
        api[name](...values)
      },
      [method, args] as [string, unknown[]],
    )
  }

  private locate(target: Target) {
    return typeof target === 'string' ? this.page.locator(target) : target
  }

  private async wait(ms: number) {
    if (ms * this.pace > 0) await this.page.waitForTimeout(ms * this.pace)
  }
}
