import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { imageToInsert } from '../../../renderer/src/paste.ts'

const clip = (text: string, types: string[]) => ({
  getData: (format: string) => (format === 'text/plain' ? text : ''),
  files: types.map((type) => ({ type })),
})

describe('붙여넣기: 이미지로 처리할지', () => {
  it('Word에서 복사한 글자(글자 + 그 부분을 찍은 그림)는 글자로', () => {
    assert.equal(imageToInsert(clip('Automatic logout instructions:\n- In accordance with…', ['image/png'])), undefined)
  })
  it('화면 캡처·그림 복사(글자 없음)는 이미지로', () => {
    assert.deepEqual(imageToInsert(clip('', ['image/png'])), { type: 'image/png' })
    assert.deepEqual(imageToInsert(clip('  \n', ['text/rtf', 'image/jpeg'])), { type: 'image/jpeg' })
  })
  it('글자만, 아무것도 없음', () => {
    assert.equal(imageToInsert(clip('text', [])), undefined)
    assert.equal(imageToInsert(clip('', [])), undefined)
    assert.equal(imageToInsert(null), undefined)
  })
})
