import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describeChanges, expandRevertPaths } from '../changes.ts'
import { deleteManual, listManuals, manualStats } from '../sections.ts'

describe('바뀐 파일 이름', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('섹션은 제목, 이미지는 id, manual.yaml은 목차, 나머지는 경로', () => {
    const changes = describeChanges(fx.ref, [
      { path: 'manuals/demo/02-dealer/01-list.md', status: 'modified' },
      { path: 'manuals/demo/03-new/01-draft.md', status: 'added' },
      { path: 'manuals/demo/images/dealer-list.png', status: 'modified' },
      { path: 'manuals/demo/manual.yaml', status: 'modified' },
      { path: 'manuals/bo/images/x.png', status: 'deleted' },
    ])
    assert.deepEqual(
      changes.map((c) => [c.kind, c.label]),
      [
        ['section', 'Dealer List View'],
        ['section', '03-new/01-draft.md'],
        ['image', 'dealer-list'],
        ['manual', '목차 (manual.yaml)'],
        ['other', 'manuals/bo/images/x.png'],
      ],
    )
  })
})

describe('매뉴얼 삭제', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('지운 매뉴얼의 파일은 "매뉴얼 삭제" 한 줄로 묶고, 되돌릴 때는 그 아래 파일 전부로 푼다', () => {
    const all = [
      { path: 'manuals/kia/manual.yaml', status: 'deleted' as const },
      { path: 'manuals/kia/01-a/00-intro.md', status: 'deleted' as const },
      { path: 'manuals/kia/images/x.png', status: 'deleted' as const },
      { path: 'manuals/demo/02-dealer/01-list.md', status: 'modified' as const },
      // manual.yaml이 남아 있으면(파일 몇 개만 지움) 묶지 않는다
      { path: 'manuals/bo/images/y.png', status: 'deleted' as const },
    ]
    const changes = describeChanges(fx.ref, all)
    assert.deepEqual(
      changes.map((c) => [c.kind, c.path, c.label]),
      [
        ['manual-removed', 'manuals/kia/', '매뉴얼 삭제: kia (파일 3개)'],
        ['section', 'manuals/demo/02-dealer/01-list.md', 'Dealer List View'],
        ['other', 'manuals/bo/images/y.png', 'manuals/bo/images/y.png'],
      ],
    )
    assert.deepEqual(expandRevertPaths(['manuals/kia/', 'manuals/bo/images/y.png'], all), [
      'manuals/kia/manual.yaml',
      'manuals/kia/01-a/00-intro.md',
      'manuals/kia/images/x.png',
      'manuals/bo/images/y.png',
    ])
  })

  it('지금 매뉴얼과 마지막 하나는 지우지 않고, 다른 매뉴얼은 폴더와 캡처 기록까지 지운다', () => {
    const root = fx.ref.root
    assert.throws(() => deleteManual(root, 'demo', 'demo'), /지금 열린 매뉴얼은 지울 수 없습니다/)
    assert.throws(() => deleteManual(root, 'other', 'x'), /매뉴얼이 없습니다/)
    assert.throws(() => deleteManual(root, '../demo', 'x'), /매뉴얼 id는/)
    cpSync(join(root, 'manuals/demo'), join(root, 'manuals/copy'), { recursive: true })
    writeFileSync(join(root, 'manuals/copy/images/a.png'), 'png')
    mkdirSync(join(root, '.capture/copy'), { recursive: true })
    assert.deepEqual(manualStats(root, 'copy'), { sections: 3, images: 1 })
    deleteManual(root, 'copy', 'demo')
    assert.ok(!existsSync(join(root, 'manuals/copy')) && !existsSync(join(root, '.capture/copy')))
    assert.deepEqual(listManuals(root), ['demo'])
    assert.throws(() => deleteManual(root, 'demo', 'x'), /하나뿐이라/)
  })
})
