// Claude 변경 검토용 비교. 편집기는 줄 단위(바뀐 줄 왼쪽 막대), 미리보기는 문단 맞춤 + 단어 단위로 표시한다.
// 화면 코드와 분리해 테스트한다
import { diffArrays, diffLines, diffWordsWithSpace } from 'diff'

export interface ReviewHunk {
  // add: 새로 들어간 줄, change: 바뀐 줄, del: 줄이 지워진 자리(그 다음 줄)
  kind: 'add' | 'change' | 'del'
  // 지금 본문 기준 줄 번호 (1부터, 끝 포함)
  from: number
  to: number
}

const lineCount = (value: string) => value.replace(/\n$/, '').split('\n').length

// 고치기 전과 지금 본문을 줄 단위로 비교한다. 지운 다음 넣은 것은 바뀐 줄 하나로 묶는다
export function reviewHunks(before: string, after: string): ReviewHunk[] {
  const hunks: ReviewHunk[] = []
  const last = Math.max(1, lineCount(after))
  let line = 1
  let removedAt: number | undefined
  for (const part of diffLines(before, after)) {
    const count = part.count ?? lineCount(part.value)
    if (part.removed) {
      removedAt = line
      continue
    }
    if (part.added) {
      hunks.push({ kind: removedAt === line ? 'change' : 'add', from: line, to: line + count - 1 })
      removedAt = undefined
      line += count
      continue
    }
    if (removedAt !== undefined) hunks.push({ kind: 'del', from: Math.min(removedAt, last), to: Math.min(removedAt, last) })
    removedAt = undefined
    line += count
  }
  if (removedAt !== undefined) hunks.push({ kind: 'del', from: Math.min(removedAt, last), to: Math.min(removedAt, last) })
  return hunks
}

export type BlockMatch =
  | { kind: 'same' | 'changed'; before: number; after: number }
  | { kind: 'added'; after: number }
  | { kind: 'removed'; before: number }

// 미리보기 문단 목록(서명)을 맞춘다. 지운 문단과 넣은 문단이 이어지면 앞에서부터 짝지어 '바뀜'으로 본다
export function alignBlocks(before: string[], after: string[]): BlockMatch[] {
  const out: BlockMatch[] = []
  let b = 0
  let a = 0
  let removed: number[] = []
  const flushRemoved = () => {
    for (const index of removed) out.push({ kind: 'removed', before: index })
    removed = []
  }
  for (const part of diffArrays(before, after)) {
    const count = part.count ?? part.value.length
    if (part.removed) {
      for (let i = 0; i < count; i++) removed.push(b++)
      continue
    }
    if (part.added) {
      for (let i = 0; i < count; i++) {
        const pair = removed.shift()
        out.push(pair === undefined ? { kind: 'added', after: a++ } : { kind: 'changed', before: pair, after: a++ })
      }
      flushRemoved()
      continue
    }
    flushRemoved()
    for (let i = 0; i < count; i++) out.push({ kind: 'same', before: b++, after: a++ })
  }
  flushRemoved()
  return out
}

export type WordOp = { type: 'ins'; start: number; end: number } | { type: 'del'; at: number; text: string }

// 한 문단 안에서 단어 단위로 비교한다. 위치는 지금 글자 기준 (넣은 글자는 감싸고, 지운 글자는 그 자리에 끼워 넣는다)
export function wordOps(before: string, after: string): WordOp[] {
  const ops: WordOp[] = []
  let at = 0
  for (const part of diffWordsWithSpace(before, after)) {
    if (part.added) {
      ops.push({ type: 'ins', start: at, end: at + part.value.length })
      at += part.value.length
    } else if (part.removed) {
      if (part.value.trim()) ops.push({ type: 'del', at, text: part.value })
    } else at += part.value.length
  }
  return ops
}
