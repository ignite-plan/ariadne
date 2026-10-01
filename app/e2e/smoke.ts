// 빌드된 앱(out/)을 띄워 기획자 흐름을 끝까지 따라간다. 제출(push)은 하지 않는다.
// usage: ARIADNE_E2E_TOKEN=$(gh auth token) pnpm app:e2e [--shots <dir>] [--app release/mac-arm64/Ariadne.app]
// --app을 주면 패키징된 앱(asar, unpack된 esbuild)을 검증한다
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { _electron as electron, type Page } from 'playwright'

const { values } = parseArgs({ options: { shots: { type: 'string' }, repo: { type: 'string' }, app: { type: 'string' } } })
const token = process.env.ARIADNE_E2E_TOKEN
if (!token) throw new Error('ARIADNE_E2E_TOKEN이 필요합니다 (예: $(gh auth token))')

// 가짜 BO. shots.ts의 dealer-list 계열(ready: text=Total, clip: #root, Location 팝업)을 흉내 낸다
const bo = http.createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><body style="margin:0;font-family:sans-serif"><div id="root">
    <h1>Dealer Management</h1><p>Total 2</p><form class="Filter"><input placeholder="Search"></form>
    <button onclick="document.getElementById('p').hidden=false">Location</button>
    <div id="p" role="dialog" hidden style="padding:20px;background:#fde68a">Location Information</div></div></body>`)
})
await new Promise<void>((done) => bo.listen(0, '127.0.0.1', done))
const boBaseUrl = `http://127.0.0.1:${(bo.address() as AddressInfo).port}/ca/admin`

const temp = mkdtempSync(join(tmpdir(), 'ariadne-e2e-'))
const userData = join(temp, 'user-data')
const workspace = join(temp, 'workspace')
mkdirSync(join(userData, 'auth'), { recursive: true })
writeFileSync(
  join(userData, 'settings.json'),
  JSON.stringify({ workspaceDir: workspace, repoUrl: values.repo ?? 'https://github.com/ignite-plan/ariadne', boBaseUrl }),
)
// BO 로그인 세션이 있는 상태로 시작한다 (실제 MFA 대신)
writeFileSync(join(userData, 'auth', 'bo.json'), JSON.stringify({ cookies: [], origins: [] }))
const shotsDir = values.shots ? resolve(values.shots) : undefined
if (shotsDir) mkdirSync(shotsDir, { recursive: true })

const app = await electron.launch({
  ...(values.app
    ? { executablePath: join(resolve(values.app), 'Contents/MacOS/Ariadne'), args: [] }
    : { args: [resolve('out/main/index.js')] }),
  env: { ...process.env, ARIADNE_USER_DATA: userData },
})
const errors: string[] = []
const page = await app.firstWindow()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {})

const step = async (name: string, fn: () => Promise<void>) => {
  const started = Date.now()
  try {
    await fn()
    console.log(`✓ ${name} (${Date.now() - started}ms)`)
  } catch (error) {
    console.log(`✗ ${name}`)
    if (shotsDir) await page.screenshot({ path: join(shotsDir, `fail-${name.replace(/\W+/g, '-')}.png`) })
    throw error
  }
}
const snap = async (name: string) => {
  if (!shotsDir) return
  await page.waitForTimeout(350) // 모달 페이드가 끝난 뒤 찍는다
  await page.screenshot({ path: join(shotsDir, `${name}.png`) })
}
const toast = (p: Page, text: string | RegExp) => p.locator('.toast', { hasText: text })

