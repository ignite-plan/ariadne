import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toggleCenter, toggleMark } from '../../../shared/markdown-edit.ts'

const apply = (doc: string, e: { from: number; to: number; insert: string }) => doc.slice(0, e.from) + e.insert + doc.slice(e.to)

describe('형광펜 버튼', () => {
  it('선택한 글자를 감싸고, 안에서 다시 누르면 푼다', () => {
    const doc = 'Click Save button.'
    const on = toggleMark(doc, 6, 10)
    const marked = apply(doc, on)
    assert.equal(marked, 'Click [Save]{.mark} button.')
    assert.equal(marked.slice(on.selection.anchor, on.selection.head), 'Save')
    const off = toggleMark(marked, 8, 8)
    assert.equal(apply(marked, off), doc)
  })
  it('선택이 없으면 기본 글자, 여러 줄이면 줄마다', () => {
    assert.equal(apply('a', toggleMark('a', 1, 1)), 'a[강조할 글자]{.mark}')
    assert.equal(apply('x\ny', toggleMark('x\ny', 0, 3)), '[x]{.mark}\n[y]{.mark}')
  })
})

describe('이미지 가운데 정렬 버튼', () => {
  it('크기 표기에 붙이고 떼고, 표기가 없으면 새로 붙인다', () => {
    assert.equal(toggleCenter('![Cap](images/a.png){width=4.2in}'), '![Cap](images/a.png){width=4.2in align=center}')
    assert.equal(toggleCenter('![Cap](images/a.png){width=4.2in align=center}'), '![Cap](images/a.png){width=4.2in}')
    assert.equal(toggleCenter('- ![](images/a.png)'), '- ![](images/a.png){align=center}')
    assert.equal(toggleCenter('![](images/a.png){align=center}'), '![](images/a.png)')
    assert.equal(toggleCenter('no image here'), null)
  })
})
