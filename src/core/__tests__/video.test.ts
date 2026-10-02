import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { isBlockedLabel } from '../safety.ts'
import { composeArgs } from '../video/compose.ts'
import { describeStep } from '../video/describe.ts'
import { FrameSlots } from '../video/recorder.ts'
import { applyVars, deleteVideo, listVideos, loadVideo, parseVideo, saveVideo, videoVars, type VideoScenario } from '../video/scenario.ts'
import { readingTime, toSrt, toVtt } from '../video/subtitles.ts'
import { wavDuration } from '../video/tts/index.ts'
import { createFixture } from './fixture.ts'

describe('subtitles', () => {
  const cues = [
    { start: 0, end: 2500, text: 'This screen lists dealers.' },
    { start: 2500, end: 3_725_042.4, text: 'Click Detail.' },
  ]

  it('SRT는 쉼표 ms, 1부터 번호', () => {
    assert.equal(
      toSrt(cues),
      '1\n00:00:00,000 --> 00:00:02,500\nThis screen lists dealers.\n\n2\n00:00:02,500 --> 01:02:05,042\nClick Detail.\n',
    )
  })

  it('VTT는 헤더와 점 ms', () => {
    assert.equal(
      toVtt(cues),
      'WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nThis screen lists dealers.\n\n00:00:02.500 --> 01:02:05.042\nClick Detail.\n',
    )
  })

  it('읽는 시간은 최소 2초, 15자/초', () => {
    assert.equal(readingTime('short'), 2000)
    assert.equal(readingTime('x'.repeat(60)), 4000)
  })
})

describe('FrameSlots', () => {
  it('프레임이 없는 구간은 직전 프레임으로 채우고, 끝까지 마지막 프레임을 늘린다', () => {
    const written: string[] = []
    const slots = new FrameSlots(1000, 10, (f) => written.push(f.toString()))
    slots.push(Buffer.from('a'), 1000)
    slots.push(Buffer.from('b'), 1300)
    slots.push(Buffer.from('c'), 1320) // 같은 슬롯 안에서 바로 바뀌면 b는 건너뛴다
    slots.finish(1600)
    assert.deepEqual(written, ['a', 'a', 'a', 'c', 'c', 'c'])
    assert.equal(slots.written, 6)
  })

  it('첫 프레임이 늦게 오면 그 프레임으로 앞을 채운다', () => {
    const written: string[] = []
    const slots = new FrameSlots(0, 10, (f) => written.push(f.toString()))
    slots.push(Buffer.from('a'), 200)
    slots.finish(300)
    assert.deepEqual(written, ['a', 'a', 'a'])
  })
})

describe('composeArgs', () => {
  it('음성 clip을 녹화 위치에 지연해 섞고 자막을 mov_text로 넣는다', () => {
    const args = composeArgs({
      video: 'screen.mp4',
      audio: [
        { file: 'a.wav', at: 0 },
        { file: 'b.wav', at: 2500.4 },
      ],
      srt: 'x.srt',
      durationMs: 6000,
      out: 'out.mp4',
    })
    const filter = args[args.indexOf('-filter_complex') + 1]
    assert.match(filter, /\[1:a\].*adelay=0:all=1\[a0\]/)
    assert.match(filter, /\[2:a\].*adelay=2500:all=1\[a1\]/)
    assert.match(filter, /\[a0\]\[a1\]amix=inputs=2:normalize=0/)
    const joined = args.join(' ')
    assert.ok(joined.includes('-map 0:v -map [aout] -c:a aac'))
    assert.ok(joined.includes('-map 3:s -c:s mov_text'))
    assert.deepEqual(args.slice(-5), ['-t', '6.000', '-movflags', '+faststart', 'out.mp4'])
  })

  it('음성·자막이 없으면 영상만 복사', () => {
    const args = composeArgs({ video: 'screen.mp4', audio: [], durationMs: 1000, out: 'out.mp4' })
    assert.ok(!args.includes('-filter_complex'))
    assert.ok(!args.includes('mov_text'))
    assert.equal(args.filter((a) => a === '-i').length, 1)
  })
})

describe('isBlockedLabel (영상)', () => {
  it('Discard와 정확히 Create인 버튼도 막고, Create New는 통과', () => {
    for (const label of ['Save Draft', 'Discard', 'Create', ' create ']) assert.ok(isBlockedLabel(label), label)
    for (const label of ['Create New', 'View', 'Location', 'OK', 'Active']) assert.ok(!isBlockedLabel(label), label)
  })
})

