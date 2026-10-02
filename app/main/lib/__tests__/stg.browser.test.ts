// 가짜 STG(메뉴 관리 화면)와 설치된 Chrome으로 StgSession과 Ariadne MCP를 검증한다
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { markSession } from '../../../../src/core/session.ts'
import { loadManual } from '../../../../src/core/manual.ts'
import { startAriadneMcp } from '../mcp.ts'
import { StgSession } from '../stg.ts'

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const PAGE = `<!doctype html><html><head><title>Menu Management</title></head><body style="margin:0;font-family:sans-serif">
<div id="root">
  <h1>Menu Management</h1>
  <p>Total 3</p>
  <ul role="tree"><li role="treeitem">Home</li><li role="treeitem">Notice</li></ul>
  <button id="add">+ Group Addition</button>
  <button id="del" onclick="fetch('/api/v1/menus/1',{method:'DELETE'})">Delete</button>
  <button id="search" onclick="fetch('/api/v1/menus/search',{method:'POST'}).then(r=>document.getElementById('st').textContent='searched '+r.status)">Search</button>
  <span id="st"></span>
  <div id="dlg" role="dialog" aria-label="Menu Information" hidden style="padding:20px;background:#fde68a">
    <h2>Menu Information</h2>
    <label>Menu name <input id="name"></label>
    <button onclick="fetch('/api/v1/menus',{method:'POST'}).then(()=>document.getElementById('st').textContent='saved').catch(()=>document.getElementById('st').textContent='save-blocked')">Save</button>
    <button onclick="document.getElementById('dlg').hidden=true">Cancel</button>
  </div>
</div>
<script>document.getElementById('add').onclick=()=>{document.getElementById('dlg').hidden=false}</script>
</body></html>`

