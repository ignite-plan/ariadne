import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { PNG } from 'pngjs'
import { analyzeDocx, guessVersion, importDocx, matchDrawings } from '../import.ts'
import { loadManual, localePath, outputName, stripFrontMatter } from '../manual.ts'
import { referenceStyles, styleIdByName } from '../reference.ts'

const hasPandoc = (() => {
  try {
    execFileSync('pandoc', ['--version'])
    return true
  } catch {
    return false
  }
})()
const BO_SOURCE = resolve('manuals/bo/source/Hyundai.docx')
const repoRoot = process.cwd()

describe('manual 설정', () => {
  it('Word 파일 이름: output 템플릿, 없으면 제목_v버전', () => {
    assert.equal(outputName({ title: 'T', version: '1.2.0', output: 'X_v{version}_EN', chapters: [] }), 'X_v1.2.0_EN')
    assert.equal(outputName({ title: 'FO Manual', version: '1.0.0', chapters: [] }), 'FO Manual_v1.0.0')
  })

  it('en.json 위치: code.locale, 없으면 code.app 규칙', () => {
    assert.equal(localePath({ title: '', version: '', code: { app: 'apps/hyundai-fo' }, chapters: [] }), 'apps/hyundai-fo/src/locales/en.json')
    assert.equal(localePath({ title: '', version: '', code: { app: 'a', locale: 'x.json' }, chapters: [] }), 'x.json')
    assert.equal(localePath({ title: '', version: '', chapters: [] }), undefined)
  })

  it('파일 이름에서 버전 추정', () => {
    assert.equal(guessVersion('/x/Hyundai-Dealers FO User Manual_v1.2.3_EN.docx'), '1.2.3')
    assert.equal(guessVersion('/x/Hyundai.docx'), '1.0.0')
  })
})

describe('reference 스타일', () => {
  const styles = (normal: string, heading: string, caption = 'Caption') =>
    `<w:styles><w:style w:type="paragraph" w:default="1" w:styleId="${normal}"><w:name w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="${heading}"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="${caption}"><w:name w:val="caption"/></w:style>` +
    `<w:style w:type="table" w:styleId="TableNormal"><w:name w:val="Normal Table"/></w:style></w:styles>`

  it('언어와 상관없이 이름으로 스타일 ID를 찾는다', () => {
    assert.equal(styleIdByName(styles('a', '11', 'af0'), 'heading 1'), '11')
    assert.equal(styleIdByName(styles('Normal', 'Heading1'), 'Normal'), 'Normal')
    assert.equal(styleIdByName(styles('Normal', 'Heading1'), 'heading 9'), undefined)
  })

  it('영문 Word(ID가 Normal/Heading1)도 pandoc 스타일을 그 위에 얹는다', () => {
    const out = referenceStyles(styles('Normal', 'Heading1'))
    assert.match(out, /w:styleId="BodyText"><w:name w:val="Body Text"\/><w:basedOn w:val="Normal"\/>/)
    assert.match(out, /w:styleId="TOCHeading"><w:name w:val="TOC Heading"\/><w:basedOn w:val="Heading1"\/>/)
    assert.match(out, /w:styleId="ImageCaption"><w:name w:val="Image Caption"\/><w:basedOn w:val="Caption"\/>/)
    assert.match(out, /w:styleId="Heading1"><w:name w:val="heading 1"\/><w:pPr><w:pageBreakBefore\/>/)
    assert.match(out, /w:styleId="Normal"><w:name w:val="Normal"\/><w:rPr><w:rFonts w:ascii="Calibri"/)
  })

  it('Normal/제목 1이 없으면 에러', () => {
    assert.throws(() => referenceStyles('<w:styles></w:styles>'), /Normal\/제목 1 스타일을 찾지 못했습니다/)
  })
})

