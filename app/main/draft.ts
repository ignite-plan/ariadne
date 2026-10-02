// "Claude로 초안 만들기" 한 번 실행을 관리한다: Ariadne MCP 시작 → claude -p → 이벤트 전달 → 정리
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ManualRef } from '../../src/core/manual.ts'
import type { DraftCheck, DraftEvent, DraftInput, DraftResult } from '../shared/api.ts'
import draftSkill from '../../.claude/skills/manual-draft/SKILL.md?raw'
import refreshSkill from '../../.claude/skills/manual-refresh/SKILL.md?raw'
import videoSkill from '../../.claude/skills/manual-video-draft/SKILL.md?raw'
import { renderVideo } from '../../src/core/video/index.ts'
import { StepError } from '../../src/core/video/steps.ts'
import { skillText, taskText } from './lib/prompts.ts'
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
import { explainFailure, type ClaudeAuth } from './lib/claude-auth.ts'
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

export async function checkDraft(claudePath?: string, refresh = false, auth: ClaudeAuth = 'apiKey'): Promise<DraftCheck> {
  const cli = await findClaude(claudePath || undefined, refresh, auth)
  const authInfo = { mode: auth, keySource: cli?.keySource ?? null }
  if (!cli) return { claude: null, atlassian: [], auth: authInfo }
  try {
    const servers = await mcpServers(cli, refresh)
    return { claude: { path: cli.path, version: cli.version }, atlassian: servers.filter((s) => isAtlassianServer(s.name)), auth: authInfo }
  } catch (error) {
    return { claude: { path: cli.path, version: cli.version }, atlassian: [], auth: authInfo, error: (error as Error).message }
  }
}

const BUNDLED = { 'manual-draft': draftSkill, 'manual-refresh': refreshSkill, 'manual-video-draft': videoSkill }

export async function startDraft({
  ref,
  input,
  claudePath,
  claudeAuth = 'apiKey',
  codeDir,
  captureBaseUrl,
  authFile,
  onEvent,
}: {
  ref: ManualRef
  input: DraftInput
  claudePath?: string
  claudeAuth?: ClaudeAuth
  // 개발자 PC의 dealerhub-web. 있으면 읽기만 허용한다
  codeDir?: string
  captureBaseUrl: string
  authFile: string
  onEvent: (event: DraftEvent) => void
}): Promise<DraftResult> {
  if (current) throw new Error('이미 초안을 만드는 중입니다')
  // ~/.zshrc를 고친 뒤 앱을 다시 열지 않아도 최신 키·모델로 실행하도록 매번 로그인 셸을 다시 읽는다
  const cli = await findClaude(claudePath || undefined, true, claudeAuth)
  if (!cli) throw new Error('Claude Code CLI(claude)를 찾지 못했습니다. 설정 → 환경 점검을 확인하세요')
  if (claudeAuth === 'apiKey' && !cli.keySource) {
    throw new Error('ANTHROPIC_API_KEY를 찾지 못했습니다. ~/.zshrc에 키를 넣거나, 설정 → 고급 → Claude 인증을 claude.ai 로그인으로 바꾸세요')
  }

  onEvent({ kind: 'status', text: 'Confluence 연결 확인 중' })
  const atlassian = (await mcpServers(cli).catch(() => [] as McpStatus[])).filter((s) => isAtlassianServer(s.name))
  if (!atlassian.some((s) => s.connected)) {
    onEvent({ kind: 'warning', text: 'Claude Code에 연결된 Atlassian(Confluence) MCP가 없습니다. 기획서 없이 STG 화면만으로 쓰고 정책은 TODO로 남깁니다' })
  }

  const code = codeDir && existsSync(codeDir) ? realpathSync(codeDir) : undefined
  let stg: StgSession | undefined
  const mcp = await startAriadneMcp({
    ref,
    stg: () => (stg ??= new StgSession({ ...ref, baseUrl: captureBaseUrl, authFile })),
    // 영상 시나리오를 화면 없이(headless) 실행해 본다. 녹화·음성·파일 없음
    videoCheck: (id, fromScene) =>
      renderVideo({ ...ref, id, baseUrl: captureBaseUrl, authFile, preview: true, headed: false, fromScene, pace: 0.2, stepTimeout: 8000 }).then(
        (r) => ({ ok: true as const, durationMs: r.durationMs, blockedRequests: r.blockedRequests }),
        (error: Error) =>
          error instanceof StepError
            ? { ok: false as const, error: error.message, scene: error.scene, step: error.step }
            : { ok: false as const, error: error.message },
      ),
  })
  const work = mkdtempSync(join(tmpdir(), 'ariadne-draft-'))
  const mcpConfigFile = join(work, 'mcp.json')
  writeFileSync(mcpConfigFile, JSON.stringify(mcp.config))

  try {
    onEvent({ kind: 'status', text: 'Claude 시작' })
    const handle = runClaude({
      cli,
      cwd: ref.root,
      prompt: `${skillText(ref.root, input.mode, BUNDLED)}\n\n${taskText(ref, input, { codeDir: code })}`,
      allowedTools: buildAllowedTools(
        ref.manual,
        atlassian.filter((s) => s.connected).map((s) => s.name),
        realpathSync(ref.root),
        code ? [code] : [],
      ),
      mcpConfigFile,
      onEvent: (event) => onEvent({ kind: 'claude', event }),
    })
    current = handle
    const result = await handle.done
    return {
      manual: ref.manual,
      ok: result.ok,
      text: result.ok ? result.text : explainFailure(result.text, claudeAuth, cli.env),
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
