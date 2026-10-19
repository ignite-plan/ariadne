// 빌드된 앱(out/)을 띄워 기획자 흐름을 끝까지 따라간다. 제출(push)은 하지 않는다.
// usage: ARIADNE_E2E_TOKEN=$(gh auth token) pnpm app:e2e [--shots <dir>] [--app release/mac-arm64/Ariadne.app]
// --app을 주면 패키징된 앱(asar, unpack된 esbuild)을 검증한다. 단계는 smoke/ 아래 묶음별로 있다
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { deletePassword, GITHUB_TOKEN_SERVICE } from '../main/lib/keychain.ts'
import { fakeVoiceModel, launchApp, prepareUserData, startFakeBo, stepper } from './harness.ts'
import { captureAndVideo } from './smoke/capture-video.ts'
import { claude } from './smoke/claude.ts'
import type { Smoke } from './smoke/context.ts'
import { editor } from './smoke/editor.ts'
import { manuals } from './smoke/manuals.ts'
import { onboarding } from './smoke/onboarding.ts'
import { settings } from './smoke/settings.ts'

const { values } = parseArgs({ options: { shots: { type: 'string' }, repo: { type: 'string' }, app: { type: 'string' } } })
const token = process.env.ARIADNE_E2E_TOKEN
if (!token) throw new Error('ARIADNE_E2E_TOKEN이 필요합니다 (예: $(gh auth token))')

// 가짜 BO. shots.ts의 dealer-list 계열(ready: text=Total, clip: #root, Location 팝업)을 흉내 낸다
const bo = await startFakeBo((_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><body style="margin:0;font-family:sans-serif"><div id="root">
    <h1>Dealer Management</h1><p>Total 2</p><form class="Filter"><input placeholder="Search"></form>
    <button onclick="document.getElementById('p').hidden=false">Location</button>
    <div id="p" role="dialog" hidden style="padding:20px;background:#fde68a">Location Information</div></div></body>`)
})

const temp = mkdtempSync(join(tmpdir(), 'ariadne-e2e-'))
// 가짜 Claude Code 설정: 앱이 Atlassian MCP 설정을 여기서 옮겨 strict로 넘긴다 (가짜 claude mcp list의 서버 이름과 같다)
const claudeConfigDir = join(temp, 'claude-config')
mkdirSync(claudeConfigDir, { recursive: true })
writeFileSync(
  join(claudeConfigDir, '.claude.json'),
  JSON.stringify({ mcpServers: { 'mcp-atlassian-fake': { type: 'stdio', command: '/bin/true', args: [], env: { CONFLUENCE_URL: 'https://example.invalid' } } } }),
)
const userData = join(temp, 'user-data')
const workspace = join(temp, 'workspace')
// BO 로그인 세션이 있는 상태로 시작한다 (실제 MFA 대신 로그인 표식만. 가짜 BO는 인증이 없다)
prepareUserData(userData, { settings: { workspaceDir: workspace, repoUrl: values.repo ?? 'https://github.com/ignite-plan/ariadne' }, baseUrl: bo.baseUrl })
// 가짜 Claude 최신화는 이 파일이 생길 때까지 기다린다 (그동안 영상 만들기를 함께 돌린다)
const claudeHold = join(temp, 'claude-hold')
// 음성 모델 자리만 채운다. 동시 실행 단계는 내레이션을 끄고 만들어서 모델을 읽지 않는다
const models = join(temp, 'models')
fakeVoiceModel(models)
const shotsDir = values.shots ? resolve(values.shots) : undefined
if (shotsDir) mkdirSync(shotsDir, { recursive: true })

const app = await launchApp({
  appPath: values.app,
  env: {
    ARIADNE_USER_DATA: userData,
    ARIADNE_CAPTURE_BASE_URL: bo.baseUrl,
    // 가짜 Claude: LLM 없이 Ariadne MCP 도구를 실제로 부른다
    ARIADNE_CLAUDE_PATH: resolve('app/e2e/fake-claude.mjs'),
    // STG 기록 브라우저를 이 테스트가 조작한다
    ARIADNE_E2E_RECORD_PORT: '9339',
    ARIADNE_FAKE_CLAUDE_HOLD: claudeHold,
    CLAUDE_CONFIG_DIR: claudeConfigDir,
    ARIADNE_VIDEO_MODEL_DIR: models,
  },
})
const errors: string[] = []
const page = await app.firstWindow()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {})

const smoke: Smoke = {
  app,
  page,
  step: stepper({ page, shotsDir }),
  snap: async (name) => {
    if (!shotsDir) return
    await page.waitForTimeout(350) // 모달 페이드가 끝난 뒤 찍는다
    await page.screenshot({ path: join(shotsDir, `${name}.png`) })
  },
  toast: (text) => page.locator('.toast', { hasText: text }),
  token,
  workspace,
  userData,
  claudeHold,
}

try {
  await onboarding(smoke)
  await editor(smoke)
  await captureAndVideo(smoke)
  await manuals(smoke)
  await claude(smoke)
  await settings(smoke)

  assert.deepEqual(errors, [], errors.join('\n'))
  console.log('E2E 통과')
} finally {
  await app.close().catch(() => {})
  bo.close()
  // 설정 단계가 저장한 토큰 (로그인 키체인, account = 이 테스트의 앱 데이터 폴더)
  deletePassword({ service: GITHUB_TOKEN_SERVICE, account: userData })
  rmSync(temp, { recursive: true, force: true })
}
