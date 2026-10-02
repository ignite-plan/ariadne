// 녹화 timeline → SRT / WebVTT

export interface Cue {
  // 녹화 시작 기준 ms
  start: number
  end: number
  text: string
}

function stamp(ms: number, separator: ',' | '.') {
  const total = Math.max(0, Math.round(ms))
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  const h = Math.floor(total / 3_600_000)
  const m = Math.floor((total % 3_600_000) / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(total % 1000, 3)}`
}

export function toSrt(cues: Cue[]) {
  return cues
    .map((cue, i) => `${i + 1}\n${stamp(cue.start, ',')} --> ${stamp(cue.end, ',')}\n${cue.text}\n`)
    .join('\n')
}

export function toVtt(cues: Cue[]) {
  return `WEBVTT\n\n${cues.map((cue) => `${stamp(cue.start, '.')} --> ${stamp(cue.end, '.')}\n${cue.text}\n`).join('\n')}`
}

// 음성 없이 만들 때 자막을 읽을 시간. 영어 약 15자/초, 최소 2초
export function readingTime(text: string) {
  return Math.max(2000, Math.round((text.length / 15) * 1000))
}
