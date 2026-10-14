// 공유 Chrome 하나에서 Claude STG 탐색 탭과 영상 녹화 탭(다른 연결, CDP)이 동시에 도는지 가짜 STG로 확인한다
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { after, before, describe, it } from 'node:test'
import { skipWithout, startFakeStg } from '../../../../src/core/__tests__/browser.ts'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { cdpTab, profileTab } from '../../../../src/core/session.ts'
import { renderVideo, type VideoScenario } from '../../../../src/core/video/index.ts'
import { acquireExclusiveProfile, closeAllHosts, hostCount, hostTab, leaseEndpoint, leaseTab } from '../browser-host.ts'
import { StgSession } from '../stg.ts'

const skip = skipWithout({ ffmpeg: true })

const PAGE = `<!doctype html><html><head><title>Menu Management</title></head><body style="margin:0;font-family:sans-serif">
<h1>Menu Management</h1><p>Total 3</p>
<button onclick="fetch('/api/menus/1',{method:'PUT'}).catch(()=>{})">Go</button>
<button onclick="fetch('/api/dealer',{method:'POST'}).then(()=>document.getElementById('done').hidden=false)">Save</button>
<div id="done" hidden>Saved</div>
</body></html>`

describe('공유 Chrome (Chrome)', { skip }, () => {
  const fx = createFixture()
  const writes: string[] = []
  let fake: Awaited<ReturnType<typeof startFakeStg>>
  let baseUrl = ''
  const profileDir = join(fx.ref.root, 'stg-profile')

  before(async () => {
    fake = await startFakeStg((req, res) => {
      if (req.method !== 'GET') {
        writes.push(`${req.method} ${req.url}`)
        return res.end('{}')
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(PAGE)
    }, { basePath: '/ca', profileDir })
    baseUrl = fake.baseUrl
  })
  after(async () => {
    await closeAllHosts()
    await fake.close()
    fx.cleanup()
  })

  it('Claude 탐색과 영상 녹화(다른 연결)가 탭을 나눠 동시에 돌고, 쓰기 차단·자막은 탭마다 따로', async () => {
    const session = new StgSession({ ...fx.ref, baseUrl, profileDir, openTab: hostTab(profileDir) })
    const endpoint = await leaseEndpoint(profileDir)
    const scenario: VideoScenario = {
      id: 'save-menu',
      title: 'Save Menu',
      mutates: true,
      scenes: [
        { say: 'Open the menu screen.', steps: [{ open: '/menu' }, { waitFor: { text: 'Total' } }] },
        { say: 'Click Save.', steps: [{ click: { role: 'button', name: 'Save' } }, { waitFor: { text: 'Saved' } }] },
      ],
    }
    try {
      const video = renderVideo({
        ...fx.ref,
        id: scenario.id,
        scenario,
        baseUrl,
        profileDir,
        openTab: cdpTab(endpoint.url),
        viewport: { width: 960, height: 600 },
        outDir: 'out',
        tts: false,
        pace: 0.3,
      })
      // 녹화하는 동안 Claude 탭에서 화면을 열고 누른다
      const explored: string[][] = []
      for (let i = 0; i < 3; i++) {
        await session.open('/menu')
        explored.push((await session.click('button', 'Go')).blockedRequests)
      }
      const result = await video

      // 영상 탭: STG 저장 허용이라 POST가 나갔다. Claude 탭: 쓰기(PUT)는 모두 막혔다
      assert.deepEqual(writes, ['POST /api/dealer'])
      assert.ok(explored.flat().some((r) => /^PUT .*\/api\/menus\/1$/.test(r)), explored.flat().join('\n'))
      const size = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', result.mp4!], {
        encoding: 'utf8',
      }).trim()
      assert.equal(size, '960,600')
      // 자막 overlay는 영상 탭에만 들어간다
      const page = (session as unknown as { page: import('playwright').Page }).page
      assert.equal(await page.locator('ariadne-video-overlay').count(), 0)
      assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), [1440, 900])
    } finally {
      endpoint.release()
      await session.close()
    }
  })

  it('탭을 모두 돌려받으면 잠시 뒤 닫히고, 단독 작업은 공유 Chrome을 닫은 뒤 프로필로 Chrome을 띄운다', async () => {
    const tab = await leaseTab(profileDir, { width: 800, height: 600 })
    await tab.page.goto(`${baseUrl}/menu`)
    await tab.close()
    assert.equal(hostCount(), 1)
    await sleep(5500)
    assert.equal(hostCount(), 0)

    await (await leaseTab(profileDir, { width: 800, height: 600 })).close()
    assert.equal(hostCount(), 1)
    const release = await acquireExclusiveProfile(profileDir, 'STG 기록')
    try {
      assert.equal(hostCount(), 0)
      // 같은 프로필로 바로 띄워도 '이미 쓰는 중' 오류가 나지 않는다
      const own = await profileTab(profileDir)({ viewport: { width: 800, height: 600 } })
      await own.page.goto(`${baseUrl}/menu`)
      await own.close()
    } finally {
      release()
    }
  })
})
