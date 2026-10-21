import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createFixture } from '../../../../src/core/__tests__/fixture.ts'
import { KOKORO_FILES, KOKORO_MODEL } from '../../../../src/core/video/tts/model.ts'
import { mediaResponse } from '../asset.ts'
import { downloadModel, modelStatus, type ModelProgress } from '../video-model.ts'
import { loadVideo, videoYaml } from '../../../../src/core/video/scenario.ts'
import { createVideo, newVideoId, readVideoYaml, videoInfos } from '../videos.ts'

describe('가이드 영상 목록·만들기', () => {
  const fx = createFixture()
  after(fx.cleanup)

  it('제목으로 id를 만들고, 겹치면 번호를 붙인다', () => {
    const first = createVideo(fx.ref, { title: 'Dealer List View', sections: ['02-dealer/01-list.md', '02-dealer/02-create.md'] })
    assert.equal(first.id, 'dealer-list-view')
    assert.deepEqual(first.scenes, [{ say: '', steps: [] }])
    assert.equal(newVideoId(fx.ref, 'Dealer List View'), 'dealer-list-view-2')
    assert.equal(createVideo(fx.ref, { title: 'Dealer List View' }).id, 'dealer-list-view-2')
    assert.throws(() => createVideo(fx.ref, { title: '  ' }), /제목/)
  })

  it('목록은 형식이 틀린 파일도 오류와 함께 보여 주고, 만든 영상이 있으면 경로를 준다', () => {
    writeFileSync(join(fx.dir, 'videos', 'broken.yaml'), 'title: Broken\nscenes:\n  - steps:\n      - run: x\n')
    mkdirSync(join(fx.ref.root, 'dist', 'videos'), { recursive: true })
    writeFileSync(join(fx.ref.root, 'dist', 'videos', 'dealer-list-view.mp4'), 'x')
    const infos = videoInfos(fx.ref)
    assert.deepEqual(
      infos.map((i) => [i.id, i.title, i.scenes, i.sections, Boolean(i.error)]),
      [
        ['broken', 'broken', 0, [], true],
        ['dealer-list-view', 'Dealer List View', 1, ['02-dealer/01-list.md', '02-dealer/02-create.md'], false],
        ['dealer-list-view-2', 'Dealer List View', 1, [], false],
      ],
    )
    assert.equal(infos[1].output?.mp4, 'dist/videos/dealer-list-view.mp4')
    assert.equal(infos[1].output?.vtt, 'dist/videos/dealer-list-view.vtt')
    assert.equal(infos[2].output, undefined)
  })

  it('YAML 가져오기: id는 파일 이름, 같은 id가 있으면 알리고 새로 넣을 id를 준다, 형식이 틀리면 이유', () => {
    const yaml = 'title: Post Management\nscenes:\n  - say: Hello.\n    steps:\n      - open: /post\n'
    const fresh = readVideoYaml(fx.ref, '/tmp/Post Management.yaml', yaml)
    assert.deepEqual([fresh.id, fresh.exists, fresh.freeId], ['post-management', false, 'post-management'])
    assert.deepEqual(fresh.scenario.scenes, [{ say: 'Hello.', steps: [{ open: '/post' }] }])
    const same = readVideoYaml(fx.ref, '/x/dealer-list-view.yml', yaml)
    assert.deepEqual([same.id, same.exists, same.freeId, same.scenario.id], ['dealer-list-view', true, 'dealer-list-view-3', 'dealer-list-view'])
    // 파일 이름이 한글뿐이면 제목으로
    assert.equal(readVideoYaml(fx.ref, '/x/게시판.yaml', yaml).id, 'post-management')
    assert.throws(() => readVideoYaml(fx.ref, '/x/a.yaml', 'title: [x'), /a\.yaml: YAML 문법 오류/)
    assert.throws(() => readVideoYaml(fx.ref, '/x/a.yaml', 'title: X\nscenes:\n  - steps:\n      - run: x\n'), /형식 오류/)
    // 내보낸 파일을 다시 가져오면 같은 시나리오
    const original = loadVideo(fx.ref, 'dealer-list-view')
    assert.deepEqual(readVideoYaml(fx.ref, '/x/dealer-list-view.yaml', videoYaml(original)).scenario, original)
  })
})

describe('음성 모델 받기', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ariadne-model-'))
  let server: http.Server
  let base = ''
  const requested: string[] = []
  let failOnce = 'onnx/model_quantized.onnx'

  before(async () => {
    server = http.createServer((req, res) => {
      const file = decodeURIComponent(req.url!.slice(1))
      requested.push(file)
      const body = Buffer.alloc(file.endsWith('.onnx') ? 3 << 20 : 10, 1)
      res.setHeader('Content-Length', String(body.length))
      // 처음 한 번은 중간에 끊는다
      if (file === failOnce) {
        failOnce = ''
        res.write(body.subarray(0, 1000))
        return res.destroy()
      }
      res.end(body)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })

  it('끊기면 깨진 파일을 남기지 않고, 다시 받으면 남은 파일만 받는다', async () => {
    const url = (file: string) => `${base}/${encodeURIComponent(file)}`
    await assert.rejects(downloadModel(dir, fetch, undefined, url))
    assert.equal(modelStatus(dir).ready, false)
    assert.ok(!existsSync(join(dir, KOKORO_MODEL, 'onnx/model_quantized.onnx.part')))
    assert.ok(existsSync(join(dir, KOKORO_MODEL, 'config.json')))

    requested.length = 0
    const progress: ModelProgress[] = []
    const status = await downloadModel(dir, fetch, (p) => progress.push(p), url)
    assert.deepEqual(requested, ['onnx/model_quantized.onnx'])
    assert.equal(status.ready, true)
    assert.equal(status.bytes, 3 * 10 + (3 << 20))
    assert.ok(progress.length >= 3, `${progress.length}`)
    assert.deepEqual(progress.at(-1), { file: 'onnx/model_quantized.onnx', index: KOKORO_FILES.length - 1, count: KOKORO_FILES.length, loaded: 3 << 20, total: 3 << 20 })
  })
})

describe('영상 파일 응답 (Range)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ariadne-asset-'))
  const file = join(dir, 'a.mp4')
  writeFileSync(file, Buffer.from('0123456789'))
  after(() => rmSync(dir, { recursive: true, force: true }))

  const text = async (res: Response) => Buffer.from(await res.arrayBuffer()).toString()

  it('Range가 없으면 전체, 있으면 206과 잘라 낸 내용', async () => {
    const all = mediaResponse(file, null)
    assert.equal(all.status, 200)
    assert.equal(all.headers.get('content-type'), 'video/mp4')
    assert.equal(await text(all), '0123456789')

    const part = mediaResponse(file, 'bytes=2-5')
    assert.equal(part.status, 206)
    assert.equal(part.headers.get('content-range'), 'bytes 2-5/10')
    assert.equal(await text(part), '2345')

    assert.equal(await text(mediaResponse(file, 'bytes=7-')), '789')
    assert.equal(await text(mediaResponse(file, 'bytes=-3')), '789')
    assert.equal(mediaResponse(file, 'bytes=20-').status, 416)
    assert.equal(readFileSync(file, 'utf8'), '0123456789')
  })
})
