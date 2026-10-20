// 편집기 버튼이 하는 Markdown 변환. Electron·CodeMirror에 의존하지 않는다 (단위 테스트 대상)

// 노란 형광펜: [글자]{.mark} → Word에서 노란 형광펜(w:highlight yellow)
// 안에 버튼 \[..\]처럼 이스케이프된 괄호가 있어도 한 형광펜으로 본다
export const MARK_RE = /\[((?:\\.|[^\]\n])+)\]\{\.mark\}/g

export interface TextEdit {
  from: number
  to: number
  insert: string
  // 바꾼 뒤 선택할 범위
  selection: { anchor: number; head: number }
}

// 줄 앞 들여쓰기·목록 기호 ("  - ", "1. "). 형광펜 밖에 둔다 (안에 들어가면 Word에 "- "가 글자로 찍히고 목록이 깨진다)
const LINE_PREFIX = /^\s*(?:(?:[-*+]|\d+[.)])\s+)?/
// 중간을 자르면 안 되는 표기: 굵게, 버튼 \[..\], 이미지·링크, 기존 형광펜
const TOKEN_RE = /\*\*(?:\\.|[^*\n])+?\*\*|\\\[[^\n]*?\\\]|!?\[[^\]\n]*\]\([^)\n]*\)(?:\{[^}\n]*\})?|\[[^\]\n]+\]\{[^}\n]*\}/g

// 한 줄 안의 선택 [from, to)를 감쌀 수 있는 범위로 맞춘다: 목록 기호 뒤부터, 표기 중간에 걸리면 표기 전체로, 앞뒤 공백 제외
function markRange(line: string, from: number, to: number): [number, number] | undefined {
  from = Math.max(from, line.match(LINE_PREFIX)![0].length)
  for (const m of line.matchAll(TOKEN_RE)) {
    const start = m.index!
    const end = start + m[0].length
    if (from > start && from < end) from = start
    if (to > start && to < end) to = end
  }
  while (from < to && /\s/.test(line[from])) from++
  while (to > from && /\s/.test(line[to - 1])) to--
  // 줄 끝 줄바꿈 표시(\)는 밖에 둔다 (안에 들어가면 닫는 괄호를 이스케이프해 형광펜이 깨진다)
  if (to === line.trimEnd().length && line[to - 1] === '\\' && line[to - 2] !== '\\') to--
  return from < to ? [from, to] : undefined
}

// 선택이 형광펜 안에 있으면 풀고, 아니면 선택한 글자(없으면 fallback)를 형광펜으로 감싼다.
// 줄을 넘기면 형광펜이 깨지므로 줄마다 감싸고, 목록 기호와 굵게·버튼 표기는 쪼개지 않는다
export function toggleMark(doc: string, from: number, to: number, fallback = '강조할 글자'): TextEdit {
  for (const m of doc.matchAll(MARK_RE)) {
    const start = m.index!
    const end = start + m[0].length
    if (from >= start && to <= end) {
      const inner = m[1]
      return { from: start, to: end, insert: inner, selection: { anchor: start, head: start + inner.length } }
    }
  }
  if (from === to) {
    const insert = `[${fallback}]{.mark}`
    return { from, to, insert, selection: { anchor: from + 1, head: from + 1 + fallback.length } }
  }
  // 선택이 걸친 줄 전체를 다시 쓴다
  const start = doc.lastIndexOf('\n', from - 1) + 1
  const lineEnd = doc.indexOf('\n', to)
  const end = lineEnd < 0 ? doc.length : lineEnd
  let offset = start
  let written = 0
  // 바꾼 뒤 선택: 첫 형광펜 글자 시작 ~ 마지막 형광펜 글자 끝
  let anchor = -1
  let head = -1
  const lines = doc.slice(start, end).split('\n').map((line) => {
    const lineStart = offset
    offset += line.length + 1
    const range = markRange(line, Math.max(from, lineStart) - lineStart, Math.min(to, lineStart + line.length) - lineStart)
    const next = range ? `${line.slice(0, range[0])}[${line.slice(range[0], range[1])}]{.mark}${line.slice(range[1])}` : line
    if (range) {
      if (anchor < 0) anchor = start + written + range[0] + 1
      head = start + written + range[1] + 1
    }
    written += next.length + 1
    return next
  })
  // 감쌀 글자가 없다 (목록 기호나 공백만 골랐다)
  if (anchor < 0) return { from, to, insert: doc.slice(from, to), selection: { anchor: from, head: to } }
  return { from: start, to: end, insert: lines.join('\n'), selection: { anchor, head } }
}

// 이미지 뒤 속성: ![..](..){width=4.2in align=center}
const IMAGE_RE = /(!\[[^\]]*\]\([^)\s]+\))(\{[^}]*\})?/

// 줄의 이미지에 가운데 정렬을 켜고 끈다. 이미지가 없으면 null
export function toggleCenter(line: string): string | null {
  const m = line.match(IMAGE_RE)
  if (!m) return null
  const [whole, image, attrs] = m
  const inner = attrs ? attrs.slice(1, -1).trim() : ''
  const parts = inner ? inner.split(/\s+/) : []
  const on = parts.includes('align=center')
  const next = on ? parts.filter((p) => p !== 'align=center') : [...parts, 'align=center']
  const replaced = next.length ? `${image}{${next.join(' ')}}` : image
  return line.replace(whole, replaced)
}

export const isCentered = (attrs: string) => /(^|\s)align=center(\s|$)/.test(attrs.replace(/[{}]/g, ' '))
