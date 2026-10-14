// 편집기 버튼이 하는 Markdown 변환. Electron·CodeMirror에 의존하지 않는다 (단위 테스트 대상)

// 노란 형광펜: [글자]{.mark} → Word에서 노란 형광펜(w:highlight yellow)
export const MARK_RE = /\[([^\]\n]+)\]\{\.mark\}/g

export interface TextEdit {
  from: number
  to: number
  insert: string
  // 바꾼 뒤 선택할 범위
  selection: { anchor: number; head: number }
}

// 선택이 형광펜 안에 있으면 풀고, 아니면 선택한 글자(없으면 fallback)를 형광펜으로 감싼다
export function toggleMark(doc: string, from: number, to: number, fallback = '강조할 글자'): TextEdit {
  for (const m of doc.matchAll(MARK_RE)) {
    const start = m.index!
    const end = start + m[0].length
    if (from >= start && to <= end) {
      const inner = m[1]
      return { from: start, to: end, insert: inner, selection: { anchor: start, head: start + inner.length } }
    }
  }
  const selected = doc.slice(from, to) || fallback
  // 줄을 넘기면 형광펜이 깨지므로 줄마다 감싼다
  const insert = selected
    .split('\n')
    .map((line) => (line.trim() ? `[${line}]{.mark}` : line))
    .join('\n')
  return { from, to, insert, selection: { anchor: from + 1, head: from + insert.length - '{.mark}'.length - 1 } }
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
