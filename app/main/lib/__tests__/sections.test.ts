import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { PNG } from 'pngjs'
import YAML from 'yaml'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { joinSection, serializeFrontMatter, splitSection } from '../../../../src/core/manual.ts'
import { slugify, uniqueName } from '../../../../src/core/naming.ts'
import {
  collectTodos,
  createSection,
  extractTodos,
  importImage,
  listImages,
  listManuals,
  readSectionDoc,
  readTree,
  removeSection,
  resolveInside,
  sectionTitle,
  suggestImageId,
  writeSectionDoc,
} from '../sections.ts'

const png = (w = 2, h = 2) => PNG.sync.write(new PNG({ width: w, height: h }))

describe('resolveInside', () => {
  it('root 안 경로만 허용한다', () => {
    assert.equal(resolveInside('/ws', 'manuals/bo/a.md'), '/ws/manuals/bo/a.md')
    assert.throws(() => resolveInside('/ws', '../etc/passwd'), /허용되지 않은 경로/)
    assert.throws(() => resolveInside('/ws', '/etc/passwd'), /허용되지 않은 경로/)
    assert.throws(() => resolveInside('/ws', 'manuals/../../x'), /허용되지 않은 경로/)
  })
})

describe('split / join', () => {
  it('front-matter와 본문을 나누고 다시 합치면 원문과 같다', () => {
    const raw = '---\ntitle: A\nroutes: []\n---\n\n## A\n\n- item\n'
    const { frontMatter, body } = splitSection(raw)
    assert.equal(frontMatter, '---\ntitle: A\nroutes: []\n---\n')
    assert.equal(body, '## A\n\n- item\n')
    assert.equal(joinSection(frontMatter, body), raw)
  })

  it('끝 공백은 줄바꿈 하나로 정리한다', () => {
    assert.equal(joinSection('---\nx: 1\n---\n', 'body\n\n\n  '), '---\nx: 1\n---\n\nbody\n')
  })

  it('실제 매뉴얼 모든 섹션이 읽고 쓰기를 거쳐도 byte 단위로 같다', () => {
    const dir = resolve('manuals/bo')
    const manual = YAML.parse(readFileSync(join(dir, 'manual.yaml'), 'utf8'))
    let count = 0
    for (const chapter of manual.chapters) {
      for (const file of chapter.sections) {
        const raw = readFileSync(join(dir, chapter.dir, file), 'utf8')
        const { frontMatter, body } = splitSection(raw)
        assert.equal(joinSection(frontMatter, body), raw, `${chapter.dir}/${file}`)
        count++
      }
    }
    assert.ok(count > 40)
  })
})

describe('serializeFrontMatter', () => {
  it('키 순서를 고정하고 빈 배열을 채운다', () => {
    assert.equal(
      serializeFrontMatter({ i18nPrefix: ['A_'], title: 'Screen' }),
      '---\ntitle: Screen\nroutes: []\nsources: []\ni18nPrefix:\n  - A_\n---\n',
    )
  })
})

describe('extractTodos / sectionTitle', () => {
  it('TODO 주석과 줄 번호를 뽑는다', () => {
    const body = '## T\n\n- a <!-- TODO: 정책 확인 -->\n<!--\n  TODO 여러 줄\n  설명\n-->\n<!-- 일반 주석 -->\n'
    assert.deepEqual(extractTodos(body), [
      { line: 3, text: '정책 확인' },
      { line: 4, text: '여러 줄 설명' },
    ])
  })

  it('제목은 첫 H2, 없으면 front-matter title', () => {
    assert.equal(sectionTitle('---\ntitle: Meta\n---\n\n## Heading\n'), 'Heading')
    assert.equal(sectionTitle('---\ntitle: Meta\n---\n\nbody\n'), 'Meta')
  })
})

describe('slugify', () => {
  it('영문 소문자와 -만 남긴다', () => {
    assert.equal(slugify('Zone/District Management & More'), 'zone-district-management-and-more')
    assert.equal(slugify('딜러'), '')
  })

  it('겹치면 -2, -3을 붙인다', () => {
    const taken = new Set(['menu', 'menu-2'])
    assert.equal(uniqueName('menu', (n) => taken.has(n)), 'menu-3')
    assert.equal(uniqueName('dealer', (n) => taken.has(n)), 'dealer')
  })
})

