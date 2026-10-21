// 미리보기 HTML에서 Word에 Markdown 표기가 글자로 그대로 나올 곳을 표시한다 (src/core/word-check.ts와 같은 기준).
// 태그 밖 글자만 본다
const RAW_MARKUP = /\*\*|\{\.mark\}|\]\{|&lt;!--|--&gt;/g

export function markWordIssues(html: string) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(RAW_MARKUP, (m) => `<mark class="word-issue" title="Word에 이 표기가 글자로 그대로 나옵니다">${m}</mark>`)))
    .join('')
    .replace(/<pre\b/g, '<pre class="word-issue-block" title="들여쓰기 때문에 Word에 코드 블록(글자 그대로)으로 나옵니다"')
}

// 이미지는 보일 때 불러온다 (매뉴얼 전체는 이미지가 수백 장)
export const lazyImages = (html: string) => html.replace(/<img\b(?![^>]*\bloading=)/g, '<img loading="lazy"')
