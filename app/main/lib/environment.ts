// 외부 도구 위치 찾기. Finder에서 띄운 앱은 PATH가 /usr/bin:/bin 정도라 Homebrew 경로를 직접 본다
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const PANDOC_CANDIDATES = ['/opt/homebrew/bin/pandoc', '/usr/local/bin/pandoc', '/usr/bin/pandoc']

export function findPandoc(override?: string, candidates = PANDOC_CANDIDATES) {
  for (const path of override ? [override, ...candidates] : candidates) {
    if (!existsSync(path)) continue
    try {
      const version = execFileSync(path, ['--version'], { encoding: 'utf8' }).split('\n')[0]
      return { path, version }
    } catch {
      // 실행 불가면 다음 후보
    }
  }
  return null
}

export const FFMPEG_CANDIDATES = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']

// 가이드 영상용 ffmpeg. 앱에 들어 있는 ffmpeg-static을 먼저 쓴다.
// 패키징된 앱에서는 실행 파일이 app.asar.unpacked에 있다 (asar 안에서는 실행할 수 없음)
export function findFfmpeg(candidates = FFMPEG_CANDIDATES) {
  try {
    const bundled = (createRequire(import.meta.url)('ffmpeg-static') as string | null)?.replace(/app\.asar([/\\])/, 'app.asar.unpacked$1')
    if (bundled && existsSync(bundled)) return { path: bundled, bundled: true }
  } catch {
    // 개발 환경에서 ffmpeg-static 설치가 실패했으면 Homebrew를 본다
  }
  const path = candidates.find((p) => existsSync(p))
  return path ? { path, bundled: false } : null
}

export function findChrome() {
  const app = 'Google Chrome.app/Contents/MacOS/Google Chrome'
  return [join('/Applications', app), join(homedir(), 'Applications', app)].find((p) => existsSync(p)) ?? null
}

export function formatAge(ms: number) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}시간 전`
  return `${Math.round(hours / 24)}일 전`
}
