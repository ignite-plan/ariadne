import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { composeArgs } from '../video/compose.ts'
import { MUTATING_LABEL } from '../video/director.ts'
import { FrameSlots } from '../video/recorder.ts'
import { readingTime, toSrt, toVtt } from '../video/subtitles.ts'

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

describe('MUTATING_LABEL', () => {
  it('저장/삭제/발송/승인 류만 막는다', () => {
    for (const label of ['Save', 'Save Draft', 'Delete', ' Send email', 'Approve', 'Submit', 'Register', 'Discard', 'Create']) {
      assert.ok(MUTATING_LABEL.test(label), label)
    }
    for (const label of ['Search', 'Reset', 'Create New', 'Detail', 'View', 'Location', 'Cancel', 'Saved filters']) {
      assert.ok(!MUTATING_LABEL.test(label), label)
    }
  })
})
