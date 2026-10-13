// "Claude로 초안 만들기" 한 번 실행을 관리한다: Ariadne MCP 시작 → claude -p → 이벤트 전달 → 정리
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
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
import { stepFailure } from '../../src/core/video/steps.ts'
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
import { explainFailure, type ClaudeAuthSetting } from './lib/claude-auth.ts'
import type { ClaudeEffort } from '../shared/api.ts'
import { MCP_NAME, startAriadneMcp, type AriadneMcpDeps } from './lib/mcp.ts'
import { createRunGuard, type GuardLimits } from './lib/run-guard.ts'
import {
  bareFlags,
  BUILTIN_TOOLS,
  buildRunMcpConfig,
  canRunBare,
  claudeConfigFile,
  MCP_ATLASSIAN_JIRA_READ_TOOLS,
  readClaudeMcpServers,
  type McpServerConfig,
} from './lib/run-mcp.ts'
import { runRefreshBatch } from './lib/refresh-batch.ts'
import { clearReview, saveReviewBase } from './lib/review.ts'
import { readSectionDoc, writeSectionDoc } from './lib/sections.ts'
import { digestPath, parseSpecReply, readDigest, specRefs, writeDigest, type SpecDigest } from './lib/spec.ts'
import { StgSession } from './lib/stg.ts'
import { createMcpStatusCache, type McpStatusCache } from './lib/mcp-status.ts'
import { checkScope, needsConfluence, scopeLabel } from '../shared/draft-mode.ts'
import { errorText } from './lib/logger.ts'
import { log } from './log.ts'

