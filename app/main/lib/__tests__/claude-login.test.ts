import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import type { ClaudeCli } from '../claude.ts'
import { claudeLoginStatus, claudeLogout, parseAuthStatus, parseLoginUrl, startClaudeLogin } from '../claude-login.ts'

describe('claude.ai 로그인', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claude-login-'))
  after(() => rmSync(dir, { recursive: true, force: true }))
  const state = join(dir, 'logged-in')
  // claude auth login / status / logout 흉내. 코드가 abc면 로그인, 아니면 실패
  const bin = join(dir, 'claude')
  writeFileSync(
    bin,
    `#!/bin/sh
if [ "$1 $2" = "auth status" ]; then
  if [ -f "${state}" ]; then echo '{"loggedIn": true, "authMethod": "claude.ai", "email": "kim@example.com"}'; else echo '{"loggedIn": false}'; exit 1; fi
  exit 0
fi
if [ "$1 $2" = "auth logout" ]; then rm -f "${state}"; exit 0; fi
printf 'Opening browser to sign in…\\nIf the browser didn'"'"'t open, visit: \\033]8;;https://claude.com/cai/oauth/authorize?code=true&state=s1\\033\\\\https://claude.com/cai/oauth/authorize?code=true&state=s1\\033]8;;\\033\\\\\\nPaste code here if prompted > '
read code
if [ "$code" = "abc" ]; then touch "${state}"; echo 'Login successful.'; exit 0; fi
echo 'Invalid code'; exit 1
`,
  )
  chmodSync(bin, 0o755)
  const cli = { path: bin, version: 'x', envPath: '', env: process.env, auth: 'login', keySource: null, managed: false } satisfies ClaudeCli

  it('출력에서 로그인 주소를 읽는다 (터미널 링크 표식 앞에서 끊음)', () => {
    const out = "visit: \x1b]8;;https://claude.com/cai/oauth/authorize?code=true&state=s1\x1b\\https://claude.com/x\x1b]8;;\x1b\\\nPaste"
    assert.equal(parseLoginUrl(out), 'https://claude.com/cai/oauth/authorize?code=true&state=s1')
    assert.equal(parseLoginUrl('Opening browser to sign in…'), undefined)
  })

  it('상태: 로그인 여부와 계정, 읽지 못하면 오류', () => {
    assert.deepEqual(parseAuthStatus('{"loggedIn":true,"authMethod":"claude.ai","email":"a@b.c"}'), { loggedIn: true, method: 'claude.ai', account: 'a@b.c' })
    assert.deepEqual(parseAuthStatus('{"loggedIn":false}'), { loggedIn: false, method: undefined, account: undefined })
    assert.match(parseAuthStatus('oops').error ?? '', /로그인 상태를 읽지 못했습니다/)
  })

  it('코드를 붙여 넣어 로그인하고, 로그아웃한다', async () => {
    assert.equal((await claudeLoginStatus(cli)).loggedIn, false, '로그인 전 (exit 1이어도 JSON을 읽는다)')
    const urls: string[] = []
    const login = startClaudeLogin(cli, (url) => urls.push(url))
    await new Promise((r) => setTimeout(r, 200))
    assert.deepEqual(urls, ['https://claude.com/cai/oauth/authorize?code=true&state=s1'])
    login.sendCode(' abc ')
    await login.done
    assert.deepEqual(await claudeLoginStatus(cli), { loggedIn: true, method: 'claude.ai', account: 'kim@example.com' })
    await claudeLogout(cli)
    assert.equal(existsSync(state), false)
  })

  it('틀린 코드는 실패, 취소는 취소로', async () => {
    const wrong = startClaudeLogin(cli, () => {})
    wrong.sendCode('nope')
    await assert.rejects(wrong.done, /claude\.ai 로그인에 실패했습니다 \(.*Invalid code\)/)
    const cancelled = startClaudeLogin(cli, () => {})
    cancelled.cancel()
    await assert.rejects(cancelled.done, /취소했습니다/)
  })
})
