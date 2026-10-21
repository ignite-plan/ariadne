// Word의 "캡션(Caption)" 스타일 문단을 이미지 캡션으로 옮긴다.
// Word 원본은 이미지 아래 캡션을 따로 문단으로 다는 경우가 많은데, pandoc은 그 문단을 일반 본문으로 꺼낸다.
// 그대로 두면 Word·미리보기에서 캡션이 아니라 본문 글자로 나온다
import { spawn } from 'node:child_process'

type Node = { t?: string; c?: unknown } | Node[] | string | number | null

const textOf = (node: Node): string => {
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!node || typeof node !== 'object') return ''
  if (node.t === 'Str') return String(node.c)
  if (node.t === 'Space' || node.t === 'SoftBreak') return ' '
  return textOf(node.c as Node)
}

// pandoc JSON AST(docx+styles)에서 캡션 스타일 문단 글자
export function captionsInAst(blocks: unknown): string[] {
  const found: string[] = []
  const walk = (node: Node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.t === 'Div') {
      const [[, , attrs], content] = node.c as [[string, string[], [string, string][]], Node]
      const style = attrs.find(([key]) => key === 'custom-style')?.[1] ?? ''
      if (/^caption/i.test(style)) {
        const text = textOf(content).replace(/\s+/g, ' ').trim()
        if (text) found.push(text)
        return
      }
    }
    for (const value of Object.values(node)) walk(value as Node)
  }
  walk(blocks as Node)
  return found
}

// Word 원본의 캡션 스타일 문단 글자 목록
export function wordCaptions(source: string, pandoc = 'pandoc') {
  return new Promise<string[]>((resolve, reject) => {
    const child = spawn(pandoc, [source, '-f', 'docx+styles', '-t', 'json'])
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8').on('data', (d) => (out += d))
    child.stderr.setEncoding('utf8').on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(captionsInAst(JSON.parse(out).blocks)) : reject(new Error(`pandoc 실패: ${err}`))))
  })
}

// 비교용: Markdown 표기(굵게·기울임·형광펜·이스케이프)와 둥근 따옴표를 빼고 소문자로
export const captionKey = (text: string) =>
  plainCaption(text)
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()

// 캡션 글자만 (Markdown 표기를 뺀다)
export const plainCaption = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
    .replace(/\\(.)/g, '$1')
    .replace(/[*_]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// 이미지만 있는 줄 (목록 안 포함). 캡션은 비었거나 Word가 자동으로 넣은 한글 대체 텍스트
const IMAGE_LINE = /^(\s*(?:[-*+]\s+)?)!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?\s*$/

// 이미지 줄 다음(빈 줄 건너)에 Word 캡션 문단과 글자가 같은 한 줄 문단이 있으면, 그 글자를 이미지 캡션으로 옮기고 문단을 지운다.
// 이미지에 이미 같은 캡션이 있으면 겹친 문단만 지운다. 다른 캡션이 있으면 그대로 둔다.
// 이미지가 윗줄 문장에 이어진 줄이면 빈 줄을 넣어 이미지만의 문단(Word 캡션이 붙는 그림)으로 뗀다
export function mergeCaptionParagraphs(lines: string[], captions: Iterable<string>) {
  const keys = new Set([...captions].map(captionKey))
  const out = [...lines]
  const merged: string[] = []
  for (let i = 0; i < out.length; i++) {
    const image = out[i].match(IMAGE_LINE)
    if (!image) continue
    let j = i + 1
    while (j < out.length && !out[j].trim()) j++
    // 캡션 문단은 한 줄짜리 문단 (다음 줄이 비었거나 끝)
    if (j >= out.length || (j + 1 < out.length && out[j + 1].trim())) continue
    const candidate = out[j].trim()
    if (!keys.has(captionKey(candidate)) || IMAGE_LINE.test(candidate)) continue
    const [, prefix, alt, src, attrs = ''] = image
    const caption = plainCaption(candidate)
    if (alt && !/[가-힣]/.test(alt) && captionKey(alt) !== captionKey(caption)) continue
    out[i] = `${prefix}![${caption.replace(/[[\]]/g, '\\$&')}](${src})${attrs}`
    out.splice(i + 1, j - i)
    // 이미지가 윗줄 문장과 같은 문단이면 캡션이 붙는 그림이 되지 않아 Word에 캡션이 안 나온다. 빈 줄로 떼어 이미지만의 문단으로
    if (i > 0 && out[i - 1].trim() && !prefix.trim()) {
      out.splice(i, 0, '')
      i++
    }
    merged.push(caption)
  }
  return { lines: out, merged }
}
