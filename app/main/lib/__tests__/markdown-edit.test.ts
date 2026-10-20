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

  it('목록 기호와 들여쓰기는 형광펜 밖에 둔다 (줄 전체를 골라도)', () => {
    const doc = '- First item\n  - Nested item\n\n1. Step one'
    const marked = apply(doc, toggleMark(doc, 0, doc.length))
    assert.equal(marked, '- [First item]{.mark}\n  - [Nested item]{.mark}\n\n1. [Step one]{.mark}')
    const e = toggleMark(doc, 0, doc.length)
    assert.equal(marked.slice(e.selection.anchor, e.selection.head), 'First item]{.mark}\n  - [Nested item]{.mark}\n\n1. [Step one')
    // 목록 기호만 골랐으면 그대로
    assert.equal(apply(doc, toggleMark(doc, 0, 2)), doc)
  })

  it('굵게·버튼 표기 중간에 걸리면 표기 전체를 감싼다 (쪼개면 Word에 ** 가 글자로 찍힌다)', () => {
    const doc = '- **Domain**: Placeholder text. Click **\\[Save\\]** now.'
    // "Domain" 글자만 골라도 ** 밖에서 감싼다
    const d = doc.indexOf('Domain')
    assert.equal(apply(doc, toggleMark(doc, d, doc.length)), '- [**Domain**: Placeholder text. Click **\\[Save\\]** now.]{.mark}')
    // 버튼 이름 중간에서 끝나면 버튼 표기 끝까지
    const s = doc.indexOf('Click')
    assert.equal(apply(doc, toggleMark(doc, s, doc.indexOf('Save') + 2)), '- **Domain**: Placeholder text. [Click **\\[Save\\]**]{.mark} now.')
    // 버튼이 든 형광펜 안에서 다시 누르면 푼다
    const marked = apply(doc, toggleMark(doc, s, doc.indexOf('Save') + 2))
    assert.equal(apply(marked, toggleMark(marked, marked.indexOf('Save'), marked.indexOf('Save'))), doc)
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
