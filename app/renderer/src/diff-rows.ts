// 변경 보기용 줄 비교. 화면 코드와 분리해 테스트한다
import { diffLines } from 'diff'

export interface Row {
  kind: 'same' | 'add' | 'del' | 'gap'
  text: string
  before?: number
  after?: number
}

const CONTEXT = 3

// 마지막 제출 내용과 지금 내용을 줄 단위로 비교한다. 바뀐 줄 앞뒤 3줄만 보여 준다
export function buildRows(before: string, after: string): Row[] {
  const rows: Row[] = []
  let b = 1
  let a = 1
  for (const part of diffLines(before, after)) {
    const lines = part.value.replace(/\n$/, '').split('\n')
    for (const text of lines) {
      if (part.added) rows.push({ kind: 'add', text, after: a++ })
      else if (part.removed) rows.push({ kind: 'del', text, before: b++ })
      else rows.push({ kind: 'same', text, before: b++, after: a++ })
    }
  }
  const keep = rows.map(() => false)
  rows.forEach((row, i) => {
    if (row.kind === 'same') return
    for (let j = Math.max(0, i - CONTEXT); j <= Math.min(rows.length - 1, i + CONTEXT); j++) keep[j] = true
  })
  const out: Row[] = []
  rows.forEach((row, i) => {
    if (keep[i]) out.push(row)
    else if (out.at(-1)?.kind !== 'gap') out.push({ kind: 'gap', text: '' })
  })
  return out
}