// 최신화는 화면마다 Claude를 따로, 이만큼 동시에 돌린다 (공유 Chrome의 탭을 하나씩 쓴다)
const REFRESH_CONCURRENCY = 3
// 기획서 요약 단계의 최대 턴. 넘으면 실패로 보고 요약 없이 계속할지 묻는다
const SPEC_MAX_TURNS = 150
// 요약 단계가 헛돌면 상한 전에 끊는다 (같은 조회 반복, 도구 오류 연속)
const SPEC_LIMITS = { maxRepeats: 3, maxConsecutiveErrors: 6 }
// 화면 하나의 상한. 넘으면 그 화면만 실패로 끝내고 다른 화면은 계속한다
const SCREEN_LIMITS = { maxTurns: 120, timeoutMs: 20 * 60 * 1000, maxEditFailures: 4, maxRepeats: 4, maxConsecutiveErrors: 8 }

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
  auth: ClaudeAuthSetting = 'auto',
): Promise<DraftCheck> {
  const cli = await findClaude(claudePath || undefined, refresh, auth)
  const authInfo = { mode: cli?.auth ?? (auth === 'login' ? 'login' : 'apiKey'), keySource: cli?.keySource ?? null }
  if (!cli) return { claude: null, atlassian: [], auth: authInfo }
  const claude = { path: cli.path, version: cli.version, managed: cli.managed }
  if (!confluence) return { claude, atlassian: [], auth: authInfo, atlassianSkipped: true }
  try {
    const { servers, checkedAt } = await mcpServers(cli, refresh)
    return { claude, atlassian: servers.filter((s) => isAtlassianServer(s.name)), atlassianCheckedAt: checkedAt, auth: authInfo }
  } catch (error) {
    return { claude, atlassian: [], auth: authInfo, error: (error as Error).message }
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
  claudeAuth?: ClaudeAuthSetting
  // --model 값 (기본 claude-sonnet-5[1m]: 큰 기획서·긴 STG 탐색에서 자동 요약을 피한다). 비우면 ANTHROPIC_MODEL
  model?: string
  // 생각량. 매뉴얼 작업은 확인·옮기기가 많아 medium이면 충분하고 훨씬 빠르다
  effort?: ClaudeEffort
  // 개발자 PC의 dealerhub-web. 있으면 읽기만 허용한다
  codeDir?: string
  captureBaseUrl: string
  // 로그인 세션(유지되는 Chrome 프로필)
  profileDir: string
  // 탭 여는 방법. 앱은 공유 Chrome의 탭을 넘긴다 (STG 탐색·영상 실행해 보기가 각자 탭을 쓰고, 영상 만들기와 동시에 돈다)
  openTab?: OpenTab
  // 앱 전용 Claude 설정 폴더 (--bare로 실행할 때 CLAUDE_CONFIG_DIR. 대화 기록도 여기에 쌓인다)
  claudeDataDir?: string
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

// 이 작업의 모든 Claude 실행이 같이 쓰는 것
interface RunContext {
  ref: ManualRef
  cli: ClaudeCli
  root: string
  // 연결된 Atlassian MCP 서버 이름 (기획서를 쓰지 않는 작업이면 비어 있다)
  confluence: string[]
  // PC에 등록된 MCP 서버 설정 (Atlassian 설정을 그대로 옮겨 strict로 실행하려고)
  registered: Record<string, McpServerConfig>
  // 개발자 PC의 dealerhub-web (읽기만)
  code?: string
  bare: boolean
  configDir?: string
  model?: string
  effort?: ClaudeEffort
  // STG 탐색 브라우저 (Claude 실행마다 하나, 처음 STG 도구를 부를 때 연다)
  newStg: () => StgSession
  // 공유 Chrome의 탭을 빌려 쓰는지 (아니면 프로필로 Chrome을 하나만 띄울 수 있다)
  sharedBrowser: boolean
}

// Claude Code·Atlassian 연결을 확인하고 실행 방식을 정한다
async function prepareRun(
  { ref, input, claudePath, claudeAuth = 'auto', model, effort, codeDir, captureBaseUrl, profileDir, openTab, claudeDataDir, onEvent }: DraftOptions,
): Promise<RunContext> {
  // ~/.zshrc를 고친 뒤 앱을 다시 열지 않아도 최신 키·모델로 실행하도록 매번 로그인 셸을 다시 읽는다
  const cli = await findClaude(claudePath || undefined, true, claudeAuth)
  if (!cli) throw new Error('Claude Code CLI(claude)를 찾지 못했습니다. 설정 → 환경 점검을 확인하세요')
  if (cli.auth === 'apiKey' && !cli.keySource) {
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
  const root = realpathSync(ref.root)
  const registered = readClaudeMcpServers(claudeConfigFile(cli.env), [...new Set([ref.root, root])])
  const bare = canRunBare({ dataDir: claudeDataDir, auth: cli.auth, hasKey: Boolean(cli.env.ANTHROPIC_API_KEY), atlassian: confluence, registered })
  if (bare) mkdirSync(claudeDataDir!, { recursive: true })
  return {
    ref,
    cli,
    root,
    confluence,
    registered,
    code: codeDir && existsSync(codeDir) ? realpathSync(codeDir) : undefined,
    bare,
    configDir: bare ? claudeDataDir : undefined,
    model: model?.trim() || undefined,
    effort,
    newStg: () => new StgSession({ ...ref, baseUrl: captureBaseUrl, profileDir, openTab }),
    sharedBrowser: Boolean(openTab),
  }
}

// 허용 도구. withConfluence: false면 Confluence 도구를 주지 않는다 (기획서 요약을 받은 화면 작업)
function allowedTools(ctx: RunContext, { withConfluence = true } = {}) {
  return buildAllowedTools(ctx.ref.manual, withConfluence ? ctx.confluence : [], ctx.root, ctx.code ? [ctx.code] : [], MCP_NAME, ctx.configDir)
}

// Claude 하나 실행: 그 실행 전용 Ariadne MCP → claude -p → 정리
function createRunOne(ctx: RunContext, job: Job, onEvent: (event: DraftEvent) => void): RunOne {
  const { ref, cli } = ctx
  let warnedLoose = false
  return async ({ prompt, tools, mcp: mcpDeps, target, extraArgs, disallowedTools, limits, withConfluence = true, withJira = false }) => {
    const mcp = await startAriadneMcp({ ref, ...mcpDeps })
    const work = mkdtempSync(join(tmpdir(), 'ariadne-draft-'))
    const mcpConfigFile = join(work, 'mcp.json')
    const run = buildRunMcpConfig(mcp.config.mcpServers, withConfluence ? ctx.confluence : [], ctx.registered, { jira: withJira })
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
        ...bareFlags(ctx.bare, run.strict, ctx.configDir),
        model: ctx.model,
        effort: ctx.effort,
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
        return { ...result, text: result.ok ? result.text : explainFailure(result.text, cli.auth, cli.env) }
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
}

async function draft(options: DraftOptions, job: Job): Promise<DraftResult> {
  const { ref, input, captureBaseUrl, profileDir, openTab, onEvent } = options
  const ctx = await prepareRun(options)
  const runOne = createRunOne(ctx, job, onEvent)

  if (input.mode === 'refresh' && input.targets?.length) return refresh({ ctx, input, onEvent, job, runOne })

  let stg: StgSession | undefined
  try {
    onEvent({ kind: 'status', text: 'Claude 시작' })
    const result = await runOne({
      prompt: composePrompt(skillText(ref.root, input.mode, BUNDLED), taskText(ref, input, { codeDir: ctx.code })),
      tools: allowedTools(ctx),
      mcp: {
        stg: () => (stg ??= ctx.newStg()),
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
            (error) => ({ ok: false as const, ...stepFailure(error) }),
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

// 여러 Claude 실행의 비용·막은 요청 합계
function totals() {
  const sum = { costUsd: 0, denials: [] as string[] }
  return {
    sum,
    add: (result: Awaited<ReturnType<RunOne>>) => {
      sum.costUsd += result.costUsd ?? 0
      sum.denials.push(...result.denials)
    },
  }
}

// 최신화: 기획서 요약 한 번 → 화면마다 Claude를 따로 (동시에 몇 개), STG 브라우저 하나를 탭으로 나눠 쓴다
async function refresh({
  ctx,
  input,
  onEvent,
  job,
  runOne,
}: {
  ctx: RunContext
  input: DraftInput
  onEvent: (event: DraftEvent) => void
  job: Job
  runOne: RunOne
}): Promise<DraftResult> {
  const { ref } = ctx
  const started = Date.now()
  const targets = input.targets ?? []
  const digestFile = digestPath(ref, input.menu)
  const cost = totals()
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
      concurrency: ctx.sharedBrowser ? REFRESH_CONCURRENCY : 1,
      isCancelled: () => job.cancelled,
      onEvent,
      readMeta: (target) => readSectionDoc(ref, target).meta,
      recordRefresh: (target, digest: SpecDigest) => {
        const doc = readSectionDoc(ref, target)
        writeSectionDoc(ref, target, doc.body, { ...doc.meta, refreshedFrom: specRefs(digest) })
      },
      // 요약이 실패하면 화면별로 퍼지기 전에 묻는다. 중지하면 작업 전체를 취소로 끝낸다
      onSpecFailed: async (message) => {
        const proceed = await ask(
          `기획서 요약을 만들지 못했습니다 (${message.slice(0, 300)}). 요약 없이 계속하면 화면마다 Claude가 Confluence를 직접 찾아 느리고${scoped ? ', 반영 범위를 정확히 지키기 어렵습니다' : ' 시간이 더 걸립니다'}.`,
          onEvent,
        )
        if (!proceed) job.cancelled = true
        return proceed
      },
      runSpec: async () => {
        // Confluence가 없으면 요약을 만들 수 없다. 지난 요약도 최신인지 알 수 없어 쓰지 않는다
        if (!ctx.confluence.length) return undefined
        // 범위를 정한 요약은 일부만 담으므로 지난 요약을 쓰지도, 저장하지도 않는다
        const previous = scoped ? undefined : readDigest(digestFile)
        const result = await runOne({
          prompt: composePrompt(namedSkillText(ref.root, 'manual-spec', BUNDLED, { bundledFirst: true }), specTaskText(ref, input, { previous: previous?.pages })),
          // 읽기만. 요약은 마지막 응답으로 받고 파일은 앱이 쓴다
          tools: [
            ...allowedTools(ctx).filter((tool) => !/^(Edit|Write)\(/.test(tool)),
            ...(jira ? ctx.confluence.flatMap((s) => MCP_ATLASSIAN_JIRA_READ_TOOLS.map((t) => `${mcpServerRule(s)}__${t}`)) : []),
          ],
          withJira: jira,
          // 막힌 도구를 계속 다시 시도하는 일 없이 끝나게
          extraArgs: ['--max-turns', String(SPEC_MAX_TURNS)],
          limits: SPEC_LIMITS,
          // 요약 단계는 기획서만 본다
          mcp: {
            stg: () => {
              throw new Error('기획서 요약 단계에서는 STG를 쓰지 않습니다')
            },
          },
          target: '기획서 요약',
        })
        cost.add(result)
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
        // 기획자가 Claude가 바꾼 곳을 볼 수 있게 고치기 직전 본문을 남긴다 (검토 전에 다시 최신화하면 처음 원문을 유지)
        const reviewSaved = saveReviewBase(ref, target, readSectionDoc(ref, target).body)
        let stg: StgSession | undefined
        try {
          // 기획서 요약을 받았으면 Confluence를 다시 뒤지지 않게 도구를 빼고 막는다 (요약에 없는 정책은 TODO)
          const withConfluence = !brief
          const result = await runOne({
            prompt: composePrompt(skillText(ref.root, 'refresh', BUNDLED), taskText(ref, { ...input, targets: [target] }, { codeDir: ctx.code, brief })),
            tools: allowedTools(ctx, { withConfluence }),
            disallowedTools: withConfluence ? [] : ctx.confluence.map(mcpServerRule),
            withConfluence,
            extraArgs: ['--max-turns', String(SCREEN_LIMITS.maxTurns)],
            limits: SCREEN_LIMITS,
            mcp: {
              stg: () => (stg ??= ctx.newStg()),
              noShots: scoped
                ? '반영 범위를 정한 최신화에서는 캡처를 다시 찍지 않습니다 (STG에 범위 밖 변경이 있을 수 있음). 이미지가 맞지 않으면 TODO로 남기세요'
                : undefined,
            },
            target,
          })
          cost.add(result)
          const summary = parseSummary(result.text)
          if (summary) summaries.set(target, summary)
          if (!result.ok) failures.push(`${target}: ${result.text}`)
          const changed = readFileSync(file, 'utf8') !== before || Boolean(summary?.images?.length)
          if (reviewSaved && readFileSync(file, 'utf8') === before) clearReview(ref, target)
          return { ok: result.ok, changed, todos: summary?.todos, text: result.text, durationMs: result.durationMs }
        } finally {
          await stg?.close()
        }
      },
    })
  return refreshResult(ref.manual, batch.screens, batch.digest, summaries, {
    ...cost.sum,
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
  // 묻는 중이면 중지로 답한다
  for (const [id, answer] of asks) answer(false, id)
}

// 기획자 답을 기다리는 질문 (ask 이벤트 id → 답)
const asks = new Map<string, (proceed: boolean, id: string) => void>()
let askSeq = 0

export function decideDraft(id: string, proceed: boolean) {
  asks.get(id)?.(proceed, id)
}

function ask(text: string, onEvent: (event: DraftEvent) => void) {
  const id = `ask-${++askSeq}`
  return new Promise<boolean>((resolve) => {
    asks.set(id, (proceed) => {
      asks.delete(id)
      onEvent({ kind: 'answered', id, proceed })
      resolve(proceed)
    })
    onEvent({ kind: 'ask', id, text })
  })
}
