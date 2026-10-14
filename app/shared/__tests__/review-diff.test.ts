import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { alignBlocks, reviewHunks, wordOps } from '../review-diff.ts'

describe('Claude 변경 검토 비교', () => {
  it('줄 단위: 바뀐 줄, 넣은 줄, 지운 자리를 지금 본문 줄 번호로', () => {
    const before = 'a\nb\nc\nd\n'
    const after = 'a\nB\nc\nnew1\nnew2\nd\n'
    assert.deepEqual(reviewHunks(before, after), [
      { kind: 'change', from: 2, to: 2 },
      { kind: 'add', from: 4, to: 5 },
    ])
    // 지운 줄은 그다음 줄에, 끝에서 지웠으면 마지막 줄에 표시한다
    assert.deepEqual(reviewHunks('a\nb\nc\n', 'a\nc\n'), [{ kind: 'del', from: 2, to: 2 }])
    assert.deepEqual(reviewHunks('a\nb\nc\n', 'a\nb\n'), [{ kind: 'del', from: 2, to: 2 }])
    assert.deepEqual(reviewHunks('same\n', 'same\n'), [])
  })

  it('문단 맞춤: 지운 문단과 넣은 문단이 이어지면 바뀜으로 짝짓는다', () => {
    assert.deepEqual(alignBlocks(['A', 'B', 'C'], ['A', 'B2', 'C', 'D']), [
      { kind: 'same', before: 0, after: 0 },
      { kind: 'changed', before: 1, after: 1 },
      { kind: 'same', before: 2, after: 2 },
      { kind: 'added', after: 3 },
    ])
    assert.deepEqual(alignBlocks(['A', 'B', 'C'], ['A', 'C']), [
      { kind: 'same', before: 0, after: 0 },
      { kind: 'removed', before: 1 },
      { kind: 'same', before: 2, after: 1 },
    ])
  })

  it('단어 단위: 넣은 글자는 지금 글자 위치로, 지운 글자는 그 자리에', () => {
    const before = 'Click Save to keep the dealer.'
    const after = 'Click Apply to keep the dealer and status.'
    const ops = wordOps(before, after)
    const ins = ops.filter((o) => o.type === 'ins').map((o) => o.type === 'ins' && after.slice(o.start, o.end))
    const del = ops.filter((o) => o.type === 'del').map((o) => o.type === 'del' && o.text)
    // 문장 부호는 따로 비교해 바뀐 단어만 표시한다
    assert.deepEqual(ins, ['Apply', ' and status'])
    assert.deepEqual(del, ['Save'])
    assert.deepEqual(wordOps('same text', 'same text'), [])
  })
})
