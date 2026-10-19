#!/usr/bin/env node
// E2E용 가짜 Claude Code CLI. LLM 없이 받은 --mcp-config로 Ariadne MCP 도구를 실제로 부르고 stream-json을 낸다
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assert = (ok, message) => {
  if (!ok) throw new Error(message)
}

const args = process.argv.slice(2)
if (args[0] === '--version') {
  console.log('0.0.0-fake (Claude Code)')
  process.exit(0)
}
if (args[0] === 'mcp' && args[1] === 'list') {
  console.log('mcp-atlassian-fake: /bin/true - ✔ Connected')
  process.exit(0)
}
// claude.ai 로그인 흉내: 주소를 내고 코드(fake-code)를 받으면 로그인 표식을 남긴다
if (args[0] === 'auth') {
  const { join: joinPath } = await import('node:path')
  const state = joinPath(process.env.CLAUDE_CONFIG_DIR ?? tmpdir(), 'fake-claude-login')
  if (args[1] === 'status') {
    const loggedIn = existsSync(state)
    console.log(JSON.stringify(loggedIn ? { loggedIn, authMethod: 'claude.ai', email: 'e2e@example.com' } : { loggedIn }))
    process.exit(loggedIn ? 0 : 1)
  }
  if (args[1] === 'logout') {
    rmSync(state, { force: true })
    process.exit(0)
  }
  process.stdout.write("Opening browser to sign in…\nIf the browser didn't open, visit: https://claude.com/cai/oauth/authorize?fake=1\nPaste code here if prompted > ")
  let input = ''
  process.stdin.setEncoding('utf8').on('data', (chunk) => {
    input += chunk
    if (!input.includes('\n')) return
    if (input.trim() !== 'fake-code') {
      console.log('Invalid code')
      process.exit(1)
    }
    writeFileSync(state, '1')
    console.log('Login successful.')
    process.exit(0)
  })
  await new Promise(() => {})
}

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(join(repo, 'package.json'))
const { Client } = await import(require.resolve('@modelcontextprotocol/sdk/client/index.js'))
const { StreamableHTTPClientTransport } = await import(require.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js'))

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
const servers = JSON.parse(readFileSync(args[args.indexOf('--mcp-config') + 1], 'utf8')).mcpServers
const config = servers.ariadne
// 앱은 등록된 MCP를 모두 싣지 않고(strict) 기본 도구도 쓰는 것만 싣는다. Atlassian은 Confluence 읽기 전용으로
assert(args.includes('--strict-mcp-config'), 'strict MCP')
assert(args.includes('--tools') && args.includes('--disable-slash-commands'), '기본 도구 제한')
const atlassian = servers['mcp-atlassian-fake']
if (atlassian) assert(atlassian.env?.READ_ONLY_MODE === 'true' && /^confluence_search,/.test(atlassian.env?.ENABLED_TOOLS ?? ''), 'Atlassian 읽기 전용')
const client = new Client({ name: 'fake-claude', version: '0' })
await client.connect(new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers } }))

emit({ type: 'system', subtype: 'init', model: 'fake', mcp_servers: [{ name: 'ariadne', status: 'connected' }] })
let n = 0
const call = async (name, input) => {
  const id = `toolu_${++n}`
  emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: `mcp__ariadne__${name}`, input }] } })
  const result = await client.callTool({ name, arguments: input })
  const text = result.content?.[0]?.text ?? ''
  emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: Boolean(result.isError), content: text }] } })
  return { text, isError: Boolean(result.isError) }
}

const prompt = args[args.indexOf('-p') + 1] ?? ''
if (prompt.includes('의 장면 하나를 채운다')) {
  // 장면 하나: 앞 장면을 재생해 열고, 그 장면만 저장한 뒤 그 장면부터 실행해 본다
  const video = prompt.match(/가이드 영상 시나리오 `([a-z0-9-]+)`의 장면 하나/)[1]
  const start = Number(prompt.match(/video_open_scene\(scene: (\d+)\)/)[1])
  await call('video_get', { id: video })
  const opened = await call('video_open_scene', { id: video, scene: start })
  if (!opened.text.includes('Location Information')) throw new Error('앞 장면을 재생한 화면이 아닙니다')
  await call('video_save_scene', {
    id: video,
    yaml: 'say: The popup shows the registered address of the dealer.\nsteps:\n  - waitFor: { text: Location Information }\n  - pause: 500\n',
  })
  const checked = await call('video_check', { id: video, fromScene: start })
  await client.close()
  const summary = { sections: [], video, scenes: 1, todos: 0, notes: checked.isError ? checked.text : '' }
  emit({ type: 'result', subtype: checked.isError ? 'error' : 'success', is_error: checked.isError, result: `장면을 채웠습니다.\n\`\`\`json\n${JSON.stringify(summary)}\n\`\`\``, duration_ms: 700, permission_denials: [] })
  process.exit(0)
}

