import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DraftCheck, DraftInput, RefreshScope } from '../../../shared/api.ts'
import { canQueue, queuePosition, type QueuedDraft } from '../../../shared/claude-queue.ts'
import { screenLabel, screenName, type ClaudeTask } from '../../../shared/draft-log.ts'
import { checkScope, DRAFT_MODES, draftLabel, draftMode, isVideoDraft, needsConfluence, parseTickets, scopeLabel } from '../../../shared/draft-mode.ts'
import { formatAge } from '../../../shared/format.ts'
import { api } from '../api.ts'
import { useNow } from '../hooks.ts'
import { useTasks, type DraftPanelState } from '../tasks.tsx'
import { ClaudeLoginDialog, loginLabel } from './ClaudeLogin.tsx'
import { DraftSummaryCard } from './DraftSummaryCard.tsx'
import { Icon } from './Icon.tsx'
import { StgSession } from './StgSession.tsx'
import { useToast } from './Toast.tsx'

type Phase = 'check' | 'ready' | 'running' | 'done'

// "· 3분 전 확인" (방금이면 비움)
const checkedAgo = (at?: number) => (at && Date.now() - at >= 60000 ? ` · ${formatAge(Date.now() - at)} 확인` : '')

// Claude로 초안 만들기·최신화·영상 초안·장면 채우기: 사전 점검 → 실행(진행 로그) → 결과 요약.
// 실행 상태는 tasks.tsx에 있어서, 실행 중에 패널을 숨겨도 작업은 계속되고 상단 칩에서 다시 연다
export function DraftPanel({
  panel,
  onOpenSection,
  onDiff,
  onDone,
}: {
  panel: DraftPanelState
  onOpenSection: (path: string) => void
  onDiff: (path: string, title: string) => void
  // [닫고 결과 보기]
  onDone: (input: DraftInput, changed: boolean) => void
}) {
  const { input } = panel
  const mode = DRAFT_MODES[draftMode(input)]
  const refresh = input.mode === 'refresh'
  const sceneNo = (input.scene ?? 0) + (input.insert ? 2 : 1)
  const toast = useToast()
  const tasks = useTasks()
  // 이 패널이 보여 주는 작업 (시작 전이면 없음)
  const task = tasks.taskOf(panel.id)
  // 대기 중인 패널이면 몇 번째인지 (아니면 -1)
  const position = queuePosition(tasks.queue, panel.id)
  const queued = position >= 0 && !task
  const queuedItem = queued ? tasks.queue.items[position] : undefined
  // 다른 최신화가 도는 중이면 시작 대신 대기에 넣는다
  const canEnqueue = !task && !queued && tasks.claude?.phase === 'running' && canQueue(input)
  const [localPhase, setLocalPhase] = useState<'check' | 'ready'>('check')
  const phase: Phase = task?.phase ?? localPhase
  const [force, setForce] = useState(false)
  // 최신화·캡처 정의·영상 초안: Claude에게 요청 (작업 지시에 "기획자 요청"으로 들어간다)
  const [request, setRequest] = useState('')
  const askable = input.mode === 'refresh' || input.mode === 'shots' || input.mode === 'video'
  const withRequest = (): typeof panel => (askable && request.trim() ? { ...panel, input: { ...input, notes: request.trim() } } : panel)
  const [scope, setScope] = useState<{ value?: RefreshScope; error?: string }>({})
  const [check, setCheck] = useState<DraftCheck>()
  // 연결된 결과가 있는 채로 다시 확인하는 중 (시작은 막지 않는다)
  const [rechecking, setRechecking] = useState(false)

  const runCheck = async (again = false) => {
    const keep = again && check?.atlassian.some((a) => a.connected)
    if (keep) setRechecking(true)
    else {
      setLocalPhase('check')
      // 다시 확인할 때는 지난 결과를 지워 "확인 중"을 보여 준다
      if (again) setCheck(undefined)
    }
    try {
      // 장면 채우기처럼 기획서를 안 쓰는 작업은 Confluence를 확인하지 않는다
      const [c] = await Promise.all([api.draft.check({ refresh: again, confluence: needsConfluence(input) }), tasks.reloadSession()])
      setCheck(c)
    } finally {
      setRechecking(false)
      setLocalPhase('ready')
    }
  }

  // 돌고 있는(끝난) 작업을 다시 열 때는 점검하지 않는다 (Confluence 확인에 30초쯤 걸린다)
  useEffect(() => {
    if (!task) void runCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const options = () => (refresh ? { force: force && !scope.value, scope: scope.value } : {})

  const start = async () => {
    if (refresh && scope.error) return toast.show('error', scope.error)
    // 세션은 대기 작업이 시작될 때 확인한다
    if (canEnqueue) return tasks.enqueueClaude(withRequest(), options())
    // 만료된 세션으로 몇 분씩 돌지 않게 시작 전에 실제로 STG를 열어 본다
    if (tasks.session.exists) {
      setLocalPhase('check')
      try {
        const checked = await api.capture.checkSession()
        tasks.setSession(checked)
        if (!checked.valid) return toast.show('error', 'STG 로그인 세션이 만료되었습니다. [다시 로그인]을 누른 뒤 시작하세요')
      } catch (e) {
        return toast.error(e)
      } finally {
        setLocalPhase('ready')
      }
    }
    void tasks.startClaude(withRequest(), options())
  }

  const close = () => {
    if (phase === 'running' || queued) return tasks.hideDraft()
    if (phase === 'done') return onDone(input, Boolean(task?.result))
    tasks.clearClaude()
  }

  return (
    <div className="capture-panel draft-panel">
      <header className="panel-header">
        <div>
          <h1>{mode.title}</h1>
          <p className="muted">
            {input.menu} · {mode.about(sceneNo)}
          </p>
        </div>
        {phase === 'running' ? (
          <button className="button small" onClick={close} title="작업은 계속됩니다. 위쪽 작업 표시를 누르면 다시 열립니다">
            숨기기
          </button>
        ) : (
          <button className="icon-button" onClick={close} aria-label="닫기">
            <Icon name="x" />
          </button>
        )}
      </header>

      <div className="capture-body">
        <aside className="capture-side">
          <div className="side-scroll">
            <div className="draft-checks">
              {!task && (
                <DraftChecks
                  check={check}
                  confluence={needsConfluence(input)}
                  rechecking={rechecking}
                  canRecheck={phase === 'ready' && !rechecking}
                  onRecheck={() => void runCheck(true)}
                />
              )}
              <StgSession disabled={phase === 'running' || phase === 'check'} />
              {!tasks.session.exists && <p className="muted small-note">STG 로그인이 없으면 화면 확인과 캡처를 건너뜁니다</p>}
            </div>

            <DraftInputList input={input} sceneNo={sceneNo} subject={mode.subject} task={task} queued={queuedItem} />

            {refresh && !task && !queued && <RefreshScopeFields force={force} onForce={setForce} onScope={setScope} />}
            {askable && !task && !queued && (
              <label className="scope-fields request-field">
                <b>Claude에게 요청 (선택)</b>
                <textarea
                  aria-label="Claude에게 요청"
                  rows={3}
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder={
                    input.mode === 'shots'
                      ? '예: 팝업은 Location만, 검색 영역 이미지는 빼기'
                      : input.mode === 'video'
                        ? '예: 검색 조건은 Dealer Name만 보여 주기, 장면은 5개 이내'
                        : '예: Location 팝업 설명은 건드리지 말 것, 버튼 이름만 확인'
                  }
                />
                <em className="hint">먼저 따르지만, 저장·삭제 금지나 근거가 없으면 TODO로 남기는 규칙은 바뀌지 않습니다</em>
              </label>
            )}
          </div>

          {queued ? (
            <>
              <p className="notice queue-notice">
                {tasks.queue.paused
                  ? `대기열이 멈췄습니다: ${tasks.queue.paused}`
                  : `대기 ${position + 1}번째입니다. 앞 작업이 끝나면 자동으로 시작합니다`}
              </p>
              {tasks.queue.paused && (
                <button className="button primary block" onClick={tasks.resumeQueue}>
                  <Icon name="sync" /> 계속
                </button>
              )}
              <button className="button block" onClick={() => tasks.removeQueued(panel.id)}>
                <Icon name="x" /> 대기에서 빼기
              </button>
            </>
          ) : phase === 'running' ? (
            <button className="button block" onClick={() => void api.draft.cancel()}>
              <Icon name="x" /> 중지
            </button>
          ) : phase === 'done' ? (
            <button className="button primary block" onClick={close}>
              <Icon name="check" /> {input.mode === 'shots' ? '닫고 캡처 열기' : '닫고 결과 보기'}
            </button>
          ) : (
            <button className="button primary block" disabled={phase !== 'ready' || !check?.claude || needsLogin(check)} onClick={start}>
              <Icon name={mode.startIcon} /> {canEnqueue ? `대기에 추가 (${tasks.queue.items.length + 1}번째)` : mode.start}
            </button>
          )}
          <p className="hint">{mode.duration} 걸리고, 내 Claude 사용량을 씁니다.</p>
        </aside>

        <section className="capture-results draft-log">
          {phase === 'check' && <p className="muted">환경을 확인하는 중…</p>}
          {phase === 'ready' && !queued && (
            <div className="empty-state">
              <Icon name="flag" size={32} />
              <p>{mode.ready(sceneNo)}</p>
              {canEnqueue && (
                <p>
                  지금 다른 Claude {draftLabel(tasks.claude!.input)} 작업이 돌고 있습니다. [대기에 추가]를 누르면 그 작업이 끝난 뒤 이어서 시작합니다.
                </p>
              )}
              <p className="muted">진행 상황이 여기에 한 줄씩 나옵니다. 저장·삭제 같은 버튼은 앱이 막습니다.</p>
            </div>
          )}
          {(task || queued) && <QueueList current={panel.id} />}
          {task && <DraftLog task={task} />}
          {task?.phase === 'done' && (
            <DraftSummaryCard input={input} result={task.result} error={task.error} onOpenSection={onOpenSection} onDiff={onDiff} />
          )}
          {(phase === 'running' || queued || task?.phase === 'done') && <FinishedList current={panel.id} />}
        </section>
      </div>
    </div>
  )
}

// 시작 전 점검: Claude Code와 (기획서를 쓰는 작업이면) Confluence
function DraftChecks({
  check,
  confluence,
  rechecking,
  canRecheck,
  onRecheck,
}: {
  check?: DraftCheck
  confluence: boolean
  rechecking: boolean
  canRecheck: boolean
  onRecheck: () => void
}) {
  const missingKey = Boolean(check?.claude && check.auth.mode === 'apiKey' && !check.auth.keySource)
  // claude.ai 로그인으로 도는데 로그인되어 있지 않으면 여기서 바로 로그인한다
  const missingLogin = needsLogin(check)
  const [loggingIn, setLoggingIn] = useState(false)
  const atlassianOk = check?.atlassian.some((a) => a.connected)
  // 내 PC의 claude는 버전이 제각각이라 게이트웨이(H-Chat)가 낮은 버전을 거절할 수 있다. 앱 전용 설치를 권한다
  const pcClaude = Boolean(check?.claude?.installable)
  return (
    <>
      <CheckRow
        ok={Boolean(check?.claude) && !missingKey && !missingLogin && !pcClaude}
        loading={!check}
        label="Claude Code"
        detail={claudeDetail(check)}
        warn={(missingKey || pcClaude) && !missingLogin}
        action={
          missingLogin ? (
            <button className="button small" onClick={() => setLoggingIn(true)}>
              claude.ai 로그인
            </button>
          ) : pcClaude ? (
            <InstallClaude onDone={onRecheck} />
          ) : undefined
        }
      />
      {loggingIn && <ClaudeLoginDialog onClose={() => setLoggingIn(false)} onDone={onRecheck} />}
      {confluence && (
        <CheckRow
          ok={Boolean(atlassianOk)}
          warn={check && !atlassianOk}
          loading={!check}
          label="Confluence (Atlassian MCP)"
          detail={confluenceDetail(check, rechecking)}
          action={
            check ? (
              <button className="button small ghost" onClick={onRecheck} disabled={!canRecheck}>
                다시 확인
              </button>
            ) : undefined
          }
        />
      )}
    </>
  )
}

// claude.ai 로그인으로 도는데 로그인되어 있지 않음 (상태를 못 읽었으면 막지 않는다)
const needsLogin = (check?: DraftCheck) => {
  const login = check?.claude && check.auth.mode === 'login' ? check.auth.login : undefined
  return Boolean(login && !login.loggedIn && !login.error)
}

function claudeDetail(check?: DraftCheck) {
  if (!check?.claude) return '설치되어 있지 않습니다 (설정 → 환경 점검)'
  const where = check.claude.managed
    ? ' (앱 전용)'
    : check.claude.installable
      ? ' (내 PC의 claude — 버전이 낮으면 H-Chat이 거절합니다. 앱 전용으로 설치하세요)'
      : ' (설정에서 지정한 경로)'
  const auth =
    check.auth.mode === 'login'
      ? needsLogin(check)
        ? 'claude.ai 로그인 필요'
        : check.auth.login
          ? loginLabel(check.auth.login)
          : 'claude.ai 로그인'
      : check.auth.keySource
        ? `ANTHROPIC_API_KEY (${check.auth.keySource === 'shell' ? '~/.zshrc' : '앱 환경'})`
        : 'ANTHROPIC_API_KEY 없음 — 설정 → 고급 → Claude 인증 확인'
  return `${check.claude.version}${where} · ${auth}`
}

// 점검 화면에서 바로 앱 전용 Claude Code 받기 (약 220MB). 끝나면 다시 점검한다
function InstallClaude({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [progress, setProgress] = useState<string>()
  const install = async () => {
    setProgress('준비 중…')
    const off = api.on('install-progress', (p) => {
      if (p.tool !== 'claude') return
      setProgress(p.phase === 'download' && p.loaded ? `${Math.round(p.loaded / (1 << 20))}MB` : p.phase === 'extract' ? '설치 중…' : '확인 중…')
    })
    try {
      await api.env.install('claude')
      toast.show('success', '앱 전용 Claude Code를 설치했습니다')
      onDone()
    } catch (e) {
      toast.error(e)
    } finally {
      off()
      setProgress(undefined)
    }
  }
  return (
    <button className="button small ghost" onClick={() => void install()} disabled={Boolean(progress)}>
      {progress ? `받는 중 ${progress}` : '앱 전용으로 설치'}
    </button>
  )
}

function confluenceDetail(check: DraftCheck | undefined, rechecking: boolean) {
  if (!check) return '확인 중… (30초쯤 걸립니다. 한 번 연결되면 앱을 끌 때까지 기억합니다)'
  if (rechecking) return '다시 확인 중… (그동안에도 시작할 수 있습니다)'
  const connected = check.atlassian.filter((a) => a.connected)
  if (connected.length) return `${connected.map((a) => a.name).join(', ')}${checkedAgo(check.atlassianCheckedAt)}`
  if (check.error) return `확인하지 못했습니다 — ${check.error}`
  if (check.atlassian.length) return `연결 실패 — ${check.atlassian.map((a) => `${a.name}: ${a.detail ?? '이유 모름'}`).join(' / ')}`
  return 'Claude Code에 Atlassian MCP가 없습니다. 기획서 없이 쓰고 정책은 TODO로 남깁니다'
}

function CheckRow({
  ok,
  warn,
  loading,
  label,
  detail,
  action,
}: {
  ok: boolean
  warn?: boolean
  loading?: boolean
  label: string
  detail: string
  action?: ReactNode
}) {
  return (
    <div className={`check-row ${loading ? '' : ok ? 'ok' : warn ? 'warn' : 'fail'}`}>
      <span className="env-icon">
        <Icon name={loading ? 'sync' : ok ? 'check' : 'alert'} size={13} className={loading ? 'spin' : ''} />
      </span>
      <div>
        <b>{label}</b>
        <span className="muted">{detail}</span>
      </div>
      {action}
    </div>
  )
}

// 대기 중인 최신화: 순서 바꾸기·빼기·모두 비우기. 멈췄으면 [계속]
function QueueList({ current }: { current: number }) {
  const tasks = useTasks()
  const { items, paused } = tasks.queue
  if (!items.length) return null
  const label = (item: QueuedDraft) => {
    const targets = item.input.targets ?? []
    const what = targets.length === 1 ? screenName(targets[0]) : `${item.input.menu} · 화면 ${targets.length}개`
    const scope = scopeLabel(item.options.scope)
    return scope ? `${what} · ${scope}` : what
  }
  return (
    <section className="queue-list">
      <header>
        <b>대기 중인 최신화 {items.length}</b>
        {paused && <span className="badge todo">멈춤</span>}
        <span className="spacer" />
        {paused && (
          <button className="button small" onClick={tasks.resumeQueue}>
            계속
          </button>
        )}
        <button className="button small ghost" onClick={tasks.clearQueue}>
          모두 비우기
        </button>
      </header>
      <ol>
        {items.map((item, i) => (
          <li key={item.panel} className={item.panel === current ? 'current' : ''}>
            <span className="queue-no">{i + 1}</span>
            <button className="link ellipsis" title="이 대기 항목 보기" onClick={() => tasks.openPanel({ input: item.input, id: item.panel })}>
              {label(item)}
            </button>
            <button className="icon-button small" title="앞으로" aria-label="앞으로" disabled={i === 0} onClick={() => tasks.moveQueued(item.panel, -1)}>
              <Icon name="up" size={13} />
            </button>
            <button
              className="icon-button small"
              title="뒤로"
              aria-label="뒤로"
              disabled={i === items.length - 1}
              onClick={() => tasks.moveQueued(item.panel, 1)}
            >
              <Icon name="down" size={13} />
            </button>
            <button className="icon-button small" title="대기에서 빼기" aria-label="대기에서 빼기" onClick={() => tasks.removeQueued(item.panel)}>
              <Icon name="x" size={13} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

// 이번에 끝난 다른 작업들 (대기열로 이어서 끝난 결과를 다시 연다)
function FinishedList({ current }: { current: number }) {
  const tasks = useTasks()
  const others = tasks.finished.filter((t) => t.panel !== current)
  if (!others.length) return null
  return (
    <section className="queue-list finished">
      <header>
        <b>끝난 작업</b>
      </header>
      <ol>
        {others.map((t) => (
          <li key={t.panel}>
            <Icon name={t.error ? 'alert' : 'check'} size={13} />
            <button className="link ellipsis" onClick={() => tasks.openPanel({ input: t.input, id: t.panel })}>
              Claude {draftLabel(t.input)} · {t.input.targets?.length === 1 ? screenName(t.input.targets[0]) : t.input.menu}
            </button>
            <span className="muted">{t.error ? '실패' : '결과 보기'}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// 작업 대상: 메뉴·장·영상, 위치·대상 화면·반영 범위, STG 경로
// 시작·대기할 때 붙인 Claude 요청 (장면 채우기의 notes는 따로 보여 준다)
const requestOf = (input: DraftInput, task?: ClaudeTask, queued?: QueuedDraft) =>
  input.mode === 'video-scene' ? undefined : (task?.input.notes ?? queued?.input.notes ?? input.notes)?.trim()

function DraftInputList({
  input,
  sceneNo,
  subject,
  task,
  queued,
}: {
  input: DraftInput
  sceneNo: number
  subject: string
  task?: ClaudeTask
  queued?: QueuedDraft
}) {
  const scope = task?.scope ?? queued?.options.scope
  return (
    <dl className="draft-input">
      <dt>{subject}</dt>
      <dd>{input.menu}</dd>
      {input.mode === 'video-scene' ? (
        <>
          <dt>장면</dt>
          <dd>{input.insert ? `장면 ${sceneNo - 1} 다음에 새 장면` : `장면 ${sceneNo}`}</dd>
          <dt>요청</dt>
          <dd>{input.notes || '(지금 내레이션대로)'}</dd>
        </>
      ) : isVideoDraft(input) ? (
        <>
          <dt>연결 화면</dt>
          <dd>{input.targets?.[0] ?? '없음'}</dd>
        </>
      ) : input.mode === 'refresh' || input.mode === 'shots' ? (
        <>
          <dt>대상</dt>
          <dd>{input.targets?.length === 1 ? input.targets[0] : `화면 ${input.targets?.length ?? 0}개`}</dd>
          {scope && (
            <>
              <dt>반영 범위</dt>
              <dd>{scopeLabel(scope)}</dd>
            </>
          )}
        </>
      ) : (
        <>
          <dt>위치</dt>
          <dd>
            {input.chapterDir
              ? input.chapterDir
              : `새 장 "${input.newChapterTitle ?? input.menu}" · ${input.chapterIndex === undefined ? '맨 뒤' : `${input.chapterIndex + 1}장`}`}
          </dd>
        </>
      )}
      {requestOf(input, task, queued) && (
        <>
          <dt>요청</dt>
          <ClampedText text={requestOf(input, task, queued)!} />
        </>
      )}
      {input.path && (
        <>
          <dt>STG 경로</dt>
          <dd>
            <code>{input.path}</code>
          </dd>
        </>
      )}
    </dl>
  )
}

// 긴 요청은 몇 줄만 보이고 펼쳐 본다 (왼쪽 패널 아래 버튼이 밀려나지 않게)
function ClampedText({ text }: { text: string }) {
  const ref = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [long, setLong] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 1)
  }, [text, open])
  return (
    <dd>
      <span ref={ref} className={open ? '' : 'clamped'}>
        {text}
      </span>
      {(long || open) && (
        <button className="button ghost small clamp-toggle" onClick={() => setOpen(!open)}>
          <Icon name={open ? 'up' : 'down'} /> {open ? '접기' : '펼치기'}
        </button>
      )}
    </dd>
  )
}

// 최신화 반영 범위: 기간(YYYY-MM)과 Jira 티켓. 비우면 최신 기획서 전체
function RefreshScopeFields({
  force,
  onForce,
  onScope,
}: {
  force: boolean
  onForce: (force: boolean) => void
  onScope: (scope: { value?: RefreshScope; error?: string }) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ticketText, setTicketText] = useState('')
  const parsed = parseTickets(ticketText)
  const checked = checkScope({ from, to, tickets: parsed.tickets })
  const error = parsed.invalid.length ? `Jira 티켓 형식이 틀립니다: ${parsed.invalid.join(', ')} (예: GIDPGRO-973)` : checked.error
  // 고칠 때마다 패널에 알린다 ([최신화 시작]이 이 값으로 시작한다)
  const key = JSON.stringify([checked.scope, error])
  useEffect(() => {
    onScope({ value: checked.scope, error })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <>
      <div className="scope-fields">
        <b>반영 범위 (선택)</b>
        <div className="scope-period">
          <input type="month" aria-label="시작 월" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>~</span>
          <input type="month" aria-label="끝 월" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <textarea
          aria-label="Jira 티켓"
          rows={2}
          placeholder="Jira 티켓 (예: GIDPGRO-973, GIDPDVO-2067)"
          value={ticketText}
          onChange={(e) => setTicketText(e.target.value)}
        />
        {error ? (
          <p className="form-error">{error}</p>
        ) : (
          <em className="hint">
            {checked.scope
              ? '이 범위의 변경만 반영합니다. 해당 변경이 없는 화면은 건너뛰고, 캡처 이미지는 다시 찍지 않습니다'
              : '비우면 최신 기획서 전체를 반영합니다'}
          </em>
        )}
      </div>
      {!checked.scope && (
        <label className="check-inline">
          <input type="checkbox" checked={force} onChange={(e) => onForce(e.target.checked)} />
          기획서가 안 바뀐 화면도 다시 확인
        </label>
      )}
    </>
  )
}

// 진행 로그. 최신화는 화면별 진행을 보여 주고, 화면을 누르면 그 화면 로그만
function DraftLog({ task }: { task: ClaudeTask }) {
  const [filter, setFilter] = useState<string>()
  const logEnd = useRef<HTMLDivElement>(null)
  const running = task.phase === 'running'
  const now = useNow(running)
  const elapsed = Math.max(0, Math.round((now - task.startedAt) / 1000))
  const screens = Object.entries(task.screens)

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' })
  }, [task.log.length, filter])

  return (
    <>
      {task.ask && (
        <div className="draft-ask">
          <p>{task.ask.text}</p>
          <div className="row">
            <button className="button primary small" onClick={() => void api.draft.decide(task.ask!.id, true)}>
              요약 없이 계속
            </button>
            <button className="button small" onClick={() => void api.draft.decide(task.ask!.id, false)}>
              중지
            </button>
          </div>
        </div>
      )}
      {screens.length > 0 && (
        <div className="screen-progress">
          {task.stage && <p className="muted">{task.stage}</p>}
          <ul>
            <li>
              <button className={`screen-chip ${filter === undefined ? 'active' : ''}`} onClick={() => setFilter(undefined)}>
                전체 로그
              </button>
            </li>
            {screens.map(([target, row]) => (
              <li key={target}>
                <button
                  className={`screen-chip status-${row.status} ${filter === target ? 'active' : ''}`}
                  title={row.text ?? target}
                  onClick={() => setFilter(filter === target ? undefined : target)}
                >
                  {row.status === 'running' && <Icon name="sync" size={12} className="spin" />}
                  <span>{screenName(target)}</span>
                  <b>{screenLabel(row.status, task.input.mode)}</b>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="log">
        {task.log
          .filter((line) => filter === undefined || line.target === filter)
          .map((line) => (
            <li key={line.id} className={`log-${line.kind} ${line.failed ? 'failed' : ''}`}>
              <span className="log-icon">
                {line.kind === 'tool' ? (
                  line.failed ? (
                    <Icon name="alert" size={13} />
                  ) : line.done ? (
                    <Icon name="check" size={13} />
                  ) : (
                    <Icon name="sync" size={13} className="spin" />
                  )
                ) : line.kind === 'warning' ? (
                  <Icon name="alert" size={13} />
                ) : line.kind === 'text' ? (
                  <Icon name="info" size={13} />
                ) : (
                  <Icon name="chevron" size={13} />
                )}
              </span>
              <span className="log-text">
                {filter === undefined && line.target && <span className="log-target">{screenName(line.target)}</span>}
                {line.text}
              </span>
            </li>
          ))}
        {running && (
          <li className="log-status">
            <span className="log-icon">
              <Icon name="sync" size={13} className="spin" />
            </span>
            <span className="log-text muted">작업 중 · {elapsed}초</span>
          </li>
        )}
      </ol>
      <div ref={logEnd} />
    </>
  )
}
