import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SearchQuery } from '@codemirror/search'
import { EditorSelection, EditorState } from '@codemirror/state'
import { countLabel, matchInfo } from '../../../renderer/src/editor-search.ts'

const doc = '- **Dealer Name**: The dealer name.\n- **Dealer No.**: dealer number (Dealer)\n'
const query = (search: string, options: Partial<{ caseSensitive: boolean; wholeWord: boolean }> = {}) =>
  new SearchQuery({ search, literal: true, ...options })
const at = (from: number, to: number) => EditorState.create({ doc, selection: EditorSelection.single(from, to) })

describe('편집기 찾기', () => {
  it('찾은 수와 지금 선택이 몇 번째인지', () => {
    assert.deepEqual(matchInfo(at(0, 0), query('dealer')), { total: 5, current: 0 })
    const second = doc.indexOf('dealer name')
    assert.deepEqual(matchInfo(at(second, second + 6), query('dealer')), { total: 5, current: 2 })
    assert.deepEqual(matchInfo(at(0, 0), query('')), { total: 0, current: 0 })
  })

  it('대소문자, 단어 단위, 마크다운 기호도 글자 그대로 찾는다', () => {
    assert.equal(matchInfo(at(0, 0), query('Dealer', { caseSensitive: true })).total, 3)
    assert.equal(matchInfo(at(0, 0), query('deal', { wholeWord: true })).total, 0)
    assert.equal(matchInfo(at(0, 0), query('**Dealer No.**')).total, 1)
    // 정규식이 아니라 글자로 (점·괄호)
    assert.equal(matchInfo(at(0, 0), query('(Dealer)')).total, 1)
  })

  it('결과 수 문구', () => {
    assert.equal(countLabel({ total: 0, current: 0 }, false), '')
    assert.equal(countLabel({ total: 0, current: 0 }, true), '결과 없음')
    assert.equal(countLabel({ total: 12, current: 3 }, true), '3 / 12')
    assert.equal(countLabel({ total: 12, current: 0 }, true), '12개')
    assert.equal(countLabel({ total: 1000, current: 0 }, true), '999+개')
  })
})
