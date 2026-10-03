import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeTask, MIN_DURATION_MS, shouldNotify } from '../notify.ts'

describe('알림 여부', () => {
  const long = MIN_DURATION_MS + 1
  it('기본(background)은 다른 앱을 보고 있을 때만', () => {
    assert.equal(shouldNotify({ mode: 'background', focused: false, durationMs: long }), true)
    assert.equal(shouldNotify({ mode: 'background', focused: true, durationMs: long }), false)
  })
  it('always는 보고 있어도, off는 절대 알리지 않는다', () => {
    assert.equal(shouldNotify({ mode: 'always', focused: true, durationMs: long }), true)
    assert.equal(shouldNotify({ mode: 'off', focused: false, durationMs: long }), false)
  })
  it('금방 끝난 작업은 알리지 않는다', () => {
    assert.equal(shouldNotify({ mode: 'always', focused: false, durationMs: MIN_DURATION_MS - 1 }), false)
  })
})

describe('알림 문구', () => {
  it('Claude 최신화: 고친 화면 수와 TODO', () => {
    const n = describeTask('draft:start', [{ mode: 'refresh', menu: 'Menu Management', targets: [] }], {
      ok: true,
      summary: { sections: ['08-a/01.md', '08-a/02.md'], todos: 3 },
    })
    assert.deepEqual(n, { ok: true, title: 'Claude 최신화 완료', body: 'Menu Management · 화면 2개 고침 · TODO 3 — 검토 후 제출하세요' })
    assert.equal(
      describeTask('draft:start', [{ mode: 'refresh', menu: 'Job' }], { ok: true, summary: { sections: [] } })!.body,
      'Job · 바꿀 곳이 없었습니다 — 검토 후 제출하세요',
    )
  })

  it('Claude 초안·영상 초안, 실패는 이유 첫 줄', () => {
    assert.equal(describeTask('draft:start', [{ menu: 'Enrollment Requests' }], { ok: true, summary: { sections: ['a'] } })!.title, 'Claude 초안 만들기 완료')
    assert.equal(describeTask('draft:start', [{ mode: 'video', menu: 'Dealer' }], { ok: true })!.title, 'Claude 영상 시나리오 초안 완료')
    assert.deepEqual(describeTask('draft:start', [{ mode: 'video-scene', menu: 'x' }], { ok: false, text: 'ANTHROPIC_API_KEY로 인증하지 못했습니다 (401)\n자세히' }), {
      ok: false,
      title: 'Claude 영상 장면 채우기 실패',
      body: 'ANTHROPIC_API_KEY로 인증하지 못했습니다 (401)',
    })
  })

  it('가이드 영상: 만들기/실행해 보기/실패', () => {
    assert.deepEqual(describeTask('video:run', ['dealer-list', {}], { ok: true, mp4: '/ws/dist/videos/dealer-list.mp4', durationMs: 42400 }), {
      ok: true,
      title: '가이드 영상 만들기 완료',
      body: 'dealer-list.mp4 · 42초',
    })
    assert.equal(describeTask('video:run', ['x', { preview: true }], { ok: true, durationMs: 1 })!.title, '영상 실행해 보기 완료')
    assert.equal(describeTask('video:run', ['x'], { ok: false, error: "장면 3: 'Save' 버튼을 찾지 못함" })!.body, "장면 3: 'Save' 버튼을 찾지 못함")
  })

  it('캡처, 제출, 가져오기, Word', () => {
    assert.deepEqual(describeTask('capture:run', [['a', 'b']], { changed: ['a'], unchanged: ['b'], skipped: [], failed: [] }), {
      ok: true,
      title: '화면 캡처 완료',
      body: '바뀜 1 · 그대로 1 — 반영할 이미지를 고르세요',
    })
    assert.equal(describeTask('capture:run', [[]], { changed: [], unchanged: [], failed: [{ id: 'x' }] })!.ok, false)
    assert.equal(describeTask('workspace:submit', ['m'], { mode: 'pr', conflict: true })!.body, '다른 변경과 겹쳐 PR로 올렸습니다')
    assert.equal(describeTask('manual:importDocx', [{}], 'fo')!.body, 'fo 매뉴얼을 만들었습니다 — 확인 후 제출하세요')
    assert.equal(describeTask('build:docx', [], { docx: '/ws/dist/Manual_v1.0.8.docx' })!.body, 'Manual_v1.0.8.docx')
  })

  it('던진 오류는 실패 알림, 알릴 작업이 아니면 없음', () => {
    assert.deepEqual(describeTask('workspace:submit', ['m'], undefined, new Error('push 실패: rejected')), {
      ok: false,
      title: '제출 실패',
      body: 'push 실패: rejected',
    })
    assert.equal(describeTask('manual:write', [], undefined), undefined)
    assert.equal(describeTask('settings:get', [], {}), undefined)
  })
})
