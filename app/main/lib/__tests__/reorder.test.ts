import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { loadManual } from '../../../../src/core/manual.ts'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { createSection, moveChapter, moveSection, readSectionDoc } from '../sections.ts'

describe('장/화면 순서 바꾸기', () => {
  const fx = createFixture()
  after(fx.cleanup)
  const dirs = () => loadManual(fx.ref).chapters.map((c) => c.dir)

  it('장을 옮기면 폴더 번호를 순서대로 다시 매긴다', () => {
    const renamed = moveChapter(fx.ref, '02-dealer', 0)
    assert.deepEqual(dirs(), ['01-dealer', '02-login'])
    assert.deepEqual([...renamed], [['02-dealer', '01-dealer'], ['01-login', '02-login']])
    assert.ok(existsSync(join(fx.dir, '01-dealer/01-list.md')))
    assert.ok(existsSync(join(fx.dir, '02-login/00-intro.md')))
    assert.ok(!readdirSync(fx.dir).some((d) => d.startsWith('.renumber')))
    // 내용은 그대로
    assert.equal(readSectionDoc(fx.ref, '01-dealer/01-list.md').meta.title, 'Dealer List View')
  })

  it('제자리면 아무것도 바꾸지 않는다', () => {
    assert.equal(moveChapter(fx.ref, '01-dealer', 0).size, 0)
  })

  it('화면을 옮기면 파일 번호를 다시 매긴다', () => {
    const renamed = moveSection(fx.ref, '01-dealer/02-create.md', 0)
    assert.deepEqual(loadManual(fx.ref).chapters[0].sections, ['01-create.md', '02-list.md'])
    assert.equal(renamed.get('01-dealer/02-create.md'), '01-dealer/01-create.md')
    assert.equal(readSectionDoc(fx.ref, '01-dealer/02-list.md').meta.title, 'Dealer List View')
  })

  it('장 소개(00-intro)는 맨 앞에 고정', () => {
    createSection(fx.ref, { title: 'Login Help', chapterDir: '02-login' })
    assert.deepEqual(loadManual(fx.ref).chapters[1].sections, ['00-intro.md', '01-login-help.md'])
    moveSection(fx.ref, '02-login/01-login-help.md', 0)
    assert.deepEqual(loadManual(fx.ref).chapters[1].sections, ['00-intro.md', '01-login-help.md'])
    assert.throws(() => moveSection(fx.ref, '02-login/00-intro.md', 1), /장 소개는 맨 앞/)
  })

  it('새 장을 원하는 위치에 끼워 넣는다 (뒤 장 번호를 민다)', () => {
    const path = createSection(fx.ref, { title: 'Menu List View', newChapterTitle: 'Menu Management', chapterIndex: 1 })
    assert.equal(path, '02-menu-management/01-menu-list-view.md')
    assert.deepEqual(dirs(), ['01-dealer', '02-menu-management', '03-login'])
    assert.equal(readSectionDoc(fx.ref, path).meta.title, 'Menu List View')
  })

  it('없는 장/화면은 거절', () => {
    assert.throws(() => moveChapter(fx.ref, '99-none', 0), /없는 장/)
    assert.throws(() => moveSection(fx.ref, '01-dealer/99-none.md', 0), /manual.yaml에 없는 섹션/)
  })
})
