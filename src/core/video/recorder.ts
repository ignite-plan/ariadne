// page.screencast JPEG 프레임을 30fps H.264로 저장한다.
// 화면이 바뀔 때만 프레임이 오므로 timestamp로 슬롯을 계산해 직전 프레임을 반복해 채운다.
import { spawn } from 'node:child_process'
import type { Page } from 'playwright'
import type { Viewport } from '../manual.ts'

export interface Recording {
  // 녹화 기준 시각 (Date.now()). timeline의 0ms
  t0: number
  stop(): Promise<{ durationMs: number; frames: number }>
}

// 프레임 timestamp(epoch ms) → 고정 fps 슬롯. 테스트하려고 분리
export class FrameSlots {
  private last: Buffer | null = null
  private next = 0

  constructor(
    private readonly t0: number,
    private readonly fps: number,
    private readonly write: (frame: Buffer) => void,
  ) {}

  get written() {
    return this.next
  }

  push(frame: Buffer, timestamp: number) {
    this.fill(this.slot(timestamp), this.last ?? frame)
    this.last = frame
  }

  // end 시각까지 마지막 프레임으로 채운다
  finish(end: number) {
    if (this.last) this.fill(this.slot(end), this.last)
  }

  private slot(timestamp: number) {
    return Math.max(0, Math.round(((timestamp - this.t0) * this.fps) / 1000))
  }

  private fill(until: number, frame: Buffer) {
    for (; this.next < until; this.next++) this.write(frame)
  }
}

export async function startRecording(page: Page, file: string, { width, height }: Viewport, fps = 30): Promise<Recording> {
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      file,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  )
  let stderr = ''
  ffmpeg.stderr.on('data', (chunk) => (stderr += chunk))
  const exited = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', (error) => reject(new Error(`ffmpeg 실행 실패 (brew install ffmpeg): ${error.message}`)))
    ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg 녹화 실패: ${stderr.trim()}`))))
  })
  // 쓰기 순서를 지키고 backpressure를 따른다
  let queue = Promise.resolve()
  const write = (frame: Buffer) => {
    queue = queue.then(() => new Promise<void>((resolve) => (ffmpeg.stdin.write(frame) ? resolve() : ffmpeg.stdin.once('drain', resolve))))
  }

  const t0 = Date.now()
  const slots = new FrameSlots(t0, fps, write)
  await page.screencast.start({ size: { width, height }, quality: 90, onFrame: ({ data, timestamp }) => slots.push(data, timestamp) })

  return {
    t0,
    async stop() {
      const end = Date.now()
      await page.screencast.stop()
      slots.finish(end)
      await queue
      ffmpeg.stdin.end()
      await exited
      return { durationMs: end - t0, frames: slots.written }
    },
  }
}
