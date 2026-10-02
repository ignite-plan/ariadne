// 기획자 PC의 Claude Code CLI(`claude -p`)를 실행하고 stream-json 출력을 화면용 이벤트로 바꾼다.
// 허용 도구 밖의 호출은 -p 모드에서 자동으로 거절된다 (Bash, 웹, Confluence 쓰기, manuals/<m> 밖 쓰기)
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, delimiter, dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import type { ClaudeEvent, DraftSummary } from '../../shared/api.ts'
import { claudeEnv, keySource, SHELL_VARS, type ClaudeAuth, type ShellVars } from './claude-auth.ts'

export type { ClaudeEvent, DraftSummary }

const run = promisify(execFile)

// Finder에서 띄운 앱은 PATH와 ~/.zshrc 환경변수가 없다. 로그인 셸에서 claude 위치, PATH, 키 환경변수를 얻는다 (nvm 설치도 찾도록 -i)
export async function shellLookup() {
  const shell = process.env.SHELL || '/bin/zsh'
  const keys = SHELL_VARS.map((k) => `__${k}__%s\\n`).join('')
  const values = SHELL_VARS.map((k) => `"\${${k}-}"`).join(' ')
  try {
    const { stdout } = await run(shell, ['-lic', `printf "__PATH__%s\\n__CLAUDE__%s\\n${keys}" "$PATH" "$(command -v claude)" ${values}`], {
      timeout: 15000,
      env: { ...process.env, TERM: 'dumb' },
    })
    const vars: ShellVars = {}
    for (const key of SHELL_VARS) {
      const value = stdout.match(new RegExp(`__${key}__(.*)`))?.[1]?.trim()
      if (value) vars[key] = value
    }
    return {
      path: stdout.match(/__PATH__(.*)/)?.[1]?.trim() ?? '',
      claude: stdout.match(/__CLAUDE__(.*)/)?.[1]?.trim() ?? '',
      vars,
    }
  } catch {
    return { path: '', claude: '', vars: {} }
  }
}

export interface ClaudeCli {
  path: string
  version: string
  // claude를 실행할 PATH (nvm으로 설치한 claude는 node가 PATH에 있어야 돈다)
  envPath: string
  // claude를 실행할 환경변수 (인증 방식 반영, 세션 표식 제거)
  env: NodeJS.ProcessEnv
  auth: ClaudeAuth
  // apiKey일 때 키를 어디서 찾았는지 (값은 담지 않는다)
  keySource: 'shell' | 'env' | null
}

const cache = new Map<ClaudeAuth, ClaudeCli | null>()

