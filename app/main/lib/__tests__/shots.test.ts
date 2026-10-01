import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadShotsBundled, shotSections } from '../shots.ts'

describe('shots', () => {
  const ref = { root: process.cwd(), manual: 'bo' }

  it('esbuild로 묶어 리포의 shots.ts를 읽는다 (steps 함수 포함)', async () => {
    const shots = await loadShotsBundled(ref)
    const popup = shots.find((s) => s.id === 'location-popup')
    assert.ok(popup)
    assert.equal(typeof popup.steps, 'function')
    assert.ok(shots.some((s) => s.manual))
  })

  it('shot id를 쓰는 섹션을 찾는다', () => {
    const map = shotSections(ref)
    assert.deepEqual(map.get('dealer-list'), ['02-dealer-management/01-dealer-list-view.md'])
  })
})
