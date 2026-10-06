import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import {
  buildAllowedTools,
  findClaude,
  isAtlassianServer,
  mcpServerRule,
  parseMcpList,
  parseStreamLine,
  parseSummary,
  runClaude,
  sessionDataDir,
  toolLabel,
  type ClaudeEvent,
} from '../claude.ts'

const FIXTURE = readFileSync(join(import.meta.dirname, 'fixtures/claude-stream.jsonl'), 'utf8')

describe('claude mcp list', () => {
  const sample = [
    'Checking MCP server health…',
    '',
    'plugin:media-pipeline:media-pipeline: node /x/bundle.js - ✔ Connected',
    'plugin:figma:figma: https://mcp.figma.com/mcp (HTTP) - ✘ Failed to connect — timed out',
    'mcp-atlassian-hmg: /Users/u/.mcp-atlassian-venv/bin/mcp-atlassian  - ✔ Connected',
    'claude.ai Atlassian: https://mcp.atlassian.com/v1/sse - ! Needs authentication',
    'playwright: npx @playwright/mcp@latest - ✔ Connected',
  ].join('\n')

  it('이름과 연결 상태', () => {
    assert.deepEqual(parseMcpList(sample), [
      { name: 'plugin:media-pipeline:media-pipeline', connected: true },
      { name: 'plugin:figma:figma', connected: false, detail: 'Failed to connect — timed out' },
      { name: 'mcp-atlassian-hmg', connected: true },
      { name: 'playwright', connected: true },
    ])
    assert.ok(isAtlassianServer('mcp-atlassian-hmg'))
    assert.ok(isAtlassianServer('confluence'))
    assert.ok(!isAtlassianServer('playwright'))
  })
})

describe('허용 도구', () => {
  it('manuals/<m> 쓰기, Ariadne MCP, Confluence 읽기만', () => {
    const tools = buildAllowedTools('bo', ['mcp-atlassian-hmg'], '/Users/kim/Documents/Ariadne')
    assert.ok(tools.includes('Edit(./manuals/bo/**)'))
    assert.ok(tools.includes('Write(./manuals/bo/**)'))
    assert.ok(tools.includes('mcp__ariadne'))
    assert.ok(tools.includes('mcp__mcp-atlassian-hmg__confluence_search'))
    assert.ok(tools.includes('mcp__mcp-atlassian-hmg__confluence_get_page'))
    assert.ok(!tools.some((t) => /update|create|delete|comment_add|add_comment|upload/i.test(t)), '쓰기 도구 없음')
    assert.ok(!tools.includes('Bash'))
    assert.ok(!tools.includes('Read'), '읽기는 경로를 제한한다')
    assert.ok(tools.includes('Read(./**)'))
    // 실제 Claude Code 폴더 이름 규칙: /private/tmp/claude-501/-Users-x → -private-tmp-claude-501--Users-x
    assert.ok(tools.includes('Read(~/.claude/projects/-Users-kim-Documents-Ariadne/**)'))
    assert.equal(sessionDataDir('/private/tmp/claude-501/-Users-x'), '~/.claude/projects/-private-tmp-claude-501--Users-x')
    assert.ok(!tools.some((t) => t.startsWith('Web')))
  })
})

describe('진행 문구', () => {
  it('도구 호출을 읽을 문장으로', () => {
    assert.equal(toolLabel('mcp__ariadne__stg_open', { path: '/menu' }), 'STG 화면 열기: /menu')
    assert.equal(toolLabel('mcp__ariadne__save_shot', { id: 'menu-list' }), '캡처 저장: menu-list')
    assert.equal(toolLabel('mcp__mcp-atlassian-hmg__confluence_search', { query: 'title ~ "메뉴 관리"' }), '기획서 검색: title ~ "메뉴 관리"')
    assert.equal(toolLabel('mcp__mcp-atlassian-hmg__confluence_get_page', { page_id: '536957869' }), '기획서 읽기: 536957869')
    assert.equal(toolLabel('Write', { file_path: '/ws/manuals/bo/08-menu/01-a.md' }, '/ws'), '쓰기: manuals/bo/08-menu/01-a.md')
    assert.equal(toolLabel('ToolSearch', { query: 'select:mcp__ariadne__stg_open' }), '도구 준비')
  })
})

