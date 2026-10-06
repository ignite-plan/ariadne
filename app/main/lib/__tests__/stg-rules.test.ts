import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { loadShotsBundled } from '../shots.ts'
import { isTelemetryRequest } from '../../../../src/core/safety.ts'
import { appendShot, inputNames, snapshotChanges, isAllowedRequest, isBlockedLabel, removeShot, shotToCode } from '../stg.ts'

describe('STG 안전장치', () => {
  it('데이터를 바꾸는 버튼 이름을 막는다', () => {
    for (const name of ['Save', 'Delete Menu', 'Submit', 'Approve', 'Send Email', 'Register', '저장', '삭제', 'Confirm', 'Upload File', 'Deactivate']) {
      assert.ok(isBlockedLabel(name), name)
    }
    for (const name of ['Search', 'Location', 'Menu Information', 'Detail', 'Cancel', 'Close', 'Next', '+ Group Addition', 'Reset', 'Saved Filters view']) {
      assert.equal(isBlockedLabel(name), false, name)
    }
  })

  it('조회 요청만 통과시킨다', () => {
    assert.ok(isAllowedRequest('GET', 'https://stg/api/v1/menus'))
    assert.ok(isAllowedRequest('POST', 'https://stg/api/v1/dealers/search'))
    assert.ok(isAllowedRequest('POST', 'https://stg/api/v1/menus/tree'))
    assert.ok(isAllowedRequest('POST', 'https://stg/api/v1/posts/list?page=1'))
    assert.ok(!isAllowedRequest('POST', 'https://stg/api/v1/menus'))
    assert.ok(!isAllowedRequest('POST', 'https://stg/api/v1/menus/12/listing-order'))
    assert.ok(!isAllowedRequest('PUT', 'https://stg/api/v1/menus/12'))
    assert.ok(!isAllowedRequest('DELETE', 'https://stg/api/v1/menus/12'))
    assert.ok(!isAllowedRequest('PATCH', 'https://stg/api/v1/menus/12'))
    // 로그인 세션 유지는 통과 (막으면 권한 조회가 403)
    assert.ok(isAllowedRequest('POST', 'https://stg-admin-api.hmg-corp.io/sso/HK1298/token'))
    assert.ok(isAllowedRequest('POST', 'https://stg-admin-api.hmg-corp.io/sso/settings'))
    assert.ok(isAllowedRequest('POST', 'https://stg-apigw-us.hmg-corp.io/dealers_bo/v0200/hyd/hacc/api/v1/auth/bo'))
    assert.ok(isAllowedRequest('POST', 'https://stg-apigw-us.hmg-corp.io/dealers_bo/v0200/hyd/hacc/api/v1/auth/bo/refresh'))
    // 이름에 auth가 들어 있어도 경로 구간이 아니면 막는다. 접속 기록 전송도 막는다
    assert.ok(!isAllowedRequest('POST', 'https://stg/api/v1/menus/12/authorities'))
    assert.ok(!isAllowedRequest('POST', 'https://stg/api/v1/tokens-issue'))
    assert.ok(!isAllowedRequest('POST', 'https://browser-intake-datadoghq.com/api/v2/rum'))
    // 모니터링 전송은 막되 알리지 않는다
    assert.ok(isTelemetryRequest('https://browser-intake-datadoghq.com/api/v2/rum?ddsource=browser'))
    assert.ok(isTelemetryRequest('https://stg-admin-config.hmg-corp.io/hadm-log'))
    assert.ok(!isTelemetryRequest('https://stg/api/v1/menus/12'))
  })
})

