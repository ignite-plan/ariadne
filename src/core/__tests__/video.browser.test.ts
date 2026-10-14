// 로컬 HTTP 서버를 가짜 BO로 두고 설치된 Chrome으로 실제 녹화·합성한다. Chrome/ffmpeg가 없으면 건너뛴다
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { MASK_ATTR, overlayScript, renderVideo, StepError, videoWorkDir, type TtsProvider, type VideoScenario } from '../video/index.ts'
import { skipWithout, startFakeStg } from './browser.ts'
import { createFixture } from './fixture.ts'

const skip = skipWithout({ ffmpeg: true })

// 문장 길이와 상관없이 1초짜리 사인파
const fakeTts: TtsProvider = {
  key: 'fake',
  async synthesize(_text, file) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ar', '24000', file])
  },
}

function probe(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name:format=duration', '-of', 'json', file], {
    encoding: 'utf8',
  })
  return JSON.parse(out) as { streams: { codec_type: string; codec_name: string }[]; format: { duration: string } }
}

// at초 프레임의 (x, y) 주변 평균 밝기 0~255
function brightness(file: string, at: number, x: number, y: number) {
  const png = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(at), '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'])
  const img = PNG.sync.read(png)
  let sum = 0
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * img.width + (x + dx)) * 4
      sum += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3
    }
  }
  return sum / 25
}

