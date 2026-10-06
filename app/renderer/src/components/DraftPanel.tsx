import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DraftCheck, DraftInput, DraftResult, SessionInfo } from '../../../shared/api.ts'
import { api } from '../api.ts'
import { SCREEN_LABEL, screenName, useTasks } from '../tasks.tsx'
import { needsConfluence } from '../../../shared/draft-mode.ts'
import { Icon } from './Icon.tsx'
import { StgSession } from './StgSession.tsx'
import { useToast } from './Toast.tsx'

type Phase = 'check' | 'ready' | 'running' | 'done'

// "· 3분 전 확인" (방금이면 비움)
const checkedAgo = (at?: number) => {
  if (!at) return ''
  const min = Math.floor((Date.now() - at) / 60000)
  return min < 1 ? '' : ` · ${min < 60 ? `${min}분` : `${Math.floor(min / 60)}시간`} 전 확인`
}

const minutes = (ms?: number) => (!ms ? '' : ms < 60000 ? `${Math.round(ms / 1000)}초` : `${Math.round(ms / 60000)}분`)

// Claude로 초안 만들기·최신화·영상 초안·장면 채우기: 사전 점검 → 실행(진행 로그) → 결과 요약.
// 실행 상태는 tasks.tsx에 있어서, 실행 중에 패널을 숨겨도 작업은 계속되고 상단 칩에서 다시 연다
export function DraftPanel({
  input,
  onOpenSection,
  onDiff,
  onDone,
}: {
  input: DraftInput
  onOpenSection: (path: string) => void
  onDiff: (path: string, title: string) => void
  // [닫고 결과 보기]
  onDone: (input: DraftInput, changed: boolean) => void
}) {
  const refresh = input.mode === 'refresh'
  // 장면 하나 채우기는 영상 초안과 같은 화면에 문구만 다르다
  const sceneMode = input.mode === 'video-scene'
  const video = input.mode === 'video' || sceneMode
  const sceneNo = (input.scene ?? 0) + (input.insert ? 2 : 1)
  const name = sceneMode ? 'Claude로 장면 채우기' : video ? 'Claude로 영상 초안' : refresh ? 'Claude로 최신화' : 'Claude로 초안 만들기'
  const toast = useToast()
  const tasks = useTasks()
  // 이 패널이 보여 주는 작업 (시작 전이면 없음)
  const task = tasks.claude?.input === input ? tasks.claude : undefined
  const [localPhase, setLocalPhase] = useState<'check' | 'ready'>('check')
  const phase: Phase = task?.phase ?? localPhase
  const log = task?.log ?? []
  const result: DraftResult | undefined = task?.result
  const error = task?.error ?? ''
  // 최신화: 화면별 진행. 화면을 누르면 그 화면 로그만
  const screens = task?.screens ?? {}
  const [filter, setFilter] = useState<string>()
  const [force, setForce] = useState(false)
  const [check, setCheck] = useState<DraftCheck>()
  const [session, setSession] = useState<SessionInfo>({ exists: false })
  const logEnd = useRef<HTMLDivElement>(null)

  // 장면 채우기처럼 기획서를 안 쓰는 작업은 Confluence를 확인하지 않는다
  const wantConfluence = needsConfluence(input)
  // 연결된 결과가 있는 채로 다시 확인하는 중 (시작은 막지 않는다)
  const [rechecking, setRechecking] = useState(false)

  const runCheck = async (refresh = false) => {
    const keep = refresh && check?.atlassian.some((a) => a.connected)
    if (keep) setRechecking(true)
    else {
      setLocalPhase('check')
      // 다시 확인할 때는 지난 결과를 지워 "확인 중"을 보여 준다
      if (refresh) setCheck(undefined)
    }
    try {
      const [c, s] = await Promise.all([api.draft.check({ refresh, confluence: wantConfluence }), api.capture.session()])
      setCheck(c)
      setSession(s)
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

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' })
  }, [log.length, filter])

  // 세션 표시를 다시 읽게 할 때 올린다
  const [sessionVersion, setSessionVersion] = useState(0)
  // 작업 중에 세션이 만료됐으면 표시를 갱신한다
  useEffect(() => {
    if (task?.phase === 'done') setSessionVersion((v) => v + 1)
  }, [task?.phase])

  const start = async () => {
    // 만료된 세션으로 몇 분씩 돌지 않게 시작 전에 실제로 STG를 열어 본다
    if (session.exists) {
      setLocalPhase('check')
      try {
        const checked = await api.capture.checkSession()
        setSession(checked)
        setSessionVersion((v) => v + 1)
        if (!checked.valid) {
          setLocalPhase('ready')
          return toast.show('error', 'STG 로그인 세션이 만료되었습니다. [다시 로그인]을 누른 뒤 시작하세요')
        }
      } catch (e) {
        setLocalPhase('ready')
        return toast.error(e)
      }
      setLocalPhase('ready')
    }
    setFilter(undefined)
    void tasks.startClaude(input, { force: refresh && force })
  }

  // 진행 시간 표시
  const [, tick] = useState(0)
  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  const close = () => {
    if (phase === 'running') return tasks.hideDraft()
    if (phase === 'done') return onDone(input, Boolean(result))
    tasks.clearClaude()
  }

  const atlassianOk = check?.atlassian.some((a) => a.connected)
  const elapsed = Math.round((Date.now() - (task?.startedAt ?? Date.now())) / 1000)

  return (
    <div className="capture-panel draft-panel">
      <header className="panel-header">
        <div>
          <h1>{name}</h1>
          <p className="muted">
            {input.menu} ·{' '}
            {sceneMode
              ? `요청대로 STG 화면을 보고 장면 ${sceneNo}의 영어 내레이션과 단계를 씁니다. 다른 장면은 건드리지 않습니다.`
              : video
              ? '연결된 매뉴얼 화면의 문장으로 내레이션을 쓰고, STG 화면을 확인해 단계를 만든 뒤 실제로 실행해 봅니다.'
              : refresh
                ? '최신 Confluence 기획서를 한 번 요약한 뒤, 화면마다 STG 화면과 지금 본문을 비교해 바뀐 곳만 고칩니다(3개씩 동시에). 근거가 다르면 TODO로 남깁니다.'
                : 'Confluence 기획서와 STG 화면을 근거로 영어 초안을 씁니다. 근거가 없는 내용은 TODO로 남깁니다.'}
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
          <div className="draft-checks">
            {!task && (
              <>
            <CheckRow
              ok={Boolean(check?.claude) && !(check?.auth.mode === 'apiKey' && !check.auth.keySource)}
              loading={!check}
              label="Claude Code"
              detail={
                !check?.claude
                  ? '설치되어 있지 않습니다 (설정 → 환경 점검)'
                  : `${check.claude.version} · ${
                      check.auth.mode === 'login'
                        ? 'claude.ai 로그인'
                        : check.auth.keySource
                          ? `ANTHROPIC_API_KEY (${check.auth.keySource === 'shell' ? '~/.zshrc' : '앱 환경'})`
                          : 'ANTHROPIC_API_KEY 없음 — 설정 → 고급 → Claude 인증 확인'
                    }`
              }
              warn={Boolean(check?.claude && check.auth.mode === 'apiKey' && !check.auth.keySource)}
            />
            {wantConfluence && (
            <CheckRow
              ok={Boolean(atlassianOk)}
              warn={check && !atlassianOk}
              loading={!check}
              label="Confluence (Atlassian MCP)"
              detail={
                !check
                  ? '확인 중… (30초쯤 걸립니다. 한 번 연결되면 앱을 끌 때까지 기억합니다)'
                  : rechecking
                    ? '다시 확인 중… (그동안에도 시작할 수 있습니다)'
                  : atlassianOk
                    ? `${check.atlassian.filter((a) => a.connected).map((a) => a.name).join(', ')}${checkedAgo(check.atlassianCheckedAt)}`
                    : check.error
                      ? `확인하지 못했습니다 — ${check.error}`
                      : check.atlassian.length
                        ? `연결 실패 — ${check.atlassian.map((a) => `${a.name}: ${a.detail ?? '이유 모름'}`).join(' / ')}`
                        : 'Claude Code에 Atlassian MCP가 없습니다. 기획서 없이 쓰고 정책은 TODO로 남깁니다'
              }
              action={
                check ? (
                  <button className="button small ghost" onClick={() => void runCheck(true)} disabled={phase !== 'ready' || rechecking}>
                    다시 확인
                  </button>
                ) : undefined
              }
            />
            )}
              </>
            )}
            <StgSession disabled={phase === 'running' || phase === 'check'} onChange={setSession} version={sessionVersion} />
            {!session.exists && <p className="muted small-note">STG 로그인이 없으면 화면 확인과 캡처를 건너뜁니다</p>}
          </div>

          <dl className="draft-input">
            <dt>{video ? '영상' : refresh ? '장' : '메뉴'}</dt>
            <dd>{input.menu}</dd>
            {sceneMode ? (
              <>
                <dt>장면</dt>
                <dd>{input.insert ? `장면 ${sceneNo - 1} 다음에 새 장면` : `장면 ${sceneNo}`}</dd>
                <dt>요청</dt>
                <dd>{input.notes || '(지금 내레이션대로)'}</dd>
              </>
            ) : video ? (
              <>
                <dt>연결 화면</dt>
                <dd>{input.targets?.[0] ?? '없음'}</dd>
              </>
            ) : refresh ? (
              <>
                <dt>대상</dt>
                <dd>
                  {input.targets?.length === 1 ? input.targets[0] : `화면 ${input.targets?.length ?? 0}개`}
                </dd>
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
            {input.path && (
              <>
                <dt>STG 경로</dt>
                <dd>
                  <code>{input.path}</code>
                </dd>
              </>
            )}
          </dl>

          {refresh && !task && (
            <label className="check-inline">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              기획서가 안 바뀐 화면도 다시 확인
            </label>
          )}

          <span className="spacer" />
          {phase === 'running' ? (
            <button className="button block" onClick={() => void api.draft.cancel()}>
              <Icon name="x" /> 중지
            </button>
          ) : phase === 'done' ? (
            <button className="button primary block" onClick={close}>
              <Icon name="check" /> 닫고 결과 보기
            </button>
          ) : (
            <button className="button primary block" disabled={phase !== 'ready' || !check?.claude} onClick={start}>
              <Icon name={refresh || video ? 'sparkle' : 'flag'} /> {sceneMode ? '장면 채우기 시작' : video ? '영상 초안 시작' : refresh ? '최신화 시작' : '초안 만들기 시작'}
            </button>
          )}
          <p className="hint">
            {sceneMode
              ? '장면 하나에 몇 분'
              : video
                ? '영상 하나에 수 분'
                : refresh
                  ? '처음에는 15~25분쯤, 기획서가 그대로면 건너뛰어 몇 분'
                  : '초안 하나에 수 분에서 10분 이상'} 걸리고, 내 Claude 사용량을 씁니다.
          </p>
        </aside>

        <section className="capture-results draft-log">
          {phase === 'check' && <p className="muted">환경을 확인하는 중…</p>}
          {phase === 'ready' && (
            <div className="empty-state">
              <Icon name="flag" size={32} />
              <p>
                {sceneMode
                  ? `[장면 채우기 시작]을 누르면 Claude가 장면 ${sceneNo}이 시작되는 화면까지 앞 장면을 재생하고, 요청대로 STG를 살펴본 뒤 그 장면만 써서 실행해 봅니다.`
                  : video
                  ? '[영상 초안 시작]을 누르면 Claude가 매뉴얼 본문으로 장면을 나누고, STG에서 단계를 찾아 시나리오를 쓴 뒤 끝까지 실행해 봅니다.'
                  : refresh
                    ? '[최신화 시작]을 누르면 Claude가 최신 기획서를 요약하고, 지난 최신화 이후 기획서가 바뀐 화면만 STG 화면과 비교해 고칩니다.'
                    : '[초안 만들기 시작]을 누르면 Claude가 기획서를 찾고 STG 화면을 확인하며 초안을 씁니다.'}
              </p>
              <p className="muted">진행 상황이 여기에 한 줄씩 나옵니다. 저장·삭제 같은 버튼은 앱이 막습니다.</p>
            </div>
          )}
          {(phase === 'running' || phase === 'done') && (
            <>
              {Object.keys(screens).length > 0 && (
                <div className="screen-progress">
                  {task?.stage && <p className="muted">{task.stage}</p>}
                  <ul>
                    <li>
                      <button className={`screen-chip ${filter === undefined ? 'active' : ''}`} onClick={() => setFilter(undefined)}>
                        전체 로그
                      </button>
                    </li>
                    {Object.entries(screens).map(([target, row]) => (
                      <li key={target}>
                        <button
                          className={`screen-chip status-${row.status} ${filter === target ? 'active' : ''}`}
                          title={row.text ?? target}
                          onClick={() => setFilter(filter === target ? undefined : target)}
                        >
                          {row.status === 'running' && <Icon name="sync" size={12} className="spin" />}
                          <span>{screenName(target)}</span>
                          <b>{SCREEN_LABEL[row.status]}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ol className="log">
                {log
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
                      ) : line.kind === 'warning' || line.kind === 'error' ? (
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
                {phase === 'running' && (
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
          )}
          {phase === 'done' && (
            <DraftSummaryCard
              result={result}
              error={error}
              refresh={refresh}
              video={video}
              sceneMode={sceneMode}
              onOpenSection={onOpenSection}
              onDiff={onDiff}
            />
          )}
        </section>
      </div>
    </div>
  )
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

function DraftSummaryCard({
  result,
  error,
  refresh,
  video,
  sceneMode,
  onOpenSection,
  onDiff,
}: {
  result?: DraftResult
  error: string
  refresh: boolean
  video?: boolean
  sceneMode?: boolean
  onOpenSection: (path: string) => void
  onDiff: (path: string, title: string) => void
}) {
  const summary = result?.summary
  const manualPrefix = (path: string) => (path.startsWith('manuals/') ? path : `manuals/${result?.manual ?? ''}/${path}`)
  return (
    <article className={`draft-summary ${error ? 'failed' : ''}`}>
      <h2>
        {error
          ? refresh
            ? '최신화를 끝까지 하지 못했습니다'
            : '초안을 끝까지 만들지 못했습니다'
          : sceneMode
            ? '장면을 채웠습니다'
            : video
            ? '영상 시나리오 초안을 만들었습니다'
            : refresh
              ? summary?.sections.length
                ? '최신화했습니다'
                : '바꿀 곳이 없었습니다'
              : '초안을 만들었습니다'}
      </h2>
      {error && <p className="form-error">{error}</p>}
      {summary ? (
        <>
          <div className="report-summary inline">
            {video ? (
              <span className="pill accent">장면 {summary.scenes ?? 0}</span>
            ) : (
              <>
                <span className="pill accent">
                  {refresh ? '고친 화면' : '화면'} {summary.sections.length}
                </span>
                <span className="pill">이미지 {summary.images?.length ?? 0}</span>
              </>
            )}
            <span className={`pill ${summary.todos ? 'todo' : ''}`}>TODO {summary.todos ?? 0}</span>
            {result?.durationMs && <span className="pill">{minutes(result.durationMs)}</span>}
          </div>
          {summary.sections.length > 0 && <h3>{refresh ? '고친 화면' : '만든 화면'}</h3>}
          <ul>
            {summary.sections.map((path) => (
              <li key={path}>
                <button className="link" onClick={() => onOpenSection(path)}>
                  {path}
                </button>
                {refresh && (
                  <button className="link small" onClick={() => onDiff(manualPrefix(path), path)}>
                    · 변경 보기
                  </button>
                )}
              </li>
            ))}
          </ul>
          {summary.unchanged && summary.unchanged.length > 0 && (
            <>
              <h3>그대로인 화면</h3>
              <ul className="muted">
                {summary.unchanged.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </>
          )}
          {summary.skipped && summary.skipped.length > 0 && (
            <>
              <h3>건너뛴 화면 (지난 최신화 이후 기획서가 그대로)</h3>
              <ul className="muted">
                {summary.skipped.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </>
          )}
          {result?.screens?.some((s) => s.status === 'failed') && (
            <>
              <h3>실패한 화면</h3>
              <ul>
                {result.screens
                  .filter((s) => s.status === 'failed')
                  .map((s) => (
                    <li key={s.target}>
                      {s.target}
                      {s.text && <span className="muted"> · {s.text.slice(0, 200)}</span>}
                    </li>
                  ))}
              </ul>
            </>
          )}
          {summary.sources && summary.sources.length > 0 && (
            <>
              <h3>{video ? '참고한 문서' : '참고한 기획서'}</h3>
              <ul>
                {summary.sources.map((s) => (
                  <li key={s.url ?? s.title}>
                    {s.url ? (
                      <button className="link" onClick={() => api.app.openExternal(s.url!)}>
                        {s.title} <Icon name="external" size={12} />
                      </button>
                    ) : (
                      s.title
                    )}
                    {s.version && <span className="muted"> · {s.version}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {summary.notes && <p className="notice">{summary.notes}</p>}
        </>
      ) : (
        result && !error && <p className="muted">요약을 읽지 못했습니다. 변경 탭에서 만든 파일을 확인하세요.</p>
      )}
      {result && result.denials.length > 0 && (
        <details>
          <summary>앱이 막은 요청 {result.denials.length}건</summary>
          <ul className="denials">
            {result.denials.map((d) => (
              <li key={d}>
                <code>{d}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="hint">
        {video
          ? '[닫고 결과 보기]를 누르면 장면 편집기로 돌아갑니다. 내레이션을 듣고 미리보기로 확인한 뒤 영상을 만드세요.'
          : 'TODO 탭에서 확인할 곳을 모아 볼 수 있습니다. 검토한 뒤 제출하세요.'}
      </p>
    </article>
  )
}