if (prompt.includes('가이드 영상 시나리오')) {
  // 영상 초안: 시나리오를 읽고, STG를 보고, 저장한 뒤 실행해 본다
  const video = prompt.match(/가이드 영상 시나리오 `([a-z0-9-]+)`/)[1]
  emit({ type: 'assistant', message: { content: [{ type: 'text', text: '매뉴얼 본문과 STG 화면으로 장면을 나누겠습니다.' }] } })
  await call('video_get', { id: video })
  await call('stg_open', { path: '/dealer/company' })
  const yaml = (mutates) => `title: Dealer List View
intro: This video shows how to view the dealer list.
sections:
  - 02-dealer-management/01-dealer-list-view.md
maskPersonal: true
${mutates ? 'mutates: true\n' : ''}scenes:
  - say: The Dealer List screen provides a list of all registered dealers.
    steps:
      - open: /dealer/company
      - waitFor: { text: Total }
  - say: Click the Location icon to see the dealer's address.
    steps:
      - click: { role: button, name: Location }
      - waitFor: { text: Location Information }
`
  // STG 저장 허용은 앱이 거절해야 한다
  const refused = await call('video_save', { id: video, yaml: yaml(true) })
  if (!refused.isError) throw new Error('mutates 저장이 거절되지 않았습니다')
  await call('video_save', { id: video, yaml: yaml(false) })
  const checked = await call('video_check', { id: video })
  await client.close()
  const summary = { sections: [], video, scenes: 2, todos: 0, sources: [{ title: '02-dealer-management/01-dealer-list-view.md' }], notes: checked.isError ? checked.text : '' }
  emit({ type: 'result', subtype: checked.isError ? 'error' : 'success', is_error: checked.isError, result: `영상 시나리오를 썼습니다.\n\`\`\`json\n${JSON.stringify(summary)}\n\`\`\``, duration_ms: 900, permission_denials: [] })
  process.exit(0)
}