describe('renderVideo (Chrome)', { skip }, () => {
  const fx = createFixture()
  const viewport = { width: 960, height: 600 }
  const posts: string[] = []
  let stg: Awaited<ReturnType<typeof startFakeStg>>
  let baseUrl = ''
  const profileDir = join(fx.ref.root, '.auth', 'demo-profile')

  before(async () => {
    stg = await startFakeStg((req, res) => {
      if (req.method === 'POST') {
        posts.push(req.url ?? '')
        return res.end('{}')
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(`<!doctype html><html><body style="margin:0;background:#fff;font-family:sans-serif">
        <div id="root"><h1>Dealer Management</h1><p>Total 2</p>
        <button onclick="document.getElementById('popup').hidden=false">Location</button>
        <button onclick="fetch('/api/dealer',{method:'POST'}).then(()=>document.getElementById('done').hidden=false)">Save</button>
        <button onclick="fetch('/api/dealer',{method:'POST'}).catch(()=>{}).finally(()=>document.getElementById('went').hidden=false)">Go</button>
        <div id="popup" role="dialog" hidden>Location Information</div>
        <div id="done" hidden>Saved</div><div id="went" hidden>Went</div>
        </div></body></html>`)
    }, { basePath: '/admin', profileDir })
    baseUrl = stg.baseUrl
  })
  after(async () => {
    await stg.close()
    fx.cleanup()
  })

  const options = () => ({ ...fx.ref, baseUrl, profileDir, viewport, outDir: 'out' })

  const scenario: VideoScenario = {
    id: 'dealer-list',
    title: 'Dealer List View',
    intro: 'Learn how to view the dealer list.',
    scenes: [
      { say: 'This screen lists all dealers.', steps: [{ open: '/dealer/company' }, { waitFor: { text: 'Total' } }] },
      {
        say: 'Click the Location button.',
        steps: [{ click: { role: 'button', name: 'Location' } }, { waitFor: { text: 'Location Information' } }],
      },
      { steps: [{ pause: 200 }] },
    ],
  }

  it('자막·음성·영상이 들어간 mp4를 만든다', async () => {
    const result = await renderVideo({ ...options(), id: scenario.id, scenario, tts: fakeTts })

    // 자막: intro + say 있는 장면 2개, 겹치지 않고 음성(1s) + 간격만큼 길다
    assert.deepEqual(
      result.cues.map((c) => c.text),
      ['Learn how to view the dealer list.', 'This screen lists all dealers.', 'Click the Location button.'],
    )
    for (const [i, cue] of result.cues.entries()) {
      assert.ok(cue.end - cue.start >= 1400, `cue ${i} ${cue.end - cue.start}ms`)
      if (i) assert.ok(cue.start >= result.cues[i - 1].end)
    }
    assert.ok(result.cues[0].end >= 2500, '시작 카드는 최소 2.5초')

    const info = probe(result.mp4!)
    assert.deepEqual(info.streams.map((s) => `${s.codec_type}:${s.codec_name}`).sort(), ['audio:aac', 'subtitle:mov_text', 'video:h264'])
    assert.ok(Math.abs(Number(info.format.duration) * 1000 - result.durationMs) < 300, `${info.format.duration}s vs ${result.durationMs}ms`)
    assert.match(readFileSync(result.srt!, 'utf8'), /^1\n00:00:00,000 --> /)
    assert.ok(readFileSync(result.vtt!, 'utf8').startsWith('WEBVTT'))

    // 자막 바가 영상에 그려졌다: 자막 중에는 하단 가운데가 어둡고, 끝난 뒤에는 흰 배경
    const screen = join(videoWorkDir(fx.ref, scenario.id), 'screen.mp4')
    const cue = result.cues[1]
    const y = viewport.height - 44 - 5
    assert.ok(brightness(screen, (cue.start + cue.end) / 2000, viewport.width / 2, y) < 90, '자막 중 어두움')
    assert.ok(brightness(screen, result.durationMs / 1000 - 0.2, viewport.width / 2, y) > 200, '자막 끝나면 밝음')
  })

  it('mutates가 아니면 Save를 누르지 못하고 쓰기 요청도 막는다. mutates면 실제로 요청한다', async () => {
    const make = (mutates: boolean, button: string): VideoScenario => ({
      id: `save-${mutates}`,
      title: 'Save',
      mutates,
      scenes: [{ say: 'Click.', steps: [{ open: '/dealer/company' }, { click: { role: 'button', name: button } }] }],
    })
    const run = { ...options(), tts: false as const, pace: 0.1 }
    await assert.rejects(renderVideo({ ...run, id: 'save-false', scenario: make(false, 'Save') }), /장면 1 단계 2 .*"Save"은\(는\) 데이터를 바꿀/)
    // 이름은 안전해 보여도 쓰기 요청이면 막는다
    const blocked = await renderVideo({ ...run, id: 'go-false', scenario: make(false, 'Go') })
    assert.deepEqual(posts, [])
    assert.equal(blocked.blockedRequests.length, 1)
    assert.match(blocked.blockedRequests[0], /^POST http.*\/api\/dealer$/)
    const result = await renderVideo({ ...run, id: 'save-true', scenario: make(true, 'Save') })
    assert.deepEqual(posts, ['/api/dealer'])
    assert.deepEqual(probe(result.mp4!).streams.map((s) => s.codec_type).sort(), ['subtitle', 'video'])
  })

  it('fromScene은 앞 장면을 녹화 없이 재생하고, preview는 파일을 만들지 않는다', async () => {
    const events: string[] = []
    const result = await renderVideo({
      ...options(),
      id: 'preview',
      scenario: {
        ...scenario,
        id: 'preview',
        scenes: [...scenario.scenes.slice(0, 2), { say: 'The popup shows the address.', steps: [{ waitFor: { text: 'Location Information' } }] }],
      },
      preview: true,
      headed: false,
      fromScene: 2,
      pace: 0.1,
      onProgress: (e) => events.push(`${e.stage}:${e.scene ?? '-'}:${e.step ?? '-'}`),
    })
    assert.equal(result.mp4, undefined)
    assert.deepEqual(result.cues.map((c) => c.text), ['The popup shows the address.'])
    assert.ok(events.includes('prepare:0:-') && events.includes('prepare:1:-') && events.includes('record:2:0'), events.join(' '))
    assert.ok(!existsSync(join(fx.ref.root, 'out', 'preview.mp4')))
  })

  it('실패한 단계의 장면·단계 번호를 알려 준다', async () => {
    const error = await renderVideo({
      ...options(),
      id: 'broken',
      scenario: {
        id: 'broken',
        title: 'Broken',
        scenes: [{ say: 'Hi.', steps: [{ open: '/dealer/company' }, { click: { role: 'button', name: 'Nope', exact: true } }] }],
      },
      tts: false,
      pace: 0.1,
      stepTimeout: 1500,
    }).catch((e: unknown) => e)
    assert.ok(error instanceof StepError, String(error))
    assert.equal(error.scene, 0)
    assert.equal(error.step, 1)
    assert.match(error.message, /^장면 1 단계 2 \('Nope' 버튼 클릭\): /)
  })
})

describe('overlay 자막 크기 (Chrome)', { skip: skipWithout() }, () => {
  it('배율만큼 자막 글자가 커지고 작아진다', async () => {
    const browser = await chromium.launch({ channel: 'chrome' })
    try {
      // 흰 화면 가운데 세로줄에서 어두운(자막 바탕) 줄 수 = 자막 바 높이
      const barHeight = async (captionScale: number) => {
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
        await page.addInitScript({ content: overlayScript({ captionScale }) })
        await page.route('http://fake.test/', (route) => route.fulfill({ contentType: 'text/html', body: '<body style="background:#fff"></body>' }))
        await page.goto('http://fake.test/')
        await page.evaluate(() => (window as unknown as { __ariadneVideo: { caption(t: string): void } }).__ariadneVideo.caption('Hello'))
        await page.waitForTimeout(400) // 자막 페이드
        const img = PNG.sync.read(await page.screenshot())
        await page.close()
        let rows = 0
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + img.width / 2) * 4
          if ((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3 < 110) rows++
        }
        return rows
      }
      const [small, medium, large] = [await barHeight(0.85), await barHeight(1), await barHeight(1.22)]
      assert.ok(small < medium && medium < large, `${small} < ${medium} < ${large}`)
      assert.ok(Math.abs(large / medium - 1.22) < 0.15, `${large / medium}`)
    } finally {
      await browser.close()
    }
  })
})

describe('overlay 개인정보 가리기 (Chrome)', { skip: skipWithout() }, () => {
  it('이메일·전화번호가 있는 요소에 mask 속성을 붙인다 (나중에 생긴 요소 포함)', async () => {
    const browser = await chromium.launch({ channel: 'chrome' })
    try {
      const page = await browser.newPage()
      await page.addInitScript({ content: overlayScript({ personal: true }) })
      await page.route('http://fake.test/', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<p id="a">dealer@example.com</p><p id="b">(416) 555-0199</p><p id="c">Dealer No. 41020</p><input id="d" value="x@y.co">',
        }),
      )
      await page.goto('http://fake.test/')
      const masked = (id: string) => page.locator(`#${id}`).evaluate((el, attr) => el.hasAttribute(attr), MASK_ATTR)
      await page.waitForFunction((attr) => document.querySelector('#a')?.hasAttribute(attr), MASK_ATTR)
      assert.deepEqual(await Promise.all(['a', 'b', 'c', 'd'].map(masked)), [true, true, false, true])
      await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<span id="e">call 905.555.0100</span>'))
      await page.waitForFunction((attr) => document.querySelector('#e')?.hasAttribute(attr), MASK_ATTR)
    } finally {
      await browser.close()
    }
  })
})
