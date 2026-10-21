// Claude에게 요청 칸. 문서에서 복사한 서식(제목·목록)을 Markdown으로 바꿔 붙여 넣는다 (rich-paste.ts)
import type { ClipboardEvent, TextareaHTMLAttributes } from 'react'
import { pastedRequest } from '../rich-paste.ts'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onPaste'> & {
  value: string
  onChange: (value: string) => void
}

const parseHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html').body

export function RequestTextarea({ value, onChange, ...props }: Props) {
  const paste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = pastedRequest(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'), parseHtml)
    if (text === undefined) return
    e.preventDefault()
    // insertText는 입력 이벤트를 내고 ⌘Z 되돌리기에도 남는다
    document.execCommand('insertText', false, text)
  }
  return <textarea {...props} value={value} onChange={(e) => onChange(e.target.value)} onPaste={paste} />
}
