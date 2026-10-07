import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type { SectionMeta } from '../../../../src/core/manual.ts'
import type { DraftEvent } from '../../../shared/api.ts'
import { runRefreshBatch, type BatchDeps } from '../refresh-batch.ts'
import { needsRefresh, parseSpecReply, readDigest, screenBrief, specSlug, writeDigest, type SpecDigest } from '../spec.ts'

const digest: SpecDigest = {
  menu: 'Menu Management',
  generatedAt: '2026-10-03T00:00:00Z',
  pages: [
    { id: '200', title: '정책', version: 3 },
    { id: '100', title: '[202606output][Phase3][BO] 메뉴 관리 화면', version: 12, url: 'https://x/100' },
  ],
  common: '권한은 Admin만',
  screens: { '08-menu/01-list.md': 'List: Total, Search', '02-create.md': 'Menu Name max 50' },
}
const current = [
  { page: '100', version: 12 },
  { page: '200', version: 3 },
]

describe('기획서 요약', () => {
  it('근거 버전이 같으면 건너뛴다 (순서 무관), 다르거나 기록이 없으면 한다', () => {
    assert.equal(needsRefresh({ refreshedFrom: [...current].reverse() }, current), false)
    assert.equal(needsRefresh({ refreshedFrom: [{ page: '100', version: 11 }, { page: '200', version: 3 }] }, current), true)
    assert.equal(needsRefresh({}, current), true)
    assert.equal(needsRefresh({ refreshedFrom: current }, []), true, '기획서를 못 읽었으면 항상 한다')
  })

  it('화면 요약: 경로나 파일 이름으로 찾고, 근거 문서와 공통 정책을 붙인다', () => {
    const own = screenBrief(digest, '08-menu/01-list.md')
    assert.match(own, /메뉴 관리 화면 \(v12\) https:\/\/x\/100/)
    assert.match(own, /공통 정책:\n권한은 Admin만/)
    assert.match(own, /이 화면:\nList: Total, Search/)
    assert.match(screenBrief(digest, '08-menu/02-create.md'), /Menu Name max 50/)
    assert.match(screenBrief(digest, '08-menu/09-none.md'), /요약에 없음/)
    assert.equal(screenBrief(undefined, 'x.md'), '')
  })

  it('파일 읽기: 형식이 틀리면 없는 것으로, 버전은 숫자로', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'))
    try {
      const file = join(dir, 'a.json')
      assert.equal(readDigest(file), undefined)
      writeFileSync(file, '{oops')
      assert.equal(readDigest(file), undefined)
      writeFileSync(file, JSON.stringify({ menu: 'M', pages: [{ id: 100, title: 't', version: '12' }, { title: 'id 없음' }], screens: {} }))
      assert.deepEqual(readDigest(file)?.pages, [{ id: '100', title: 't', version: 12 }])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    assert.equal(specSlug('Menu & Role Management'), 'menu-and-role-management')
  })

  it('요약 응답: 마지막 JSON 블록을 읽고, 재사용·형식 오류를 구분한다', () => {
    const reply = parseSpecReply(
      '요약했습니다.\n```json\n{"x":1}\n```\n끝\n```json\n' +
        JSON.stringify({ pages: [{ id: 100, title: 't', version: '12' }], screens: { 'a.md': 'A' }, common: 'C' }) +
        '\n```',
      'Menu',
    )
    assert.ok(reply && !reply.reused)
    assert.equal(reply.digest.menu, 'Menu')
    assert.deepEqual(reply.digest.pages, [{ id: '100', title: 't', version: 12 }])
    assert.deepEqual(reply.digest.screens, { 'a.md': 'A' })
    assert.ok(reply.digest.generatedAt)
    assert.deepEqual(parseSpecReply('```json\n{"reused": true}\n```', 'M'), { reused: true })
    assert.equal(parseSpecReply('JSON 없음', 'M'), undefined)
    assert.equal(parseSpecReply('```json\n{oops\n```', 'M'), undefined)
    assert.equal(parseSpecReply('```json\n{"pages":[],"screens":{}}\n```', 'M'), undefined, '근거 문서가 없으면 요약이 아니다')
    assert.equal(parseSpecReply('```json\n{"pages":[{"id":"1","version":1}],"screens":[]}\n```', 'M'), undefined)

    const dir = mkdtempSync(join(tmpdir(), 'spec-'))
    try {
      const file = join(dir, 'spec', 'menu.json')
      writeDigest(file, reply.digest)
      assert.deepEqual(readDigest(file), reply.digest)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

function deps(overrides: Partial<BatchDeps> = {}) {
  const events: DraftEvent[] = []
  const recorded: string[] = []
  const metas: Record<string, SectionMeta> = {}
  const base: BatchDeps = {
    targets: ['08-menu/01-list.md', '08-menu/02-create.md', '08-menu/03-view.md', '08-menu/04-edit.md'],
    concurrency: 2,
    runSpec: async () => digest,
    readMeta: (t) => metas[t] ?? {},
    runScreen: async () => ({ ok: true, changed: true, todos: 1 }),
    recordRefresh: (t) => recorded.push(t),
    onEvent: (e) => events.push(e),
    isCancelled: () => false,
    ...overrides,
  }
  return { base, events, recorded, metas }
}

describe('최신화 진행', () => {
  it('근거가 같은 화면은 건너뛰고, 나머지는 동시에 최대 concurrency개씩', async () => {
    let running = 0
    let peak = 0
    const briefs: Record<string, string> = {}
    const { base, events, recorded, metas } = deps({
      runScreen: async (target, brief) => {
        briefs[target] = brief
        peak = Math.max(peak, ++running)
        await new Promise((r) => setTimeout(r, 10))
        running--
        return target.endsWith('03-view.md') ? { ok: true, changed: false } : { ok: true, changed: true, todos: 2 }
      },
    })
    metas['08-menu/04-edit.md'] = { refreshedFrom: current }
    const { screens } = await runRefreshBatch(base)
    assert.equal(peak, 2)
    assert.deepEqual(
      screens.map((s) => s.status),
      ['done', 'done', 'unchanged', 'skipped'],
    )
    assert.match(briefs['08-menu/01-list.md'], /List: Total, Search/)
    assert.deepEqual(recorded.sort(), ['08-menu/01-list.md', '08-menu/02-create.md', '08-menu/03-view.md'], '바꿀 것이 없던 화면도 확인했으니 기록')
    assert.deepEqual(
      events.filter((e) => e.kind === 'phase').map((e) => (e as { phase: string }).phase),
      ['spec', 'screens', 'done'],
    )
    const firstScreen = events.filter((e) => e.kind === 'screen' && e.target === '08-menu/01-list.md').map((e) => (e as { status: string }).status)
    assert.deepEqual(firstScreen, ['waiting', 'running', 'done'])
  })

  it('force면 근거가 같아도 한다', async () => {
    const { base, metas } = deps({ force: true })
    for (const t of base.targets) metas[t] = { refreshedFrom: current }
    const { screens } = await runRefreshBatch(base)
    assert.ok(screens.every((s) => s.status === 'done'))
  })

  it('기획서 요약에 실패하면 경고하고 모든 화면을 하되, 버전은 기록하지 않는다', async () => {
    const { base, events, recorded, metas } = deps({
      runSpec: async () => {
        throw new Error('Confluence 없음')
      },
    })
    metas['08-menu/04-edit.md'] = { refreshedFrom: current }
    const { screens, digest: d } = await runRefreshBatch(base)
    assert.equal(d, undefined)
    assert.ok(screens.every((s) => s.status === 'done'))
    assert.deepEqual(recorded, [])
    assert.ok(events.some((e) => e.kind === 'warning' && /Confluence 없음/.test(e.text)))
  })

  it('실패한 화면은 기록하지 않고 다른 화면은 계속한다', async () => {
    const { base, recorded } = deps({
      runScreen: async (target) => {
        if (target.endsWith('02-create.md')) return { ok: false, changed: false, text: '세션 만료' }
        if (target.endsWith('03-view.md')) throw new Error('crash')
        return { ok: true, changed: true }
      },
    })
    const { screens } = await runRefreshBatch(base)
    assert.deepEqual(
      screens.map((s) => [s.status, s.text]),
      [
        ['done', undefined],
        ['failed', '세션 만료'],
        ['failed', 'crash'],
        ['done', undefined],
      ],
    )
    assert.deepEqual(recorded.sort(), ['08-menu/01-list.md', '08-menu/04-edit.md'])
  })

  it('취소하면 기다리던 화면은 시작하지 않는다', async () => {
    let cancelled = false
    const started: string[] = []
    const { base } = deps({
      concurrency: 1,
      isCancelled: () => cancelled,
      runScreen: async (target) => {
        started.push(target)
        cancelled = true
        return { ok: false, changed: false, text: 'killed' }
      },
    })
    const { screens } = await runRefreshBatch(base)
    assert.deepEqual(started, ['08-menu/01-list.md'])
    assert.ok(screens.every((s) => s.status === 'cancelled'))
  })

  it('요약이 실패하면 묻고, 중지하면 화면을 돌리지 않는다', async () => {
    const asked: string[] = []
    const ran: string[] = []
    const { base } = deps({
      runSpec: async () => {
        throw new Error('턴 상한')
      },
      runScreen: async (t) => (ran.push(t), { ok: true, changed: true }),
      onSpecFailed: async (m) => (asked.push(m), false),
    })
    const { screens } = await runRefreshBatch(base)
    assert.deepEqual(asked, ['턴 상한'])
    assert.deepEqual(ran, [])
    assert.ok(screens.every((s) => s.status === 'cancelled'))
  })

  it('요약 실패 뒤 계속을 고르면 요약 없이 모든 화면을 돌린다', async () => {
    const ran: string[] = []
    const { base, events } = deps({
      runSpec: async () => {
        throw new Error('턴 상한')
      },
      runScreen: async (t, brief) => (ran.push(t + (brief ? ' +brief' : '')), { ok: true, changed: true }),
      onSpecFailed: async () => true,
    })
    await runRefreshBatch(base)
    assert.equal(ran.length, 4)
    assert.ok(ran.every((r) => !r.endsWith('+brief')))
    assert.ok(events.some((e) => e.kind === 'warning' && /요약 없이/.test(e.text)))
  })
})
