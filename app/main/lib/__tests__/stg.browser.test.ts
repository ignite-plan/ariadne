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
import { markSession, sessionInfo } from '../../../../src/core/session.ts'
import { loadManual } from '../../../../src/core/manual.ts'
import { loadVideo, saveVideo } from '../../../../src/core/video/scenario.ts'
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
  <input id="kw" placeholder="Search keyword">
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
      // 대화상자가 열려 있으면 그것만 준다 (뒤 화면은 생략), full이면 전체
      assert.equal(opened.scope, 'dialog')
      assert.doesNotMatch(opened.snapshot, /treeitem "Notice"/)
      const full = await session.fill('Menu name', '', { full: true })
      assert.equal(full.scope, 'page')
      assert.match(full.snapshot, /treeitem "Notice"/)
      const filled = await session.fill('Menu name', 'Sample')
      assert.match(filled.snapshot, /textbox "Menu name": Sample/)
    })

    it('입력칸이 없으면 기다리지 않고 지금 화면의 입력칸을 알려 준다. 접근성 트리 이름(placeholder)으로도 입력', async () => {
      await session.open('/menu')
      const started = Date.now()
      await assert.rejects(session.fill('Menu name (max 50)', 'x'), /"Menu name \(max 50\)" 입력칸이 없습니다\. 지금 화면의 입력칸: textbox "Search keyword"/)
      assert.ok(Date.now() - started < 3000, `바로 실패한다 (${Date.now() - started}ms)`)
      const filled = await session.fill('Search keyword', 'notice', { full: true })
      assert.match(filled.snapshot, /textbox "Search keyword": notice/)
    })

    it('저장/삭제 버튼은 누르지 않는다', async () => {
      await assert.rejects(session.click('button', 'Save'), /데이터를 바꿀 수 있는 버튼/)
      await assert.rejects(session.click('button', 'Delete'), /데이터를 바꿀 수 있는 버튼/)
    })

    it('같은 화면에서 누르면 달라진 줄만, 화면을 다시 열면 전체', async () => {
      const opened = await session.open('/menu')
      assert.equal(opened.changesOnly, false)
      const searched = await session.click('button', 'Search')
      assert.equal(searched.changesOnly, true)
      assert.match(searched.snapshot, /searched 200/)
      assert.doesNotMatch(searched.snapshot, /treeitem "Notice"/, '그대로인 줄은 다시 주지 않는다')
      const again = await session.click('button', 'Search', undefined, { full: true })
      assert.equal(again.changesOnly, false)
      assert.match(again.snapshot, /treeitem "Notice"/)
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
      assert.equal(sessionInfo(profileDir).exists, false, '로그인 표식을 지운다')
      markSession(profileDir, baseUrl)
      // 캡처 저장도 로그인 페이지를 찍지 않고 멈춘다
      await assert.rejects(session.saveShot({ id: 'expired-shot', path: '/expired' }), /세션 만료/)
      assert.equal(existsSync(join(fx.dir, 'images', 'expired-shot.png')), false)
      assert.doesNotMatch(readFileSync(join(fx.dir, 'shots.ts'), 'utf8'), /expired-shot/)
      assert.equal(sessionInfo(profileDir).exists, false)
      markSession(profileDir, baseUrl)
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

    it('장면 하나 채우기: 앞 장면을 재생해 열고, 그 장면만 저장한다', async () => {
      saveVideo(fx.ref, {
        id: 'menu',
        title: 'Menu Management',
        speed: 1.2,
        scenes: [
          { say: 'Open the menu.', steps: [{ open: '/menu' }, { click: { role: 'button', name: '+ Group Addition' } }] },
          { say: 'Close it.', steps: [{ click: { role: 'button', name: 'Cancel' } }] },
        ],
      })
      // 장면 1 다음(장면 2)에 넣는 작업
      const sceneMcp = await startAriadneMcp({
        ref: fx.ref,
        stg: () => (stg ??= new StgSession({ ...fx.ref, baseUrl, profileDir })),
        videoScene: { id: 'menu', index: 0, insert: true },
      })
      const sceneClient = new Client({ name: 'test-scene', version: '1.0.0' })
      await sceneClient.connect(
        new StreamableHTTPClientTransport(new URL(sceneMcp.url), { requestInit: { headers: { Authorization: `Bearer ${sceneMcp.token}` } } }),
      )
      const textOf = (r: unknown) => ((r as { content: { text: string }[] }).content[0].text)
      try {
        // 장면 1을 재생하면 팝업이 열린 화면에서 시작한다
        const opened = await sceneClient.callTool({ name: 'video_open_scene', arguments: { id: 'menu', scene: 1 } })
        assert.match(textOf(opened), /dialog "Menu Information"/)
        // 전체 저장은 막힌다
        const whole = await sceneClient.callTool({ name: 'video_save', arguments: { id: 'menu', yaml: 'title: X\nscenes: []\n' } })
        assert.equal(whole.isError, true)
        assert.match(textOf(whole), /장면 하나만 바꿉니다/)
        const first = await sceneClient.callTool({
          name: 'video_save_scene',
          arguments: { id: 'menu', yaml: 'say: Enter a menu name.\nsteps:\n  - type: { target: { label: Menu name }, text: Notice }\n' },
        })
        assert.match(textOf(first), /장면 2로 저장했습니다/)
        // 다시 저장하면 넣은 장면을 고친다 (또 넣지 않는다)
        await sceneClient.callTool({ name: 'video_save_scene', arguments: { id: 'menu', yaml: 'say: Type the menu name.\nsteps: []\n' } })
        const v = loadVideo(fx.ref, 'menu')
        assert.deepEqual(v.scenes.map((s) => s.say), ['Open the menu.', 'Type the menu name.', 'Close it.'])
        assert.equal(v.speed, 1.2, '시나리오 설정은 그대로')
        // 형식이 틀리면 저장하지 않는다
        const bad = await sceneClient.callTool({ name: 'video_save_scene', arguments: { id: 'menu', yaml: 'steps:\n  - run: x\n' } })
        assert.equal(bad.isError, true)
        assert.equal(loadVideo(fx.ref, 'menu').scenes.length, 3)
      } finally {
        await sceneClient.close()
        await sceneMcp.close()
      }
      // 장면 작업이 아닌 서버에서는 장면 저장을 거절한다
      const refused = await client.callTool({ name: 'video_save_scene', arguments: { id: 'menu', yaml: 'say: x\nsteps: []\n' } })
      assert.equal(refused.isError, true)
      // 뒤 테스트가 도구 호출 기록을 순서대로 본다
      events.length = 0
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
        'video_open_scene',
        'video_save',
        'video_save_scene',
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