describe('BO 원본 가져오기', { skip: (!hasPandoc || !existsSync(BO_SOURCE)) && 'pandoc 또는 원본 없음' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'ariadne-import-'))
  after(() => rmSync(root, { recursive: true, force: true }))

  it('분석: 목차 기준 15장 36절, 이미지 289장, 경고 없음', async () => {
    const a = await analyzeDocx(BO_SOURCE)
    assert.equal(a.structure, 'toc')
    assert.equal(a.title, 'Dealers Admin User Manual')
    assert.equal(a.chapters.length, 15)
    assert.equal(a.chapters.reduce((n, c) => n + c.sections.length, 0), 36)
    assert.equal(a.images, 289)
    assert.deepEqual(a.warnings, [])
    assert.deepEqual(a.chapters[1].sections.map((s) => s.title), [
      'Dealer List View',
      'Dealer Creation Screen',
      'Dealer Detail View /Edit Screen',
    ])
  })

  // 2장은 파일럿 때 본문을 손으로 다듬어(하위 목록 들여쓰기, 코드 연결 키) 원본과 다르다
  const HAND_EDITED = new Set(['02-dealer-management'])

  it('가져오기 결과가 리포의 BO 매뉴얼과 같다 (손으로 다듬은 2장 본문 제외)', async () => {
    const phases = new Set<string>()
    const result = await importDocx({
      root,
      manual: 'bo',
      docx: BO_SOURCE,
      title: 'Dealers Admin User Manual',
      version: '1.0.7',
      onProgress: (p) => phases.add(p.phase),
    })
    assert.deepEqual([...phases], ['convert', 'write', 'images', 'reference'])
    const imported = loadManual({ root, manual: 'bo' })
    const repo = loadManual({ root: repoRoot, manual: 'bo' })
    assert.equal(result.files, repo.chapters.reduce((n, c) => n + c.sections.length, 0))
    assert.deepEqual(imported.chapters, repo.chapters)
    for (const chapter of repo.chapters) {
      if (HAND_EDITED.has(chapter.dir)) continue
      for (const file of chapter.sections) {
        const read = (r: string) => stripFrontMatter(readFileSync(join(r, 'manuals/bo', chapter.dir, file), 'utf8'))
        assert.equal(read(root), read(repoRoot), `${chapter.dir}/${file}`)
      }
    }
    const images = readdirSync(join(repoRoot, 'manuals/bo/images'))
    assert.deepEqual(readdirSync(join(root, 'manuals/bo/images')).sort(), images.sort())
    for (const image of images) {
      assert.ok(readFileSync(join(root, 'manuals/bo/images', image)).equals(readFileSync(join(repoRoot, 'manuals/bo/images', image))), image)
    }
    assert.ok(existsSync(join(root, 'manuals/bo/reference.docx')))
    assert.ok(existsSync(join(root, 'manuals/bo/shots.ts')))
  })
})

