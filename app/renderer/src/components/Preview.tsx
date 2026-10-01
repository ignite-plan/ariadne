import DOMPurify from 'dompurify'
import { forwardRef, useMemo } from 'react'

// pandoc HTML을 정리해서 보여 준다. ariadne:// 이미지와 width 스타일은 남긴다
const ALLOWED_URI = /^(?:(?:https?|ariadne|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

export const Preview = forwardRef<HTMLDivElement, { html?: string; error?: string }>(function Preview(
  { html, error },
  ref,
) {
  const clean = useMemo(
    () => (html ? DOMPurify.sanitize(html, { ADD_ATTR: ['style'], ALLOWED_URI_REGEXP: ALLOWED_URI }) : ''),
    [html],
  )
  return (
    <div className="preview" ref={ref}>
      {error ? (
        <div className="preview-error">
          <b>미리보기를 만들지 못했습니다</b>
          <p>{error}</p>
        </div>
      ) : (
        <article className="page" dangerouslySetInnerHTML={{ __html: clean }} />
      )}
    </div>
  )
})
