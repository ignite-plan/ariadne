// "Claude로 초안 만들기" 한 번 실행을 관리한다: Ariadne MCP 시작 → claude -p → 이벤트 전달 → 정리
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
import { composePrompt, namedSkillText, skillText, specTaskText, taskText } from './lib/prompts.ts'
import {
  buildAllowedTools,
  findClaude,
  isAtlassianServer,
  listMcpServers,
  mcpServerRule,
  parseSummary,
  runClaude,
  type ClaudeCli,
  type McpStatus,
} from './lib/claude.ts'
import { explainFailure, longContextModel, type ClaudeAuth } from './lib/claude-auth.ts'
import type { ClaudeEffort } from '../shared/api.ts'
import { startAriadneMcp, type AriadneMcpDeps } from './lib/mcp.ts'
import { createRunGuard, type GuardLimits } from './lib/run-guard.ts'
import { BUILTIN_TOOLS, buildRunMcpConfig, claudeConfigFile, MCP_ATLASSIAN_JIRA_READ_TOOLS, readClaudeMcpServers } from './lib/run-mcp.ts'
import { runRefreshBatch } from './lib/refresh-batch.ts'
import { readSectionDoc, writeSectionDoc } from './lib/sections.ts'
import { digestPath, parseSpecReply, readDigest, specRefs, writeDigest, type SpecDigest } from './lib/spec.ts'
import { StgSession } from './lib/stg.ts'
import { createMcpStatusCache, type McpStatusCache } from './lib/mcp-status.ts'
import { checkScope, needsConfluence, scopeLabel } from '../shared/draft-mode.ts'
import { errorText } from './lib/logger.ts'
import { log } from './report-ipc.ts'

// 최신화는 화면마다 Claude를 따로, 이만큼 동시에 돌린다 (공유 Chrome의 탭을 하나씩 쓴다)
const REFRESH_CONCURRENCY = 3
// 기획서 요약 단계의 최대 턴. 넘으면 요약 없이 화면별로 진행한다
const SPEC_MAX_TURNS = 60
// 화면 하나의 상한. 넘으면 그 화면만 실패로 끝내고 다른 화면은 계속한다
const SCREEN_LIMITS = { maxTurns: 120, timeoutMs: 20 * 60 * 1000, maxEditFailures: 4 }

let current: { handles: Set<{ cancel: () => void }>; cancelled: boolean } | undefined

// claude mcp list 결과. Atlassian 연결이 확인되면 앱을 끌 때까지 기억한다 (매번 30초씩 기다리지 않게)
let mcpStatus: McpStatusCache | undefined
let mcpCli: ClaudeCli | undefined
function mcpServers(cli: ClaudeCli, refresh = false) {
  // 설정에서 CLI 경로를 바꿀 수 있어 마지막에 받은 것으로 확인한다
  mcpCli = cli
  mcpStatus ??= createMcpStatusCache(() => listMcpServers(mcpCli!), (s) => isAtlassianServer(s.name), {
    onResult: ({ servers, error, ms }) => {
      if (error) return log.write('warn', 'mcp', `claude mcp list 실패 (${ms}ms): ${errorText(error)}`)
      const ok = servers!.some((s) => isAtlassianServer(s.name) && s.connected)
      const states = servers!.map((s) => (s.connected ? `${s.name} ✔` : `${s.name} ✘ ${s.detail ?? ''}`.trim())).join(' · ')
      log.write(ok ? 'info' : 'warn', 'mcp', `claude mcp list ${ms}ms: ${states || '(서버 없음)'}`)
    },
  })
  return mcpStatus.get(refresh)
}

