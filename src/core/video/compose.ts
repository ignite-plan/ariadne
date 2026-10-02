// 녹화 영상 + 내레이션 clip + 자막 → 최종 mp4 (h264 + aac + mov_text)
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export interface ComposeInput {
  video: string
  // 녹화 시작 기준 ms에 재생할 음성
  audio: { file: string; at: number }[]
  // 자막이 없으면 생략
  srt?: string
  durationMs: number
  out: string
  // 기본 PATH의 ffmpeg. 앱은 번들된 ffmpeg-static 경로를 넘긴다
  ffmpegPath?: string
}

export function composeArgs({ video, audio, srt, durationMs, out }: ComposeInput) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', video]
  for (const clip of audio) args.push('-i', clip.file)
  if (srt) args.push('-i', srt)
  const maps = ['-map', '0:v']
  if (audio.length) {
    const delayed = audio.map(
      (clip, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.max(0, Math.round(clip.at))}:all=1[a${i}]`,
    )
    const inputs = audio.map((_, i) => `[a${i}]`).join('')
    // normalize=0: 겹치지 않는 clip을 섞을 때 볼륨이 1/N로 줄지 않게 한다
    args.push('-filter_complex', `${delayed.join(';')};${inputs}amix=inputs=${audio.length}:normalize=0:duration=longest,apad[aout]`)
    maps.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '160k')
  }
  if (srt) maps.push('-map', `${audio.length + 1}:s`, '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng')
  args.push(...maps, '-c:v', 'copy')
  args.push('-t', (durationMs / 1000).toFixed(3), '-movflags', '+faststart', out)
  return args
}

export async function compose(input: ComposeInput) {
  await promisify(execFile)(input.ffmpegPath ?? 'ffmpeg', composeArgs(input), { maxBuffer: 16 * 1024 * 1024 }).catch((error: Error & { stderr?: string }) => {
    throw new Error(`ffmpeg 합성 실패: ${error.stderr?.trim() || error.message}`)
  })
}
