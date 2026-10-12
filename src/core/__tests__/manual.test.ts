import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { chapterNo, loadManual, mergeManual, parseFrontMatter, sectionImages, stripFrontMatter, type Manual } from '../manual.ts'
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

  it('설정 병합: 키 순서를 지키고, patch에 없는 키(video)는 두고, 빈 값은 지운다', () => {
    const current: Manual = {
      title: 'T',
      version: '1.0.0',
      output: 'X_v{version}',
      capture: { baseUrl: 'https://a' },
      video: { captionSize: 'small' },
      chapters: [{ title: 'C', dir: '01-c', sections: [] }],
    }
    const next = mergeManual(current, { version: '1.1.0', code: { app: 'apps/x' }, output: '' })
    assert.deepEqual(Object.keys(next), ['title', 'version', 'capture', 'code', 'video', 'chapters'])
    assert.equal(next.version, '1.1.0')
    assert.deepEqual(next.video, { captionSize: 'small' })
    assert.deepEqual(next.chapters, current.chapters)
    assert.equal('capture' in mergeManual(current, { capture: {} }), false)
  })
})
