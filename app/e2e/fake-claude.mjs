#!/usr/bin/env node
// E2E용 가짜 Claude Code CLI. LLM 없이 받은 --mcp-config로 Ariadne MCP 도구를 실제로 부르고 stream-json을 낸다
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
section: 02-dealer-management/01-dealer-list-view.md
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
  emit({ type: 'assistant', message: { content: [{ type: 'text', text: '지금 본문과 기획서를 비교하겠습니다.' }] } })
  await call('manual_outline', {})
  await call('stg_open', { path: '/dealer/company' })
  await call('save_shot', { id: 'dealer-list', path: '/dealer/company', ready: 'text=Total', clip: '#root', replace: true })
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
  const summary = { sections: [section], unchanged: [], images: ['dealer-list'], todos: 0, sources: [{ title: '[202606output][Phase3][BO] 딜러 관리 화면' }] }
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
