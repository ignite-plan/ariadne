// 로컬 HTTP 서버를 가짜 BO로 두고 설치된 Chrome으로 실제 캡처한다. Chrome이 없으면 건너뛴다
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { adoptShots, capture, captureDir } from '../capture.ts'
import type { Shot } from '../shot.ts'
import { checkSession, markSession, openProfile, sessionInfo } from '../session.ts'
import { createFixture } from './fixture.ts'

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

describe('capture (Chrome)', { skip: !existsSync(chrome) && 'Chrome 없음' }, () => {
  const fx = createFixture()
  let color = '#2563eb'
  let server: http.Server
  let baseUrl = ''
  const profileDir = join(fx.ref.root, '.auth', 'demo-profile')

  before(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      // 세션이 끊기면 다른 origin(MPASS)의 로그인 페이지로 보낸다
      if (req.url?.startsWith('/admin/expired')) {
        res.statusCode = 302
        res.setHeader('Location', `http://localhost:${(server.address() as AddressInfo).port}/login`)
        return res.end()
      }
      if (req.url?.startsWith('/login')) return res.end('<!doctype html><h1>MPASS Login</h1>')
      res.end(`<!doctype html><html><body style="margin:0;font-family:sans-serif">
        <div id="root"><h1>Dealer Management</h1><p>Total 2</p>
        <div id="box" style="width:300px;height:120px;background:${color}"></div>
        <button onclick="document.getElementById('popup').hidden=false">Location</button>
        <div id="popup" role="dialog" hidden style="width:200px;height:80px;background:#fde68a">Location Information</div>
        </div></body></html>`)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/admin`
    markSession(profileDir, baseUrl)
  })
  after(async () => {
    await new Promise((resolve) => server.close(resolve))
    fx.cleanup()
  })

  const shots: Shot[] = [
    { id: 'dealer-list', path: '/dealer/company', ready: 'text=Total', clip: '#root' },
    {
      id: 'location-popup',
      path: '/dealer/company',
      ready: 'text=Total',
      steps: async (page) => {
        await page.getByRole('button', { name: 'Location' }).click()
        await page.getByText('Location Information').waitFor()
      },
      clip: '[role="dialog"]',
    },
    { id: 'manual-icon', path: '/dealer/company', manual: true },
  ]

  it('처음 찍으면 모두 바뀜(새 이미지), apply=false면 images는 그대로', async () => {
    const progress: string[] = []
    const report = await capture({
      ...fx.ref,
      baseUrl,
      profileDir,
      shots,
      apply: false,
      onProgress: (p) => progress.push(`${p.index + 1}/${p.total}:${p.id}`),
    })
    assert.deepEqual(report.changed, ['dealer-list', 'location-popup'])
    assert.deepEqual(report.skipped, ['manual-icon'])
    assert.deepEqual(report.failed, [])
    assert.deepEqual(progress, ['1/3:dealer-list', '2/3:location-popup', '3/3:manual-icon'])
    assert.ok(existsSync(join(captureDir(fx.ref), 'dealer-list.png')))
    assert.ok(!existsSync(join(fx.dir, 'images', 'dealer-list.png')))
    assert.deepEqual(JSON.parse(readFileSync(join(captureDir(fx.ref), 'report.json'), 'utf8')), report)
  })

  it('채택하면 images로 옮기고, 같은 화면을 다시 찍으면 그대로', async () => {
    adoptShots(fx.ref, ['dealer-list', 'location-popup'])
    const report = await capture({ ...fx.ref, baseUrl, profileDir, shots, apply: false })
    assert.deepEqual(report.changed, [])
    assert.deepEqual(report.unchanged, ['dealer-list', 'location-popup'])
  })

  it('화면이 바뀌면 그 이미지만 바뀜', async () => {
    color = '#dc2626'
    const report = await capture({ ...fx.ref, baseUrl, profileDir, shots, only: ['dealer-list', 'location-popup'] })
    assert.deepEqual(report.changed, ['dealer-list'])
    assert.deepEqual(report.unchanged, ['location-popup'])
  })

  it('로그인 페이지로 튕기면 세션 만료로 멈춘다', async () => {
    const report = await capture({
      ...fx.ref,
      baseUrl,
      profileDir,
      shots: [
        { id: 'expired', path: '/expired', ready: 'text=Total' },
        { id: 'dealer-list', path: '/dealer/company', ready: 'text=Total', clip: '#root' },
      ],
    })
    assert.equal(report.failed.length, 1)
    assert.match(report.failed[0].error, /^세션 만료: 로그인 페이지로 이동했습니다/)
    assert.deepEqual(report.changed.concat(report.unchanged), [])
    // 로그인 표식을 지워 다음에는 로그인부터 하게 한다
    assert.equal(sessionInfo(profileDir).exists, false)
    await assert.rejects(capture({ ...fx.ref, baseUrl, profileDir, shots }), /STG 로그인 세션 없음/)
  })

  it('세션 확인: 살아 있으면 표식 시각을 갱신하고, 로그인 페이지로 튕기면 표식을 지운다', async () => {
    markSession(profileDir, baseUrl)
    const before = sessionInfo(profileDir).savedAt!
    await new Promise((r) => setTimeout(r, 20))
    const alive = await checkSession(profileDir, baseUrl)
    assert.equal(alive.valid, true)
    assert.ok(alive.savedAt! > before)
    // 다른 origin(MPASS) 로그인 페이지로 보내는 주소
    const expired = await checkSession(profileDir, `${baseUrl}/expired`)
    assert.equal(expired.valid, false)
    assert.equal(sessionInfo(profileDir).exists, false)
    // 표식이 없으면 브라우저를 열지 않고 없다고 한다
    assert.deepEqual(await checkSession(profileDir, baseUrl), { exists: false, valid: false })
    markSession(profileDir, baseUrl)
  })

  it('같은 프로필을 두 번 열면 다른 작업이 쓰고 있다고 알려 준다', async () => {
    const first = await openProfile(profileDir)
    try {
      await assert.rejects(openProfile(profileDir), /다른 STG 작업이 로그인 프로필을 쓰고 있습니다/)
    } finally {
      await first.context.close()
    }
    // 닫으면 다시 열 수 있다
    const again = await openProfile(profileDir)
    await again.context.close()
  })
})
