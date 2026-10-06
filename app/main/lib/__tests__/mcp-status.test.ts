import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { needsConfluence } from '../../../shared/draft-mode.ts'
import type { McpStatus } from '../claude.ts'
import { createMcpStatusCache } from '../mcp-status.ts'

const ok: McpStatus[] = [{ name: 'mcp-atlassian-hmg', connected: true }]
const failed: McpStatus[] = [{ name: 'mcp-atlassian-hmg', connected: false, detail: 'timed out' }]
const isAtlassian = (s: McpStatus) => /atlassian/.test(s.name)

describe('Atlassian 연결 확인 기억', () => {
  it('연결되면 다시 묻지 않고 그때 시각을 준다. refresh면 다시 확인', async () => {
    let calls = 0
    let clock = 1000
    const cache = createMcpStatusCache(async () => (calls++, ok), isAtlassian, { now: () => clock })
    assert.deepEqual(await cache.get(), { servers: ok, checkedAt: 1000 })
    clock = 99_000_000
    assert.deepEqual(await cache.get(), { servers: ok, checkedAt: 1000 }, '시간이 지나도 기억')
    assert.equal(calls, 1)
    await cache.get(true)
    assert.equal(calls, 2)
  })

  it('실패나 오류는 기억하지 않는다', async () => {
    const results: (McpStatus[] | Error)[] = [failed, new Error('boom'), ok]
    let calls = 0
    const logged: string[] = []
    const cache = createMcpStatusCache(
      async () => {
        const r = results[calls++]
        if (r instanceof Error) throw r
        return r
      },
      isAtlassian,
      { onResult: ({ error }) => logged.push(error ? 'error' : 'ok') },
    )
    assert.deepEqual((await cache.get()).servers, failed)
    await assert.rejects(cache.get(), /boom/)
    assert.deepEqual((await cache.get()).servers, ok)
    assert.equal(calls, 3)
    await cache.get()
    assert.equal(calls, 3)
    assert.deepEqual(logged, ['ok', 'error', 'ok'])
  })

  it('동시에 여러 번 불러도 한 번만 확인한다', async () => {
    let calls = 0
    const cache = createMcpStatusCache(
      () => new Promise<McpStatus[]>((r) => setTimeout(() => (calls++, r(ok)), 20)),
      isAtlassian,
    )
    await Promise.all([cache.get(), cache.get(), cache.get(true)])
    assert.equal(calls, 1)
  })
})

describe('기획서가 필요한 작업', () => {
  it('장면 채우기는 안 쓰고, 영상 초안은 연결 화면이 없을 때만', () => {
    assert.equal(needsConfluence({ mode: 'video-scene', targets: ['a.md'] }), false)
    assert.equal(needsConfluence({ mode: 'video', targets: ['02-x/01-y.md'] }), false)
    assert.equal(needsConfluence({ mode: 'video', targets: [] }), true)
    assert.equal(needsConfluence({ mode: 'refresh' }), true)
    assert.equal(needsConfluence({ mode: 'create' }), true)
    assert.equal(needsConfluence({}), true)
  })
})
