import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { acquireProfile, profileHolder, withProfile } from '../profile-lock.ts'

describe('STG 프로필 잠금', () => {
  it('한 번에 한 작업만, 이미 잡혀 있으면 그 작업 이름으로 거절', async () => {
    const release = acquireProfile('STG 기록')
    assert.equal(profileHolder(), 'STG 기록')
    assert.throws(() => acquireProfile('화면 캡처'), /^Error: STG 기록 중에는 할 수 없습니다/)
    await assert.rejects(withProfile('영상 만들기', async () => 1), /STG 기록 중에는/)
    release()
    release() // 두 번 놓아도 괜찮다
    assert.equal(profileHolder(), undefined)
  })

  it('withProfile은 실패해도 놓는다', async () => {
    await assert.rejects(withProfile('화면 캡처', async () => Promise.reject(new Error('x'))), /x/)
    assert.equal(profileHolder(), undefined)
    assert.equal(await withProfile('화면 캡처', async () => 42), 42)
  })
})
