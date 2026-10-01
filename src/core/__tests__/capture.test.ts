import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { adoptShots, capture, captureDir, defaultAuthFile, diffRatio, loadShots } from '../capture.ts'
import { createFixture, writePng } from './fixture.ts'

describe('diffRatio', () => {
  const fx = createFixture()
  after(fx.cleanup)
  const file = (name: string) => join(fx.ref.root, name)

  it('같은 이미지는 0', () => {
    writePng(file('a.png'), 10, 10)
    writePng(file('b.png'), 10, 10)
    assert.equal(diffRatio(file('a.png'), file('b.png')), 0)
  })

  it('바뀐 픽셀 비율을 돌려준다', () => {
    writePng(file('c.png'), 10, 10, (x, y) => x === 0 && y === 0)
    assert.equal(diffRatio(file('a.png'), file('c.png')), 0.01)
  })

  it('크기가 다르면 1', () => {
    writePng(file('d.png'), 10, 11)
    assert.equal(diffRatio(file('a.png'), file('d.png')), 1)
  })
})

describe('adoptShots', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('.capture의 이미지를 images로 옮긴다', () => {
    mkdirSync(captureDir(fx.ref), { recursive: true })
    writePng(join(captureDir(fx.ref), 'dealer-list.png'), 4, 4, () => true)
    writePng(join(fx.dir, 'images', 'dealer-list.png'), 4, 4)
    adoptShots(fx.ref, ['dealer-list'])
    assert.deepEqual(
      readFileSync(join(fx.dir, 'images', 'dealer-list.png')),
      readFileSync(join(captureDir(fx.ref), 'dealer-list.png')),
    )
  })
})

describe('capture', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('세션 파일이 없으면 브라우저를 띄우기 전에 실패', async () => {
    await assert.rejects(
      capture({ ...fx.ref, baseUrl: 'https://example.com', shots: [] }),
      new RegExp(`${defaultAuthFile(fx.ref)} 없음`),
    )
  })
})

describe('loadShots', () => {
  it('리포의 bo shots.ts를 읽는다', async () => {
    const shots = await loadShots({ root: process.cwd(), manual: 'bo' })
    assert.ok(shots.some((s) => s.id === 'dealer-list'))
  })
})
