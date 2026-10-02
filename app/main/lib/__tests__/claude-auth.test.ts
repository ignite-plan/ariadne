import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { claudeEnv, explainFailure, keySource } from '../claude-auth.ts'
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
    assert.match(explainFailure('Failed to authenticate. API Error: 401 Api key is expired', 'apiKey'), /~\/\.zshrc의 키를 유효한 값으로/)
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
  writeFileSync(join(dir, '.zshrc'), 'export ANTHROPIC_API_KEY="zshrc-key"\n')
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
})
