import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { createLogger } from '../logger.ts'
import { redact } from '../redact.ts'
import { buildReport, createIssue, IssuePermissionError, newIssueUrl, REPORT_TITLE_PREFIX } from '../report.ts'

describe('가리기', () => {
  it('토큰·키·비밀번호·URL 계정 정보·홈 경로', () => {
    const text = [
      'token ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'pat github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
      'key sk-ant-api03-abcdefghijklmnop',
      'hex ee881bd4aa25adf3362eda45e90a0903fca21e74d346a1c7e2f04b47724a742a',
      'commit 5730fc3a1b2c3d4e5f60718293a4b5c6d7e8f901',
      'Authorization: Bearer abc.def.ghijklmnop',
      '{"password":"hunter2-secret"} cookie=SESSION123',
      'https://x-access-token:supersecret@github.com/a/b.git',
      'file /Users/kim/Documents/Ariadne/manuals/bo/a.md',
    ].join('\n')
    const out = redact(text, { home: '/Users/kim', secrets: ['my-exact-secret-value'] })
    assert.doesNotMatch(out, /ghp_|github_pat_|sk-ant-|ee881bd4|hunter2|SESSION123|supersecret|abc\.def/)
    assert.match(out, /\[github-token\]/)
    assert.match(out, /commit 5730fc3a1b2c3d4e5f60718293a4b5c6d7e8f901/, '40자 커밋 해시는 남긴다')
    assert.match(out, /file ~\/Documents\/Ariadne\/manuals\/bo\/a\.md/)
    assert.equal(redact('value my-exact-secret-value end', { secrets: ['my-exact-secret-value', 'short', undefined] }), 'value [redacted] end')
  })
})

describe('로그 파일', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ariadne-log-'))
  after(() => rmSync(dir, { recursive: true, force: true }))

  it('한 줄씩 쓰고, 최근 오류만 골라 읽고, 쓸 때 가린다', () => {
    const log = createLogger(dir, { redact: () => ({ home: '/Users/kim', secrets: ['tok-secret-12345'] }) })
    log.write('info', 'main', '시작')
    log.error('ipc:workspace:submit', new Error('push 실패 tok-secret-12345 /Users/kim/x'))
    log.write('warn', 'report', '경고\n두 줄')
    const tail = log.tail()
    assert.equal(tail.length, 3)
    assert.match(tail[1], /ERROR \[ipc:workspace:submit\] Error: push 실패 \[redacted\] ~\/x/)
    assert.match(tail[2], /경고\\n두 줄/, '여러 줄은 한 줄로')
    const errors = log.recentErrors()
    assert.equal(errors.length, 1)
    assert.equal(errors[0].source, 'ipc:workspace:submit')
    assert.match(errors[0].message, /^Error: push 실패/)
  })

  it('크기가 넘으면 .1로 넘기고 둘 다 읽는다', () => {
    const small = createLogger(join(dir, 'rot'), { maxBytes: 200 })
    for (let i = 0; i < 10; i++) small.write('info', 'main', `line ${i} ${'x'.repeat(30)}`)
    assert.ok(existsSync(join(dir, 'rot', 'ariadne.log.1')))
    assert.ok(small.tail(100).some((l) => l.includes('line 9')))
    assert.ok(readFileSync(join(dir, 'rot', 'ariadne.log'), 'utf8').length < 400)
  })
})

describe('문제 신고', () => {
  const context = { appVersion: '1.4.1', os: '15.5', manual: 'bo', githubLogin: 'kim' }
  const errors = [{ time: '2026-10-02T01:00:00Z', level: 'error' as const, source: 'ipc:capture:run', message: 'Error: 세션 만료로 보임' }]

  it('설명, 화면 오류, 환경, 최근 오류, 로그(선택)를 담고 가린다', () => {
    const report = buildReport(
      { description: '캡처하다 멈췄어요\n두 번째 줄', error: 'Error: timeout ghp_abcdefghijklmnopqrstuvwxyz0123456789', includeLog: true },
      context,
      errors,
      ['2026 INFO [main] 시작 /Users/kim/x'],
      { home: '/Users/kim' },
    )
    assert.equal(report.title, `${REPORT_TITLE_PREFIX} 캡처하다 멈췄어요`)
    assert.match(report.body, /## 무엇을 하다가\n\n캡처하다 멈췄어요\n두 번째 줄/)
    assert.match(report.body, /## 화면에 나온 오류\n\n```\nError: timeout \[github-token\]\n```/)
    assert.match(report.body, /- 앱 버전: 1\.4\.1\n- macOS: 15\.5\n- 매뉴얼: bo\n- 신고자: @kim/)
    assert.match(report.body, /\[ipc:capture:run\] Error: 세션 만료로 보임/)
    assert.match(report.body, /<details><summary>최근 로그<\/summary>[\s\S]*INFO \[main\] 시작 ~\/x/)
    assert.doesNotMatch(buildReport({ description: 'x', includeLog: false }, context, [], ['log line']).body, /최근 로그/)
  })

  it('설명이 없으면 오류 첫 줄로 제목', () => {
    assert.equal(buildReport({ description: ' ', error: 'Error: a\nstack', includeLog: false }, context, [], []).title, `${REPORT_TITLE_PREFIX} Error: a`)
  })

  it('GitHub Issue 만들기, 권한이 없으면 IssuePermissionError', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const ok = async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ html_url: 'https://github.com/ignite-plan/ariadne/issues/7', number: 7 }), { status: 201 })
    }
    const url = await createIssue(ok, 't', 'https://github.com/ignite-plan/ariadne', { title: 'T', body: 'B' })
    assert.equal(url, 'https://github.com/ignite-plan/ariadne/issues/7')
    assert.equal(calls[0].url, 'https://api.github.com/repos/ignite-plan/ariadne/issues')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { title: 'T', body: 'B' })
    const forbidden = async () => new Response('{"message":"Resource not accessible by personal access token"}', { status: 403 })
    await assert.rejects(createIssue(forbidden, 't', 'https://github.com/a/b', { title: 'T', body: 'B' }), IssuePermissionError)
  })

  it('브라우저 새 Issue 주소: 제목·본문을 채우고 긴 본문은 자른다', () => {
    const url = newIssueUrl('https://github.com/ignite-plan/ariadne', { title: '[Ariadne 신고] 멈춤', body: 'x'.repeat(10000) }, 100)
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/ignite-plan/ariadne/issues/new')
    assert.equal(parsed.searchParams.get('title'), '[Ariadne 신고] 멈춤')
    assert.match(parsed.searchParams.get('body')!, /^x{100}\n\n…\(잘림 — 전체 내용은 클립보드에 있습니다/)
  })
})
