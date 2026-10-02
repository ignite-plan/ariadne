import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DraftCheck, DraftEvent, DraftInput, DraftResult, SessionInfo } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { Icon } from './Icon.tsx'
import { useToast } from './Toast.tsx'

interface LogLine {
  id: string
  kind: 'status' | 'warning' | 'tool' | 'text' | 'error'
  text: string
  done?: boolean
  failed?: boolean
}

type Phase = 'check' | 'ready' | 'running' | 'done'

const minutes = (ms?: number) => (!ms ? '' : ms < 60000 ? `${Math.round(ms / 1000)}초` : `${Math.round(ms / 60000)}분`)

// Claude로 초안 만들기: 사전 점검 → 실행(진행 로그) → 결과 요약
export function DraftPanel({
  input,
  onOpenSection,
  onDiff,
  onClose,
}: {
  input: DraftInput
  onOpenSection: (path: string) => void
  onDiff: (path: string, title: string) => void
  onClose: (changed: boolean) => void
}) {
  const refresh = input.mode === 'refresh'
  const video = input.mode === 'video'
  const name = video ? 'Claude로 영상 초안' : refresh ? 'Claude로 최신화' : 'Claude로 초안 만들기'
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('check')
  const [check, setCheck] = useState<DraftCheck>()
  const [session, setSession] = useState<SessionInfo>({ exists: false })
  const [log, setLog] = useState<LogLine[]>([])
  const [result, setResult] = useState<DraftResult>()
  const [error, setError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const started = useRef(Date.now())
  const logEnd = useRef<HTMLDivElement>(null)

  const runCheck = async (refresh = false) => {
    setPhase('check')
    const [c, s] = await Promise.all([api.draft.check(refresh), api.capture.session()])
    setCheck(c)
    setSession(s)
    setPhase('ready')
  }

  useEffect(() => {
    void runCheck()
    return api.on('draft-event', (event: DraftEvent) => {
      setLog((lines) => apply(lines, event))
    })
  }, [])

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' })
  }, [log])

  const login = async () => {
    setLoggingIn(true)
    try {
      await api.capture.login()
      setSession(await api.capture.session())
    } catch (e) {
      if (!errorMessage(e).includes('취소')) toast.error(e)
    } finally {
      setLoggingIn(false)
    }
  }

  const start = async () => {
    setPhase('running')
    setLog([])
    setError('')
    started.current = Date.now()
    try {
      const r = await api.draft.start(input)
      setResult(r)
      if (!r.ok) setError(r.text || 'Claude가 오류로 끝났습니다')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPhase('done')
    }
  }

  // 진행 시간 표시
  const [, tick] = useState(0)
  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  const atlassianOk = check?.atlassian.some((a) => a.connected)
  const elapsed = Math.round((Date.now() - started.current) / 1000)

  return (
    <div className="capture-panel draft-panel">
      <header className="panel-header">
        <div>
          <h1>{name}</h1>
          <p className="muted">
            {input.menu} ·{' '}
            {video
              ? '연결된 매뉴얼 화면의 문장으로 내레이션을 쓰고, STG 화면을 확인해 단계를 만든 뒤 실제로 실행해 봅니다.'
              : refresh
                ? '최신 Confluence 기획서와 STG 화면을 지금 본문과 비교해 바뀐 곳만 고칩니다. 근거가 다르면 TODO로 남깁니다.'
                : 'Confluence 기획서와 STG 화면을 근거로 영어 초안을 씁니다. 근거가 없는 내용은 TODO로 남깁니다.'}
          </p>
        </div>
        <button className="icon-button" onClick={() => onClose(Boolean(result))} aria-label="닫기" disabled={phase === 'running'}>
          <Icon name="x" />
        </button>
      </header>

      <div className="capture-body">
        <aside className="capture-side">
          <div className="draft-checks">
            <CheckRow
              ok={Boolean(check?.claude)}
              loading={!check}
              label="Claude Code"
              detail={check?.claude ? check.claude.version : '설치되어 있지 않습니다 (설정 → 환경 점검)'}
            />
            <CheckRow
              ok={Boolean(atlassianOk)}
              warn={check && !atlassianOk}
              loading={!check}
              label="Confluence (Atlassian MCP)"
              detail={
                !check
                  ? '확인 중… (30초쯤 걸립니다)'
                  : atlassianOk
                    ? check.atlassian.filter((a) => a.connected).map((a) => a.name).join(', ')
                    : '연결이 없습니다. 기획서 없이 쓰고 정책은 TODO로 남깁니다'
              }
            />
            <CheckRow
              ok={session.exists}
              warn={!session.exists}
              label="STG 로그인"
              detail={session.exists ? '로그인 세션 있음' : '없으면 화면 확인과 캡처를 건너뜁니다'}
              action={
                !session.exists && (
                  <button className="button small" onClick={login} disabled={loggingIn || phase === 'running'}>
                    로그인
                  </button>
                )
              }
            />
          </div>

          <dl className="draft-input">
            <dt>{video ? '영상' : refresh ? '장' : '메뉴'}</dt>
            <dd>{input.menu}</dd>
            {video ? (
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

          <span className="spacer" />
          {phase === 'running' ? (
            <button className="button block" onClick={() => void api.draft.cancel()}>
              <Icon name="x" /> 중지
            </button>
          ) : phase === 'done' ? (
            <button className="button primary block" onClick={() => onClose(true)}>
              <Icon name="check" /> 닫고 결과 보기
            </button>
          ) : (
            <button className="button primary block" disabled={phase !== 'ready' || !check?.claude} onClick={start}>
              <Icon name={refresh || video ? 'sparkle' : 'flag'} /> {video ? '영상 초안 시작' : refresh ? '최신화 시작' : '초안 만들기 시작'}
            </button>
          )}
          <p className="hint">
            {video ? '영상 하나에 수 분' : refresh ? '화면 수에 따라 수 분에서 10분 이상' : '초안 하나에 수 분에서 10분 이상'} 걸리고, 내 Claude 사용량을 씁니다.
          </p>
        </aside>

        <section className="capture-results draft-log">
          {phase === 'check' && <p className="muted">환경을 확인하는 중…</p>}
          {phase === 'ready' && (
            <div className="empty-state">
              <Icon name="flag" size={32} />
              <p>
                {video
                  ? '[영상 초안 시작]을 누르면 Claude가 매뉴얼 본문으로 장면을 나누고, STG에서 단계를 찾아 시나리오를 쓴 뒤 끝까지 실행해 봅니다.'
                  : refresh
                    ? '[최신화 시작]을 누르면 Claude가 지금 본문을 읽고, 최신 기획서와 STG 화면과 비교해 바뀐 곳만 고칩니다.'
                    : '[초안 만들기 시작]을 누르면 Claude가 기획서를 찾고 STG 화면을 확인하며 초안을 씁니다.'}
              </p>
              <p className="muted">진행 상황이 여기에 한 줄씩 나옵니다. 저장·삭제 같은 버튼은 앱이 막습니다.</p>
            </div>
          )}
          {(phase === 'running' || phase === 'done') && (
            <>
              <ol className="log">
                {log.map((line) => (
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
                    <span className="log-text">{line.text}</span>
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
              onOpenSection={onOpenSection}
              onDiff={onDiff}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function apply(lines: LogLine[], event: DraftEvent): LogLine[] {
  const id = `${Date.now()}-${Math.random()}`
  if (event.kind === 'status') return [...lines, { id, kind: 'status', text: event.text }]
  if (event.kind === 'warning') return [...lines, { id, kind: 'warning', text: event.text }]
  const e = event.event
  if (e.kind === 'tool') return [...lines, { id: e.id, kind: 'tool', text: e.label }]
  if (e.kind === 'tool_result') {
    return lines.map((l) => (l.id === e.id ? { ...l, done: true, failed: e.isError, text: e.isError ? `${l.text} — ${e.text}` : l.text } : l))
  }
  if (e.kind === 'text') {
    // 마지막 요약(JSON)은 결과 카드로 보여 준다
    const text = e.text.replace(/```json[\s\S]*?```/g, '').trim()
    return text ? [...lines, { id, kind: 'text', text }] : lines
  }
  if (e.kind === 'init' && e.mcp.some((m) => m.status !== 'connected')) {
    const failed = e.mcp.filter((m) => m.status !== 'connected').map((m) => m.name)
    return [...lines, { id, kind: 'status', text: `연결 안 된 MCP: ${failed.join(', ')}` }]
  }
  return lines
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
  onOpenSection,
  onDiff,
}: {
  result?: DraftResult
  error: string
  refresh: boolean
  video?: boolean
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
