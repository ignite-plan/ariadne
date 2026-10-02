// Claude가 STG 화면을 살펴볼 때 쓰는 브라우저. Claude는 브라우저를 직접 만지지 않고 이 서비스에 요청한다.
// 안전장치 두 겹: 저장/삭제류 버튼 클릭 거절, 쓰기 요청(PUT/PATCH/DELETE, 조회가 아닌 POST) 차단
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserContext, Locator, Page } from 'playwright'
import { captureDir } from '../../../src/core/capture.ts'
import { isAllowedRequest, isBlockedLabel, isTelemetryRequest } from '../../../src/core/safety.ts'
import { clearSession, openProfile } from '../../../src/core/session.ts'
import { DEFAULT_VIEWPORT, loadManual, manualDir, type ManualRef, type Viewport } from '../../../src/core/manual.ts'

export type Role = 'button' | 'link' | 'tab' | 'menuitem' | 'checkbox' | 'radio' | 'combobox' | 'option' | 'treeitem' | 'row'

// 저장/삭제류 버튼, 쓰기 요청 판단은 가이드 영상과 같은 규칙을 쓴다
export { isAllowedRequest, isBlockedLabel } from '../../../src/core/safety.ts'

export type ShotStep =
  | { click: { role: Role; name: string; nth?: number } }
  | { fill: { label: string; value: string } }
  | { waitFor: string }

export interface ShotInput {
  id: string
  path: string
  ready?: string
  steps?: ShotStep[]
  clip?: string
  mask?: string[]
}

const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

// 구조화된 단계를 shots.ts 코드로 만든다. Claude가 임의 코드를 쓰지 않게 하려고
export function shotToCode(shot: ShotInput) {
  const fields = [`id: ${quote(shot.id)}`, `path: ${quote(shot.path)}`]
  if (shot.ready) fields.push(`ready: ${quote(shot.ready)}`)
  if (shot.steps?.length) {
    const body = shot.steps
      .map((step) => {
        if ('click' in step) {
          const { role, name, nth } = step.click
          const pick = nth === undefined ? '.first()' : `.nth(${nth})`
          return `      await page.getByRole(${quote(role)}, { name: ${quote(name)} })${pick}.click()`
        }
        if ('fill' in step) return `      await page.getByLabel(${quote(step.fill.label)}).first().fill(${quote(step.fill.value)})`
        return `      await page.locator(${quote(step.waitFor)}).first().waitFor()`
      })
      .join('\n')
    fields.push(`steps: async (page) => {\n${body}\n    }`)
  }
  if (shot.clip) fields.push(`clip: ${quote(shot.clip)}`)
  if (shot.mask?.length) fields.push(`mask: [${shot.mask.map(quote).join(', ')}]`)
  return `  {\n    ${fields.join(',\n    ')},\n  },`
}