describe('목차 없는 Word 가져오기 (제목 스타일)', { skip: !hasPandoc && 'pandoc 없음' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'ariadne-import-h-'))
  after(() => rmSync(root, { recursive: true, force: true }))
  const docx = join(root, 'Hyundai-Dealers FO User Manual_v2.1.0_EN.docx')

  // pandoc으로 제목 1/2 스타일과 이미지가 있는 Word를 만든다
  const png = new PNG({ width: 4, height: 3 })
  png.data.fill(200)
  writeFileSync(join(root, 'shot.png'), PNG.sync.write(png))
  writeFileSync(
    join(root, 'src.md'),
    [
      'Dealers FO User Manual',
      '',
      '# 1. Login',
      '',
      'Log in with your dealer account.',
      '',
      '## Login Screen',
      '',
      '- **ID**: Your dealer ID.',
      '',
      '![Login](shot.png){width=6.27in}',
      '',
      '# 2. 공지사항',
      '',
      '## 공지 목록',
      '',
      '- List of notices.',
      '',
    ].join('\n'),
  )
  execFileSync('pandoc', ['src.md', '-o', docx], { cwd: root })

  it('분석: 제목 스타일로 장/절, 파일 이름에서 버전', async () => {
    const a = await analyzeDocx(docx)
    assert.equal(a.structure, 'headings')
    assert.equal(a.version, '2.1.0')
    assert.equal(a.title, 'Dealers FO User Manual')
    assert.deepEqual(
      a.chapters.map((c) => [c.no, c.title, c.slug, c.sections.map((s) => s.slug)]),
      [
        [1, 'Login', 'login', ['login-screen']],
        [2, '공지사항', 'chapter-2', ['section-1']],
      ],
    )
    assert.equal(a.images, 1)
  })

  it('새 매뉴얼로 가져오기: 설정, 원본 보관, shots.ts', async () => {
    const result = await importDocx({
      root,
      manual: 'fo',
      docx,
      title: 'Dealers FO User Manual',
      version: '2.1.0',
      output: 'Hyundai-Dealers FO User Manual_v{version}_EN',
      capture: { baseUrl: 'https://stg-dealers.hyundai-corp.io', viewport: { width: 390, height: 844 } },
      code: { app: 'apps/hyundai-fo' },
      keepSource: true,
    })
    assert.equal(result.manual, 'fo')
    const manual = loadManual({ root, manual: 'fo' })
    assert.deepEqual(Object.keys(manual), ['title', 'version', 'output', 'capture', 'code', 'chapters'])
    assert.equal(manual.capture?.baseUrl, 'https://stg-dealers.hyundai-corp.io')
    assert.deepEqual(manual.chapters, [
      { title: 'Login', dir: '01-login', sections: ['00-intro.md', '01-login-screen.md'] },
      { title: '공지사항', dir: '02-chapter-2', sections: ['01-section-1.md'] },
    ])
    const screen = readFileSync(join(root, 'manuals/fo/01-login/01-login-screen.md'), 'utf8')
    assert.match(screen, /^---\ntitle: Login Screen\nroutes: \[\]\nsources: \[\]\ni18nPrefix: \[\]\n---\n\n## Login Screen\n/)
    // Word에 표시된 크기(pandoc이 쪽 너비에 맞춘 5.83in)를 그대로 옮긴다
    assert.match(screen, /!\[Login\]\(images\/login\.png\)\{width=5\.83in\}/)
    assert.ok(existsSync(join(root, 'manuals/fo/images/login.png')))
    assert.ok(existsSync(join(root, 'manuals/fo/source', 'Hyundai-Dealers FO User Manual_v2.1.0_EN.docx')))
    assert.match(readFileSync(join(root, 'manuals/fo/shots.ts'), 'utf8'), /defineShots\(\[\]\)/)
    assert.ok(existsSync(join(root, 'manuals/fo/reference.docx')))
  })

  it('잘못된 id와 없는 파일은 거절', async () => {
    await assert.rejects(importDocx({ root, manual: 'FO Manual', docx }), /영문 소문자/)
    await assert.rejects(analyzeDocx(join(root, 'none.docx')), /Word 파일이 없습니다/)
  })

  it('장이 없으면 거절', async () => {
    const flat = join(root, 'flat.docx')
    writeFileSync(join(root, 'flat.md'), 'just text\n')
    execFileSync('pandoc', ['flat.md', '-o', flat], { cwd: root })
    await assert.rejects(analyzeDocx(flat), /장을 찾지 못했습니다/)
  })
})

describe('Word 그림과 이미지 짝 맞추기', () => {
  const d = (media: string | undefined, l = 0) => ({ crop: { l, t: 0, r: 0, b: 0 }, widthIn: 6, ratio: 0.5, ...(media ? { media } : {}) })
  it('도형(그림 아님)이 끼어 있어도 이름으로 맞춘다. 같은 이미지를 여러 번 쓰면 순서대로', () => {
    const drawings = [d('image1.png', 0.1), d(undefined), d('image2.png', 0.2), d('image2.png', 0.3), d(undefined), d('image3.png', 0.4)]
    const matched = matchDrawings(['/w/media/image1.png', '/w/media/image2.png', '/w/media/image2.png', '/w/media/image3.png'], drawings)
    assert.deepEqual(
      matched.map((m) => m?.crop.l),
      [0.1, 0.2, 0.3, 0.4],
    )
  })
  it('Word에 없는 이미지는 짝 없음, 그림 수보다 더 쓰이면 마지막 것을 다시 쓴다', () => {
    const matched = matchDrawings(['/w/media/x.png', '/w/media/image1.png', '/w/media/image1.png'], [d('image1.png', 0.1)])
    assert.equal(matched[0], undefined)
    assert.equal(matched[1]?.crop.l, 0.1)
    assert.equal(matched[2]?.crop.l, 0.1)
  })
})
