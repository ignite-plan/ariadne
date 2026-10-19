// Claude 작업 결과 카드: 만든·고친 화면, 참고한 기획서, 앱이 막은 요청
import type { DraftInput, DraftResult } from '../../../shared/api.ts'
import { DRAFT_MODES, draftMode, isVideoDraft } from '../../../shared/draft-mode.ts'
import { formatDuration } from '../../../shared/format.ts'
import { api } from '../api.ts'
import { Icon } from './Icon.tsx'

export function DraftSummaryCard({
  input,
  result,
  error,
  onOpenSection,
  onDiff,
}: {
  input: DraftInput
  result?: DraftResult
  error: string
  onOpenSection: (path: string) => void
  onDiff: (path: string, title: string) => void
}) {
  const mode = DRAFT_MODES[draftMode(input)]
  const refresh = input.mode === 'refresh'
  const shots = input.mode === 'shots'
  const video = isVideoDraft(input)
  const summary = result?.summary
  const manualPrefix = (path: string) => (path.startsWith('manuals/') ? path : `manuals/${result?.manual ?? ''}/${path}`)
  return (
    <article className={`draft-summary ${error ? 'failed' : ''}`}>
      <h2>{error ? mode.failed : mode.done(summary?.sections.length ?? 0)}</h2>
      {error && <p className="form-error">{error}</p>}
      {summary ? (
        <>
          <div className="report-summary inline">
            {video ? (
              <span className="pill accent">장면 {summary.scenes ?? 0}</span>
            ) : shots ? (
              <span className="pill accent">캡처 정의 {summary.images?.length ?? 0}</span>
            ) : (
              <>
                <span className="pill accent">
                  {refresh ? '고친 화면' : '화면'} {summary.sections.length}
                </span>
                <span className="pill">이미지 {summary.images?.length ?? 0}</span>
              </>
            )}
            {!shots && <span className={`pill ${summary.todos ? 'todo' : ''}`}>TODO {summary.todos ?? 0}</span>}
            {result?.durationMs ? <span className="pill">{formatDuration(result.durationMs)}</span> : null}
          </div>
          {summary.sections.length > 0 && <h3>{refresh ? '고친 화면' : shots ? '캡처 정의를 더한 화면' : '만든 화면'}</h3>}
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
              <h3>{shots ? '더한 정의가 없는 화면' : '그대로인 화면'}</h3>
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
          : shots
            ? '[닫고 캡처 열기]를 누르면 캡처 패널이 열립니다. 새로 등록한 이미지를 찍어 지금 매뉴얼과 비교하고, 캡처 정의(shots.ts)를 제출하세요.'
            : 'TODO 탭에서 확인할 곳을 모아 볼 수 있습니다. 검토한 뒤 제출하세요.'}
      </p>
    </article>
  )
}
