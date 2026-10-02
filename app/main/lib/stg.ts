// Claude가 STG 화면을 살펴볼 때 쓰는 브라우저. Claude는 브라우저를 직접 만지지 않고 이 서비스에 요청한다.
// 안전장치 두 겹: 저장/삭제류 버튼 클릭 거절, 쓰기 요청(PUT/PATCH/DELETE, 조회가 아닌 POST) 차단
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright'
import { captureDir } from '../../../src/core/capture.ts'
import { DEFAULT_VIEWPORT, loadManual, manualDir, type ManualRef, type Viewport } from '../../../src/core/manual.ts'

export type Role = 'button' | 'link' | 'tab' | 'menuitem' | 'checkbox' | 'radio' | 'combobox' | 'option' | 'treeitem' | 'row'

// 화면을 바꾸는 동작으로 보이는 이름. 단어 단위로 본다
const BLOCKED_LABEL =
  /\b(save|delete|remove|submit|approve|reject|send|register|publish|confirm|apply changes|deactivate|activate|terminate|reset password|upload|import|sync|resend|withdraw)\b|저장|삭제|승인|반려|발송|전송|등록|게시|확인|적용|업로드|탈퇴|해지/i

export function isBlockedLabel(name: string) {
  return BLOCKED_LABEL.test(name)
}

// 조회로 보이는 POST만 통과시킨다 (BO 목록/검색 API 중 POST가 있다)
const READ_POST = /(search|list|query|count|lookup|tree|options|codes?|filter|preview|summary)(\b|[/?_-]|$)/i

export function isAllowedRequest(method: string, url: string) {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true
  if (m !== 'POST') return false
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    // 상대 경로면 그대로 본다
  }
  return READ_POST.test(path)
}

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

// shots.ts 배열 끝에 넣는다. 같은 id가 있으면 거절
export function appendShot(source: string, shot: ShotInput) {
  if (new RegExp(`id:\\s*['"]${shot.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(source)) {
    throw new Error(`shots.ts에 이미 있는 id: ${shot.id}`)
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
  authFile: string
  viewport?: Viewport
  headless?: boolean
}

export class StgSession {
  private browser?: Browser
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
    this.browser ??= await chromium.launch({ channel: 'chrome', headless: this.options.headless ?? true })
    this.context ??= await this.newContext()
    this.page = await this.context.newPage()
    return this.page
  }

  private async newContext() {
    const context = await this.browser!.newContext({
      storageState: this.options.authFile,
      viewport: this.viewport,
      deviceScaleFactor: 1,
      locale: 'en-US',
    })
    await context.route('**/*', (route) => {
      const request = route.request()
      if (isAllowedRequest(request.method(), request.url())) return route.continue()
      this.blocked.push(`${request.method()} ${request.url()}`)
      return route.abort('blockedbyclient')
    })
    return context
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
      throw new Error(`로그인 페이지로 이동했습니다(세션 만료). 앱의 캡처 화면에서 다시 로그인해야 합니다: ${page.url()}`)
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
  async saveShot(shot: ShotInput) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(shot.id)) throw new Error('shot id는 영문 소문자, 숫자, -만 쓸 수 있습니다')
    for (const step of shot.steps ?? []) {
      if ('click' in step && isBlockedLabel(step.click.name)) {
        throw new Error(`"${step.click.name}"은(는) 데이터를 바꿀 수 있는 버튼이라 캡처 단계에 넣을 수 없습니다`)
      }
    }
    const shotsFile = join(manualDir(this.options), 'shots.ts')
    const next = appendShot(readFileSync(shotsFile, 'utf8'), shot)

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
    await this.browser?.close().catch(() => {})
    this.browser = undefined
    this.context = undefined
    this.page = undefined
  }
}