if (prompt.includes('화면별 요약을 마지막 응답의 JSON 블록으로 낸다')) {
  // 최신화 1단계: 기획서 요약을 마지막 응답으로 낸다 (파일은 앱이 쓴다). 쓰기 도구는 허용 목록에 없어야 한다
  assert(atlassian, '요약 단계에는 Atlassian MCP를 싣는다')
  const allowed = args.slice(args.indexOf('--allowedTools') + 1).filter((a) => !a.startsWith('--'))
  assert(!allowed.some((t) => /^(Edit|Write)\(/.test(t)), '요약 단계에 쓰기 권한을 주지 않는다')
  const screens = Object.fromEntries([...prompt.matchAll(/^  - (\S+\.md) \(manuals\//gm)].map((m) => [m[1], 'Dealer list: Total, Location filter']))
  const digest = {
    pages: [{ id: '900001', title: '[202606output][Phase3][BO] 딜러 관리 화면', version: 3, url: 'https://example.invalid/wiki/900001' }],
    screens,
  }
  if (prompt.includes('FAIL-999')) {
    // 요약 실패: JSON 없이 끝난다 (턴 상한에 걸린 것처럼)
    await client.close()
    emit({ type: 'result', subtype: 'success', is_error: false, result: '히스토리 표를 더 찾아보겠습니다.', duration_ms: 300, permission_denials: [] })
    process.exit(0)
  }
  if (prompt.includes('- 반영 범위')) {
    // 반영 범위: 티켓이 있으면 Jira 읽기 도구만 더 켠다. 범위에 해당하는 변경은 딜러 목록 화면 하나
    assert(prompt.includes('Jira 티켓: E2E-101') && prompt.includes('기간: 2026-05 ~ 2026-08') && prompt.includes('[202608output]'), '요약 지시에 반영 범위')
    assert(allowed.includes('mcp__mcp-atlassian-fake__jira_get_issue'), 'Jira 읽기 허용')
    assert(/jira_get_issue/.test(atlassian.env?.ENABLED_TOOLS ?? '') && !/jira_create|jira_update/.test(atlassian.env?.ENABLED_TOOLS ?? ''), 'Jira는 읽기 도구만')
    digest.pages[0].title = '[202608output][Phase3][BO] 딜러 관리 화면'
    const list = Object.keys(screens).find((k) => k.endsWith('01-dealer-list-view.md'))
    digest.changes = { [list]: '2026-07-14 E2E-101: 딜러 목록 소개 문구에 상태 표시 추가' }
  }
  await client.close()
  emit({ type: 'result', subtype: 'success', is_error: false, result: `요약했습니다.\n\`\`\`json\n${JSON.stringify(digest)}\n\`\`\``, duration_ms: 300, permission_denials: [] })
  process.exit(0)
}

if (prompt.includes('최신화한다')) {
  // 최신화: 화면 하나씩 따로 실행된다. 대상 화면 한 줄을 고치고, 기존 이미지를 replace로 다시 찍는다
  const target = (prompt.match(/^- 대상 화면: (manuals\/\S+\.md)$/m) ?? prompt.match(/^  - (manuals\/\S+\.md)$/m))[1]
  assert(prompt.includes('Dealer list: Total, Location filter'), '화면별 작업은 기획서 요약을 받는다')
  // 요약을 받은 화면 작업에는 Confluence 도구를 주지 않고 막는다, 턴 상한이 있다
  const allowed = args.slice(args.indexOf('--allowedTools') + 1)
  const disallowed = args.slice(args.indexOf('--disallowedTools') + 1, args.indexOf('--allowedTools'))
  assert(!allowed.some((t) => t.startsWith('mcp__mcp-atlassian-fake')), '화면 작업에 Confluence 허용 없음')
  assert(disallowed.includes('mcp__mcp-atlassian-fake'), '화면 작업에서 Confluence 막음')
  assert(!atlassian, '요약을 받은 화면 작업에는 Atlassian MCP를 싣지 않는다')
  assert(args.includes('--max-turns'), '화면 작업 턴 상한')
  const root = process.cwd()
  const scoped = prompt.includes('- 반영 범위')
  if (scoped) {
    assert(prompt.includes('E2E-101: 딜러 목록 소개 문구') && prompt.includes('이것만 반영한다'), '반영할 변경만 받는다')
    assert(target.endsWith('01-dealer-list-view.md'), '반영할 변경이 있는 화면만 돈다')
  }
  emit({ type: 'assistant', message: { content: [{ type: 'text', text: '지금 본문과 기획서를 비교하겠습니다.' }] } })
  await call('manual_outline', {})
  await call('stg_open', { path: '/dealer/company' })
  const shot = await call('save_shot', { id: 'dealer-list', path: '/dealer/company', ready: 'text=Total', clip: '#root', replace: true })
  if (scoped) assert(shot.isError && /다시 찍지 않습니다/.test(shot.text), '반영 범위 최신화는 캡처를 거절한다')
  // E2E: 최신화가 도는 동안(STG 탭을 연 채로) 영상 만들기를 함께 돌려 보려고, 이 파일이 생길 때까지 기다린다
  const hold = process.env.ARIADNE_FAKE_CLAUDE_HOLD
  if (hold) {
    emit({ type: 'assistant', message: { content: [{ type: 'text', text: '기획서를 더 읽는 중입니다.' }] } })
    while (!existsSync(hold)) await sleep(200)
  }
  const id = `toolu_${++n}`
  const file = join(root, target)
  emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'Edit', input: { file_path: file } }] } })
  const before = readFileSync(file, 'utf8')
  writeFileSync(file, before.replace('- This screen provides a list of all registered dealers.', '- This screen lists all registered dealers and their status.'))
  emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: false, content: 'ok' }] } })
  await client.close()
  const section = target.split('/').slice(2).join('/')
  const summary = { sections: [section], unchanged: [], images: scoped ? [] : ['dealer-list'], todos: 0, sources: [{ title: '[202606output][Phase3][BO] 딜러 관리 화면' }] }
  emit({ type: 'result', subtype: 'success', is_error: false, result: `최신화했습니다.\n\`\`\`json\n${JSON.stringify(summary)}\n\`\`\``, duration_ms: 900, permission_denials: [] })
  process.exit(0)
}

emit({ type: 'assistant', message: { content: [{ type: 'text', text: '기획서와 STG 화면을 확인하겠습니다.' }] } })
await call('manual_outline', {})
const created = JSON.parse((await call('create_section', { title: 'Menu List View', newChapterTitle: 'Menu Management E2E', chapterIndex: 7 })).text)
await call('stg_open', { path: '/menu' })
await call('stg_click', { role: 'button', name: 'Delete' })
await call('save_shot', { id: 'menu-e2e-list', path: '/menu', ready: 'text=Total', clip: '#root' })

const id = `toolu_${++n}`
emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'Write', input: { file_path: created.file } }] } })
const front = readFileSync(created.file, 'utf8').match(/^---\n[\s\S]*?\n---\n/)[0]
writeFileSync(
  created.file,
  `${front}\n## Menu List View\n\n- This screen lists registered menus.\n\n![Menu List](images/menu-e2e-list.png){width=6.27in}\n\n- **Menu name**: <!-- TODO: 확인 필요 - 최대 길이 -->\n`,
)
emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: false, content: 'ok' }] } })
await client.close()

const summary = { sections: [created.path], images: ['menu-e2e-list'], todos: 1, sources: [{ title: '[202606output][Phase3][BO] 메뉴 관리 화면', url: 'https://hmg.atlassian.net/wiki/spaces/DLRS/pages/536957869' }] }
emit({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: `초안을 만들었습니다.\n\`\`\`json\n${JSON.stringify(summary)}\n\`\`\``,
  total_cost_usd: 0,
  duration_ms: 1200,
  num_turns: 6,
  permission_denials: [],
})
