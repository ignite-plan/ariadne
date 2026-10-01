// 리포의 manuals/<m>/shots.ts는 TS라 패키징된 앱에서 바로 import할 수 없다. esbuild로 묶어서 import한다
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { manualDir, sectionImages, loadManual, readSection, type ManualRef } from '../../../src/core/manual.ts'
import type { Shot } from '../../../src/core/shot.ts'

export async function loadShotsBundled(ref: ManualRef): Promise<Shot[]> {
  // esbuild는 불러오는 순간 ESBUILD_BINARY_PATH를 읽는다. main에서 경로를 정한 뒤에 불러오도록 늦춘다
  const { build } = await import('esbuild')
  const result = await build({
    entryPoints: [join(manualDir(ref), 'shots.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    // shots.ts는 playwright 타입만 쓴다 (type import는 지워진다). 값 import는 지원하지 않는다
    external: ['playwright'],
    logLevel: 'silent',
  })
  const dir = mkdtempSync(join(tmpdir(), 'ariadne-shots-'))
  const file = join(dir, 'shots.mjs')
  writeFileSync(file, result.outputFiles[0].text)
  try {
    const mod = (await import(pathToFileURL(file).href)) as { shots: Shot[] }
    return mod.shots
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// shot id → 그 이미지를 쓰는 섹션 경로
export function shotSections(ref: ManualRef) {
  const map = new Map<string, string[]>()
  for (const chapter of loadManual(ref).chapters) {
    for (const file of chapter.sections) {
      for (const id of sectionImages(readSection(ref, chapter, file))) {
        map.set(id, [...(map.get(id) ?? []), `${chapter.dir}/${file}`])
      }
    }
  }
  return map
}
