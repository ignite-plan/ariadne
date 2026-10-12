// 화면 캡처와 가이드 영상 (장면 편집, 미리보기, STG에서 기록, Claude로 초안·장면)
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import type { Smoke } from './context.ts'

export async function captureAndVideo({ page, step, snap, toast, workspace }: Smoke) {
  await step('캡처: 가짜 BO 캡처 → 비교 → 1장 반영 → 되돌리기', async () => {
    await page.getByRole('button', { name: '캡처' }).click()
    await page.getByRole('heading', { name: '화면 캡처' }).waitFor()
    await page.locator('.shot', { hasText: 'dealer-list' }).first().waitFor({ timeout: 15000 })
    assert.ok(await page.locator('.shot.disabled', { hasText: 'dealer-list-view-img-1' }).count())
    await page.locator('.session.ok').waitFor()
    await page.getByRole('button', { name: '3장 캡처' }).click()
    await page.locator('.report-summary').waitFor({ timeout: 90000 })
    const changed = await page.locator('.compare').count()
    assert.equal(changed, 3, `바뀐 이미지 ${changed}장`)
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.compare img')].every((i) => (i as HTMLImageElement).naturalWidth > 0),
    )
    await snap('08-capture')
    // location-popup만 남기고 반영
    for (const id of ['dealer-list', 'dealer-list-search']) {
      await page.locator('.compare', { has: page.locator('b', { hasText: new RegExp(`^${id}$`) }) }).locator('input').uncheck()
    }
    await page.getByRole('button', { name: '선택한 1장 반영' }).click()
    await toast('이미지 1장을 반영했습니다').waitFor()
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.locator('.change-item', { hasText: 'location-popup' }).waitFor({ timeout: 10000 })
    assert.equal(await page.locator('.change-item').count(), 1)
    await page.locator('.change-item', { hasText: 'location-popup' }).getByTitle('변경 되돌리기').click()
    await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 10000 })
  })

  await step('가이드 영상: 새 영상 → 장면 보기 → 삭제', async () => {
    await page.getByRole('button', { name: '영상', exact: true }).click()
    await page.getByRole('heading', { name: '가이드 영상' }).waitFor()
    await page.getByRole('button', { name: '새 영상' }).click()
    const dialog = page.getByRole('dialog')
    // 지금 열린 화면(Dealer List View)이 미리 골라져 있다
    await dialog.locator('input').and(page.locator('[value="Dealer List View"]')).waitFor()
    await dialog.getByRole('button', { name: '만들기' }).click()
    await page.locator('.video-title h2', { hasText: 'Dealer List View' }).waitFor()
    const scene = page.locator('.scene-list .scene').first()
    await scene.locator('textarea').fill('The Dealer List screen provides a list of all registered dealers.')
    // 단계 추가: 화면 열기 → 글자 기다리기 → 버튼 클릭
    const addStep = async (kind: string, fill: (d: typeof dialog) => Promise<void>, shot?: string) => {
      await scene.getByRole('button', { name: '단계', exact: true }).click()
      await dialog.locator('select').first().selectOption({ label: kind })
      await fill(dialog)
      if (shot) await snap(shot)
      await dialog.getByRole('button', { name: '추가' }).click()
      await dialog.waitFor({ state: 'detached' })
    }
    await addStep('화면 열기', (d) => d.locator('input').fill('/dealer/company'))
    await addStep('보일 때까지 기다리기', async (d) => {
      await d.locator('select').nth(1).selectOption({ label: '화면 글자' })
      await d.locator('input').first().fill('Total')
    })
    await addStep('클릭', (d) => d.locator('input').first().fill('Location'), '08c-video-step')
    await snap('08b-video-editor')
    assert.deepEqual(await scene.locator('.step-text').allTextContents(), [
      '/dealer/company 화면 열기',
      "'Total' 글자 표시 기다림",
      "'Location' 버튼 클릭",
    ])
    await page.locator('.video-title', { hasText: '저장됨' }).waitFor()
    const yaml = readFileSync(join(workspace, 'manuals/bo/videos/dealer-list-view.yaml'), 'utf8')
    assert.ok(yaml.includes('- open: /dealer/company'), yaml)
    assert.ok(yaml.includes('role: button\n          name: Location'), yaml)
    // 미리보기 (가짜 BO, 녹화 없음)
    await page.locator('.video-toolbar').getByRole('button', { name: '미리보기', exact: true }).click()
    await toast(/미리보기를 마쳤습니다/).waitFor({ timeout: 60000 })

    // STG에서 기록: 장면 2를 만들고, 장면 1을 재생한 화면에서 이어서 조작한다
    await page.getByRole('button', { name: '장면 추가' }).click()
    const scene2 = page.locator('.scene-list .scene').nth(1)
    await scene2.getByRole('button', { name: 'STG에서 기록' }).click()
    await page.locator('.recording-bar', { hasText: '장면 2에 단계가 붙습니다' }).waitFor({ timeout: 30000 })
    const recorder = await chromium.connectOverCDP('http://127.0.0.1:9339')
    const bo = recorder.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('/ca/admin'))!
    await bo.getByText('Location Information').waitFor()
    await bo.locator('ariadne-recorder').getByRole('button', { name: '기다릴 글자 고르기' }).click()
    await bo.getByText('Location Information').click()
    await bo.getByRole('button', { name: 'Location' }).click()
    await scene2.locator('.step-text').nth(1).waitFor()
    await snap('08d-video-record')
    await bo.locator('ariadne-recorder').getByRole('button', { name: '기록 끝' }).click()
    await page.locator('.recording-bar').waitFor({ state: 'detached', timeout: 10000 })
    await recorder.close().catch(() => {})
    assert.deepEqual(await scene2.locator('.step-text').allTextContents(), [
      "'Location Information' 글자 표시 기다림",
      "'Location' 버튼 클릭",
    ])
    await page.locator('.video-title', { hasText: '저장됨' }).waitFor()
    const recorded = readFileSync(join(workspace, 'manuals/bo/videos/dealer-list-view.yaml'), 'utf8')
    assert.ok(recorded.includes('text: Location Information'), recorded)

    // Claude로 초안 (가짜 claude → Ariadne MCP video_get/video_save/video_check → STG)
    await page.locator('.video-toolbar').getByRole('button', { name: 'Claude로 초안' }).click()
    await page.getByRole('heading', { name: 'Claude로 영상 초안' }).waitFor()
    await page.getByRole('button', { name: '영상 초안 시작' }).click({ timeout: 60000 })
    await page.getByRole('heading', { name: '영상 시나리오 초안을 만들었습니다' }).waitFor({ timeout: 90000 })
    assert.ok(await page.locator('.log li', { hasText: '영상 시나리오 실행해 보기' }).count())
    await snap('08e-video-draft')
    await page.getByRole('button', { name: '닫고 결과 보기' }).click()
    await page.locator('.scene-list .scene').nth(1).locator('textarea').first().waitFor()
    assert.equal(await page.locator('.scene-list .scene').count(), 2)
    assert.equal(
      await page.locator('.scene-list .scene').nth(1).locator('textarea').first().inputValue(),
      "Click the Location icon to see the dealer's address.",
    )
    assert.ok(!readFileSync(join(workspace, 'manuals/bo/videos/dealer-list-view.yaml'), 'utf8').includes('mutates'))

    // Claude로 이 장면: 장면 2 다음에 새 장면 (가짜 claude → video_open_scene/video_save_scene/video_check)
    await page.locator('.scene-list .scene').nth(1).getByRole('button', { name: 'Claude로 이 장면' }).click()
    const ask = page.getByRole('dialog', { name: 'Claude로 장면 2' })
    await ask.locator('textarea').fill('Location 팝업에 주소가 보이는 화면')
    await ask.getByText('장면 2 다음에 새 장면으로 추가').click()
    await ask.getByRole('button', { name: '다음' }).click()
    await page.getByRole('heading', { name: 'Claude로 장면 채우기' }).waitFor()
    await page.getByRole('button', { name: '장면 채우기 시작' }).click({ timeout: 60000 })
    await page.getByRole('heading', { name: '장면을 채웠습니다' }).waitFor({ timeout: 90000 })
    await snap('08f-video-scene')
    await page.getByRole('button', { name: '닫고 결과 보기' }).click()
    await page.locator('.scene-list .scene').nth(2).locator('textarea').first().waitFor()
    assert.equal(await page.locator('.scene-list .scene').count(), 3)
    assert.equal(
      await page.locator('.scene-list .scene').nth(2).locator('textarea').first().inputValue(),
      'The popup shows the registered address of the dealer.',
    )
    // 리포에 다른 영상(dealer-list, dealer-create)이 있을 수 있어 빈 목록이 아니라 지운 영상 하나만 사라졌는지 본다
    const videosBefore = await page.locator('.video-item').count()
    await page.locator('.video-toolbar').getByTitle('삭제', { exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('.video-item').length === n - 1, videosBefore)
    assert.ok(!existsSync(join(workspace, 'manuals/bo/videos/dealer-list-view.yaml')))
    await page.locator('.panel-header').getByRole('button', { name: '닫기' }).click()
    // 만들었다 지웠으니 제출할 변경이 없다
    await page.getByRole('tab', { name: /변경/ }).click()
    await page.locator('.empty', { hasText: '제출할 변경이 없습니다' }).waitFor({ timeout: 10000 })
  })
}
