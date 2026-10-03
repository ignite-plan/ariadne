import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { acquireExclusive, acquireShared, isExclusiveHeld, onLockChange, profileHolders, withShared } from '../profile-lock.ts'

describe('STG 프로필 잠금', () => {
  it('공유 작업끼리는 함께 돈다', () => {
    const a = acquireShared('/p1', 'Claude 작업')
    const b = acquireShared('/p1', '영상 만들기')
    assert.deepEqual(profileHolders('/p1'), ['Claude 작업', '영상 만들기'])
    a()
    b()
    assert.deepEqual(profileHolders('/p1'), [])
  })

  it('공유 작업 중에는 단독 작업을 그 작업 이름들로 거절', () => {
    const a = acquireShared('/p2', 'Claude 작업')
    const b = acquireShared('/p2', '영상 만들기')
    assert.throws(() => acquireExclusive('/p2', 'STG 기록'), /^Error: Claude 작업, 영상 만들기 중에는 할 수 없습니다/)
    a()
    b()
    const release = acquireExclusive('/p2', 'STG 기록')
    assert.ok(isExclusiveHeld('/p2'))
    release()
  })

  it('단독 작업 중에는 공유·단독 모두 거절, 두 번 놓아도 괜찮다', async () => {
    const release = acquireExclusive('/p3', 'STG 로그인')
    assert.throws(() => acquireShared('/p3', '화면 캡처'), /^Error: STG 로그인 중에는 할 수 없습니다/)
    assert.throws(() => acquireExclusive('/p3', '미리보기'), /STG 로그인 중에는/)
    await assert.rejects(withShared('/p3', '영상 만들기', async () => 1), /STG 로그인 중에는/)
    release()
    release()
    assert.deepEqual(profileHolders('/p3'), [])
  })

  it('프로필이 다르면 서로 막지 않는다', () => {
    const release = acquireExclusive('/p4', 'STG 로그인')
    const other = acquireShared('/p5', 'Claude 작업')
    other()
    release()
  })

  it('withShared는 실패해도 놓고, 바뀔 때마다 알린다', async () => {
    let changes = 0
    const off = onLockChange(() => changes++)
    await assert.rejects(withShared('/p6', '화면 캡처', async () => Promise.reject(new Error('x'))), /x/)
    assert.deepEqual(profileHolders('/p6'), [])
    assert.equal(await withShared('/p6', '화면 캡처', async () => 42), 42)
    off()
    assert.equal(changes, 4)
  })
})
