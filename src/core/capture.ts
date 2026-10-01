// shots.ts를 순회하며 STG BO를 캡처하고, 기존 이미지와 픽셀 비교해 바뀐 것을 골라낸다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { manualDir, type ManualRef } from './manual.ts'
import type { Shot } from './shot.ts'

export interface CaptureOptions extends ManualRef {
  baseUrl: string
  // 기본 <root>/.auth/<manual>.json
  authFile?: string
  // 없으면 manuals/<manual>/shots.ts를 import. 앱은 TS를 직접 import할 수 없어 미리 읽어 넘긴다
  shots?: Shot[]
  only?: string[]
  // 0~1, 이 비율 이하로 바뀌면 같은 이미지로 본다
  threshold?: number
  // false면 images/에 덮어쓰지 않고 .capture/에만 남긴다 (앱에서 검토 후 adoptShots)
  apply?: boolean
  onProgress?: (event: { id: string; index: number; total: number }) => void
}

export interface CaptureReport {
  changed: string[]
  unchanged: string[]
  skipped: string[]
  failed: { id: string; error: string }[]
}

export function defaultAuthFile({ root, manual }: ManualRef) {
  return resolve(root, '.auth', `${manual}.json`)
}

export function captureDir({ root, manual }: ManualRef) {
  return resolve(root, '.capture', manual)
}

export async function loadShots(ref: ManualRef) {
  const { shots } = (await import(pathToFileURL(join(manualDir(ref), 'shots.ts')).href)) as { shots: Shot[] }
  return shots
}

// 0~1, 바뀐 픽셀 비율. 크기가 다르면 1
export function diffRatio(a: string, b: string) {
  const left = PNG.sync.read(readFileSync(a))
  const right = PNG.sync.read(readFileSync(b))
  if (left.width !== right.width || left.height !== right.height) return 1
  const changed = pixelmatch(left.data, right.data, undefined, left.width, left.height, { threshold: 0.1 })
  return changed / (left.width * left.height)
}

// .capture/<manual>/<id>.png를 images/로 옮긴다
export function adoptShots(ref: ManualRef, ids: string[]) {
  for (const id of ids) {
    copyFileSync(join(captureDir(ref), `${id}.png`), join(manualDir(ref), 'images', `${id}.png`))
  }
}

export async function capture({
  baseUrl,
  authFile,
  shots,
  only,
  threshold = 0.005,
  apply = true,
  onProgress,
  ...ref
}: CaptureOptions): Promise<CaptureReport> {
  const auth = authFile ?? defaultAuthFile(ref)
  if (!existsSync(auth)) throw new Error(`${auth} 없음. 로그인 먼저 실행`)
  const targets = (shots ?? (await loadShots(ref))).filter((s) => !only || only.includes(s.id))
  const outDir = captureDir(ref)
  mkdirSync(outDir, { recursive: true })
  const imagesDir = join(manualDir(ref), 'images')
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  const report: CaptureReport = { changed: [], unchanged: [], skipped: [], failed: [] }

  // 사내망에서 Playwright 브라우저 다운로드가 막혀 있어 설치된 Chrome을 쓴다
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const context = await browser.newContext({
      storageState: auth,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: 'en-US',
    })
    const page = await context.newPage()

    for (const [index, shot] of targets.entries()) {
      onProgress?.({ id: shot.id, index, total: targets.length })
      if (shot.manual) {
        report.skipped.push(shot.id)
        continue
      }
      try {
        await page.goto(new URL(shot.path.replace(/^\//, ''), base).href)
        if (!page.url().startsWith(new URL(baseUrl).origin)) throw new Error(`세션 만료로 보임: ${page.url()}`)
        await page.waitForLoadState('networkidle')
        if (shot.ready) await page.locator(shot.ready).first().waitFor()
        await shot.steps?.(page)
        const file = join(outDir, `${shot.id}.png`)
        const mask = shot.mask?.map((m) => page.locator(m))
        if (shot.clip) await page.locator(shot.clip).first().screenshot({ path: file, mask, animations: 'disabled' })
        else await page.screenshot({ path: file, mask, animations: 'disabled' })

        const current = join(imagesDir, `${shot.id}.png`)
        if (existsSync(current) && diffRatio(current, file) <= threshold) {
          report.unchanged.push(shot.id)
          continue
        }
        if (apply) copyFileSync(file, current)
        report.changed.push(shot.id)
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
        report.failed.push({ id: shot.id, error: message })
        if (message.startsWith('세션 만료')) break
      }
    }
  } finally {
    await browser.close()
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  return report
}
