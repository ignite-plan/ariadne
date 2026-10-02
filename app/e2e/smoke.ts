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
  JSON.stringify({ workspaceDir: workspace, repoUrl: values.repo ?? 'https://github.com/ignite-plan/ariadne' }),
)
// BO 로그인 세션이 있는 상태로 시작한다 (실제 MFA 대신)
writeFileSync(join(userData, 'auth', 'bo.json'), JSON.stringify({ cookies: [], origins: [] }))
const shotsDir = values.shots ? resolve(values.shots) : undefined
if (shotsDir) mkdirSync(shotsDir, { recursive: true })

const app = await electron.launch({
  ...(values.app
    ? { executablePath: join(resolve(values.app), 'Contents/MacOS/Ariadne'), args: [] }
    : { args: [resolve('out/main/index.js')] }),
  env: {
    ...process.env,
    ARIADNE_USER_DATA: userData,
    ARIADNE_CAPTURE_BASE_URL: boBaseUrl,
    // 가짜 Claude: LLM 없이 Ariadne MCP 도구를 실제로 부른다
    ARIADNE_CLAUDE_PATH: resolve('app/e2e/fake-claude.mjs'),
  },
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
    await page.getByRole('dialog').getByRole('button', { name: '빈 화면 직접 쓰기' }).click()
    await page.getByRole('dialog').locator('select').first().selectOption({ index: 15 }) // 마지막 장
    await page.getByPlaceholder('Menu List View').fill('E2E Smoke Screen')
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
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.locator('.change-item', { hasText: 'location-popup' }).waitFor({ timeout: 10000 })
    assert.equal(await page.locator('.change-item').count(), 1)
    await page.locator('.change-item', { hasText: 'location-popup' }).getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 10000 })
  })

  await step('새 매뉴얼 가져오기 (Word → FO) → 전환 → 되돌리기', async () => {
    // 파일 대화상자 대신 리포의 BO 원본을 고르게 한다
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (() => Promise.resolve({ canceled: false, filePaths: [file] })) as typeof dialog.showOpenDialog
    }, resolve('manuals/bo/source/Hyundai.docx'))
    await page.locator('.manual-switch').click()
    await page.getByRole('button', { name: /새 매뉴얼 가져오기/ }).click()
    await page.getByRole('button', { name: 'Word 파일 고르기…' }).click()
    await page.locator('.import-stats', { hasText: '15장' }).waitFor({ timeout: 60000 })
    await page.locator('.import-stats', { hasText: '이미지 289장' }).waitFor()
    const title = page.locator('.import-form input').first()
    assert.equal(await title.inputValue(), 'Dealers Admin User Manual')
    await title.fill('Dealers FO User Manual E2E')
    assert.equal(await page.locator('.import-form input').nth(1).inputValue(), 'fo-e2e')
    assert.equal(await page.getByPlaceholder('https://stg-…').inputValue(), 'https://stg-dealers.hyundai-corp.io')
    await snap('10-import')
    await page.getByRole('dialog').getByRole('button', { name: '가져오기' }).click()
    await toast(page, '새 매뉴얼을 가져왔습니다').waitFor({ timeout: 120000 })
    await page.locator('.manual-switch', { hasText: 'Dealers FO User Manual E2E' }).waitFor()
    await page.getByRole('tab', { name: '목차' }).click()
    assert.equal(await page.locator('.toc-chapter').count(), 15)
    // 미리보기가 새 매뉴얼 첫 화면으로 바뀐다
    await page.locator('.page', { hasText: 'While connected to the VPN' }).waitFor({ timeout: 15000 })
    await page.locator('.page img').first().waitFor({ timeout: 15000 })
    assert.ok(existsSync(join(workspace, 'manuals/fo-e2e/source/Hyundai.docx')))
    assert.match(readFileSync(join(workspace, 'manuals/fo-e2e/manual.yaml'), 'utf8'), /baseUrl: https:\/\/stg-dealers\.hyundai-corp\.io\n/)
    await snap('11-imported')

    await page.getByTitle('설정').click()
    await page.locator('.settings-nav button', { hasText: '매뉴얼' }).click()
    await page.getByPlaceholder('https://stg-…').waitFor()
    assert.equal(await page.getByPlaceholder('https://stg-…').inputValue(), 'https://stg-dealers.hyundai-corp.io')
    await page.keyboard.press('Escape')

    await page.locator('.manual-switch').click()
    await page.locator('.menu button', { hasText: 'Dealers Admin User Manual' }).click()
    await page.locator('.manual-switch', { hasText: 'Dealers Admin User Manual' }).waitFor()
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    assert.ok(!existsSync(join(workspace, 'manuals/fo-e2e/manual.yaml')))
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('목차 끌어 놓기로 장 순서 바꾸기 → 되돌리기', async () => {
    const titles = () => page.locator('.toc-chapter-title .ellipsis').allTextContents()
    const before = await titles()
    await page.locator('.toc-chapter-row', { hasText: 'Job Management' }).dragTo(page.locator('.toc-chapter-row', { hasText: 'Dealer Management' }))
    await page.waitForFunction(() => document.querySelectorAll('.toc-chapter-title .ellipsis')[1]?.textContent === 'Job Management')
    const after = await titles()
    assert.equal(after[1], 'Job Management')
    assert.equal(after[2], before[1])
    assert.ok(existsSync(join(workspace, 'manuals/bo/02-job-management')))
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    await page.getByRole('tab', { name: '목차' }).click()
    await page.waitForFunction(() => document.querySelectorAll('.toc-chapter-title .ellipsis')[1]?.textContent === 'Dealer Management')
  })

  await step('Claude로 초안 만들기 (가짜 claude → Ariadne MCP → STG)', async () => {
    await page.getByRole('button', { name: '새 화면' }).click()
    await page.getByPlaceholder('Menu Management').first().fill('Menu Management E2E')
    await page.getByRole('dialog').locator('select').nth(1).selectOption({ index: 8 }) // 8장 (기존 8장 앞)
    await page.getByRole('dialog').getByRole('button', { name: '다음' }).click()
    await page.getByRole('heading', { name: 'Claude로 초안 만들기' }).waitFor()
    await page.locator('.check-row.ok', { hasText: 'Claude Code' }).waitFor({ timeout: 30000 })
    await page.locator('.check-row.ok', { hasText: 'Confluence' }).waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: '초안 만들기 시작' }).click()
    await page.locator('.draft-summary', { hasText: '초안을 만들었습니다' }).waitFor({ timeout: 90000 })
    // 저장/삭제 버튼 거절이 로그에 보인다
    await page.locator('.log li.log-tool.failed', { hasText: 'STG 누르기: Delete' }).waitFor()
    await page.locator('.log li', { hasText: '캡처 저장: menu-e2e-list' }).waitFor()
    await snap('12-draft')
    assert.ok(existsSync(join(workspace, 'manuals/bo/08-menu-management-e2e/01-menu-list-view.md')))
    assert.ok(existsSync(join(workspace, 'manuals/bo/09-menu-management/00-intro.md')), '기존 8장이 9장으로 밀린다')
    assert.ok(existsSync(join(workspace, 'manuals/bo/images/menu-e2e-list.png')))
    assert.match(readFileSync(join(workspace, 'manuals/bo/shots.ts'), 'utf8'), /id: 'menu-e2e-list'/)
    await page.locator('.draft-summary button.link', { hasText: '08-menu-management-e2e/01-menu-list-view.md' }).click()
    await page.locator('.breadcrumb', { hasText: 'Menu List View' }).waitFor()
    await page.locator('.page .todo', { hasText: '최대 길이' }).waitFor({ timeout: 15000 })
    await page.getByRole('tab', { name: /TODO/ }).click()
    await page.locator('.todo-item', { hasText: '최대 길이' }).waitFor()

    await page.getByRole('tab', { name: /변경/ }).click()
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    assert.ok(existsSync(join(workspace, 'manuals/bo/08-menu-management/00-intro.md')), '되돌리면 8장이 제자리')
    await page.getByRole('tab', { name: '목차' }).click()
  })

  await step('Claude로 최신화 (기존 화면) → 변경 보기 → 되돌리기', async () => {
    await page.locator('.toc-section', { hasText: 'Dealer List View' }).click()
    await page.locator('.breadcrumb', { hasText: 'Dealer List View' }).waitFor()
    await page.locator('.doc-header').getByRole('button', { name: /Claude로 최신화/ }).click()
    await page.getByRole('heading', { name: 'Claude로 최신화' }).waitFor()
    await page.locator('.draft-input', { hasText: '02-dealer-management/01-dealer-list-view.md' }).waitFor()
    await page.getByRole('button', { name: '최신화 시작' }).click()
    await page.locator('.draft-summary', { hasText: '최신화했습니다' }).waitFor({ timeout: 90000 })
    await page.locator('.log li', { hasText: '캡처 저장: dealer-list' }).waitFor()
    // 기존 이미지(정의 있음)를 같은 id로 다시 찍었다
    assert.equal((readFileSync(join(workspace, 'manuals/bo/shots.ts'), 'utf8').match(/id: 'dealer-list',/g) ?? []).length, 1)
    await page.locator('.draft-summary').getByRole('button', { name: /변경 보기/ }).click()
    await page.locator('.diff-row.del', { hasText: 'This screen provides a list of all registered dealers.' }).waitFor()
    await page.locator('.diff-row.add', { hasText: 'This screen lists all registered dealers and their status.' }).waitFor()
    await snap('13-refresh-diff')
    await page.keyboard.press('Escape')
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    // 열려 있던 화면은 Claude가 고친 내용으로 다시 읽힌다
    await page.locator('.cm-content', { hasText: 'lists all registered dealers and their status' }).waitFor({ timeout: 10000 })
    // 최신화 뒤에는 변경 탭으로 간다
    await page.locator('.change-item', { hasText: 'Dealer List View' }).getByTitle('변경 보기').click()
    await page.locator('.diff-row.add', { hasText: 'their status' }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '모두 되돌리기' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 30000 })
    await page.getByRole('tab', { name: '목차' }).click()
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