export async function findClaude(override?: string, refresh = false, auth: ClaudeAuth = 'apiKey'): Promise<ClaudeCli | null> {
  if (cache.has(auth) && !refresh && !override) return cache.get(auth)!
  const cached = { set: (value: ClaudeCli | null) => cache.set(auth, value) }
  const home = homedir()
  const shell = await shellLookup()
  const candidates = [
    override,
    process.env.ARIADNE_CLAUDE_PATH,
    shell.claude,
    join(home, '.local/bin/claude'),
    join(home, '.claude/local/claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ].filter((p): p is string => Boolean(p))
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const envPath = [dirname(path), shell.path, process.env.PATH].filter(Boolean).join(delimiter)
    const env = claudeEnv(process.env, { path: envPath, auth, shellVars: shell.vars })
    try {
      const { stdout } = await run(path, ['--version'], { timeout: 20000, env })
      const found: ClaudeCli = {
        path,
        version: stdout.trim().split('\n')[0],
        envPath,
        env,
        auth,
        keySource: auth === 'apiKey' ? keySource(process.env, shell.vars) : null,
      }
      if (!override) cached.set(found)
      return found
    } catch {
      // 다음 후보
    }
  }
  if (!override) cached.set(null)
  return null
}

export interface McpStatus {
  name: string
  connected: boolean
}

// `claude mcp list` 출력: "name: command - ✔ Connected"
export function parseMcpList(output: string): McpStatus[] {
  return output
    .split('\n')
    .map((line) => line.match(/^(\S+?):\s+.*\s-\s+(✔|✘|✓|✗|!)\s*(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ name: m[1], connected: m[2] === '✔' || m[2] === '✓' }))
}

export async function listMcpServers(cli: ClaudeCli) {
  const { stdout } = await run(cli.path, ['mcp', 'list'], { timeout: 90000, env: cli.env })
  return parseMcpList(stdout)
}

export const isAtlassianServer = (name: string) => /atlassian|confluence/i.test(name)

// 공식 Atlassian 원격 MCP와 로컬 mcp-atlassian(sooperset)의 읽기 도구. 쓰기(create/update/delete/comment)는 넣지 않는다
const CONFLUENCE_READ_TOOLS = [
  // mcp-atlassian
  'confluence_search',
  'confluence_get_page',
  'confluence_get_page_children',
  'confluence_get_page_ancestors',
  'confluence_get_page_history',
  'confluence_get_page_diff',
  'confluence_get_comments',
  'confluence_get_labels',
  'confluence_get_attachments',
  'confluence_get_page_images',
  'confluence_get_space_page_tree',
  // Atlassian Remote MCP
  'search',
  'fetch',
  'getAccessibleAtlassianResources',
  'getConfluencePage',
  'searchConfluenceUsingCql',
  'getConfluenceSpaces',
  'getPagesInConfluenceSpace',
  'getConfluencePageDescendants',
  'getConfluencePageAncestors',
  'getConfluencePageFooterComments',
  'getConfluencePageInlineComments',
]

// 읽기 전용 Bash(tail, ls 등)는 허용 목록이 없어도 자동 승인되므로 명시적으로 막는다. 거절 규칙이 허용보다 우선한다
export const DISALLOWED_TOOLS = ['Bash', 'WebFetch', 'WebSearch', 'Task', 'Agent', 'NotebookEdit']

// Claude Code는 큰 도구 결과(예: 긴 Confluence 페이지)를 ~/.claude/projects/<작업 폴더 이름>/ 아래 파일로 저장하고 Read로 읽는다.
// 폴더 이름은 작업 폴더 경로의 영문·숫자 외 문자를 -로 바꾼 것이다. 다른 작업의 기록은 읽지 못하게 이 폴더만 연다
export function sessionDataDir(cwd: string) {
  return `~/.claude/projects/${cwd.replace(/[^A-Za-z0-9]/g, '-')}`
}

// readDirs: 작업 폴더 밖에서 읽기만 허용할 폴더 (예: 개발자의 dealerhub-web). 절대 경로 규칙은 //로 시작한다
export function buildAllowedTools(manual: string, atlassianServers: string[], cwd: string, readDirs: string[] = [], ariadne = 'ariadne') {
  const writable = `./manuals/${manual}/**`
  return [
    // 작업 폴더와 이번 작업의 큰 결과 폴더만 읽는다 (Glob/Grep도 Read 규칙을 따른다)
    'Read(./**)',
    `Read(${sessionDataDir(cwd)}/**)`,
    ...readDirs.map((dir) => `Read(/${dir.replace(/\/+$/, '')}/**)`),
    'Glob',
    'Grep',
    'TodoWrite',
    'ToolSearch',
    `Edit(${writable})`,
    `Write(${writable})`,
    `mcp__${ariadne}`,
    ...atlassianServers.flatMap((server) => {
      const prefix = `mcp__${server.replace(/[^A-Za-z0-9_-]/g, '_')}__`
      return CONFLUENCE_READ_TOOLS.map((tool) => prefix + tool)
    }),
  ]
}

const short = (text: string, n = 80) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

// 도구 호출을 기획자가 읽을 문장으로
export function toolLabel(name: string, input: Record<string, unknown>, cwd = '') {
  const file = (p: unknown) => (typeof p === 'string' ? (cwd && p.startsWith(cwd) ? relative(cwd, p) : basename(p)) : '')
  // mcp__<server>__<tool>. 서버 이름에 -나 _가 있을 수 있어 앞 두 칸을 뗀다
  const tool = name.startsWith('mcp__') ? name.split('__').slice(2).join('__') : name
  if (name === 'Read') return `읽기: ${file(input.file_path)}`
  if (name === 'Write') return `쓰기: ${file(input.file_path)}`
  if (name === 'Edit' || name === 'MultiEdit') return `고치기: ${file(input.file_path)}`
  if (name === 'Glob' || name === 'Grep') return `찾기: ${short(String(input.pattern ?? ''), 50)}`
  if (name === 'TodoWrite') return '작업 계획 정리'
  if (name === 'ToolSearch') return '도구 준비'
  if (name.startsWith('mcp__ariadne__')) {
    const labels: Record<string, string> = {
      manual_outline: '매뉴얼 목차 확인',
      create_section: `화면 만들기: ${input.title ?? ''}`,
      stg_open: `STG 화면 열기: ${input.path ?? ''}`,
      stg_click: `STG 누르기: ${input.name ?? ''}`,
      stg_fill: `STG 입력: ${input.label ?? ''}`,
      save_shot: `캡처 저장: ${input.id ?? ''}`,
      video_get: `영상 시나리오 읽기: ${input.id ?? ''}`,
      video_save: `영상 시나리오 저장: ${input.id ?? ''}`,
      video_check: `영상 시나리오 실행해 보기${input.fromScene === undefined ? '' : ` (장면 ${Number(input.fromScene) + 1}부터)`}`,
    }
    return labels[tool] ?? tool
  }
  if (/search|cql/i.test(tool)) return `기획서 검색: ${short(String(input.query ?? input.cql ?? ''), 60)}`
  if (/page|fetch/i.test(tool)) return `기획서 읽기: ${input.title ?? input.page_id ?? input.pageId ?? input.id ?? ''}`
  return short(tool, 40)
}

function resultText(content: unknown) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : '')).join('\n')
  }
  return ''
}

