// "Claude로 초안 만들기" 한 번 실행을 관리한다: Ariadne MCP 시작 → claude -p → 이벤트 전달 → 정리
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ManualRef } from '../../src/core/manual.ts'
import type { DraftCheck, DraftEvent, DraftInput, DraftResult } from '../shared/api.ts'
import bundledSkill from '../../.claude/skills/manual-draft/SKILL.md?raw'
import {
  buildAllowedTools,
  findClaude,
  isAtlassianServer,
  listMcpServers,
  parseSummary,
  runClaude,
  type ClaudeCli,
  type McpStatus,
} from './lib/claude.ts'
import { startAriadneMcp } from './lib/mcp.ts'
import { StgSession } from './lib/stg.ts'

let mcpCache: { at: number; servers: McpStatus[] } | undefined
let current: { cancel: () => void } | undefined

async function mcpServers(cli: ClaudeCli, refresh = false) {
  // claude mcp list는 서버마다 연결을 시험해 수십 초 걸린다. 10분 캐시
  if (!refresh && mcpCache && Date.now() - mcpCache.at < 10 * 60 * 1000) return mcpCache.servers
  const servers = await listMcpServers(cli)
  mcpCache = { at: Date.now(), servers }
  return servers
}

export async function checkDraft(claudePath?: string, refresh = false): Promise<DraftCheck> {
  const cli = await findClaude(claudePath || undefined, refresh)
  if (!cli) return { claude: null, atlassian: [] }
  try {
    const servers = await mcpServers(cli, refresh)
    return { claude: { path: cli.path, version: cli.version }, atlassian: servers.filter((s) => isAtlassianServer(s.name)) }
  } catch (error) {
    return { claude: { path: cli.path, version: cli.version }, atlassian: [], error: (error as Error).message }
  }
}

function skillText(root: string) {
  const file = join(root, '.claude/skills/manual-draft/SKILL.md')
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : bundledSkill
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

function taskText(ref: ManualRef, input: DraftInput) {
  const place = input.chapterDir
    ? `기존 장 \`${input.chapterDir}\`에 추가`
    : `새 장 "${input.newChapterTitle ?? input.menu}"을(를) chapterIndex ${input.chapterIndex ?? '맨 뒤'} 위치에 만든다`
  return [
    '## 이번 작업',
    `- 매뉴얼 id: ${ref.manual}`,
    `- 메뉴: ${input.menu}`,
    `- 넣을 위치: ${place}`,
    `- STG 경로 힌트: ${input.path || '(없음 — Confluence 메뉴 LIST에서 찾는다)'}`,
    input.notes ? `- 기획자 메모: ${input.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function startDraft({
  ref,
  input,
  claudePath,
  captureBaseUrl,
  authFile,
  onEvent,
}: {
  ref: ManualRef
  input: DraftInput
  claudePath?: string
  captureBaseUrl: string
  authFile: string
  onEvent: (event: DraftEvent) => void
}): Promise<DraftResult> {
  if (current) throw new Error('이미 초안을 만드는 중입니다')
  const cli = await findClaude(claudePath || undefined)
  if (!cli) throw new Error('Claude Code CLI(claude)를 찾지 못했습니다. 설정 → 환경 점검을 확인하세요')

  onEvent({ kind: 'status', text: 'Confluence 연결 확인 중' })
  const atlassian = (await mcpServers(cli).catch(() => [] as McpStatus[])).filter((s) => isAtlassianServer(s.name))
  if (!atlassian.some((s) => s.connected)) {
    onEvent({ kind: 'warning', text: 'Claude Code에 연결된 Atlassian(Confluence) MCP가 없습니다. 기획서 없이 STG 화면만으로 쓰고 정책은 TODO로 남깁니다' })
  }

  let stg: StgSession | undefined
  const mcp = await startAriadneMcp({
    ref,
    stg: () => (stg ??= new StgSession({ ...ref, baseUrl: captureBaseUrl, authFile })),
  })
  const work = mkdtempSync(join(tmpdir(), 'ariadne-draft-'))
  const mcpConfigFile = join(work, 'mcp.json')
  writeFileSync(mcpConfigFile, JSON.stringify(mcp.config))

  try {
    onEvent({ kind: 'status', text: 'Claude 시작' })
    const handle = runClaude({
      cli,
      cwd: ref.root,
      prompt: `${skillText(ref.root)}\n\n${taskText(ref, input)}`,
      allowedTools: buildAllowedTools(ref.manual, atlassian.filter((s) => s.connected).map((s) => s.name), realpathSync(ref.root)),
      mcpConfigFile,
      onEvent: (event) => onEvent({ kind: 'claude', event }),
    })
    current = handle
    const result = await handle.done
    return {
      ok: result.ok,
      text: result.text,
      summary: parseSummary(result.text),
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      denials: result.denials,
    }
  } finally {
    current = undefined
    await stg?.close()
    await mcp.close()
    rmSync(work, { recursive: true, force: true })
  }
}

export function cancelDraft() {
  current?.cancel()
}
