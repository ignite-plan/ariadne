import DOMPurify from 'dompurify'
import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react'
import { markReview } from '../review-marks.ts'

// pandoc HTML을 정리해서 보여 준다. ariadne:// 이미지와 width 스타일은 남긴다
const ALLOWED_URI = /^(?:(?:https?|ariadne|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
const sanitize = (html: string) => DOMPurify.sanitize(html, { ADD_ATTR: ['style'], ALLOWED_URI_REGEXP: ALLOWED_URI })

export const Preview = forwardRef<
  HTMLDivElement,
  {
    html?: string
    error?: string
    // Claude가 고치기 전 HTML. 있으면 바뀐 곳을 표시한다
    beforeHtml?: string
  }
>(function Preview({ html, error, beforeHtml }, ref) {
  const clean = useMemo(() => (html ? sanitize(html) : ''), [html])
  const cleanBefore = useMemo(() => (beforeHtml ? sanitize(beforeHtml) : undefined), [beforeHtml])
  const article = useRef<HTMLElement>(null)

  // 표시는 DOM을 직접 고치므로, 내용이나 비교 대상이 바뀔 때마다 처음부터 다시 그린다
  useLayoutEffect(() => {
    const el = article.current
    if (!el) return
    el.innerHTML = clean
    if (cleanBefore !== undefined) markReview(el, cleanBefore)
  }, [clean, cleanBefore, error])

  return (
    <div className="preview" ref={ref}>
      {error ? (
        <div className="preview-error">
          <b>미리보기를 만들지 못했습니다</b>
          <p>{error}</p>
        </div>
      ) : (
        <article className={`page ${cleanBefore !== undefined ? 'reviewing' : ''}`} ref={article} />
      )}
    </div>
  )
})