const idPattern = (id: string) => new RegExp(`id:\\s*['"]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)

// shots.ts에서 id의 { ... } 항목을 지운다 (뒤 쉼표, 줄 포함)
export function removeShot(source: string, id: string) {
  const match = idPattern(id).exec(source)
  if (!match) return source
  let start = match.index
  for (let depth = 0; start > 0; start--) {
    const c = source[start - 1]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) break
      depth--
    }
  }
  start -= 1
  let end = start
  for (let depth = 0; end < source.length; end++) {
    if (source[end] === '{') depth++
    else if (source[end] === '}' && --depth === 0) break
  }
  end += 1
  if (source[end] === ',') end += 1
  const lineStart = source.lastIndexOf('\n', start - 1) + 1
  const prefix = source.slice(lineStart, start)
  const from = /^\s*$/.test(prefix) ? lineStart : start
  const to = source[end] === '\n' && from === lineStart ? end + 1 : end
  return source.slice(0, from) + source.slice(to)
}

// shots.ts 배열 끝에 넣는다. 같은 id가 있으면 거절, replace면 바꾼다
export function appendShot(source: string, shot: ShotInput, replace = false) {
  if (idPattern(shot.id).test(source)) {
    if (!replace) throw new Error(`shots.ts에 이미 있는 id: ${shot.id}. 바꾸려면 replace: true`)
    source = removeShot(source, shot.id)
  }
  const code = shotToCode(shot)
  const empty = source.match(/defineShots\(\[\s*\]\)/)
  if (empty) return source.replace(empty[0], `defineShots([\n${code}\n])`)
  const end = source.lastIndexOf('])')
  if (end < 0) throw new Error('shots.ts에서 defineShots([...])를 찾지 못했습니다')
  const before = source.slice(0, end).replace(/\s*$/, '')
  return `${before}${before.endsWith(',') || before.endsWith('[') ? '' : ','}\n${code}\n${source.slice(end)}`
}

const MAX_SNAPSHOT = 12000

export interface OpenResult {
  url: string
  title: string
  // 접근성 트리 (YAML 비슷한 텍스트). UI 라벨을 그대로 옮길 때 쓴다
  snapshot: string
  screenshot: string
  blockedRequests: string[]
}

export interface StgOptions extends ManualRef {
  baseUrl: string
  // 로그인 세션(유지되는 Chrome 프로필). 한 번에 브라우저 하나만 열 수 있다
  profileDir: string
  viewport?: Viewport
  headless?: boolean
}

export class StgSession {
  private context?: BrowserContext
  private page?: Page
  private blocked: string[] = []
  private counter = 0
  readonly baseUrl: string
  readonly viewport: Viewport

  constructor(private readonly options: StgOptions) {
    this.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`
    this.viewport = options.viewport ?? loadManual(options).capture?.viewport ?? DEFAULT_VIEWPORT
  }

  private async ensurePage() {
    if (this.page && !this.page.isClosed()) return this.page
    if (!this.context) {
      const { context, page } = await openProfile(this.options.profileDir, { headless: this.options.headless ?? true, viewport: this.viewport })
      await context.route('**/*', (route) => {
        const request = route.request()
        if (isAllowedRequest(request.method(), request.url())) return route.continue()
        if (!isTelemetryRequest(request.url())) this.blocked.push(`${request.method()} ${request.url()}`)
        return route.abort('blockedbyclient')
      })
      this.context = context
      this.page = page
      return page
    }
    this.page = await this.context.newPage()
    return this.page
  }

  private url(path: string) {
    if (/^https?:\/\//.test(path)) {
      if (new URL(path).origin !== new URL(this.baseUrl).origin) throw new Error(`STG 밖 주소는 열 수 없습니다: ${path}`)
      return path
    }
    return new URL(path.replace(/^\//, ''), this.baseUrl).href
  }

  private async describe(page: Page): Promise<OpenResult> {
    await page.waitForLoadState('networkidle').catch(() => {})
    const dir = join(captureDir(this.options), 'draft')
    mkdirSync(dir, { recursive: true })
    const screenshot = join(dir, `view-${++this.counter}.png`)
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    let snapshot = await page.locator('body').ariaSnapshot().catch(() => '')
    if (snapshot.length > MAX_SNAPSHOT) snapshot = `${snapshot.slice(0, MAX_SNAPSHOT)}\n… (잘림)`
    const blockedRequests = this.blocked
    this.blocked = []
    return { url: page.url(), title: await page.title(), snapshot, screenshot, blockedRequests }
  }

  async open(path: string) {
    const page = await this.ensurePage()
    await page.goto(this.url(path))
    if (new URL(page.url()).origin !== new URL(this.baseUrl).origin) {
      // 앱이 '로그인 세션 있음'으로 잘못 보여 주지 않게 로그인 표식을 지운다
      clearSession(this.options.profileDir)
      throw new Error(`로그인 페이지로 이동했습니다(세션 만료). 앱에서 [다시 로그인]을 눌러 로그인해야 합니다: ${page.url()}`)
    }
    return this.describe(page)
  }

  private async target(role: Role, name: string, nth?: number): Promise<Locator> {
    const page = await this.ensurePage()
    const all = page.getByRole(role, { name })
    const count = await all.count()
    if (!count) throw new Error(`화면에 ${role} "${name}"이(가) 없습니다`)
    return nth === undefined ? all.first() : all.nth(nth)
  }

  async click(role: Role, name: string, nth?: number) {
    if (isBlockedLabel(name)) throw new Error(`"${name}"은(는) 데이터를 바꿀 수 있는 버튼이라 누르지 않습니다`)
    const locator = await this.target(role, name, nth)
    // 이름이 비슷한 다른 버튼일 수 있어 실제 접근성 이름도 다시 확인한다
    const actual = (await locator.getAttribute('aria-label')) ?? (await locator.innerText().catch(() => name))
    if (isBlockedLabel(actual)) throw new Error(`"${actual}"은(는) 데이터를 바꿀 수 있는 버튼이라 누르지 않습니다`)
    await locator.click()
    return this.describe(await this.ensurePage())
  }

  async fill(label: string, value: string) {
    const page = await this.ensurePage()
    await page.getByLabel(label).first().fill(value)
    return this.describe(page)
  }

  // 새 페이지에서 단계를 다시 재생해 찍는다. 같은 단계가 다음 릴리즈 캡처에도 그대로 쓰인다
  // replace: 이미 있는 이미지/캡처 정의를 바꾼다 (최신화). 아니면 기존 이미지 id는 거절한다
  async saveShot(shot: ShotInput, replace = false) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(shot.id)) throw new Error('shot id는 영문 소문자, 숫자, -만 쓸 수 있습니다')
    for (const step of shot.steps ?? []) {
      if ('click' in step && isBlockedLabel(step.click.name)) {
        throw new Error(`"${step.click.name}"은(는) 데이터를 바꿀 수 있는 버튼이라 캡처 단계에 넣을 수 없습니다`)
      }
    }
    const shotsFile = join(manualDir(this.options), 'shots.ts')
    const imageFile = join(manualDir(this.options), 'images', `${shot.id}.png`)
    if (!replace && existsSync(imageFile)) {
      throw new Error(`이미 있는 이미지 id입니다: ${shot.id}. 다른 id를 쓰거나, 그 이미지를 바꾸려면 replace: true`)
    }
    const next = appendShot(readFileSync(shotsFile, 'utf8'), shot, replace)

    await this.ensurePage()
    const page = await this.context!.newPage()
    try {
      await page.goto(this.url(shot.path))
      await page.waitForLoadState('networkidle').catch(() => {})
      if (shot.ready) await page.locator(shot.ready).first().waitFor({ timeout: 8000 })
      for (const step of shot.steps ?? []) {
        if ('click' in step) {
          const { role, name, nth } = step.click
          const all = page.getByRole(role, { name })
          await (nth === undefined ? all.first() : all.nth(nth)).click()
        } else if ('fill' in step) await page.getByLabel(step.fill.label).first().fill(step.fill.value)
        else await page.locator(step.waitFor).first().waitFor({ timeout: 8000 })
      }
      await page.waitForLoadState('networkidle').catch(() => {})
      const imagesDir = join(manualDir(this.options), 'images')
      mkdirSync(imagesDir, { recursive: true })
      const file = join(imagesDir, `${shot.id}.png`)
      const mask = shot.mask?.map((m) => page.locator(m))
      if (shot.clip) await page.locator(shot.clip).first().screenshot({ path: file, mask, animations: 'disabled' })
      else await page.screenshot({ path: file, mask, animations: 'disabled' })
      writeFileSync(shotsFile, next)
      return { image: `images/${shot.id}.png`, file }
    } finally {
      await page.close()
    }
  }

  async close() {
    await this.context?.close().catch(() => {})
    this.context = undefined
    this.page = undefined
  }
}