describe('stream-json (실제 출력)', () => {
  it('init → 도구 → 결과 → 거절 → 최종', () => {
    const events = FIXTURE.split('\n').flatMap((l) => parseStreamLine(l, '/ws'))
    const kinds = events.map((e) => e.kind)
    assert.equal(kinds[0], 'init')
    assert.deepEqual(
      events.filter((e) => e.kind === 'tool').map((e) => (e as Extract<ClaudeEvent, { kind: 'tool' }>).label),
      ['쓰기: manuals/demo/a.txt', '쓰기: outside.txt'],
    )
    const results = events.filter((e) => e.kind === 'tool_result') as Extract<ClaudeEvent, { kind: 'tool_result' }>[]
    assert.deepEqual(results.map((r) => r.isError), [false, true])
    const final = events.at(-1) as Extract<ClaudeEvent, { kind: 'result' }>
    assert.equal(final.kind, 'result')
    assert.equal(final.ok, true)
    assert.equal(final.denials.length, 1)
    assert.match(final.denials[0], /^Write .*outside\.txt/)
  })

  it('모르는 줄은 무시', () => {
    assert.deepEqual(parseStreamLine('not json'), [])
    assert.deepEqual(parseStreamLine('{"type":"rate_limit_event"}'), [])
  })

  it('마지막 JSON 요약', () => {
    const text = '완료했습니다.\n```json\n{"sections":["08-a/01-b.md"],"todos":2}\n```'
    assert.deepEqual(parseSummary(text), { sections: ['08-a/01-b.md'], todos: 2 })
    assert.equal(parseSummary('요약 없음'), undefined)
    assert.equal(parseSummary('```json\n{"x":1}\n```'), undefined)
  })
})

describe('실행기 (가짜 claude)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ariadne-fake-claude-'))
  after(() => rmSync(dir, { recursive: true, force: true }))
  const script = join(dir, 'claude')
  writeFileSync(join(dir, 'stream.jsonl'), FIXTURE)
  writeFileSync(
    script,
    `#!/usr/bin/env node
const fs = require('fs')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code)'); process.exit(0) }
fs.writeFileSync(${JSON.stringify(join(dir, 'args.json'))}, JSON.stringify(args))
if (args[1] === 'hang') { setInterval(() => {}, 1000); return }
const lines = fs.readFileSync(${JSON.stringify(join(dir, 'stream.jsonl'))}, 'utf8').split('\\n')
let i = 0
const next = () => { if (i < lines.length) { process.stdout.write(lines[i++] + '\\n'); setTimeout(next, 2) } }
next()
`,
  )
  chmodSync(script, 0o755)

  it('버전 확인', async () => {
    const cli = await findClaude(script)
    assert.equal(cli?.version, '9.9.9 (Claude Code)')
  })

  it('이벤트를 전달하고 최종 결과를 돌려준다', async () => {
    const cli = (await findClaude(script))!
    const events: ClaudeEvent[] = []
    const { done } = runClaude({
      cli,
      cwd: dir,
      prompt: 'draft',
      allowedTools: ['Read', 'mcp__ariadne'],
      mcpConfigFile: '/tmp/mcp.json',
      disallowedTools: [mcpServerRule('mcp-atlassian.hmg')],
      onEvent: (e) => events.push(e),
    })
    const result = await done
    assert.equal(result.kind, 'result')
    assert.ok(events.some((e) => e.kind === 'init'))
    const args = JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8'))
    assert.deepEqual(args.slice(0, 2), ['-p', 'draft'])
    assert.ok(args.includes('--mcp-config') && args.includes('/tmp/mcp.json'))
    assert.deepEqual(args.slice(args.indexOf('--allowedTools') + 1), ['Read', 'mcp__ariadne'])
    const disallowed = args.slice(args.indexOf('--disallowedTools') + 1, args.indexOf('--allowedTools'))
    assert.ok(disallowed.includes('Bash') && disallowed.includes('WebFetch'))
    assert.ok(disallowed.includes('mcp__mcp-atlassian_hmg'), '이번 작업에서 더 막는 도구')
  })

  it('중지하면 거절된다', async () => {
    const cli = (await findClaude(script))!
    const { done, cancel } = runClaude({ cli, cwd: dir, prompt: 'hang', allowedTools: [], mcpConfigFile: '/tmp/x', onEvent: () => {} })
    setTimeout(cancel, 200)
    await assert.rejects(done, /중지했습니다/)
  })
})