describe('캡처 정의 코드 생성', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('구조화된 단계를 Playwright 코드로', () => {
    const code = shotToCode({
      id: 'menu-create-popup',
      path: '/menu',
      ready: 'text=Total',
      steps: [{ click: { role: 'button', name: "Group's Addition" } }, { fill: { label: 'Menu name', value: 'Sample' } }, { waitFor: '[role="dialog"]' }],
      clip: '[role="dialog"]',
    })
    assert.match(code, /id: 'menu-create-popup'/)
    assert.match(code, /await page\.getByRole\('button', \{ name: 'Group\\'s Addition' \}\)\.first\(\)\.click\(\)/)
    assert.match(code, /await page\.getByLabel\('Menu name'\)\.first\(\)\.fill\('Sample'\)/)
    assert.match(code, /clip: '\[role="dialog"\]'/)
  })

  it('기존 항목 바꾸기 (중첩 중괄호가 있는 steps 포함)', async () => {
    const bo = readFileSync(join(process.cwd(), 'manuals/bo/shots.ts'), 'utf8')
    const removed = removeShot(bo, 'location-popup')
    assert.doesNotMatch(removed, /location-popup/)
    assert.match(removed, /id: 'dealer-list', path/)
    assert.match(removed, /id: 'dealer-list-search'/)
    assert.equal(removeShot(bo, 'none'), bo)
    assert.throws(() => appendShot(bo, { id: 'location-popup', path: '/x' }), /replace: true/)
    const replaced = appendShot(bo, { id: 'location-popup', path: '/dealer/company', clip: '[role="dialog"]' }, true)
    assert.equal(replaced.match(/location-popup/g)?.length, 1)
    assert.match(replaced, /id: 'location-popup',\n    path: '\/dealer\/company',\n    clip: '\[role="dialog"\]'/)
    // 한 줄짜리 항목도 바꾼다
    const one = appendShot(bo, { id: 'dealer-list', path: '/dealer/company', ready: 'text=Total' }, true)
    assert.equal(one.match(/id: 'dealer-list',/g)?.length, 1)
    mkdirSync(join(fx.ref.root, 'src/core'), { recursive: true })
    writeFileSync(join(fx.ref.root, 'src/core/shot.ts'), readFileSync(join(process.cwd(), 'src/core/shot.ts')))
    writeFileSync(join(fx.dir, 'shots.ts'), replaced.replace("'../../src/core/shot.ts'", "'../../src/core/shot.ts'"))
    const shots = await loadShotsBundled(fx.ref)
    assert.deepEqual(shots.map((s) => s.id), ['dealer-list', 'dealer-list-search', 'dealer-list-view-img-1', 'dealer-list-view-img-2', 'location-popup'])
  })

  it('빈 shots.ts와 기존 shots.ts 끝에 붙이고, 만든 파일이 실제로 불러와진다', async () => {
    const empty = "import { defineShots } from '../../src/core/shot.ts'\n\nexport const shots = defineShots([])\n"
    const one = appendShot(empty, { id: 'menu-list', path: '/menu', clip: '#root' })
    const two = appendShot(one, { id: 'menu-popup', path: '/menu', steps: [{ click: { role: 'button', name: 'Location' } }], clip: '[role="dialog"]' })
    assert.throws(() => appendShot(two, { id: 'menu-list', path: '/x' }), /이미 있는 id/)

    const bo = readFileSync(join(process.cwd(), 'manuals/bo/shots.ts'), 'utf8')
    assert.match(appendShot(bo, { id: 'new-shot', path: '/x' }), /manual: true \},\n  \{\n    id: 'new-shot'/)

    // shots.ts는 ../../src/core/shot.ts를 import한다. fixture 루트에 그 파일을 둔다
    mkdirSync(join(fx.ref.root, 'src/core'), { recursive: true })
    writeFileSync(join(fx.ref.root, 'src/core/shot.ts'), readFileSync(join(process.cwd(), 'src/core/shot.ts')))
    writeFileSync(join(fx.dir, 'shots.ts'), two)
    const shots = await loadShotsBundled(fx.ref)
    assert.deepEqual(shots.map((s) => s.id), ['menu-list', 'menu-popup'])
    assert.equal(typeof shots[1].steps, 'function')
  })
})

describe('입력칸 후보', () => {
  it('접근성 트리의 입력칸 이름을 중복 없이', () => {
    const snapshot = [
      '- dialog "Menu Information":',
      '  - textbox "Menu name": Sample',
      '  - combobox "Menu Type"',
      '  - textbox "Say \\"hi\\""',
      '  - button "Cancel"',
      '  - textbox "Menu name"',
      '  - spinbutton "Order"',
      '  - textbox',
    ].join('\n')
    assert.deepEqual(inputNames(snapshot), ['textbox "Menu name"', 'combobox "Menu Type"', 'textbox "Say \\"hi\\""', 'spinbutton "Order"'])
    assert.deepEqual(inputNames('- button "Save"'), [])
  })
})

describe('달라진 줄만', () => {
  it('앞 응답에 없던 줄만 순서대로, 빈 줄은 빼고', () => {
    const before = new Set(['- heading "Menu"', '  - textbox "Menu name"', '  - text: Total 3'])
    const next = ['- heading "Menu"', '  - textbox "Menu name": Sample', '  - text: Total 3', '', '  - text: searched 200'].join('\n')
    assert.deepEqual(snapshotChanges(before, next), ['  - textbox "Menu name": Sample', '  - text: searched 200'])
    assert.deepEqual(snapshotChanges(before, [...before].join('\n')), [])
  })
})
