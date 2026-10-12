import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { envChecks, type EnvFacts } from '../env-check.ts'

const facts = (patch: Partial<EnvFacts> = {}): EnvFacts => ({
  auth: { hasToken: true, user: { login: 'kim', name: 'Kim', id: 1, avatarUrl: '' } },
  workspace: { dir: '/ws', cloned: true },
  pandoc: { path: '/data/tools/pandoc/bin/pandoc', version: 'pandoc 3.6' },
  toolsDir: '/data/tools',
  chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  claude: { version: '2.1.0 (Claude Code)', managed: true },
  claudeOverride: false,
  claudeVersion: '2.1.0',
  ffmpeg: { path: '/app/ffmpeg', bundled: true },
  voice: { ready: true, bytes: 92_000_000 },
  session: { exists: true, savedAt: 0 },
  now: 5 * 60000,
  ...patch,
})

const byId = (checks: ReturnType<typeof envChecks>) => Object.fromEntries(checks.map((c) => [c.id, c]))

describe('환경 점검', () => {
  it('모두 갖춰지면 전부 통과, 설치 버튼 없음', () => {
    const checks = envChecks(facts())
    assert.deepEqual(
      checks.map((c) => c.id),
      ['token', 'workspace', 'pandoc', 'chrome', 'claude', 'ffmpeg', 'voice', 'session'],
    )
    assert.ok(checks.every((c) => c.ok && !c.install))
    const c = byId(checks)
    assert.equal(c.token.detail, 'Kim (@kim)')
    assert.match(c.pandoc.detail, /앱이 설치함/)
    assert.equal(c.voice.detail, 'Kokoro · 92MB')
    assert.match(c.session.detail, /^5분 전 로그인/)
  })

  it('토큰 오류와 없는 도구는 이유와 설치 방법을 알려 준다', () => {
    const c = byId(
      envChecks(
        facts({
          auth: { hasToken: true, error: 'Bad credentials' },
          pandoc: null,
          chrome: null,
          claude: null,
          ffmpeg: null,
          voice: { ready: false, bytes: 0 },
          session: { exists: false },
        }),
      ),
    )
    assert.equal(c.token.ok, false)
    assert.equal(c.token.detail, 'Bad credentials')
    assert.equal(c.pandoc.install, 'pandoc')
    assert.equal(c.chrome.link?.url, 'https://www.google.com/chrome/')
    assert.equal(c.claude.install, 'claude')
    assert.equal(c.session.ok, false)
    assert.equal(byId(envChecks(facts({ auth: { hasToken: false } }))).token.detail, '설정에서 GitHub 토큰을 입력하세요')
  })

  it('내 PC의 claude는 앱 전용 설치를 권하고, 경로를 직접 지정했으면 통과', () => {
    const pc = { version: '2.0.0', managed: false }
    const own = byId(envChecks(facts({ claude: pc }))).claude
    assert.equal(own.ok, false)
    assert.equal(own.install, 'claude')
    const pinned = byId(envChecks(facts({ claude: pc, claudeOverride: true }))).claude
    assert.equal(pinned.ok, true)
    assert.equal(pinned.install, undefined)
  })
})
