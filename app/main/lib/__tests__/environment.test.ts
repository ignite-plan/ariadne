import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findPandoc, formatAge } from '../environment.ts'

describe('environment', () => {
  it('후보 경로에서 실행 가능한 pandoc을 찾는다', () => {
    assert.equal(findPandoc(undefined, ['/nope/pandoc']), null)
    const found = findPandoc('/nope/override')
    if (found) assert.match(found.version, /^pandoc /)
  })

  it('경과 시간 표기', () => {
    assert.equal(formatAge(5 * 60000), '5분 전')
    assert.equal(formatAge(3 * 3600000), '3시간 전')
    assert.equal(formatAge(3 * 86400000), '3일 전')
  })
})
