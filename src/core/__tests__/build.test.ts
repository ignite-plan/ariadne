import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import { addImageBorders, assembleMarkdown, buildDocx } from '../build.ts'
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

const hasPandoc = (() => {
  try {
    execFileSync('pandoc', ['--version'])
    return true
  } catch {
    return false
  }
})()

describe('Word 빌드: 형광펜과 이미지 가운데 정렬', { skip: !hasPandoc && 'pandoc 없음' }, () => {
  const fx = createFixture()
  after(() => fx.cleanup())

  it('[글자]{.mark}는 노란 형광펜, {align=center} 이미지는 가운데 정렬 그림 스타일(목록 안 포함)', () => {
    copyFileSync(resolve('manuals/bo/reference.docx'), join(fx.dir, 'reference.docx'))
    const png = new PNG({ width: 4, height: 4 })
    writeFileSync(join(fx.dir, 'images', 'pic.png'), PNG.sync.write(png))
    writeFileSync(
      join(fx.dir, '01-login/00-intro.md'),
      [
        '---',
        'title: Login',
        '---',
        '',
        '## Login',
        '',
        'Click [Save]{.mark} to save.',
        '',
        '![](images/pic.png){width=2in align=center}',
        '',
        '![](images/pic.png){width=2in}',
        '',
        '- Item',
        '- ![](images/pic.png){width=2in align=center}',
        '',
      ].join('\n'),
    )
    const { docx } = buildDocx({ ...fx.ref, chapters: [1], outDir: join(fx.ref.root, 'dist') })
    assert.ok(existsSync(docx))
    const xml = execFileSync('unzip', ['-p', docx, 'word/document.xml'], { encoding: 'utf8' })
    assert.match(xml, /<w:highlight w:val="yellow"\s*\/>/)
    const imageParas = [...xml.matchAll(/<w:p>(?:(?!<\/w:p>)[\s\S])*?<w:drawing>[\s\S]*?<\/w:p>/g)].map((m) => m[0])
    const styles = imageParas.map((p) => p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '')
    assert.deepEqual(
      styles.map((st) => st === 'Figure'),
      [true, false, true],
      `이미지 문단 스타일: ${styles.join(', ')}`,
    )
    assert.ok(/<w:numPr>/.test(imageParas[2]), '목록 안 이미지는 목록 기호를 유지한다')
    assert.doesNotMatch(xml, /align/, '정렬 표기는 Word에 남지 않는다')
  })
})
