import { useEffect, useMemo, useState } from 'react'
import { isSessionExpired } from '../../../../src/core/stg-url.ts'
import { assetUrl, type CaptureProgress, type CaptureReport, type ShotInfo } from '../../../shared/api.ts'
import { api, errorMessage } from '../api.ts'
import { useTasks } from '../tasks.tsx'
import { Icon } from './Icon.tsx'
import { Progress } from './Progress.tsx'
import { StgSession } from './StgSession.tsx'
import { useToast } from './Toast.tsx'

export function CapturePanel({
  manual,
  currentSection,
  onAdopted,
  onClose,
}: {
  manual: string
  currentSection?: string
  onAdopted: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const [shots, setShots] = useState<ShotInfo[]>()
  const [loadError, setLoadError] = useState('')
  const { session, reloadSession } = useTasks()
  const [scope, setScope] = useState<'section' | 'all'>(currentSection ? 'section' : 'all')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<CaptureProgress>()
  const [report, setReport] = useState<CaptureReport>()
  const [adopt, setAdopt] = useState<Set<string>>(new Set())
  const [stamp, setStamp] = useState(Date.now())

  useEffect(() => {
    api.capture.shots().then(setShots, (e) => setLoadError(errorMessage(e)))
    return api.on('capture-progress', setProgress)
  }, [])

  const visible = useMemo(
    () => (shots ?? []).filter((s) => scope === 'all' || (currentSection && s.sections.includes(currentSection))),
    [shots, scope, currentSection],
  )

  // 범위를 바꾸면 자동 캡처 가능한 것만 기본 선택
  useEffect(() => {
    setChecked(new Set(visible.filter((s) => !s.manual).map((s) => s.id)))
  }, [visible])

  const run = async () => {
    setRunning(true)
    setReport(undefined)
    setProgress(undefined)
    try {
      const result = await api.capture.run([...checked])
      setReport(result)
      setAdopt(new Set(result.changed))
      setStamp(Date.now())
      if (result.failed.some((f) => isSessionExpired(f.error))) {
        toast.show('error', '로그인 세션이 만료되었습니다. 다시 로그인하세요')
        void reloadSession()
      }
    } catch (e) {
      toast.error(e)
    } finally {
      setRunning(false)
    }
  }

  const applyAdopt = async () => {
    try {
      await api.capture.adopt([...adopt])
      toast.show('success', `이미지 ${adopt.size}장을 반영했습니다`)
      setReport(report && { ...report, changed: report.changed.filter((id) => !adopt.has(id)) })
      setAdopt(new Set())
      onAdopted()
    } catch (e) {
      toast.error(e)
    }
  }

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  return (
    <div className="capture-panel">
      <header className="panel-header">
        <div>
          <h1>화면 캡처</h1>
          <p className="muted">STG 화면을 다시 찍어 바뀐 이미지만 골라 반영합니다. 저장·삭제 버튼은 누르지 않습니다.</p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="닫기" disabled={running}>
          <Icon name="x" />
        </button>
      </header>

      <div className="capture-body">
        <aside className="capture-side">
          <StgSession disabled={running} />

          <div className="segmented small">
            <button
              className={scope === 'section' ? 'active' : ''}
              onClick={() => setScope('section')}
              disabled={!currentSection}
            >
              지금 화면
            </button>
            <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
              전체
            </button>
          </div>

          <div className="shot-list">
            {loadError && <p className="form-error">{loadError}</p>}
            {!shots && !loadError && <p className="muted">캡처 목록을 읽는 중…</p>}
            {shots && !visible.length && (
              <p className="empty">
                이 화면에는 자동 캡처가 정의되어 있지 않습니다. <br />
                개발자에게 <code>shots.ts</code> 추가를 요청하세요.
              </p>
            )}
            {visible.map((s) => (
              <label key={s.id} className={`shot ${s.manual ? 'disabled' : ''}`} title={s.manual ? '수동 이미지 (자동 캡처 안 함)' : s.path}>
                <input
                  type="checkbox"
                  disabled={s.manual || running}
                  checked={checked.has(s.id)}
                  onChange={() => setChecked(toggle(checked, s.id))}
                />
                <span className="ellipsis">{s.id}</span>
                {s.manual && <span className="tag">수동</span>}
                {!s.exists && <span className="tag accent">새</span>}
              </label>
            ))}
          </div>

          <button className="button primary block" disabled={!checked.size || running || !session.exists} onClick={run}>
            <Icon name="camera" /> {running ? '캡처 중…' : `${checked.size}장 캡처`}
          </button>
          {running && progress && (
            <Progress percent={Math.round(((progress.index + 1) / progress.total) * 100)}>
              <span className="ellipsis">
                {progress.index + 1}/{progress.total} · {progress.id}
              </span>
            </Progress>
          )}
        </aside>

        <section className="capture-results">
          {!report && !running && (
            <div className="empty-state">
              <Icon name="camera" size={32} />
              <p>왼쪽에서 캡처할 이미지를 고르고 [캡처]를 누르세요.</p>
              <p className="muted">바뀐 이미지만 여기에 나란히 보여 줍니다. 확인한 것만 반영됩니다.</p>
            </div>
          )}
          {report && (
            <>
              <div className="report-summary">
                <span className="pill accent">바뀜 {report.changed.length}</span>
                <span className="pill">그대로 {report.unchanged.length}</span>
                {report.skipped.length > 0 && <span className="pill">수동 {report.skipped.length}</span>}
                {report.failed.length > 0 && <span className="pill danger">실패 {report.failed.length}</span>}
                <span className="spacer" />
                <button className="button primary" disabled={!adopt.size} onClick={applyAdopt}>
                  <Icon name="check" /> 선택한 {adopt.size}장 반영
                </button>
              </div>
              {report.failed.length > 0 && (
                <ul className="failed-list">
                  {report.failed.map((f) => (
                    <li key={f.id}>
                      <b>{f.id}</b> {f.error}
                    </li>
                  ))}
                </ul>
              )}
              {report.changed.length === 0 && (
                <p className="empty">바뀐 이미지가 없습니다. 매뉴얼 이미지가 최신입니다.</p>
              )}
              {report.changed.map((id) => {
                const shot = shots?.find((s) => s.id === id)
                return (
                  <article key={id} className={`compare ${adopt.has(id) ? 'selected' : ''}`}>
                    <label className="compare-head">
                      <input type="checkbox" checked={adopt.has(id)} onChange={() => setAdopt(toggle(adopt, id))} />
                      <b>{id}</b>
                      {shot?.sections[0] && <span className="muted ellipsis">{shot.sections.join(', ')}</span>}
                    </label>
                    <div className="compare-images">
                      <figure>
                        <figcaption>지금 매뉴얼</figcaption>
                        {shot?.exists === false ? (
                          <div className="no-image">새 이미지</div>
                        ) : (
                          <img src={assetUrl(`manuals/${manual}/images/${id}.png`, stamp)} alt="" />
                        )}
                      </figure>
                      <figure>
                        <figcaption>새로 찍은 화면</figcaption>
                        <img src={assetUrl(`.capture/${manual}/${id}.png`, stamp)} alt="" />
                      </figure>
                    </div>
                  </article>
                )
              })}
            </>
          )}
        </section>
      </div>

    </div>
  )
}
