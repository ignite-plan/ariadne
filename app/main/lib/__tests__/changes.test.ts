import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { describeChanges } from '../changes.ts'

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