try {
  await step('온보딩: 토큰 연결', async () => {
    await page.getByRole('heading', { name: 'GitHub 연결' }).waitFor()
    await snap('01-token')
    await page.getByPlaceholder('github_pat_…').fill(token)
    await page.getByRole('button', { name: '연결' }).click()
    await page.getByRole('heading', { name: '매뉴얼 내려받기' }).waitFor({ timeout: 30000 })
  })

  await step('온보딩: 리포 내려받기 (net.fetch)', async () => {
    await snap('02-workspace')
    await page.getByRole('button', { name: '내려받기' }).click()
    await page.getByRole('heading', { name: '환경 점검' }).waitFor({ timeout: 180000 })
    assert.ok(existsSync(join(workspace, 'manuals/bo/manual.yaml')))
  })

  await step('온보딩: 환경 점검', async () => {
    await page.locator('.env-list li').first().waitFor()
    await snap('03-env')
    const ok = await page.locator('.env-list li.ok').count()
    assert.ok(ok >= 3, `통과 항목 ${ok}개`)
    await page.getByRole('button', { name: /시작하기/ }).click()
  })

  await step('편집 화면: 목차와 첫 화면', async () => {
    await page.locator('.toc-section').first().waitFor({ timeout: 30000 })
    assert.ok((await page.locator('.toc-chapter').count()) >= 10)
    await page.locator('.cm-content').waitFor()
    await page.locator('.sync-badge.synced').waitFor({ timeout: 30000 })
  })

  await step('Dealer List View 열기 + 미리보기 이미지', async () => {
    await page.locator('.toc-section', { hasText: 'Dealer List View' }).click()
    await page.locator('.breadcrumb', { hasText: 'Dealer List View' }).waitFor()
    await page.locator('.page h2', { hasText: 'Dealer List View' }).waitFor({ timeout: 15000 })
    const img = page.locator('.page img').first()
    await img.waitFor()
    assert.match((await img.getAttribute('src')) ?? '', /^ariadne:\/\/ws\/manuals\/bo\/images\//)
    await page.waitForFunction(() => {
      const el = document.querySelector('.page img') as HTMLImageElement | null
      return Boolean(el && el.complete && el.naturalWidth > 0)
    })
    assert.ok((await page.locator('.cm-size-chip').count()) > 0, '크기 칩')
    await snap('04-workbench')
  })

  const sectionFile = join(workspace, 'manuals/bo/02-dealer-management/01-dealer-list-view.md')
  const original = readFileSync(sectionFile, 'utf8')

  await step('편집 → 자동 저장 → 변경 탭', async () => {
    await page.locator('.cm-content').click()
    await page.keyboard.press('Meta+ArrowDown')
    await page.keyboard.type('\n- **E2E Label**: added by smoke test.')
    await page.locator('.save-state.saved').waitFor({ timeout: 5000 })
    await page.waitForFunction(() => document.querySelector('.save-state')?.textContent === '저장됨')
    assert.match(readFileSync(sectionFile, 'utf8'), /E2E Label\*\*: added by smoke test\./)
    await page.locator('.page strong', { hasText: 'E2E Label' }).waitFor({ timeout: 10000 })
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.locator('.change-item', { hasText: 'Dealer List View' }).waitFor({ timeout: 10000 })
    await snap('05-changes')
  })

  await step('제출 다이얼로그 (제출하지 않음)', async () => {
    await page.getByRole('button', { name: /제출/ }).first().click()
    await page.getByRole('dialog').getByText('변경사항 제출').waitFor()
    const message = await page.getByRole('dialog').locator('textarea').inputValue()
    assert.match(message, /Dealer List View/)
    await snap('06-submit')
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  })

  await step('되돌리기', async () => {
    await page.locator('.change-item', { hasText: 'Dealer List View' }).getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await toast(page, '되돌렸습니다').waitFor()
    assert.equal(readFileSync(sectionFile, 'utf8'), original)
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor()
  })

  await step('이미지 다이얼로그', async () => {
    await page.getByRole('tab', { name: '목차' }).click()
    await page.getByTitle('이미지 넣기').click()
    await page.locator('.image-tile').first().waitFor()
    assert.ok((await page.locator('.image-tile').count()) > 200)
    await page.getByPlaceholder('이미지 id 검색').fill('dealer-list')
    await snap('07-image')
    await page.keyboard.press('Escape')
  })

  await step('새 화면 추가 → 삭제', async () => {
    await page.getByRole('button', { name: '새 화면' }).click()
    await page.getByPlaceholder('Enrollment Request List').fill('E2E Smoke Screen')
    await page.getByRole('dialog').getByRole('button', { name: '추가' }).click()
    await page.locator('.breadcrumb', { hasText: 'E2E Smoke Screen' }).waitFor()
    await page.locator('.page .todo').first().waitFor()
    const item = page.locator('.toc-chapter li', { hasText: 'E2E Smoke Screen' })
    await item.hover()
    await item.getByTitle('화면 삭제').click()
    await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
    await item.waitFor({ state: 'detached' })
    await page.getByRole('tab', { name: /변경/ }).click()
    // manual.yaml을 원래대로 쓰므로 남는 변경이 없어야 한다
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 10000 })
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('Word 만들기 (지금 장)', async () => {
    await page.locator('.toc-section', { hasText: 'Dealer List View' }).click()
    await page.getByRole('button', { name: 'Word 만들기' }).click()
    await page.getByRole('button', { name: /지금 장만/ }).click()
    await toast(page, 'Word 문서를 만들었습니다').waitFor({ timeout: 60000 })
    const docx = readdirSync(join(workspace, 'dist')).filter((f) => f.endsWith('_ch2.docx'))
    assert.equal(docx.length, 1)
  })

  await step('캡처: 가짜 BO 캡처 → 비교 → 1장 반영 → 되돌리기', async () => {
    await page.getByRole('button', { name: '캡처' }).click()
    await page.getByRole('heading', { name: '화면 캡처' }).waitFor()
    await page.locator('.shot', { hasText: 'dealer-list' }).first().waitFor({ timeout: 15000 })
    assert.ok(await page.locator('.shot.disabled', { hasText: 'dealer-list-view-img-1' }).count())
    await page.locator('.session.ok').waitFor()
    await page.getByRole('button', { name: '3장 캡처' }).click()
    await page.locator('.report-summary').waitFor({ timeout: 90000 })
    const changed = await page.locator('.compare').count()
    assert.equal(changed, 3, `바뀐 이미지 ${changed}장`)
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.compare img')].every((i) => (i as HTMLImageElement).naturalWidth > 0),
    )
    await snap('08-capture')
    // location-popup만 남기고 반영
    for (const id of ['dealer-list', 'dealer-list-search']) {
      await page.locator('.compare', { has: page.locator('b', { hasText: new RegExp(`^${id}$`) }) }).locator('input').uncheck()
    }
    await page.getByRole('button', { name: '선택한 1장 반영' }).click()
    await toast(page, '이미지 1장을 반영했습니다').waitFor()
    await page.getByRole('button', { name: '닫기' }).first().click()
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.locator('.change-item', { hasText: 'location-popup' }).waitFor({ timeout: 10000 })
    assert.equal(await page.locator('.change-item').count(), 1)
    await page.locator('.change-item', { hasText: 'location-popup' }).getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 10000 })
  })

  await step('설정: 환경 점검, 정보', async () => {
    await page.getByTitle('설정').click()
    const nav = (name: string) => page.locator('.settings-nav button', { hasText: name })
    await nav('환경 점검').click()
    await page.locator('.env-list li').first().waitFor()
    await nav('변경 영향').click()
    await page.getByText('dealerhub-web 경로 지정하기').waitFor()
    await nav('정보').click()
    await page.getByText(/버전 \d/).waitFor()
    await snap('09-settings')
    await page.keyboard.press('Escape')
  })

  assert.deepEqual(errors, [], errors.join('\n'))
  console.log('E2E 통과')
} finally {
  await app.close().catch(() => {})
  bo.close()
  rmSync(temp, { recursive: true, force: true })
}
