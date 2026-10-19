import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { claudeEnv, DEFAULT_CLAUDE_MODEL, explainFailure, isBlockingFailure, keySource, resolveAuth, upgradeClaudeModel } from '../claude-auth.ts'
import { findClaude, runClaude, shellLookup } from '../claude.ts'

const base = {
  HOME: '/Users/kim',
  ANTHROPIC_API_KEY: 'from-app-env',
  ANTHROPIC_AUTH_TOKEN: 'tok',
  ANTHROPIC_BASE_URL: 'https://gateway',
  CLAUDECODE: '1',
  CLAUDE_CODE_SESSION_ID: 'x',
  CLAUDE_CODE_ENTRYPOINT: 'cli',
  CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/s',
  CLAUDE_CODE_USE_BEDROCK: '1',
  CLAUDE_PID: '1',
}

describe('Claude 인증 환경', () => {
  it('세션 표식은 어느 방식이든 지운다 (사용자 설정은 남긴다)', () => {
    for (const auth of ['apiKey', 'login'] as const) {
      const env = claudeEnv(base, { path: '/bin', auth })
      for (const k of ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_PID']) {
        assert.equal(env[k], undefined, `${auth} ${k}`)
      }
      assert.equal(env.CLAUDE_CODE_USE_BEDROCK, '1')
      assert.equal(env.PATH, '/bin')
    }
  })

  it('apiKey: 키를 넘기고, 로그인 셸(~/.zshrc) 값을 우선한다', () => {
    assert.equal(claudeEnv(base, { path: '/bin', auth: 'apiKey' }).ANTHROPIC_API_KEY, 'from-app-env')
    const env = claudeEnv(base, { path: '/bin', auth: 'apiKey', shellVars: { ANTHROPIC_API_KEY: 'from-zshrc' } })
    assert.equal(env.ANTHROPIC_API_KEY, 'from-zshrc')
    assert.equal(env.ANTHROPIC_BASE_URL, 'https://gateway')
    // Finder에서 띄워 앱 환경에 키가 없어도 셸 값으로 채운다
    assert.equal(claudeEnv({ HOME: '/h' }, { path: '/bin', auth: 'apiKey', shellVars: { ANTHROPIC_API_KEY: 'k' } }).ANTHROPIC_API_KEY, 'k')
  })

  it('모델(ANTHROPIC_MODEL)은 인증 방식과 상관없이 로그인 셸 값을 넘긴다', () => {
    for (const auth of ['apiKey', 'login'] as const) {
      const env = claudeEnv(base, { path: '/bin', auth, shellVars: { ANTHROPIC_MODEL: 'claude-sonnet-5' } })
      assert.equal(env.ANTHROPIC_MODEL, 'claude-sonnet-5', auth)
    }
    assert.equal(claudeEnv({ HOME: '/h' }, { path: '/bin', auth: 'apiKey' }).ANTHROPIC_MODEL, undefined)
  })

  it('login: 키 환경변수를 넘기지 않는다', () => {
    const env = claudeEnv(base, { path: '/bin', auth: 'login', shellVars: { ANTHROPIC_API_KEY: 'from-zshrc' } })
    assert.equal(env.ANTHROPIC_API_KEY, undefined)
    assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined)
    assert.equal(env.ANTHROPIC_BASE_URL, undefined)
  })

  it('키를 찾은 곳 (값은 돌려주지 않는다)', () => {
    assert.equal(keySource(base, { ANTHROPIC_API_KEY: 'x' }), 'shell')
    assert.equal(keySource(base, {}), 'env')
    assert.equal(keySource({}, {}), null)
  })

  it('실패를 방식에 맞는 할 일로', () => {
    const expired = 'Failed to authenticate. API Error: 401 Api key is expired'
    // AUTH_TOKEN이 있으면 그것으로 인증하므로 그 변수를 짚는다 (값은 끝 4자리만)
    const withToken = explainFailure(expired, 'apiKey', {
      ANTHROPIC_API_KEY: 'key-good-742a',
      ANTHROPIC_AUTH_TOKEN: 'token-old-6a31',
      ANTHROPIC_BASE_URL: 'https://h-chat-api.autoever.com/claude-code/v2',
    })
    assert.match(withToken, /^ANTHROPIC_AUTH_TOKEN\(…6a31\)로 h-chat-api\.autoever\.com에 인증하지 못했습니다/)
    assert.match(withToken, /ANTHROPIC_API_KEY보다 먼저 쓰입니다\. ~\/\.zshrc에서 ANTHROPIC_AUTH_TOKEN을 지우거나/)
    assert.ok(!withToken.includes('key-good') && !withToken.includes('token-old'))
    const keyOnly = explainFailure(expired, 'apiKey', { ANTHROPIC_API_KEY: 'key-old-1234' })
    assert.match(keyOnly, /^ANTHROPIC_API_KEY\(…1234\)로 인증하지 못했습니다.*~\/\.zshrc의 ANTHROPIC_API_KEY를 유효한 값으로/)
    // 게이트웨이가 모델을 받지 않으면 ANTHROPIC_MODEL을 안내한다
    const model = explainFailure('API Error: 500 Something went wrongInvalid model: claude-sonnet-4-6. This is a server-side issue', 'apiKey', {
      ANTHROPIC_BASE_URL: 'https://h-chat-api.autoever.com/claude-code/v2',
    })
    assert.match(model, /^h-chat-api\.autoever\.com가 claude-sonnet-4-6 모델을 받지 않습니다/)
    assert.match(model, /ANTHROPIC_MODEL이 없어.*export ANTHROPIC_MODEL=/)
    assert.match(explainFailure('Invalid API key · Fix external API key', 'login'), /claude\.ai 로그인으로 인증하지 못했습니다/)
    assert.match(explainFailure('Not logged in · Please run /login', 'login'), /로그인되어 있지 않습니다/)
    assert.equal(explainFailure('다른 오류', 'apiKey'), '다른 오류')
  })
})

