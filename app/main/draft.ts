// "Claude로 초안 만들기" 한 번 실행을 관리한다: Ariadne MCP 시작 → claude -p → 이벤트 전달 → 정리
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { manualDir, type ManualRef } from '../../src/core/manual.ts'
import type { OpenTab } from '../../src/core/session.ts'
import type { DraftCheck, DraftEvent, DraftInput, DraftResult, DraftSummary, ScreenResult } from '../shared/api.ts'
import draftSkill from '../../.claude/skills/manual-draft/SKILL.md?raw'
import refreshSkill from '../../.claude/skills/manual-refresh/SKILL.md?raw'
import specSkill from '../../.claude/skills/manual-spec/SKILL.md?raw'
import videoSkill from '../../.claude/skills/manual-video-draft/SKILL.md?raw'
import videoSceneSkill from '../../.claude/skills/manual-video-scene/SKILL.md?raw'
import { renderVideo } from '../../src/core/video/index.ts'
import { StepError } from '../../src/core/video/steps.ts'
import { namedSkillText, skillText, specTaskText, taskText } from './lib/prompts.ts'
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
import { startAriadneMcp, type AriadneMcpDeps } from './lib/mcp.ts'
import { runRefreshBatch } from './lib/refresh-batch.ts'
import { readSectionDoc, writeSectionDoc } from './lib/sections.ts'
import { digestPath, readDigest, specRefs, type SpecDigest } from './lib/spec.ts'
import { StgSession } from './lib/stg.ts'

// 최신화는 화면마다 Claude를 따로, 이만큼 동시에 돌린다 (공유 Chrome의 탭을 하나씩 쓴다)
const REFRESH_CONCURRENCY = 3

let mcpCache: { at: number; servers: McpStatus[] } | undefined
// 실행 중인 작업. 최신화는 Claude 여러 개
let current: { handles: Set<{ cancel: () => void }>; cancelled: boolean } | undefined

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

const BUNDLED = {
  'manual-draft': draftSkill,
  'manual-refresh': refreshSkill,
  'manual-video-draft': videoSkill,
  'manual-video-scene': videoSceneSkill,
  'manual-spec': specSkill,
}

interface DraftOptions {
  ref: ManualRef
  input: DraftInput
  claudePath?: string
  claudeAuth?: ClaudeAuth
  // 개발자 PC의 dealerhub-web. 있으면 읽기만 허용한다
  codeDir?: string
  captureBaseUrl: string
  // 로그인 세션(유지되는 Chrome 프로필)
  profileDir: string
  // 탭 여는 방법. 앱은 공유 Chrome의 탭을 넘긴다 (STG 탐색·영상 실행해 보기가 각자 탭을 쓰고, 영상 만들기와 동시에 돈다)
  openTab?: OpenTab
  onEvent: (event: DraftEvent) => void
}

export async function startDraft(options: DraftOptions): Promise<DraftResult> {
  if (current) throw new Error('이미 Claude 작업 중입니다')
  const job = { handles: new Set<{ cancel: () => void }>(), cancelled: false }
  current = job
  try {
    return await draft(options, job)
  } finally {
    current = undefined
  }
}

type Job = NonNullable<typeof current>

