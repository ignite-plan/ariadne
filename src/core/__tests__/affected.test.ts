import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { changedLocaleKeys, findAffected, matchSections } from '../affected.ts'
import { createFixture } from './fixture.ts'

describe('changedLocaleKeys', () => {
  it('추가/삭제된 key만, 중복 없이', () => {
    const diff = [
      'diff --git a/en.json b/en.json',
      '--- a/en.json',
      '+++ b/en.json',
      '@@ -10 +10 @@',
      '-  "DEALER_LIST_TITLE": "Dealers",',
      '+  "DEALER_LIST_TITLE": "Dealer List",',
      '+  "DEALER_CREATE_NAME": "Company name",',
      '   "UNCHANGED_KEY": "x",',
    ].join('\n')
    assert.deepEqual(changedLocaleKeys(diff), ['DEALER_LIST_TITLE', 'DEALER_CREATE_NAME'])
  })
})

describe('matchSections', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('sources glob과 i18nPrefix로 섹션을 찾는다', () => {
    const affected = matchSections(
      fx.ref,
      ['apps/hyundai-bo/src/pages/Dealer/Company/List/TableArea.tsx', 'apps/hyundai-bo/src/pages/Other/x.tsx'],
      ['DEALER_CREATE_NAME'],
    )
    assert.deepEqual(affected, [
      {
        section: '02-dealer/01-list.md',
        title: 'Dealer List View',
        files: ['apps/hyundai-bo/src/pages/Dealer/Company/List/TableArea.tsx'],
        keys: [],
        images: ['dealer-list', 'location-popup'],
      },
      { section: '02-dealer/02-create.md', title: 'Dealer Creation', files: [], keys: ['DEALER_CREATE_NAME'], images: [] },
    ])
  })

  it('관련 변경이 없으면 빈 배열', () => {
    assert.deepEqual(matchSections(fx.ref, ['README.md'], ['OTHER_KEY']), [])
  })
})

describe('findAffected', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('git 두 ref 사이 변경을 매핑한다', () => {
    const repo = join(fx.ref.root, 'web')
    const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
    const locale = 'apps/hyundai-bo/src/locales/en.json'
    const page = 'apps/hyundai-bo/src/pages/Dealer/Company/List/index.tsx'
    mkdirSync(join(repo, 'apps/hyundai-bo/src/locales'), { recursive: true })
    mkdirSync(join(repo, 'apps/hyundai-bo/src/pages/Dealer/Company/List'), { recursive: true })
    execFileSync('git', ['init', '-q', '-b', 'main', repo])
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    writeFileSync(join(repo, locale), '{\n  "DEALER_CREATE_NAME": "Name"\n}\n')
    git('add', '.')
    git('commit', '-qm', 'base')
    git('tag', 'base')
    writeFileSync(join(repo, locale), '{\n  "DEALER_CREATE_NAME": "Company name"\n}\n')
    writeFileSync(join(repo, page), 'export {}\n')
    git('add', '.')
    git('commit', '-qm', 'head')

    const result = findAffected({ ...fx.ref, repo, base: 'base' })
    assert.equal(result.range, 'base...HEAD')
    assert.deepEqual(
      result.affected.map((a) => [a.section, a.files, a.keys]),
      [
        ['02-dealer/01-list.md', [page], []],
        ['02-dealer/02-create.md', [], ['DEALER_CREATE_NAME']],
      ],
    )
  })
})