describe('로그인 셸과 실행 (실제 zsh, 가짜 claude)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ariadne-auth-'))
  const saved = { ZDOTDIR: process.env.ZDOTDIR, SHELL: process.env.SHELL, KEY: process.env.ANTHROPIC_API_KEY }
  after(() => {
    process.env.ZDOTDIR = saved.ZDOTDIR
    process.env.SHELL = saved.SHELL
    if (saved.KEY === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = saved.KEY
    rmSync(dir, { recursive: true, force: true })
  })
  writeFileSync(join(dir, '.zshrc'), 'export ANTHROPIC_API_KEY="zshrc-key"\nexport ANTHROPIC_MODEL="claude-sonnet-5"\n')
  const script = join(dir, 'claude')
  writeFileSync(
    script,
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo "9.9.9 (Claude Code)"; exit 0; fi
printf '%s' "\${ANTHROPIC_API_KEY-<none>}" > ${JSON.stringify(join(dir, 'key.txt'))}
echo '{"type":"result","subtype":"success","is_error":false,"result":"ok","permission_denials":[]}'
`,
  )
  chmodSync(script, 0o755)

  it('로그인 셸에서 ~/.zshrc의 키를 읽는다', async () => {
    process.env.SHELL = '/bin/zsh'
    process.env.ZDOTDIR = dir
    const shell = await shellLookup()
    assert.equal(shell.vars.ANTHROPIC_API_KEY, 'zshrc-key')
    assert.equal(shell.vars.ANTHROPIC_MODEL, 'claude-sonnet-5')
  })

  it('apiKey면 셸 키로, login이면 키 없이 claude를 실행한다', async () => {
    process.env.SHELL = '/bin/zsh'
    process.env.ZDOTDIR = dir
    process.env.ANTHROPIC_API_KEY = 'stale-app-env'
    for (const [auth, expected] of [['apiKey', 'zshrc-key'], ['login', '<none>']] as const) {
      const cli = (await findClaude(script, true, auth))!
      assert.equal(cli.keySource, auth === 'apiKey' ? 'shell' : null)
      await runClaude({ cli, cwd: dir, prompt: 'x', allowedTools: [], mcpConfigFile: '/tmp/x', onEvent: () => {} }).done
      assert.equal(readFileSync(join(dir, 'key.txt'), 'utf8'), expected, auth)
    }
  })

  it('자동 요약 반복(thrashing)은 한국어로', () => {
    const raw = 'Autocompact is thrashing: the context refilled to the limit within 3 turns of the previous compact, 3 times in a row.'
    assert.match(explainFailure(raw, 'apiKey', {}), /대화가 너무 길어져 자동 요약을 반복하다 멈췄습니다/)
  })

  it('게이트웨이가 낮은 Claude Code 버전을 거절하면 앱 전용 설치(또는 앱 업데이트)를 안내한다', () => {
    const raw = [
      'API Error: 400 ',
      '',
      '너무 낮은 버전의 Claude Code를 사용하고 있습니다. (현재 버전: 2.1.123, 권장 버전: 2.1.292)',
      '해결 방법: Claude Code를 최신 권장 버전으로 업데이트한 뒤 다시 시도해 주세요. npm install -g @anthropic-ai/claude-code@2.1.292',
      '',
      'Your Claude Code version is too old. (current: 2.1.123, recommended: 2.1.292)',
    ].join('\n')
    const env = { ANTHROPIC_BASE_URL: 'https://h-chat-api.autoever.com/claude-code/v2' }
    const pc = explainFailure(raw, 'apiKey', env, { version: '2.1.123 (Claude Code)', managed: false })
    assert.equal(
      pc,
      'h-chat-api.autoever.com가 너무 낮은 버전의 Claude Code라며 거절했습니다 (현재 2.1.123, 권장 2.1.292). 지금은 내 PC에 설치된 claude를 쓰고 있습니다. 설정 → 환경 점검 → Claude Code에서 [앱 전용으로 설치]를 누른 뒤 다시 시도하세요',
    )
    assert.match(explainFailure('Your Claude Code version is too old.', 'apiKey', {}, { version: '2.1.278 (Claude Code)', managed: true }), /현재 2\.1\.278\)\. 앱 전용 Claude Code가 게이트웨이 기준보다 낮습니다\. 앱을 새 버전으로 업데이트/)
  })

  it('다시 해도 같은 오류인지: 원문과 바꾼 문구 모두', () => {
    for (const text of [
      'Your Claude Code version is too old.',
      'API Error: 500 Invalid model: claude-x',
      'Invalid API key · Fix external API key',
      'Not logged in · Please run /login',
      explainFailure('API Error: 400 너무 낮은 버전의 Claude Code를 사용하고 있습니다', 'apiKey', {}),
      explainFailure('Not logged in · Please run /login', 'login'),
    ]) {
      assert.equal(isBlockingFailure(text), true, text)
    }
    assert.equal(isBlockingFailure('턴 상한(150턴)에 걸려 멈췄습니다'), false)
    assert.equal(isBlockingFailure('STG 세션이 만료되었습니다'), false)
  })

  it('인증 자동: 키가 있으면 API 키, 없으면 claude.ai 로그인. 기본 모델은 Sonnet 1M', () => {
    assert.equal(resolveAuth('auto', {}, { ANTHROPIC_API_KEY: 'k' }), 'apiKey')
    assert.equal(resolveAuth('auto', { ANTHROPIC_AUTH_TOKEN: 't' }, {}), 'apiKey')
    assert.equal(resolveAuth('auto', {}, {}), 'login')
    assert.equal(resolveAuth('login', {}, { ANTHROPIC_API_KEY: 'k' }), 'login')
    assert.equal(resolveAuth('apiKey', {}, {}), 'apiKey')
    assert.equal(DEFAULT_CLAUDE_MODEL, 'claude-sonnet-5-5[1m]')
    // 예전 기본값을 저장해 둔 설정은 새 기본값으로, 직접 넣은 모델과 빈 값(ANTHROPIC_MODEL 사용)은 그대로
    assert.equal(upgradeClaudeModel('claude-sonnet-5[1m]'), 'claude-sonnet-5-5[1m]')
    assert.equal(upgradeClaudeModel('claude-sonnet-5'), 'claude-sonnet-5')
    assert.equal(upgradeClaudeModel(''), '')
    assert.match(explainFailure('API Error: 400 invalid model: claude-x[1m]', 'apiKey', {}), /Claude 모델을 쓸 수 있는 모델로 바꾸거나 비우세요/)
  })
})
