// 가짜 화면에서 사람이 조작하듯 Playwright로 누르고 입력해, 기록된 단계가 기대한 대상인지와 그대로 재생되는지 본다
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { chromium, type Browser, type Page } from 'playwright'
import { Director } from '../video/director.ts'
import { appendRecorded, attachRecorder, type RecordEvent } from '../video/record.ts'
import type { Step } from '../video/scenario.ts'
import { runSteps } from '../video/steps.ts'
import { skipWithout } from './browser.ts'


const HTML = `<!doctype html><body style="font-family:sans-serif">
  <h1 id="title" onclick="window.titleClicked = true">Dealer Management</h1>
  <p>Total 2</p>
  <table><tr><td>Dealer A</td><td><button>Detail</button></td></tr><tr><td>Dealer B</td><td><button>Detail</button></td></tr></table>
  <button onclick="document.getElementById('popup').hidden=false">Location</button>
  <button class="icon" onclick="window.iconClicked=true"><svg width="10" height="10"></svg></button>
  <button>Save</button>
  <label>Dealer Name <input id="name"></label>
  <label for="status">Type</label><select id="status"><option>Main</option><option>Sub</option></select>
  <div role="combobox" id="combo" tabindex="0" aria-label="Status">Select</div>
  <ul role="listbox" id="list" hidden><li role="option">Active</li><li role="option">Inactive</li></ul>
  <div id="popup" role="dialog" hidden>Location Information</div>
  <p class="email">owner@dealer.ca</p>
  <script>
    combo.addEventListener('mousedown', () => { list.hidden = false })
    list.addEventListener('click', (e) => { combo.textContent = e.target.textContent; list.hidden = true })
  </script>
</body>`

describe('기록 (Chrome)', { skip: skipWithout() }, () => {
  let browser: Browser
  before(async () => {
    browser = await chromium.launch({ channel: 'chrome' })
  })
  after(async () => {
    await browser.close()
  })

  const open = async () => {
    const page = await browser.newPage()
    await page.route('http://bo.test/**', (route) => route.fulfill({ contentType: 'text/html', body: HTML }))
    await page.goto('http://bo.test/admin/dealer')
    return page
  }

  // 이벤트가 n개 모일 때까지 기다린다 (기록은 비동기)
  const collect = (events: RecordEvent[]) => async (n: number) => {
    for (let i = 0; i < 50 && events.length < n; i++) await new Promise((r) => setTimeout(r, 50))
    assert.equal(events.length, n, JSON.stringify(events))
  }

  it('클릭·입력·선택을 같은 규칙의 대상으로 기록하고, 그대로 재생된다', async () => {
    const page = await open()
    const events: RecordEvent[] = []
    await attachRecorder(page, { onEvent: (e) => events.push(e) })
    const wait = collect(events)

    await page.getByRole('row', { name: 'Dealer B' }).getByRole('button', { name: 'Detail' }).click()
    await wait(1)
    await page.getByRole('button', { name: 'Location' }).click()
    await wait(2)
    await page.getByLabel('Dealer Name').fill('Video Test')
    await page.getByLabel('Dealer Name').blur()
    await wait(3)
    await page.getByLabel('Type').selectOption('Sub')
    await wait(4)
    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Active', exact: true }).click()
    await wait(6)

    const steps = events.map((e) => (e.kind === 'step' ? e.step : null))
    assert.deepEqual(steps, [
      { click: { role: 'button', name: 'Detail', nth: 1 } },
      { click: { role: 'button', name: 'Location' } },
      { type: { target: { role: 'textbox', name: 'Dealer Name' }, text: 'Video Test' } },
      { select: { target: { role: 'combobox', name: 'Type' }, value: 'Sub' } },
      { click: { role: 'combobox', name: 'Status' } },
      { click: { role: 'option', name: 'Active', exact: true } },
    ])
    assert.ok(events.every((e) => e.kind === 'step' && !e.warning))

    // 선택 상자 클릭 + 항목 클릭은 '선택' 하나로
    let merged: Step[] = []
    for (const step of steps) merged = appendRecorded(merged, step!)
    assert.deepEqual(merged.at(-1), { choose: { target: { role: 'combobox', name: 'Status' }, option: 'Active' } })
    assert.equal(merged.length, 5)

    // 새 페이지에서 그대로 재생하면 같은 결과
    const replay = await open()
    await runSteps(new Director(replay, { baseUrl: 'http://bo.test/admin', pace: 0, overlay: false }), merged.slice(1), 0)
    assert.equal(await replay.locator('#popup').isVisible(), true)
    assert.equal(await replay.locator('#name').inputValue(), 'Video Test')
    assert.equal(await replay.locator('#status').inputValue(), 'Sub')
    assert.equal(await replay.locator('#combo').textContent(), 'Active')
    await Promise.all([page.close(), replay.close()])
  })

  it('이름 없는 요소와 저장 버튼은 알리고, 고르기 모드는 화면에 클릭을 전달하지 않는다', async () => {
    const page = await open()
    const events: RecordEvent[] = []
    await attachRecorder(page, { onEvent: (e) => events.push(e) })
    const wait = collect(events)
    const toolbar = (name: string) => page.locator('ariadne-recorder').getByRole('button', { name })

    await page.locator('button.icon').click()
    await wait(1)
    await page.getByRole('button', { name: 'Save' }).click()
    await wait(2)
    assert.match((events[0] as Extract<RecordEvent, { kind: 'step' }>).warning ?? '', /이름이 없는 요소/)
    assert.match((events[1] as Extract<RecordEvent, { kind: 'step' }>).warning ?? '', /"Save".*STG에 실제 저장 허용/)

    await toolbar('강조할 곳 고르기').click()
    await page.locator('#title').click()
    await wait(3)
    assert.equal(await page.evaluate(() => (window as unknown as { titleClicked?: boolean }).titleClicked), undefined)
    assert.deepEqual(events[2], { kind: 'step', step: { highlight: { target: { role: 'heading', name: 'Dealer Management' }, ms: 2000 } } })

    await toolbar('기다릴 글자 고르기').click()
    await page.getByText('Total 2').click()
    await wait(4)
    assert.deepEqual(events[3], { kind: 'step', step: { waitFor: { text: 'Total 2' } } })

    await toolbar('가릴 곳 고르기').click()
    await page.locator('.email').click()
    await wait(5)
    assert.deepEqual(events[4], { kind: 'mask', target: { text: 'owner@dealer.ca' } })

    // 고르기가 끝나면 다시 기록한다
    await page.getByRole('button', { name: 'Location' }).click()
    await wait(6)
    assert.deepEqual(events[5], { kind: 'step', step: { click: { role: 'button', name: 'Location' } } })

    await toolbar('새 장면').click()
    await toolbar('기록 끝').click()
    await wait(8)
    assert.deepEqual(events.slice(6), [{ kind: 'scene' }, { kind: 'stop' }])
    await page.close()
  })

  it('페이지를 옮겨도 계속 기록한다', async () => {
    const page: Page = await open()
    const events: RecordEvent[] = []
    await attachRecorder(page, { onEvent: (e) => events.push(e) })
    await page.goto('http://bo.test/admin/other')
    await page.getByRole('button', { name: 'Location' }).click()
    await collect(events)(1)
    await page.close()
  })
})