describe('시나리오 YAML', () => {
  const fx = createFixture()
  after(fx.cleanup)
  const scenario: VideoScenario = {
    id: 'dealer-list',
    title: 'Dealer List View',
    maskPersonal: true,
    scenes: [
      { say: 'Open the list.', steps: [{ open: '/dealer/company' }, { waitFor: { text: 'Total' } }] },
      { steps: [{ click: { role: 'button', name: 'Delete', within: { role: 'row', name: 'Video Test {stamp}' } } }] },
    ],
  }

  it('저장하면 id 없이 YAML로 쓰고, 읽으면 파일 이름이 id', () => {
    saveVideo(fx.ref, scenario)
    const text = readFileSync(join(fx.dir, 'videos', 'dealer-list.yaml'), 'utf8')
    assert.ok(text.startsWith('title: Dealer List View\n'))
    assert.ok(!/^id:/m.test(text))
    assert.deepEqual(loadVideo(fx.ref, 'dealer-list'), scenario)
    assert.deepEqual(listVideos(fx.ref), ['dealer-list'])
    deleteVideo(fx.ref, 'dealer-list')
    assert.deepEqual(listVideos(fx.ref), [])
  })

  it('형식이 틀리면 어디가 틀렸는지 알려 준다', () => {
    assert.throws(() => parseVideo('x', { title: 'X', scenes: [{ steps: [{ click: { nth: 1 } }] }] }), /scenes\.0\.steps\.0/)
    assert.throws(() => parseVideo('x', { title: 'X', scenes: [{ steps: [{ run: 'rm -rf /' }] }] }), /형식 오류/)
    assert.throws(() => parseVideo('x', { scenes: [] }), /title/)
    assert.throws(() => saveVideo(fx.ref, { ...scenario, id: '../x' }), /영문 소문자/)
  })

  it('장면 단계가 없으면 빈 배열', () => {
    assert.deepEqual(parseVideo('x', { title: 'X', scenes: [{ say: 'Hi' }] }).scenes, [{ say: 'Hi', steps: [] }])
  })

  it('{stamp}를 모든 문자열에서 바꾸고 모르는 변수는 둔다', () => {
    const vars = videoVars(new Date(2026, 9, 2, 8, 5))
    assert.deepEqual(vars, { stamp: '10020805' })
    const applied = applyVars(scenario, vars)
    assert.deepEqual(applied.scenes[1].steps[0], {
      click: { role: 'button', name: 'Delete', within: { role: 'row', name: 'Video Test 10020805' } },
    })
    assert.equal(applyVars('{unknown} {stamp}', vars), '{unknown} 10020805')
  })
})

describe('describeStep', () => {
  it('기획자가 읽는 문장', () => {
    assert.equal(describeStep({ open: '/dealer/company' }), '/dealer/company 화면 열기')
    assert.equal(describeStep({ click: { role: 'button', name: 'Location', nth: 1 } }), "'Location' 버튼 2번째 클릭")
    assert.equal(
      describeStep({ click: { role: 'button', name: 'Delete', within: { role: 'row', name: 'A' } } }),
      "'A' 행 안의 'Delete' 버튼 클릭",
    )
    assert.equal(describeStep({ type: { target: { placeholder: 'Dealer Name' }, text: 'X' } }), "'Dealer Name' 입력칸에 \"X\" 입력")
    assert.equal(describeStep({ choose: { target: { role: 'combobox' }, option: 'Active' } }), "선택 상자에서 'Active' 선택")
    assert.equal(describeStep({ waitFor: { text: 'Total' } }), "'Total' 글자 표시 기다림")
    assert.equal(describeStep({ pause: 1500 }), '1.5초 멈춤')
  })
})

describe('wavDuration', () => {
  const wav = (dataBytes: number, byteRate: number, sizeField = dataBytes, extra = 0) => {
    const buf = Buffer.alloc(44 + extra + dataBytes)
    buf.write('RIFF', 0, 'ascii')
    buf.write('WAVE', 8, 'ascii')
    buf.write('fmt ', 12, 'ascii')
    buf.writeUInt32LE(16, 16)
    buf.writeUInt32LE(byteRate, 28)
    let offset = 36
    if (extra) {
      buf.write('LIST', offset, 'ascii')
      buf.writeUInt32LE(extra - 8, offset + 4)
      offset += extra
    }
    buf.write('data', offset, 'ascii')
    buf.writeUInt32LE(sizeField, offset + 4)
    return buf
  }

  it('data 크기 / byteRate', () => {
    assert.equal(wavDuration(wav(48000, 96000)), 500)
    assert.equal(wavDuration(wav(96000, 96000, 96000, 26)), 1000)
  })

  it('스트리밍 WAV(크기 칸 0xFFFFFFFF)는 파일 끝까지', () => {
    assert.equal(wavDuration(wav(24000, 48000, 0xffffffff)), 500)
  })

  it('WAV가 아니면 오류', () => {
    assert.throws(() => wavDuration(Buffer.from('not a wav file at all, really')), /WAV/)
  })
})