async function draft(
  { ref, input, claudePath, claudeAuth = 'apiKey', codeDir, captureBaseUrl, profileDir, openTab, onEvent }: DraftOptions,
  job: Job,
): Promise<DraftResult> {
  // ~/.zshrc를 고친 뒤 앱을 다시 열지 않아도 최신 키·모델로 실행하도록 매번 로그인 셸을 다시 읽는다
  const cli = await findClaude(claudePath || undefined, true, claudeAuth)
  if (!cli) throw new Error('Claude Code CLI(claude)를 찾지 못했습니다. 설정 → 환경 점검을 확인하세요')
  if (claudeAuth === 'apiKey' && !cli.keySource) {
    throw new Error('ANTHROPIC_API_KEY를 찾지 못했습니다. ~/.zshrc에 키를 넣거나, 설정 → 고급 → Claude 인증을 claude.ai 로그인으로 바꾸세요')
  }

  onEvent({ kind: 'status', text: 'Confluence 연결 확인 중' })
  const atlassian = (await mcpServers(cli).catch(() => [] as McpStatus[])).filter((s) => isAtlassianServer(s.name))
  const confluence = atlassian.filter((s) => s.connected).map((s) => s.name)
  if (!confluence.length) {
    onEvent({ kind: 'warning', text: 'Claude Code에 연결된 Atlassian(Confluence) MCP가 없습니다. 기획서 없이 STG 화면만으로 쓰고 정책은 TODO로 남깁니다' })
  }
  const code = codeDir && existsSync(codeDir) ? realpathSync(codeDir) : undefined
  const root = realpathSync(ref.root)
  const allowedTools = (extra: string[] = []) => [...buildAllowedTools(ref.manual, confluence, root, code ? [code] : []), ...extra]

  // Claude 하나 실행: 그 작업 전용 Ariadne MCP → claude -p → 정리
  const runOne: RunOne = async ({ prompt, tools, mcp: mcpDeps, target }) => {
    const mcp = await startAriadneMcp({ ref, ...mcpDeps })
    const work = mkdtempSync(join(tmpdir(), 'ariadne-draft-'))
    const mcpConfigFile = join(work, 'mcp.json')
    writeFileSync(mcpConfigFile, JSON.stringify(mcp.config))
    try {
      if (job.cancelled) return { ok: false, text: '취소했습니다', denials: [] as string[] }
      const handle = runClaude({ cli, cwd: ref.root, prompt, allowedTools: tools, mcpConfigFile, onEvent: (event) => onEvent({ kind: 'claude', event, target }) })
      job.handles.add(handle)
      try {
        const result = await handle.done
        return { ...result, text: result.ok ? result.text : explainFailure(result.text, claudeAuth, cli.env) }
      } finally {
        job.handles.delete(handle)
      }
    } finally {
      await mcp.close()
      rmSync(work, { recursive: true, force: true })
    }
  }

  if (input.mode === 'refresh' && input.targets?.length) {
    return refresh({ ref, input, captureBaseUrl, profileDir, openTab, onEvent, job, runOne, allowedTools, code, confluence: confluence.length > 0 })
  }

  let stg: StgSession | undefined
  try {
    onEvent({ kind: 'status', text: 'Claude 시작' })
    const result = await runOne({
      prompt: `${skillText(ref.root, input.mode, BUNDLED)}\n\n${taskText(ref, input, { codeDir: code })}`,
      tools: allowedTools(),
      mcp: {
        stg: () => (stg ??= new StgSession({ ...ref, baseUrl: captureBaseUrl, profileDir, openTab })),
        // 장면 하나만 채우는 작업이면 그 장면만 저장할 수 있다
        videoScene:
          input.mode === 'video-scene' && input.video
            ? { id: input.video, index: input.scene ?? 0, insert: Boolean(input.insert) }
            : undefined,
        // 영상 시나리오를 화면 없이(headless) 실행해 본다. 녹화·음성·파일 없음
        // 공유 Chrome이면 탭을 하나 더 연다. 단독 실행(openTab 없음)이면 프로필은 Chrome 하나만 열 수 있어 STG 탐색 브라우저를 닫고 실행한다
        videoCheck: async (id, fromScene) => {
          if (!openTab) await stg?.close()
          return renderVideo({ ...ref, id, baseUrl: captureBaseUrl, profileDir, openTab, preview: true, headed: false, fromScene, pace: 0.2, stepTimeout: 8000 }).then(
            (r) => ({ ok: true as const, durationMs: r.durationMs, blockedRequests: r.blockedRequests }),
            (error: Error) =>
              error instanceof StepError
                ? { ok: false as const, error: error.message, scene: error.scene, step: error.step }
                : { ok: false as const, error: error.message },
          )
        },
      },
    })
    return {
      manual: ref.manual,
      ok: result.ok,
      text: result.text,
      summary: parseSummary(result.text),
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      denials: result.denials,
    }
  } finally {
    await stg?.close()
  }
}

type RunOne = (args: { prompt: string; tools: string[]; mcp: Omit<AriadneMcpDeps, 'ref'>; target?: string }) => Promise<{
  ok: boolean
  text: string
  costUsd?: number
  durationMs?: number
  denials: string[]
}>

