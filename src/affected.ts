// dealerhub-web의 두 ref 사이 변경을 매뉴얼 섹션에 매핑한다.
// usage: pnpm affected --manual bo --base release/2609-regular [--head release/2610-regular]
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, matchesGlob, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import YAML from 'yaml'

process.loadEnvFile()
const { values } = parseArgs({
  options: {
    manual: { type: 'string', default: 'bo' },
    base: { type: 'string' },
    head: { type: 'string', default: 'HEAD' },
    locale: { type: 'string', default: 'apps/hyundai-bo/src/locales/en.json' },
  },
})
if (!values.base) throw new Error('--base is required')
const repo = resolve(process.env.DEALERHUB_WEB_DIR ?? '../dealerhub-web')
const range = `${values.base}...${values.head}`

function git(...args: string[]) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

const changedFiles = git('diff', '--name-only', range).split('\n').filter(Boolean)
const changedKeys = [
  ...new Set(
    git('diff', '-U0', range, '--', values.locale!)
      .split('\n')
      .map((l) => l.match(/^[+-]\s*"([A-Z0-9_]+)"/)?.[1])
      .filter((k): k is string => Boolean(k)),
  ),
]

interface Section {
  title: string
  sources?: string[]
  i18nPrefix?: string[]
}

const manualDir = resolve('manuals', values.manual!)
const manual = YAML.parse(readFileSync(join(manualDir, 'manual.yaml'), 'utf8'))
const affected = []

for (const chapter of manual.chapters as { dir: string; sections: string[] }[]) {
  for (const file of chapter.sections) {
    const path = join(chapter.dir, file)
    const raw = readFileSync(join(manualDir, path), 'utf8')
    const meta: Section = YAML.parse(raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '{}')
    const files = changedFiles.filter((f) => meta.sources?.some((glob) => matchesGlob(f, glob)))
    const keys = changedKeys.filter((k) => meta.i18nPrefix?.some((p) => k.startsWith(p)))
    const images = [...raw.matchAll(/\]\(images\/([^)]+)\.png\)/g)].map((m) => m[1])
    if (files.length || keys.length) affected.push({ section: path, title: meta.title, files, keys, images })
  }
}

console.log(JSON.stringify({ range, affected }, null, 2))