describe('섹션 조작', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('매뉴얼 목록', () => {
    assert.deepEqual(listManuals(fx.ref.root), ['demo'])
    assert.deepEqual(listManuals('/nonexistent'), [])
  })

  it('목차: 제목, TODO 수, 수정 표시', () => {
    writeFileSync(join(fx.dir, '02-dealer/02-create.md'), readFileSync(join(fx.dir, '02-dealer/02-create.md'), 'utf8') + '<!-- TODO: x -->\n')
    const tree = readTree(fx.ref, new Set(['manuals/demo/02-dealer/01-list.md']))
    assert.equal(tree.title, 'Demo Manual')
    assert.deepEqual(
      tree.chapters.map((c) => [c.no, c.title, c.sections.map((s) => [s.title, s.todos, s.modified])]),
      [
        [1, 'Login', [['Login', 0, false]]],
        [2, 'Dealer', [['Dealer List View', 0, true], ['Dealer Creation', 1, false]]],
      ],
    )
  })

  it('manual.yaml에 없는 경로는 열지 않는다', () => {
    assert.throws(() => readSectionDoc(fx.ref, '02-dealer/99-none.md'), /manual.yaml에 없는 섹션/)
    assert.throws(() => readSectionDoc(fx.ref, '../../etc/passwd'), /manual.yaml에 없는 섹션/)
    assert.throws(() => readSectionDoc(fx.ref, '02-dealer/01-list.md/x'), /manual.yaml에 없는 섹션/)
  })

  it('본문만 쓰면 front-matter 원문은 그대로', () => {
    const path = '02-dealer/01-list.md'
    const before = readFileSync(join(fx.dir, path), 'utf8')
    const doc = readSectionDoc(fx.ref, path)
    assert.equal(doc.meta.title, 'Dealer List View')
    writeSectionDoc(fx.ref, path, doc.body.replace('## Dealer List View', '## Dealer List'))
    const after = readFileSync(join(fx.dir, path), 'utf8')
    assert.equal(after, before.replace('## Dealer List View', '## Dealer List'))
  })

  it('meta를 넘기면 front-matter를 다시 쓴다', () => {
    const path = '01-login/00-intro.md'
    const doc = readSectionDoc(fx.ref, path)
    writeSectionDoc(fx.ref, path, doc.body, { title: 'Login', routes: ['/login'] })
    assert.equal(readSectionDoc(fx.ref, path).meta.routes?.[0], '/login')
    assert.ok(readFileSync(join(fx.dir, path), 'utf8').startsWith('---\ntitle: Login\nroutes:\n  - /login\n'))
  })

  it('TODO 모으기', () => {
    assert.deepEqual(collectTodos(fx.ref), [{ path: '02-dealer/02-create.md', sectionTitle: 'Dealer Creation', line: 4, text: 'x' }])
  })

  it('기존 장에 화면 추가: 다음 번호 파일 + manual.yaml', () => {
    const path = createSection(fx.ref, { title: 'Dealer Detail', chapterDir: '02-dealer' })
    assert.equal(path, '02-dealer/03-dealer-detail.md')
    const doc = readSectionDoc(fx.ref, path)
    assert.equal(doc.meta.title, 'Dealer Detail')
    assert.ok(doc.body.startsWith('## Dealer Detail\n'))
    assert.equal(extractTodos(doc.body).length, 1)
    const yaml = YAML.parse(readFileSync(join(fx.dir, 'manual.yaml'), 'utf8'))
    assert.deepEqual(yaml.chapters[1].sections, ['01-list.md', '02-create.md', '03-dealer-detail.md'])
  })

  it('같은 이름이어도 다음 번호로 만든다', () => {
    assert.equal(createSection(fx.ref, { title: 'Dealer Detail', chapterDir: '02-dealer' }), '02-dealer/04-dealer-detail.md')
    removeSection(fx.ref, '02-dealer/04-dealer-detail.md')
  })

  it('새 장 만들기: 마지막 장 다음 번호', () => {
    const path = createSection(fx.ref, { title: 'Request List', newChapterTitle: 'Enrollment Management' })
    assert.equal(path, '03-enrollment-management/01-request-list.md')
    assert.equal(readTree(fx.ref).chapters.at(-1)!.title, 'Enrollment Management')
  })

  it('잘못된 이름은 거절', () => {
    assert.throws(() => createSection(fx.ref, { title: '  ', chapterDir: '02-dealer' }), /화면 이름을 입력/)
    assert.throws(() => createSection(fx.ref, { title: '딜러 목록', chapterDir: '02-dealer' }), /영문/)
    assert.throws(() => createSection(fx.ref, { title: 'X', newChapterTitle: '' }), /새 장 이름/)
  })

  it('화면 삭제: 파일과 항목, 빈 장까지 지운다', () => {
    removeSection(fx.ref, '03-enrollment-management/01-request-list.md')
    assert.ok(!existsSync(join(fx.dir, '03-enrollment-management/01-request-list.md')))
    assert.ok(!readTree(fx.ref).chapters.some((c) => c.dir === '03-enrollment-management'))
  })

  it('이미지: PNG만 받고 id 규칙과 중복을 지킨다', () => {
    assert.equal(importImage(fx.ref, 'dealer-list', png()), 'dealer-list')
    assert.deepEqual(listImages(fx.ref).map((i) => i.id), ['dealer-list'])
    assert.equal(suggestImageId(fx.ref, 'Dealer List'), 'dealer-list-2')
    assert.equal(suggestImageId(fx.ref, '딜러'), 'image')
    assert.throws(() => importImage(fx.ref, 'Bad Id', png()), /영문 소문자/)
    assert.throws(() => importImage(fx.ref, 'jpeg', new Uint8Array([0xff, 0xd8, 0xff])), /PNG 이미지만/)
    const bytes = png(3, 3)
    importImage(fx.ref, 'pasted', bytes)
    assert.deepEqual(readFileSync(join(fx.dir, 'images/pasted.png')), bytes)
  })
})

describe('실제 리포 목차', () => {
  it('bo 매뉴얼 전체를 읽는다', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ariadne-real-'))
    cpSync(resolve('manuals'), join(tmp, 'manuals'), { recursive: true })
    try {
      const tree = readTree({ root: tmp, manual: 'bo' })
      assert.equal(tree.chapters.length, readdirSync(join(tmp, 'manuals/bo')).filter((d) => /^\d\d-/.test(d)).length)
      assert.ok(tree.chapters.every((c) => c.sections.every((s) => s.title)))
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