// stream-json 한 줄 → 이벤트 (모르는 줄은 무시)
export function parseStreamLine(line: string, cwd = ''): ClaudeEvent[] {
  let event: Record<string, any>
  try {
    event = JSON.parse(line)
  } catch {
    return []
  }
  if (event.type === 'system' && event.subtype === 'init') {
    return [{ kind: 'init', model: event.model, mcp: (event.mcp_servers ?? []).map((s: any) => ({ name: s.name, status: s.status })) }]
  }
  if (event.type === 'assistant') {
    return (event.message?.content ?? []).flatMap((c: any): ClaudeEvent[] => {
      if (c.type === 'text' && c.text?.trim()) return [{ kind: 'text', text: c.text.trim() }]
      if (c.type === 'tool_use') return [{ kind: 'tool', id: c.id, name: c.name, label: toolLabel(c.name, c.input ?? {}, cwd) }]
      return []
    })
  }
  if (event.type === 'user') {
    return (event.message?.content ?? []).flatMap((c: any): ClaudeEvent[] =>
      c?.type === 'tool_result' ? [{ kind: 'tool_result', id: c.tool_use_id, isError: Boolean(c.is_error), text: short(resultText(c.content), 300) }] : [],
    )
  }
  if (event.type === 'result') {
    return [
      {
        kind: 'result',
        ok: !event.is_error && event.subtype === 'success',
        text: String(event.result ?? ''),
        costUsd: event.total_cost_usd,
        durationMs: event.duration_ms,
        turns: event.num_turns,
        denials: (event.permission_denials ?? []).map((d: any) => `${d.tool_name} ${JSON.stringify(d.tool_input ?? {}).slice(0, 120)}`),
      },
    ]
  }
  return []
}

// 마지막 응답의 ```json {...}``` 요약
export function parseSummary(text: string): DraftSummary | undefined {
  const block = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1]
  if (!block) return undefined
  try {
    const value = JSON.parse(block)
    return Array.isArray(value.sections) ? value : undefined
  } catch {
    return undefined
  }
}

export interface RunOptions {
  cli: ClaudeCli
  cwd: string
  prompt: string
  allowedTools: string[]
  mcpConfigFile: string
  onEvent: (event: ClaudeEvent) => void
  extraArgs?: string[]
}

export function runClaude({ cli, cwd, prompt, allowedTools, mcpConfigFile, onEvent, extraArgs = [] }: RunOptions) {
  const child = spawn(
    cli.path,
    [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'default',
      '--mcp-config',
      mcpConfigFile,
      '--disallowedTools',
      ...DISALLOWED_TOOLS,
      '--allowedTools',
      ...allowedTools,
      ...extraArgs,
    ],
    { cwd, env: cli.env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let buffer = ''
  let stderr = ''
  let final: Extract<ClaudeEvent, { kind: 'result' }> | undefined
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    buffer += chunk
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      for (const event of parseStreamLine(line, cwd)) {
        if (event.kind === 'result') final = event
        onEvent(event)
      }
    }
  })
  child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d))
  const done = new Promise<Extract<ClaudeEvent, { kind: 'result' }>>((resolve, reject) => {
    child.on('error', (e) => reject(new Error(`Claude Code 실행 실패: ${e.message}`)))
    child.on('close', (code, signal) => {
      if (final) return resolve(final)
      if (signal) return reject(new Error('중지했습니다'))
      reject(new Error(`Claude Code가 결과 없이 끝났습니다 (code ${code})${stderr ? `\n${stderr.slice(-800)}` : ''}`))
    })
  })
  return { done, cancel: () => child.kill('SIGTERM') }
}
