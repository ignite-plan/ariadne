import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { buildRows } from '../../../renderer/src/diff-rows.ts'
import { skillText, taskText } from '../prompts.ts'

describe('작업 지시', () => {
  const root = mkdtempSync(join(tmpdir(), 'ariadne-prompts-'))
  after(() => rmSync(root, { recursive: true, force: true }))
  const bundled = { 'manual-draft': '---\nname: d\n---\n\nBUNDLED DRAFT', 'manual-refresh': '---\nname: r\n---\nBUNDLED REFRESH' }

  it('리포의 스킬을 우선, 없으면 앱에 묶인 것', () => {
    assert.equal(skillText(root, 'refresh', bundled), 'BUNDLED REFRESH')
    mkdirSync(join(root, '.claude/skills/manual-refresh'), { recursive: true })
    writeFileSync(join(root, '.claude/skills/manual-refresh/SKILL.md'), '---\nname: manual-refresh\n---\n\n# 리포 스킬\n')
    assert.equal(skillText(root, 'refresh', bundled), '# 리포 스킬')
    assert.equal(skillText(root, undefined, bundled), 'BUNDLED DRAFT')
  })

  it('최신화: 대상 화면과 코드 위치', () => {
    const text = taskText(
      { root, manual: 'bo' },
      { mode: 'refresh', menu: 'Menu Management', targets: ['08-menu-management/01-menu-list-view.md', '08-menu-management/02-menu-creation.md'] },
      { codeDir: '/Users/kim/dealerhub-web' },
    )
    assert.match(text, /할 일: 아래 기존 화면을 최신 기획서와 STG 화면에 맞춰 최신화한다/)
    assert.match(text, /  - manuals\/bo\/08-menu-management\/02-menu-creation\.md/)
    assert.match(text, /dealerhub-web 코드: \/Users\/kim\/dealerhub-web \(읽기만 가능/)
    assert.doesNotMatch(text, /넣을 위치/)
  })

  it('영상 초안: 시나리오 id, 연결 화면, 리포에 있는 영상 스킬', () => {
    const text = taskText(
      { root, manual: 'bo' },
      { mode: 'video', menu: 'Dealer List View', video: 'dealer-list', targets: ['02-dealer-management/01-dealer-list-view.md'] },
    )
    assert.match(text, /가이드 영상 시나리오 `dealer-list`를 채운다/)
    assert.match(text, /연결된 매뉴얼 화면: manuals\/bo\/02-dealer-management\/01-dealer-list-view\.md/)
    assert.doesNotMatch(text, /넣을 위치|dealerhub-web/)
    assert.match(taskText({ root, manual: 'bo' }, { mode: 'video', menu: 'X', video: 'x' }), /연결된 매뉴얼 화면: 없음/)
    assert.throws(() => skillText(root, 'video', bundled), /manual-video-draft/)
    assert.match(skillText(process.cwd(), 'video', bundled), /^# 가이드 영상 시나리오 초안/)
  })

  it('초안: 넣을 위치, 코드 없음', () => {
    const text = taskText({ root, manual: 'fo' }, { menu: 'Notice', newChapterTitle: 'Notice', chapterIndex: 3 })
    assert.match(text, /새 장 "Notice"을\(를\) chapterIndex 3 위치에 만든다/)
    assert.match(text, /dealerhub-web 코드: 없음/)
  })
})

describe('변경 보기 줄 비교', () => {
  it('바뀐 줄 앞뒤 3줄만 남기고 나머지는 접는다', () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n') + '\n'
    const after = before.replace('line 10\n', 'line 10 changed\n')
    const rows = buildRows(before, after)
    assert.deepEqual(
      rows.map((r) => (r.kind === 'gap' ? '…' : `${r.kind}:${r.text}`)),
      ['…', 'same:line 7', 'same:line 8', 'same:line 9', 'del:line 10', 'add:line 10 changed', 'same:line 11', 'same:line 12', 'same:line 13', '…'],
    )
    const del = rows.find((r) => r.kind === 'del')!
    assert.equal(del.before, 10)
  })

  it('새 파일은 전부 추가, 같으면 비어 있다', () => {
    assert.deepEqual(buildRows('', 'a\nb\n').map((r) => r.kind), ['add', 'add'])
    assert.deepEqual(buildRows('a\n', 'a\n'), [{ kind: 'gap', text: '' }])
  })
})
