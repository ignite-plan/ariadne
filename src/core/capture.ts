// shots.ts를 순회하며 STG BO를 캡처하고, 기존 이미지와 픽셀 비교해 바뀐 것을 골라낸다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pixelmatch from 'pixelmatch'
import type { Page } from 'playwright'
import { PNG } from 'pngjs'
import { DEFAULT_VIEWPORT, loadManual, manualDir, type ManualRef, type Viewport } from './manual.ts'
import { clearSession, defaultProfileDir, profileTab, requireSession, type OpenTab } from './session.ts'
import type { Shot } from './shot.ts'
import { gotoStg, isSessionExpired } from './stg-url.ts'

export interface CaptureOptions extends ManualRef {
  // 없으면 manual.yaml capture.baseUrl
  baseUrl?: string
  // 없으면 manual.yaml capture.viewport, 그것도 없으면 1440x900
  viewport?: Viewport
  // 로그인 세션(유지되는 Chrome 프로필). 기본 <root>/.auth/<manual>-profile
  profileDir?: string
  // 탭 여는 방법. 기본은 프로필로 Chrome을 단독으로 띄운다. 앱은 공유 Chrome의 탭을 넘긴다
  openTab?: OpenTab
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

// 화면 하나를 찍는다: 이동 → 준비 → 조작 → 가리고 찍기. pnpm capture와 앱의 캡처 저장(Claude save_shot)이 같이 쓴다
export async function shootShot(page: Page, baseUrl: string, shot: Omit<Shot, 'id' | 'manual'>, file: string) {
  await gotoStg(page, baseUrl, shot.path)
  await page.waitForLoadState('networkidle').catch(() => {})
  if (shot.ready) await page.locator(shot.ready).first().waitFor()
  if (shot.steps) {
    await shot.steps(page)
    await page.waitForLoadState('networkidle').catch(() => {})
  }
  const mask = shot.mask?.map((m) => page.locator(m))
  if (shot.clip) await page.locator(shot.clip).first().screenshot({ path: file, mask, animations: 'disabled' })
  else await page.screenshot({ path: file, mask, animations: 'disabled' })
}

export async function capture({
  baseUrl: baseUrlOption,
  viewport: viewportOption,
  profileDir,
  openTab,
  shots,
  only,
  threshold = 0.005,
  apply = true,
  onProgress,
  ...ref
}: CaptureOptions): Promise<CaptureReport> {
  const manual = loadManual(ref)
  const baseUrl = baseUrlOption || manual.capture?.baseUrl
  if (!baseUrl) throw new Error('캡처 대상 주소가 없습니다. manual.yaml capture.baseUrl을 지정하세요')
  const viewport = viewportOption ?? manual.capture?.viewport ?? DEFAULT_VIEWPORT
  const profile = profileDir ?? defaultProfileDir(ref)
  requireSession(profile)
  const targets = (shots ?? (await loadShots(ref))).filter((s) => !only || only.includes(s.id))
  const outDir = captureDir(ref)
  mkdirSync(outDir, { recursive: true })
  const imagesDir = join(manualDir(ref), 'images')

  const report: CaptureReport = { changed: [], unchanged: [], skipped: [], failed: [] }

  const { page, close } = await (openTab ?? profileTab(profile))({ viewport })
  try {
    for (const [index, shot] of targets.entries()) {
      onProgress?.({ id: shot.id, index, total: targets.length })
      if (shot.manual) {
        report.skipped.push(shot.id)
        continue
      }
      try {
        const file = join(outDir, `${shot.id}.png`)
        await shootShot(page, baseUrl, shot, file)

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
        if (isSessionExpired(error)) {
          clearSession(profile)
          break
        }
      }
    }
  } finally {
    await close()
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  return report
}