describe('STG 세션과 Ariadne MCP (Chrome)', { skip: !existsSync(chrome) && 'Chrome 없음' }, () => {
  const fx = createFixture()
  const requests: string[] = []
  let server: http.Server
  let baseUrl = ''
  const profileDir = join(fx.ref.root, 'stg-profile')

  before(async () => {
    server = http.createServer((req, res) => {
      requests.push(`${req.method} ${req.url}`)
      if (req.url?.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json')
        return res.end('{}')
      }
      if (req.url?.startsWith('/ca/admin/expired')) {
        res.writeHead(302, { Location: `http://localhost:${(server.address() as AddressInfo).port}/login` })
        return res.end()
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(req.url?.startsWith('/login') ? '<h1>MPASS</h1>' : PAGE)
    })
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ca/admin`
    markSession(profileDir, baseUrl)
    writeFileSync(join(fx.dir, 'shots.ts'), "import { defineShots } from '../../src/core/shot.ts'\n\nexport const shots = defineShots([])\n")
    mkdirSync(join(fx.dir, 'images'), { recursive: true })
  })
  after(async () => {
    await new Promise((done) => server.close(done))
    fx.cleanup()
  })

  describe('StgSession', () => {
    const stg = () => new StgSession({ ...fx.ref, baseUrl, profileDir })
    let session: StgSession
    before(() => {
      session = stg()
    })
    after(() => session.close())

    it('화면을 열면 접근성 트리와 스크린샷을 준다', async () => {
      const result = await session.open('/menu')
      assert.equal(result.title, 'Menu Management')
      assert.match(result.snapshot, /button "\+ Group Addition"/)
      assert.match(result.snapshot, /treeitem "Notice"/)
      assert.ok(existsSync(result.screenshot))
    })

    it('팝업 열기, 입력', async () => {
      const opened = await session.click('button', '+ Group Addition')
      assert.match(opened.snapshot, /dialog "Menu Information"/)
      const filled = await session.fill('Menu name', 'Sample')
      assert.match(filled.snapshot, /textbox "Menu name": Sample/)
    })

    it('저장/삭제 버튼은 누르지 않는다', async () => {
      await assert.rejects(session.click('button', 'Save'), /데이터를 바꿀 수 있는 버튼/)
      await assert.rejects(session.click('button', 'Delete'), /데이터를 바꿀 수 있는 버튼/)
    })

    it('조회 POST는 통과, 쓰기 요청은 브라우저에서 막는다', async () => {
      const before = requests.length
      const result = await session.click('button', 'Search')
      assert.ok(requests.slice(before).includes('POST /api/v1/menus/search'))
      assert.deepEqual(result.blockedRequests, [])
      // 버튼 이름 검사를 우회해도(직접 fetch) 쓰기 요청은 서버에 닿지 않는다
      const page = (session as unknown as { page: import('playwright').Page }).page
      await page.evaluate(() => fetch('/api/v1/menus/1', { method: 'DELETE' }).catch(() => {}))
      await page.evaluate(() => fetch('/api/v1/menus', { method: 'POST' }).catch(() => {}))
      const after = await session.open('/menu')
      assert.ok(!requests.includes('DELETE /api/v1/menus/1'))
      assert.ok(!requests.includes('POST /api/v1/menus'))
      assert.ok(after.blockedRequests.some((r) => r.startsWith('DELETE ')))
    })

    it('STG 밖 주소와 세션 만료를 알려 준다', async () => {
      await assert.rejects(session.open('https://example.com/'), /STG 밖 주소/)
      await assert.rejects(session.open('/expired'), /세션 만료/)
    })

    it('캡처 저장: 단계를 새 페이지에서 재생해 찍고 shots.ts에 추가', async () => {
      const saved = await session.saveShot({
        id: 'menu-information-popup',
        path: '/menu',
        ready: 'text=Total',
        steps: [{ click: { role: 'button', name: '+ Group Addition' } }],
        clip: '[role="dialog"]',
      })
      assert.equal(saved.image, 'images/menu-information-popup.png')
      assert.ok(existsSync(saved.file))
      assert.match(readFileSync(join(fx.dir, 'shots.ts'), 'utf8'), /id: 'menu-information-popup'/)
      await assert.rejects(
        session.saveShot({ id: 'bad', path: '/menu', steps: [{ click: { role: 'button', name: 'Save' } }] }),
        /캡처 단계에 넣을 수 없습니다/,
      )
      await assert.rejects(session.saveShot({ id: 'Bad Id', path: '/menu' }), /영문 소문자/)
    })

    it('기존 이미지는 replace 없이 덮어쓰지 않고, replace면 이미지와 정의를 바꾼다', async () => {
      const file = join(fx.dir, 'images', 'menu-information-popup.png')
      const before = readFileSync(file)
      await assert.rejects(session.saveShot({ id: 'menu-information-popup', path: '/menu' }), /이미 있는 이미지 id/)
      assert.ok(readFileSync(file).equals(before))
      // 정의가 없던(원본 Word에서 온) 이미지도 replace로 정의를 채운다
      writeFileSync(join(fx.dir, 'images', 'imported-shot.png'), before)
      await session.saveShot({ id: 'imported-shot', path: '/menu', ready: 'text=Total', clip: '#root' }, true)
      await session.saveShot({ id: 'menu-information-popup', path: '/menu', ready: 'text=Total', clip: '#root' }, true)
      assert.ok(!readFileSync(file).equals(before), '전체 화면으로 다시 찍었다')
      const shots = readFileSync(join(fx.dir, 'shots.ts'), 'utf8')
      assert.equal(shots.match(/id: 'menu-information-popup'/g)?.length, 1)
      assert.match(shots, /id: 'imported-shot'/)
      assert.doesNotMatch(shots, /\+ Group Addition/, 'replace 전 steps는 사라진다')
    })
  })

  describe('Ariadne MCP 서버', () => {
    let mcp: Awaited<ReturnType<typeof startAriadneMcp>>
    let client: Client
    let stg: StgSession | undefined
    const events: string[] = []

    before(async () => {
      mcp = await startAriadneMcp({
        ref: fx.ref,
        stg: () => (stg ??= new StgSession({ ...fx.ref, baseUrl, profileDir })),
        onEvent: (e) => events.push(e.tool),
      })
      client = new Client({ name: 'test', version: '1.0.0' })
      await client.connect(
        new StreamableHTTPClientTransport(new URL(mcp.url), { requestInit: { headers: { Authorization: `Bearer ${mcp.token}` } } }),
      )
    })
    after(async () => {
      await client.close()
      await stg?.close()
      await mcp.close()
    })

    it('도구 목록', async () => {
      const { tools } = await client.listTools()
      assert.deepEqual(tools.map((t) => t.name).sort(), [
        'create_section',
        'manual_outline',
        'save_shot',
        'stg_click',
        'stg_fill',
        'stg_open',
        'video_check',
        'video_get',
        'video_save',
      ])
    })

    it('목차 → 새 장을 1장 위치에 만들기', async () => {
      const outline = await client.callTool({ name: 'manual_outline', arguments: {} })
      const info = JSON.parse((outline.content as { text: string }[])[0].text)
      assert.equal(info.manual, 'demo')
      assert.equal(info.chapters.length, 2)
      const created = await client.callTool({
        name: 'create_section',
        arguments: { title: 'Menu List View', newChapterTitle: 'Menu Management', chapterIndex: 0 },
      })
      const { path, file } = JSON.parse((created.content as { text: string }[])[0].text)
      assert.equal(path, '01-menu-management/01-menu-list-view.md')
      assert.ok(existsSync(file))
      assert.deepEqual(loadManual(fx.ref).chapters.map((c) => c.dir), ['01-menu-management', '02-login', '03-dealer'])
    })

    it('STG 도구: 열기, 누르기 거절은 오류 결과로', async () => {
      const opened = await client.callTool({ name: 'stg_open', arguments: { path: '/menu' } })
      assert.match((opened.content as { text: string }[])[0].text, /button "\+ Group Addition"/)
      const blocked = await client.callTool({ name: 'stg_click', arguments: { role: 'button', name: 'Delete' } })
      assert.equal(blocked.isError, true)
      const shot = await client.callTool({ name: 'save_shot', arguments: { id: 'menu-list', path: '/menu', ready: 'text=Total', clip: '#root' } })
      assert.equal(JSON.parse((shot.content as { text: string }[])[0].text).image, 'images/menu-list.png')
      assert.deepEqual(events, ['manual_outline', 'create_section', 'stg_open', 'stg_click', 'save_shot'])
    })

    it('토큰이 없으면 401', async () => {
      const res = await fetch(mcp.url, { method: 'POST', body: '{}' })
      assert.equal(res.status, 401)
    })
  })
})