// 점검 화면. Claude Code 위치·키와 Atlassian 연결은 한 번 확인하면 기억해 둔다 (refresh면 다시 확인).
// confluence: false면 이 작업은 기획서를 안 쓰므로 Atlassian을 확인하지 않는다
export async function checkDraft(
  claudePath?: string,
  { refresh = false, confluence = true }: { refresh?: boolean; confluence?: boolean } = {},
  auth: ClaudeAuth = 'apiKey',
): Promise<DraftCheck> {
  const cli = await findClaude(claudePath || undefined, refresh, auth)
  const authInfo = { mode: auth, keySource: cli?.keySource ?? null }
  if (!cli) return { claude: null, atlassian: [], auth: authInfo }
  const claude = { path: cli.path, version: cli.version }
  if (!confluence) return { claude, atlassian: [], auth: authInfo, atlassianSkipped: true }
  try {
    const { servers, checkedAt } = await mcpServers(cli, refresh)
    return { claude, atlassian: servers.filter((s) => isAtlassianServer(s.name)), atlassianCheckedAt: checkedAt, auth: authInfo }
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
  // 1M 문맥 모델로 실행 (큰 기획서·긴 STG 탐색에서 자동 요약을 피한다)
  longContext?: boolean
  // 생각량. 매뉴얼 작업은 확인·옮기기가 많아 medium이면 충분하고 훨씬 빠르다
  effort?: ClaudeEffort
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
  // 반영 범위는 최신화에만. 형식을 확인하고 빈 값은 범위 없음으로
  if (options.input.scope) {
    const checked = options.input.mode === 'refresh' ? checkScope(options.input.scope) : {}
    if ('error' in checked && checked.error) throw new Error(checked.error)
    options = { ...options, input: { ...options.input, scope: checked.scope } }
  }
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
  { ref, input, claudePath, claudeAuth = 'apiKey', longContext = false, effort, codeDir, captureBaseUrl, profileDir, openTab, onEvent }: DraftOptions,
  job: Job,
): Promise<DraftResult> {
  // ~/.zshrc를 고친 뒤 앱을 다시 열지 않아도 최신 키·모델로 실행하도록 매번 로그인 셸을 다시 읽는다
  const cli = await findClaude(claudePath || undefined, true, claudeAuth)
  if (!cli) throw new Error('Claude Code CLI(claude)를 찾지 못했습니다. 설정 → 환경 점검을 확인하세요')
  if (claudeAuth === 'apiKey' && !cli.keySource) {
    throw new Error('ANTHROPIC_API_KEY를 찾지 못했습니다. ~/.zshrc에 키를 넣거나, 설정 → 고급 → Claude 인증을 claude.ai 로그인으로 바꾸세요')
  }

  // 기획서를 안 쓰는 작업(장면 채우기 등)은 Atlassian을 확인하지도 싣지도 않는다
  let confluence: string[] = []
  if (needsConfluence(input)) {
    onEvent({ kind: 'status', text: 'Confluence 연결 확인 중' })
    const servers = await mcpServers(cli).then(
      (r) => r.servers,
      () => [] as McpStatus[],
    )
    confluence = servers.filter((s) => isAtlassianServer(s.name) && s.connected).map((s) => s.name)
    if (!confluence.length) {
      onEvent({ kind: 'warning', text: 'Claude Code에 연결된 Atlassian(Confluence) MCP가 없습니다. 기획서 없이 STG 화면만으로 쓰고 정책은 TODO로 남깁니다' })
    }
  }
  const code = codeDir && existsSync(codeDir) ? realpathSync(codeDir) : undefined
  const root = realpathSync(ref.root)
  // withConfluence: false면 Confluence 도구를 주지 않는다 (기획서 요약을 받은 화면 작업)
  const allowedTools = (extra: string[] = [], { withConfluence = true } = {}) => [
    ...buildAllowedTools(ref.manual, withConfluence ? confluence : [], root, code ? [code] : []),
    ...extra,
  ]

  // Claude 하나 실행: 그 작업 전용 Ariadne MCP → claude -p → 정리
  const model = longContext ? longContextModel(cli.env) : undefined
  // PC에 등록된 MCP 서버 설정 (Atlassian 설정을 그대로 옮겨 strict로 실행하려고)
  const registered = readClaudeMcpServers(claudeConfigFile(cli.env), [...new Set([ref.root, root])])
  let warnedLoose = false

  const runOne: RunOne = async ({ prompt, tools, mcp: mcpDeps, target, extraArgs, disallowedTools, limits, withConfluence = true, withJira = false }) => {
    const mcp = await startAriadneMcp({ ref, ...mcpDeps })
    const work = mkdtempSync(join(tmpdir(), 'ariadne-draft-'))
    const mcpConfigFile = join(work, 'mcp.json')
    const run = buildRunMcpConfig(mcp.config.mcpServers, withConfluence ? confluence : [], registered, { jira: withJira })
    if (!run.strict && !warnedLoose) {
      warnedLoose = true
      log.write('warn', 'mcp', `Atlassian MCP 설정을 찾지 못해 등록된 MCP를 모두 싣고 실행합니다: ${run.missing.join(', ')}`)
    }
    // Atlassian 서버 설정에는 토큰이 들어 있다. 이 작업만 쓰는 임시 폴더(0700)에 나만 읽게 쓰고 끝나면 지운다
    writeFileSync(mcpConfigFile, JSON.stringify(run.config), { mode: 0o600 })
    try {
      if (job.cancelled) return { ok: false, text: '취소했습니다', denials: [] as string[] }
      let stop = (_reason: string) => {}
      const guard = createRunGuard(limits ?? {}, (reason) => {
        onEvent({ kind: 'warning', text: reason, target })
        stop(reason)
      })
      const handle = runClaude({
        cli,
        cwd: ref.root,
        prompt,
        allowedTools: tools,
        mcpConfigFile,
        extraArgs,
        disallowedTools,
        strictMcp: run.strict,
        model,
        effort,
        builtinTools: BUILTIN_TOOLS,
        onEvent: (event) => {
          guard.onEvent(event)
          onEvent({ kind: 'claude', event, target })
        },
      })
      stop = () => handle.cancel()
      job.handles.add(handle)
      try {
        const result = await handle.done
        if (guard.stopped) return { ...result, ok: false, text: guard.stopped }
        // 턴 상한에 걸리면 결과 문구가 비어 있다
        if (!result.ok && !result.text.trim() && result.turns) return { ...result, text: `턴 상한(${result.turns}턴)에 걸려 멈췄습니다` }
        return { ...result, text: result.ok ? result.text : explainFailure(result.text, claudeAuth, cli.env) }
      } catch (error) {
        if (guard.stopped) return { ok: false, text: guard.stopped, denials: [] as string[] }
        throw error
      } finally {
        guard.dispose()
        job.handles.delete(handle)
      }
    } finally {
      await mcp.close()
      rmSync(work, { recursive: true, force: true })
    }
  }

  if (input.mode === 'refresh' && input.targets?.length) {
    return refresh({
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
      confluence: confluence.length > 0,
      confluenceServers: confluence,
    })
  }

  let stg: StgSession | undefined
  try {
    onEvent({ kind: 'status', text: 'Claude 시작' })
    const result = await runOne({
      prompt: composePrompt(skillText(ref.root, input.mode, BUNDLED), taskText(ref, input, { codeDir: code })),
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

type RunOne = (args: {
  prompt: string
  tools: string[]
  mcp: Omit<AriadneMcpDeps, 'ref'>
  target?: string
  extraArgs?: string[]
  disallowedTools?: string[]
  limits?: GuardLimits
  // false면 Atlassian MCP를 싣지 않는다 (기획서 요약을 받은 화면 작업)
  withConfluence?: boolean
  // Atlassian MCP에 Jira 읽기 도구도 켠다 (반영 범위에 티켓이 있는 기획서 요약)
  withJira?: boolean
}) => Promise<{
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
  confluenceServers,
}: {
  ref: ManualRef
  input: DraftInput
  captureBaseUrl: string
  profileDir: string
  openTab?: OpenTab
  onEvent: (event: DraftEvent) => void
  job: Job
  runOne: RunOne
  allowedTools: (extra?: string[], options?: { withConfluence?: boolean }) => string[]
  code?: string
  confluence: boolean
  confluenceServers: string[]
}): Promise<DraftResult> {
  const started = Date.now()
  const targets = input.targets ?? []
  const stgSession = () => new StgSession({ ...ref, baseUrl: captureBaseUrl, profileDir, openTab })
  const digestFile = digestPath(ref, input.menu)
  let costUsd = 0
  const denials: string[] = []
  const summaries = new Map<string, DraftSummary>()
  const failures: string[] = []

  const scoped = Boolean(input.scope)
  const jira = Boolean(input.scope?.tickets?.length)
  if (scoped) onEvent({ kind: 'status', text: `반영 범위: ${scopeLabel(input.scope)}` })
  const batch = await runRefreshBatch({
      targets,
      force: input.force,
      scoped,
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
        // 범위를 정한 요약은 일부만 담으므로 지난 요약을 쓰지도, 저장하지도 않는다
        const previous = scoped ? undefined : readDigest(digestFile)
        const result = await runOne({
          prompt: composePrompt(namedSkillText(ref.root, 'manual-spec', BUNDLED, { bundledFirst: true }), specTaskText(ref, input, { previous: previous?.pages })),
          // 읽기만. 요약은 마지막 응답으로 받고 파일은 앱이 쓴다
          tools: [
            ...allowedTools().filter((tool) => !/^(Edit|Write)\(/.test(tool)),
            ...(jira ? confluenceServers.flatMap((s) => MCP_ATLASSIAN_JIRA_READ_TOOLS.map((t) => `${mcpServerRule(s)}__${t}`)) : []),
          ],
          withJira: jira,
          // 막힌 도구를 계속 다시 시도하는 일 없이 끝나게
          extraArgs: ['--max-turns', String(SPEC_MAX_TURNS)],
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
        const reply = parseSpecReply(result.text, input.menu)
        if (!reply) throw new Error('기획서 요약 응답에서 JSON을 읽지 못했습니다')
        if (reply.reused) {
          if (!previous) throw new Error('지난 요약이 없는데 재사용한다고 답했습니다')
          onEvent({ kind: 'status', text: '기획서가 지난 요약 때와 같아 그 요약을 씁니다' })
          return previous
        }
        if (scoped && !reply.digest.changes) throw new Error('반영 범위 요약에 화면별 변경(changes)이 없습니다')
        if (!scoped) writeDigest(digestFile, reply.digest)
        return reply.digest
      },
      runScreen: async (target, brief) => {
        const file = join(manualDir(ref), target)
        const before = readFileSync(file, 'utf8')
        let stg: StgSession | undefined
        try {
          // 기획서 요약을 받았으면 Confluence를 다시 뒤지지 않게 도구를 빼고 막는다 (요약에 없는 정책은 TODO)
          const withConfluence = !brief
          const result = await runOne({
            prompt: composePrompt(skillText(ref.root, 'refresh', BUNDLED), taskText(ref, { ...input, targets: [target] }, { codeDir: code, brief })),
            tools: allowedTools([], { withConfluence }),
            disallowedTools: withConfluence ? [] : confluenceServers.map(mcpServerRule),
            withConfluence,
            extraArgs: ['--max-turns', String(SCREEN_LIMITS.maxTurns)],
            limits: SCREEN_LIMITS,
            mcp: {
              stg: () => (stg ??= stgSession()),
              noShots: scoped
                ? '반영 범위를 정한 최신화에서는 캡처를 다시 찍지 않습니다 (STG에 범위 밖 변경이 있을 수 있음). 이미지가 맞지 않으면 TODO로 남기세요'
                : undefined,
            },
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