// 최신화: 기획서 요약 한 번 → 화면마다 Claude를 따로 (동시에 몇 개), STG 브라우저 하나를 탭으로 나눠 쓴다
async function refresh({
  ref,
  input,
  captureBaseUrl,
  profileDir,
  openTab,
  onEvent,
  job,
  runOne,
  allowedTools,
  code,
  confluence,
}: {
  ref: ManualRef
  input: DraftInput
  captureBaseUrl: string
  profileDir: string
  openTab?: OpenTab
  onEvent: (event: DraftEvent) => void
  job: Job
  runOne: RunOne
  allowedTools: (extra?: string[]) => string[]
  code?: string
  confluence: boolean
}): Promise<DraftResult> {
  const started = Date.now()
  const targets = input.targets ?? []
  const stgSession = () => new StgSession({ ...ref, baseUrl: captureBaseUrl, profileDir, openTab })
  const digestFile = digestPath(ref, input.menu)
  const relDigest = relative(ref.root, digestFile).split(sep).join('/')
  let costUsd = 0
  const denials: string[] = []
  const summaries = new Map<string, DraftSummary>()
  const failures: string[] = []

  const batch = await runRefreshBatch({
      targets,
      force: input.force,
      // 공유 Chrome이 없으면(단독 실행) 프로필 Chrome을 하나만 열 수 있어 한 화면씩
      concurrency: openTab ? REFRESH_CONCURRENCY : 1,
      isCancelled: () => job.cancelled,
      onEvent,
      readMeta: (target) => readSectionDoc(ref, target).meta,
      recordRefresh: (target, digest: SpecDigest) => {
        const doc = readSectionDoc(ref, target)
        writeSectionDoc(ref, target, doc.body, { ...doc.meta, refreshedFrom: specRefs(digest) })
      },
      runSpec: async () => {
        // Confluence가 없으면 요약을 만들 수 없다. 지난 요약도 최신인지 알 수 없어 쓰지 않는다
        if (!confluence) return undefined
        const previous = readDigest(digestFile)
        mkdirSync(dirname(digestFile), { recursive: true })
        const result = await runOne({
          prompt: `${namedSkillText(ref.root, 'manual-spec', BUNDLED)}\n\n${specTaskText(ref, input, { digestFile: relDigest, previous: previous?.pages })}`,
          tools: allowedTools([`Write(./${relDigest})`]),
          // 요약 단계는 기획서만 본다
          mcp: {
            stg: () => {
              throw new Error('기획서 요약 단계에서는 STG를 쓰지 않습니다')
            },
          },
          target: '기획서 요약',
        })
        costUsd += result.costUsd ?? 0
        denials.push(...result.denials)
        if (!result.ok) throw new Error(result.text)
        const digest = readDigest(digestFile)
        if (!digest) throw new Error(`요약 파일을 만들지 못했습니다: ${relDigest}`)
        return digest
      },
      runScreen: async (target, brief) => {
        const file = join(manualDir(ref), target)
        const before = readFileSync(file, 'utf8')
        let stg: StgSession | undefined
        try {
          const result = await runOne({
            prompt: `${skillText(ref.root, 'refresh', BUNDLED)}\n\n${taskText(ref, { ...input, targets: [target] }, { codeDir: code, brief })}`,
            tools: allowedTools(),
            mcp: { stg: () => (stg ??= stgSession()) },
            target,
          })
          costUsd += result.costUsd ?? 0
          denials.push(...result.denials)
          const summary = parseSummary(result.text)
          if (summary) summaries.set(target, summary)
          if (!result.ok) failures.push(`${target}: ${result.text}`)
          const changed = readFileSync(file, 'utf8') !== before || Boolean(summary?.images?.length)
          return { ok: result.ok, changed, todos: summary?.todos, text: result.text, durationMs: result.durationMs }
        } finally {
          await stg?.close()
        }
      },
    })
  return refreshResult(ref.manual, batch.screens, batch.digest, summaries, {
    costUsd,
    denials,
    failures,
    durationMs: Date.now() - started,
    cancelled: job.cancelled,
  })
}

function refreshResult(
  manual: string,
  screens: ScreenResult[],
  digest: SpecDigest | undefined,
  summaries: Map<string, DraftSummary>,
  { costUsd, denials, failures, durationMs, cancelled }: { costUsd: number; denials: string[]; failures: string[]; durationMs: number; cancelled: boolean },
): DraftResult {
  const by = (status: ScreenResult['status']) => screens.filter((s) => s.status === status).map((s) => s.target)
  const notes = [...summaries.entries()].map(([t, s]) => (s.notes ? `${t}: ${s.notes}` : '')).filter(Boolean)
  const summary: DraftSummary = {
    sections: by('done'),
    unchanged: by('unchanged'),
    skipped: by('skipped'),
    images: [...new Set([...summaries.values()].flatMap((s) => s.images ?? []))],
    todos: [...summaries.values()].reduce((n, s) => n + (s.todos ?? 0), 0),
    sources: digest
      ? digest.pages.map((p) => ({ title: p.title, url: p.url, version: String(p.version) }))
      : [...new Map([...summaries.values()].flatMap((s) => s.sources ?? []).map((src) => [src.url ?? src.title, src])).values()],
    notes: notes.join('\n') || undefined,
  }
  const failed = by('failed')
  const counts = [
    `고침 ${summary.sections.length}`,
    `바꿀 것 없음 ${summary.unchanged?.length ?? 0}`,
    `건너뜀 ${summary.skipped?.length ?? 0}`,
    failed.length ? `실패 ${failed.length}` : '',
    by('cancelled').length ? `취소 ${by('cancelled').length}` : '',
  ].filter(Boolean)
  const text = [`화면 ${screens.length}개: ${counts.join(', ')}`, ...notes, ...failures].join('\n')
  return {
    manual,
    ok: !cancelled && failed.length === 0,
    text: cancelled ? `취소했습니다. ${text}` : text,
    summary,
    screens,
    costUsd,
    durationMs,
    denials: [...new Set(denials)],
  }
}

export function cancelDraft() {
  if (!current) return
  current.cancelled = true
  for (const handle of current.handles) handle.cancel()
}
