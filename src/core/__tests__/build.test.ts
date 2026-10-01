import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { addImageBorders, assembleMarkdown } from '../build.ts'
import { createFixture } from './fixture.ts'

const pic = (cx: number) =>
  `<pic:pic><a:ext cx="${cx}" cy="100"/><a:ln w="9525"><a:noFill/></a:ln></pic:pic>`
const BORDER = '<a:ln><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln>'

describe('assembleMarkdown', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('장 제목을 붙이고 manual.yaml 순서로 합친다', () => {
    const { markdown } = assembleMarkdown(fx.ref)
    assert.ok(markdown.startsWith('---\ntitle: Demo Manual\n---\n\n# 1. Login\n\nLog in with MPASS.'))
    const order = ['# 1. Login', '# 2. Dealer', '## Dealer List View', '## Dealer Creation'].map((h) =>
      markdown.indexOf(h),
    )
    assert.deepEqual([...order].sort((a, b) => a - b), order)
    assert.ok(!markdown.includes('i18nPrefix'))
    assert.ok(markdown.endsWith('Required.\n'))
  })

  it('장 번호로 거른다', () => {
    const { markdown } = assembleMarkdown(fx.ref, [2])
    assert.ok(!markdown.includes('# 1. Login'))
    assert.ok(markdown.includes('# 2. Dealer'))
  })

  it('해당 장이 없으면 에러', () => {
    assert.throws(() => assembleMarkdown(fx.ref, [9]), /빌드할 장이 없습니다: --chapters 9/)
  })
})

describe('addImageBorders', () => {
  it('1in 이상 이미지에 accent1 테두리를 두른다', () => {
    assert.equal(addImageBorders(pic(914400)), `<pic:pic><a:ext cx="914400" cy="100"/>${BORDER}</pic:pic>`)
  })

  it('1in 미만 인라인 아이콘은 그대로 둔다', () => {
    assert.equal(addImageBorders(pic(219456)), pic(219456))
  })

  it('이미지마다 따로 판단한다', () => {
    const out = addImageBorders(pic(219456) + pic(5733288))
    assert.equal(out.split('accent1').length - 1, 1)
    assert.ok(out.startsWith(pic(219456)))
  })
})
