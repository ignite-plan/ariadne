import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Step } from '../video/scenario.ts'
import { buildStep, cleanTarget, kindOf, stepFields, stepValid, targetOf, targetValid } from '../video/step-form.ts'

describe('장면 편집기 단계 입력', () => {
  it('단계를 편집 칸으로 펼치고 다시 같은 단계로 만든다', () => {
    const steps: Step[] = [
      { open: '/dealer' },
      { click: { role: 'button', name: 'Search' } },
      { type: { target: { label: 'Name' }, text: 'Video Test {stamp}' } },
      { choose: { target: { role: 'combobox', name: 'Status' }, option: 'Active' } },
      { highlight: { target: { text: 'Total' }, ms: 2000 } },
      { pause: 1500 },
    ]
    for (const step of steps) {
      const kind = kindOf(step)
      const target = targetOf(step) ?? { role: 'button', name: '' }
      const fields = stepFields(step)
      assert.ok(stepValid(kind, target, fields), JSON.stringify(step))
      assert.deepEqual(buildStep(kind, target, fields), step)
    }
  })

  it('빈 칸이 있으면 만들 수 없다', () => {
    assert.equal(stepValid('open', {}, { path: ' ', text: '', seconds: 1 }), false)
    assert.equal(stepValid('click', { text: ' ' }, { path: '/', text: '', seconds: 1 }), false)
    assert.equal(stepValid('choose', { role: 'combobox' }, { path: '/', text: '', seconds: 1 }), false)
    assert.equal(stepValid('pause', {}, { path: '/', text: '', seconds: 0 }), false)
  })

  it('대상: 고른 방식의 값만 남기고, 기본값과 빈 안쪽 대상은 지운다', () => {
    assert.deepEqual(cleanTarget({ role: 'button', name: '  Save ', nth: 0, exact: false, within: { role: 'row', name: '' } }), {
      role: 'button',
      name: 'Save',
      within: { role: 'row' },
    })
    assert.deepEqual(cleanTarget({ label: ' Name ', nth: 2, exact: true, within: { text: '' } }), { label: 'Name', nth: 2, exact: true })
    assert.equal(targetValid({ role: 'button', within: { text: ' ' } }), false)
  })
})
