import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { chapterNo, loadManual, parseFrontMatter, sectionImages, stripFrontMatter } from '../manual.ts'
import { createFixture, SECTIONS } from './fixture.ts'

describe('manual', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('manual.yaml을 읽는다', () => {
    const manual = loadManual(fx.ref)
    assert.equal(manual.version, '0.1.0')
    assert.deepEqual(manual.chapters.map(chapterNo), [1, 2])
  })

  it('front-matter를 파싱한다', () => {
    const meta = parseFrontMatter(SECTIONS['02-dealer/01-list.md'])
    assert.equal(meta.title, 'Dealer List View')
    assert.deepEqual(meta.i18nPrefix, ['DEALER_LIST_'])
  })

  it('front-matter가 없거나 비어 있으면 빈 객체', () => {
    assert.deepEqual(parseFrontMatter('## Title\n'), {})
    assert.deepEqual(parseFrontMatter('---\n\n---\nbody'), {})
  })

  it('front-matter만 걷어낸다', () => {
    const body = stripFrontMatter(SECTIONS['02-dealer/02-create.md'])
    assert.ok(body.startsWith('\n## Dealer Creation'))
    assert.ok(!body.includes('i18nPrefix'))
  })

  it('본문이 참조하는 이미지 id를 순서대로 뽑는다', () => {
    assert.deepEqual(sectionImages(SECTIONS['02-dealer/01-list.md']), ['dealer-list', 'location-popup'])
  })
})
