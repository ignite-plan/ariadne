// 외부 도구 위치 찾기. Finder에서 띄운 앱은 PATH가 /usr/bin:/bin 정도라 Homebrew 경로를 직접 본다
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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
