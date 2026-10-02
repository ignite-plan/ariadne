// 로컬 HTTP 서버를 가짜 BO로 두고 설치된 Chrome으로 실제 녹화·합성한다. Chrome/ffmpeg가 없으면 건너뛴다
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { PNG } from 'pngjs'
import { renderVideo, videoWorkDir, type TtsProvider, type VideoScenario } from '../video/index.ts'
import { createFixture } from './fixture.ts'

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
})()

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

describe('renderVideo (Chrome)', { skip: (!existsSync(chrome) && 'Chrome 없음') || (!hasFfmpeg && 'ffmpeg 없음') }, () => {
  const fx = createFixture()
  const viewport = { width: 960, height: 600 }
  const posts: string[] = []
  let server: http.Server
  let baseUrl = ''
  const authFile = join(fx.ref.root, '.auth', 'demo.json')

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        posts.push(req.url ?? '')
        return res.end('{}')
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(`<!doctype html><html><body style="margin:0;background:#fff;font-family:sans-serif">
        <div id="root"><h1>Dealer Management</h1><p>Total 2</p>
        <p class="email">dealer@example.com</p>
        <button onclick="document.getElementById('popup').hidden=false">Location</button>
        <button onclick="fetch('/api/dealer',{method:'POST'}).then(()=>document.getElementById('done').hidden=false)">Save</button>
        <div id="popup" role="dialog" hidden>Location Information</div>
        <div id="done" hidden>Saved</div>
        </div></body></html>`)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/admin`
    mkdirSync(join(fx.ref.root, '.auth'), { recursive: true })
    writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }))
  })
  after(async () => {
    await new Promise((resolve) => server.close(resolve))
    fx.cleanup()
  })

  const scenario: VideoScenario = {
    id: 'dealer-list',
    title: 'Dealer List View',
    intro: 'Learn how to view the dealer list.',
    mask: ['.email'],
    scenes: [
      { say: 'This screen lists all dealers.', do: async (v) => { await v.goto('/dealer/company'); await v.ready('text=Total') } },
      { say: 'Click the Location button.', do: async (v) => { await v.click(v.page.getByRole('button', { name: 'Location' })); await v.ready('text=Location Information') } },
      { do: async (v) => v.pause(200) },
    ],
  }

  it('자막·음성·영상이 들어간 mp4를 만든다', async () => {
    const result = await renderVideo({ ...fx.ref, id: scenario.id, scenario, baseUrl, authFile, viewport, tts: fakeTts, outDir: 'out' })

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

    const info = probe(result.mp4)
    assert.deepEqual(info.streams.map((s) => `${s.codec_type}:${s.codec_name}`).sort(), ['audio:aac', 'subtitle:mov_text', 'video:h264'])
    assert.ok(Math.abs(Number(info.format.duration) * 1000 - result.durationMs) < 300, `${info.format.duration}s vs ${result.durationMs}ms`)
    assert.match(readFileSync(result.srt, 'utf8'), /^1\n00:00:00,000 --> /)
    assert.ok(readFileSync(result.vtt, 'utf8').startsWith('WEBVTT'))

    // 자막 바가 영상에 그려졌다: 자막 중에는 하단 가운데가 어둡고, 끝난 뒤에는 흰 배경
    const screen = join(videoWorkDir(fx.ref, scenario.id), 'screen.mp4')
    const cue = result.cues[1]
    const y = viewport.height - 44 - 5
    assert.ok(brightness(screen, (cue.start + cue.end) / 2000, viewport.width / 2, y) < 90, '자막 중 어두움')
    assert.ok(brightness(screen, result.durationMs / 1000 - 0.2, viewport.width / 2, y) > 200, '자막 끝나면 밝음')
  })

  it('mutates가 아니면 Save를 누르지 못하고, mutates면 실제로 요청한다', async () => {
    const save = (mutates: boolean): VideoScenario => ({
      id: `save-${mutates}`,
      title: 'Save',
      mutates,
      scenes: [{ say: 'Click Save.', do: async (v) => { await v.goto('/dealer/company'); await v.click('text=Save'); await v.ready('text=Saved') } }],
    })
    const options = { ...fx.ref, baseUrl, authFile, viewport, tts: false as const, outDir: 'out', pace: 0.1 }
    await assert.rejects(renderVideo({ ...options, id: 'save-false', scenario: save(false) }), /scene 1 .*"Save" 버튼은 mutates: true/)
    assert.deepEqual(posts, [])
    const result = await renderVideo({ ...options, id: 'save-true', scenario: save(true) })
    assert.deepEqual(posts, ['/api/dealer'])
    assert.deepEqual(probe(result.mp4).streams.map((s) => s.codec_type).sort(), ['subtitle', 'video'])
  })
})
