// Claude가 STG 화면을 살펴볼 때 쓰는 브라우저. Claude는 브라우저를 직접 만지지 않고 이 서비스에 요청한다.
// 안전장치 두 겹: 저장/삭제류 버튼 클릭 거절, 쓰기 요청(PUT/PATCH/DELETE, 조회가 아닌 POST) 차단
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator, Page } from 'playwright'
import { captureDir } from '../../../src/core/capture.ts'
import { guardWrites, isBlockedLabel } from '../../../src/core/safety.ts'
import { clearSession, isSessionExpired, profileTab, type OpenTab, type StgTab } from '../../../src/core/session.ts'
import { Director } from '../../../src/core/video/director.ts'
import type { Scene } from '../../../src/core/video/scenario.ts'
import { runSteps } from '../../../src/core/video/steps.ts'
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

// 접근성 트리는 Claude 대화에 계속 쌓인다. 평소에는 짧게, 열린 대화상자가 있으면 그것만 준다
const MAX_SNAPSHOT = 4000
const MAX_SNAPSHOT_FULL = 12000

export interface OpenResult {
  url: string
  title: string
  // 접근성 트리 (YAML 비슷한 텍스트). UI 라벨을 그대로 옮길 때 쓴다
  snapshot: string
  // 화면 전체인지, 맨 위 대화상자만인지. 잘랐는지
  scope: 'page' | 'dialog'
  truncated: boolean
  screenshot: string
  blockedRequests: string[]
}

export interface DescribeOptions {
  // 화면 전체를 길게 (대화상자가 열려 있어도 전체)
  full?: boolean
}

// 여러 최신화 작업이 동시에 찍어도 스크린샷 파일 이름이 겹치지 않게 프로세스 전체에서 센다
let shotCounter = 0

export interface StgOptions extends ManualRef {
  baseUrl: string
  // 로그인 세션(유지되는 Chrome 프로필). 한 번에 브라우저 하나만 열 수 있다
  profileDir: string
  viewport?: Viewport
  headless?: boolean
  // 탭 여는 방법. 앱은 공유 Chrome의 탭을 넘긴다 (영상 만들기와 동시에 돈다). 기본은 프로필로 단독 실행
  openTab?: OpenTab
}

export class StgSession {
  private tab?: StgTab
  private page?: Page
  private blocked: string[] = []
  readonly baseUrl: string
  readonly viewport: Viewport

