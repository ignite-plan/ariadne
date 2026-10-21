// 전체·장 미리보기: Word와 같은 순서·내용(TODO 빼고)으로 화면들을 이어 보여 준다.
// 지금 편집 중인 화면은 입력하는 대로 바뀌고(liveHtml), 다른 화면은 [이 화면 편집]으로 편집기에 연다
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import type { PreviewChapter } from '../../../shared/api.ts'
import { lazyImages, markWordIssues } from '../word-issues.ts'
import { sanitize } from './Preview.tsx'

const render = (html: string) => lazyImages(markWordIssues(sanitize(html)))

export const FullPreview = forwardRef<
  HTMLDivElement,
  {
    chapters?: PreviewChapter[]
    loading: boolean
    error?: string
    currentPath: string
    // 지금 화면의 입력 중 내용 (Word 모드로 그린 것). 아직 없으면 디스크 내용
    liveHtml?: string
    onOpenSection: (path: string) => void
  }
>(function FullPreview({ chapters, loading, error, currentPath, liveHtml, onOpenSection }, ref) {
  const container = useRef<HTMLDivElement | null>(null)
  // 다른 화면 HTML은 내용이 바뀔 때만 다시 정리한다
  const rendered = useMemo(
    () =>
      chapters?.map((chapter) => ({
        ...chapter,
        sections: chapter.sections.map((s) => ({ ...s, html: render(s.html) })),
      })),
    [chapters],
  )
  const live = useMemo(() => (liveHtml !== undefined ? render(liveHtml) : undefined), [liveHtml])

  // 화면을 바꾸거나 처음 그렸을 때 지금 화면으로 옮긴다 (편집 중 다시 읽을 때는 그대로)
  const scrolledTo = useRef<string>(undefined)
  useEffect(() => {
    if (!rendered || scrolledTo.current === currentPath) return
    const el = container.current?.querySelector<HTMLElement>('[data-current="true"]')
    if (!el) return
    scrolledTo.current = currentPath
    el.scrollIntoView({ block: 'start' })
  }, [rendered, currentPath])

  if (error) {
    return (
      <div className="preview">
        <div className="preview-error">
          <b>미리보기를 만들지 못했습니다</b>
          <p>{error}</p>
        </div>
      </div>
    )
  }
  return (
    <div
      className="preview full-preview"
      ref={(el) => {
        container.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
    >
      {!rendered && <p className="muted full-preview-loading">{loading ? '미리보기를 만드는 중…' : ''}</p>}
      {rendered?.map((chapter) => (
        <article className="page full-page" key={chapter.dir}>
          <h1 className="full-chapter">
            {chapter.no}. {chapter.title}
          </h1>
          {chapter.sections.map((s) => {
            const current = s.path === currentPath
            return (
              <section
                key={s.path}
                className={`full-section ${current ? 'current' : ''} ${s.issues.length ? 'has-issue' : ''}`}
                data-path={s.path}
                data-current={current}
              >
                {!current && (
                  <button className="button small full-open" onClick={() => onOpenSection(s.path)} title={`${s.title} 화면을 편집기에 엽니다`}>
                    이 화면 편집
                  </button>
                )}
                <div className="full-body" dangerouslySetInnerHTML={{ __html: current && live !== undefined ? live : s.html }} />
              </section>
            )
          })}
        </article>
      ))}
    </div>
  )
})
