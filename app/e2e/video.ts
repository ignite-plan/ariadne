// 빌드된 앱(out/ 또는 --app 패키징 앱)으로 가이드 영상 기능을 끝까지 실행한다.
// 음성 모델을 net.fetch로 실제로 받고(약 90MB), worker(utilityProcess)에서 Kokoro·Playwright·ffmpeg로 영상을 만든다.
// usage: pnpm app:e2e:video [--app release/mac-arm64/Ariadne.app] [--models <이미 받은 모델 폴더>]
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { AriadneApi } from '../shared/api.ts'
import { launchApp, prepareUserData, startFakeBo, stepper } from './harness.ts'

const { values } = parseArgs({ options: { app: { type: 'string' }, models: { type: 'string' }, keep: { type: 'boolean' } } })

// 가짜 BO: 목록 → Location 팝업. Save는 쓰기 요청 (mutates가 아니면 막혀야 한다)
const posts: string[] = []
const bo = await startFakeBo((req, res) => {
  if (req.method === 'POST') {
    posts.push(req.url ?? '')
    return res.end('{}')
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><body style="margin:0;font-family:sans-serif;background:#fff"><div id="root">
    <h1>Dealer Management</h1><p>Total 2</p><p>owner@dealer.ca</p>
    <button onclick="document.getElementById('p').hidden=false">Location</button>
    <button onclick="fetch('/api/x',{method:'POST'})">Go</button>
    <div id="p" role="dialog" hidden style="padding:20px;background:#fde68a">Location Information</div></div></body>`)
})
const boBaseUrl = bo.baseUrl

// 작업 폴더: 지금 리포의 manuals/bo를 복사한 git 리포
const temp = mkdtempSync(join(tmpdir(), 'ariadne-video-e2e-'))
const userData = join(temp, 'user-data')
const workspace = join(temp, 'workspace')
const models = values.models ? resolve(values.models) : join(temp, 'models')
cpSync(resolve('manuals/bo'), join(workspace, 'manuals/bo'), { recursive: true })
writeFileSync(join(workspace, '.gitignore'), 'dist\n.video\n.video-cache\n')
mkdirSync(join(workspace, 'manuals/bo/videos'), { recursive: true })
writeFileSync(
  join(workspace, 'manuals/bo/videos/e2e.yaml'),
  `title: Dealer List View
intro: This video shows the dealer list.
maskPersonal: true
scenes:
  - say: The Dealer List screen shows all dealers.
    steps:
      - open: /dealer/company
      - waitFor: { text: Total }
  - say: Click the Location icon to see the address.
    steps:
      - click: { role: button, name: Location }
      - waitFor: { text: Location Information }
  - steps:
      - click: { role: button, name: Go }
      - pause: 500
`,
)
execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: workspace })
execFileSync('git', ['add', '-A'], { cwd: workspace })
execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@local', 'commit', '-q', '-m', 'init'], { cwd: workspace })
prepareUserData(userData, { settings: { workspaceDir: workspace, manual: 'bo' }, baseUrl: boBaseUrl })

const app = await launchApp({
  appPath: values.app,
  env: { ARIADNE_USER_DATA: userData, ARIADNE_CAPTURE_BASE_URL: boBaseUrl, ARIADNE_VIDEO_MODEL_DIR: models },
})
const page = await app.firstWindow()
const call = <T>(fn: (api: AriadneApi) => Promise<T>) =>
  page.evaluate(`(${fn.toString()})(window.ariadne)`) as Promise<T>

const step = stepper()

try {
  await step('환경 점검: ffmpeg는 앱에 들어 있음', async () => {
    const checks = await call((api) => api.env.check())
    const ffmpeg = checks.find((c) => c.id === 'ffmpeg')!
    assert.ok(ffmpeg.ok, ffmpeg.detail)
    if (values.app) assert.equal(ffmpeg.detail, '앱에 들어 있음')
    assert.ok(checks.find((c) => c.id === 'voice'))
  })

  await step('음성 모델 받기 (net.fetch)', async () => {
    const status = await call((api) => api.video.downloadModel())
    assert.ok(status.ready)
    assert.ok(status.bytes > 80e6, `${status.bytes}`)
  })

  await step('목록', async () => {
    const list = await call((api) => api.video.list())
    assert.deepEqual(list.map((v) => [v.id, v.scenes, Boolean(v.error)]).find((v) => v[0] === 'e2e'), ['e2e', 3, false])
  })

  await step('미리보기 (파일 없음)', async () => {
    const result = await call((api) => api.video.run('e2e', { preview: true }))
    assert.ok(result.ok, JSON.stringify(result))
    if (result.ok) {
      assert.equal(result.mp4, undefined)
      assert.equal(result.blockedRequests.length, 1)
    }
  })

  await step('영상 만들기 (Kokoro 내레이션 + 번들 ffmpeg)', async () => {
    const result = await call((api) => api.video.run('e2e', { tts: true }))
    assert.ok(result.ok, JSON.stringify(result))
    if (!result.ok) return
    assert.equal(result.mp4, 'dist/videos/e2e.mp4')
    assert.deepEqual(posts, [], '쓰기 요청은 막혀야 한다')
    const probe = JSON.parse(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', join(workspace, result.mp4!)], {
        encoding: 'utf8',
      }),
    ) as { streams: { codec_type: string }[] }
    assert.deepEqual(probe.streams.map((s) => s.codec_type).sort(), ['audio', 'subtitle', 'video'])
    assert.equal(result.cues.length, 3)
    const list = await call((api) => api.video.list())
    assert.equal(list.find((v) => v.id === 'e2e')?.output?.mp4, 'dist/videos/e2e.mp4')
  })

  await step('영상 Range 응답 (앞뒤로 옮겨 보기)', async () => {
    const res = await page.evaluate(async () => {
      const r = await fetch('ariadne://ws/dist/videos/e2e.mp4', { headers: { Range: 'bytes=0-99' } })
      return { status: r.status, range: r.headers.get('content-range'), length: (await r.arrayBuffer()).byteLength }
    })
    assert.equal(res.status, 206)
    assert.equal(res.length, 100)
    assert.match(res.range ?? '', /^bytes 0-99\/\d+$/)
  })

  await step('음성 듣기 (한 문장)', async () => {
    const clip = await call((api) => api.video.speak('Click Search to apply the filters.'))
    assert.ok(clip.ms > 1000, `${clip.ms}`)
    assert.ok(statSync(join(workspace, clip.path)).size > 10_000)
  })

  await step('실패한 장면·단계 번호', async () => {
    writeFileSync(
      join(workspace, 'manuals/bo/videos/broken.yaml'),
      'title: Broken\nscenes:\n  - say: Hi.\n    steps:\n      - open: /dealer/company\n      - waitFor: { text: Nope, exact: true }\n',
    )
    // 기본 15초를 기다린다
    const result = await call((api) => api.video.run('broken', { preview: true }))
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.scene, 0)
      assert.equal(result.step, 1)
      assert.match(result.error, /^장면 1 단계 2/)
    }
  })
} finally {
  await app.close()
  bo.close()
  if (values.keep) console.log(`작업 폴더: ${temp}`)
  else rmSync(temp, { recursive: true, force: true })
}