  constructor(private readonly options: StgOptions) {
    this.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`
    this.viewport = options.viewport ?? loadManual(options).capture?.viewport ?? DEFAULT_VIEWPORT
  }

  // 같은 브라우저에 탭을 하나 더 연다. 쓰기 차단은 탭마다 건다 (공유 Chrome의 다른 탭에 번지지 않게)
  private async newPage(page: Page) {
    const next = await page.context().newPage()
    await next.setViewportSize(this.viewport)
    await guardWrites(next, (request) => this.blocked.push(request))
    return next
  }

  private async ensurePage() {
    if (this.page && !this.page.isClosed()) return this.page
    if (this.tab) {
      this.page = await this.newPage(this.tab.page)
      return this.page
    }
    const open = this.options.openTab ?? profileTab(this.options.profileDir)
    const tab = await open({ headless: this.options.headless ?? true, viewport: this.viewport })
    try {
      await guardWrites(tab.page, (request) => this.blocked.push(request))
    } catch (error) {
      await tab.close()
      throw error
    }
    this.tab = tab
    this.page = tab.page
    return tab.page
  }

  private url(path: string) {
    if (/^https?:\/\//.test(path)) {
      if (new URL(path).origin !== new URL(this.baseUrl).origin) throw new Error(`STG 밖 주소는 열 수 없습니다: ${path}`)
      return path
    }
    return new URL(path.replace(/^\//, ''), this.baseUrl).href
  }

  private async describe(page: Page, { full = false }: DescribeOptions = {}): Promise<OpenResult> {
    await page.waitForLoadState('networkidle').catch(() => {})
    const dir = join(captureDir(this.options), 'draft')
    mkdirSync(dir, { recursive: true })
    const screenshot = join(dir, `view-${++shotCounter}.png`)
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    // 대화상자(팝업)가 열려 있으면 뒤 화면은 Claude가 이미 봤다. 맨 위 대화상자만 준다
    const dialog = full ? undefined : page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').last()
    const inDialog = dialog ? (await dialog.count().catch(() => 0)) > 0 : false
    let snapshot = await (inDialog ? dialog! : page.locator('body')).ariaSnapshot().catch(() => '')
    const max = full ? MAX_SNAPSHOT_FULL : MAX_SNAPSHOT
    const truncated = snapshot.length > max
    if (truncated) snapshot = `${snapshot.slice(0, max)}\n… (잘림. 전체는 full: true)`
    const blockedRequests = this.blocked
    this.blocked = []
    return { url: page.url(), title: await page.title(), snapshot, scope: inDialog ? 'dialog' : 'page', truncated, screenshot, blockedRequests }
  }

  async open(path: string, options?: DescribeOptions) {
    const page = await this.ensurePage()
    await page.goto(this.url(path))
    if (new URL(page.url()).origin !== new URL(this.baseUrl).origin) {
      // 앱이 '로그인 세션 있음'으로 잘못 보여 주지 않게 로그인 표식을 지운다
      clearSession(this.options.profileDir)
      throw new Error(`로그인 페이지로 이동했습니다(세션 만료). 앱에서 [다시 로그인]을 눌러 로그인해야 합니다: ${page.url()}`)
    }
    return this.describe(page, options)
  }

  private async target(role: Role, name: string, nth?: number): Promise<Locator> {
    const page = await this.ensurePage()
    const all = page.getByRole(role, { name })
    const count = await all.count()
    if (!count) throw new Error(`화면에 ${role} "${name}"이(가) 없습니다`)
    return nth === undefined ? all.first() : all.nth(nth)
  }

  // 가이드 영상의 앞 장면들을 이 브라우저에서 재생해, 다음 장면이 시작되는 화면을 연다 (Claude가 장면 하나를 채울 때)
  async replay(scenes: Scene[], mutates = false) {
    const page = await this.ensurePage()
    page.setDefaultTimeout(15_000)
    const v = new Director(page, { baseUrl: this.baseUrl, mutates, pace: 0, overlay: false })
    try {
      await v.goto('/')
      for (const [index, scene] of scenes.entries()) await runSteps(v, scene.steps, index)
    } catch (error) {
      if (isSessionExpired(error)) clearSession(this.options.profileDir)
      throw error
    }
    return this.describe(page)
  }

  async click(role: Role, name: string, nth?: number, options?: DescribeOptions) {
    if (isBlockedLabel(name)) throw new Error(`"${name}"은(는) 데이터를 바꿀 수 있는 버튼이라 누르지 않습니다`)
    const locator = await this.target(role, name, nth)
    // 이름이 비슷한 다른 버튼일 수 있어 실제 접근성 이름도 다시 확인한다
    const actual = (await locator.getAttribute('aria-label')) ?? (await locator.innerText().catch(() => name))
    if (isBlockedLabel(actual)) throw new Error(`"${actual}"은(는) 데이터를 바꿀 수 있는 버튼이라 누르지 않습니다`)
    await locator.click()
    return this.describe(await this.ensurePage(), options)
  }

  async fill(label: string, value: string, options?: DescribeOptions) {
    const page = await this.ensurePage()
    await page.getByLabel(label).first().fill(value)
    return this.describe(page, options)
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
    // 형식 오류·중복은 찍기 전에 알린다. 실제 쓰기는 찍은 뒤 다시 읽어서 (여러 화면 작업이 동시에 shots.ts를 고친다)
    appendShot(readFileSync(shotsFile, 'utf8'), shot, replace)

    const page = await this.newPage(await this.ensurePage())
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
      writeFileSync(shotsFile, appendShot(readFileSync(shotsFile, 'utf8'), shot, replace))
      return { image: `images/${shot.id}.png`, file }
    } finally {
      await page.close()
    }
  }

  async close() {
    const tab = this.tab
    this.tab = undefined
    if (this.page && this.page !== tab?.page) await this.page.close().catch(() => {})
    this.page = undefined
    await tab?.close()
  }
}

