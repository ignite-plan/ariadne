// shots.ts를 순회하며 STG BO를 캡처하고, 기존 이미지와 픽셀 비교해 바뀐 것만 교체한다.
// usage: pnpm capture --manual bo [--only dealer-list,location-popup] [--threshold 0.005]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import type { Shot } from './shot.ts'

process.loadEnvFile()
const { values } = parseArgs({
  options: {
    manual: { type: 'string', default: 'bo' },
    only: { type: 'string' },
    threshold: { type: 'string', default: '0.005' },
  },
})
const baseUrl = process.env.BO_BASE_URL
if (!baseUrl) throw new Error('.env에 BO_BASE_URL이 없습니다')
const authFile = `.auth/${values.manual}.json`
if (!existsSync(authFile)) throw new Error(`${authFile} 없음. pnpm login --manual ${values.manual} 먼저 실행`)

const manualDir = resolve('manuals', values.manual!)
const { shots } = (await import(pathToFileURL(join(manualDir, 'shots.ts')).href)) as { shots: Shot[] }
const only = values.only?.split(',')
const targets = shots.filter((s) => !only || only.includes(s.id))

const outDir = resolve('.capture', values.manual!)
mkdirSync(outDir, { recursive: true })

// 0~1, 바뀐 픽셀 비율. 크기가 다르면 1
function diffRatio(a: string, b: string) {
  const left = PNG.sync.read(readFileSync(a))
  const right = PNG.sync.read(readFileSync(b))
  if (left.width !== right.width || left.height !== right.height) return 1
  const changed = pixelmatch(left.data, right.data, undefined, left.width, left.height, { threshold: 0.1 })
  return changed / (left.width * left.height)
}

const report = { changed: [] as string[], unchanged: [] as string[], skipped: [] as string[], failed: [] as { id: string; error: string }[] }

// 사내망에서 Playwright 브라우저 다운로드가 막혀 있어 설치된 Chrome을 쓴다
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  storageState: authFile,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'en-US',
})
const page = await context.newPage()

for (const shot of targets) {
  if (shot.manual) {
    report.skipped.push(shot.id)
    continue
  }
  try {
    await page.goto(new URL(shot.path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).href)
    if (!page.url().startsWith(new URL(baseUrl).origin)) throw new Error(`세션 만료로 보임: ${page.url()}`)
    await page.waitForLoadState('networkidle')
    if (shot.ready) await page.locator(shot.ready).first().waitFor()
    await shot.steps?.(page)
    const file = join(outDir, `${shot.id}.png`)
    const mask = shot.mask?.map((m) => page.locator(m))
    if (shot.clip) await page.locator(shot.clip).first().screenshot({ path: file, mask, animations: 'disabled' })
    else await page.screenshot({ path: file, mask, animations: 'disabled' })

    const current = join(manualDir, 'images', `${shot.id}.png`)
    if (existsSync(current) && diffRatio(current, file) <= Number(values.threshold)) {
      report.unchanged.push(shot.id)
      continue
    }
    copyFileSync(file, current)
    report.changed.push(shot.id)
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
    report.failed.push({ id: shot.id, error: message })
    if (message.startsWith('세션 만료')) break
  }
}

await browser.close()
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(
  `changed ${report.changed.length} / unchanged ${report.unchanged.length} / skipped ${report.skipped.length} / failed ${report.failed.length}`,
)
for (const { id, error } of report.failed) console.log(`  ✗ ${id}: ${error}`)
