import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { after, describe, it } from 'node:test'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { clearAllReviews, clearReview, clearReviewsForRepoPaths, listReviews, readReview, saveReviewBase } from '../review.ts'
import { readSectionDoc, writeSectionDoc } from '../sections.ts'

describe('Claude 변경 검토 기준', () => {
  const fx = createFixture()
  after(() => fx.cleanup())
  const path = '02-dealer/02-create.md'

  it('고치기 직전 본문을 남기고, 다시 최신화해도 처음 원문을 유지한다', () => {
    const before = readSectionDoc(fx.ref, path).body
    assert.equal(saveReviewBase(fx.ref, path, before, 1000), true)
    writeSectionDoc(fx.ref, path, before.replace('Required.', 'Required. Up to 50 characters.'))
    // 검토 전에 두 번째 최신화: 기준은 그대로
    assert.equal(saveReviewBase(fx.ref, path, readSectionDoc(fx.ref, path).body, 2000), false)
    assert.deepEqual(readReview(fx.ref, path), { before, at: 1000 })
    assert.deepEqual(listReviews(fx.ref), [path])
  })

  it('지금 본문이 원문과 같으면 표시하지 않지만 기준은 남긴다 (Claude가 아직 고치기 전일 수 있다)', () => {
    const base = readReview(fx.ref, path)!
    const changed = readSectionDoc(fx.ref, path).body
    writeSectionDoc(fx.ref, path, base.before)
    assert.equal(readReview(fx.ref, path), undefined)
    assert.deepEqual(listReviews(fx.ref), [])
    writeSectionDoc(fx.ref, path, changed)
    assert.deepEqual(readReview(fx.ref, path), base)
    clearReview(fx.ref, path)
  })

  it('검토 완료, 되돌리기(리포 경로), 제출로 지운다', () => {
    const other = '02-dealer/01-list.md'
    for (const p of [path, other]) {
      saveReviewBase(fx.ref, p, 'old body\n')
    }
    assert.deepEqual(listReviews(fx.ref), [other, path])
    clearReview(fx.ref, other)
    assert.deepEqual(listReviews(fx.ref), [path])
    clearReviewsForRepoPaths(fx.ref, [`manuals/demo/${path}`, 'manuals/other/x.md'])
    assert.deepEqual(listReviews(fx.ref), [])
    saveReviewBase(fx.ref, path, 'old body\n')
    clearAllReviews(fx.ref)
    assert.deepEqual(listReviews(fx.ref), [])
  })

  it('화면이 없어지면 검토 기준도 지운다', () => {
    saveReviewBase(fx.ref, path, 'old body\n')
    rmSync(`${fx.dir}/${path}`)
    assert.equal(readReview(fx.ref, path), undefined)
  })

  it('작업 폴더 밖 경로는 거절한다', () => {
    assert.throws(() => saveReviewBase(fx.ref, '../../../etc/passwd', 'x'), /허용되지 않은 경로/)
  })
})
