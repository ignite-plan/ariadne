// 매뉴얼 목차·섹션·이미지·설정, 새 매뉴얼 가져오기, 미리보기, Word 만들기
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { nativeImage, shell } from 'electron'
import { buildDocx } from '../../../src/core/build.ts'
import { loadManual, mergeManual, saveManual } from '../../../src/core/manual.ts'
import { isPngBytes } from '../../../src/core/naming.ts'
import type { ManualConfig, ManualInfo } from '../../shared/api.ts'
import { analyzeInWorker, importInWorker } from '../importer.ts'
import * as gitOps from '../lib/git.ts'
import { renderManualPreview, renderSection, type PreviewCache } from '../lib/preview.ts'
import { clearReview, listReviews, readReview } from '../lib/review.ts'
import {
  collectTodos,
  createSection,
  deleteManual,
  importImage,
  listImages,
  listManuals,
  manualStats,
  moveChapter,
  moveSection,
  readSectionDoc,
  readTree,
  removeSection,
  resolveInside,
  suggestImageId,
  writeSectionDoc,
} from '../lib/sections.ts'
import { updateSettings } from '../settings.ts'
import { handle, pickPath, ref, requirePandoc, requireWorkspace, send } from './context.ts'

function manualInfos(root: string): ManualInfo[] {
  return listManuals(root).map((id) => {
    const m = loadManual({ root, manual: id })
    return { id, title: m.title, version: m.version, ...manualStats(root, id) }
  })
}

const settingsOf = ({ chapters: _chapters, ...config }: ReturnType<typeof loadManual>): ManualConfig => config

// 전체 미리보기 화면별 결과 (지금 매뉴얼)
let previewCache: { manual: string; sections: PreviewCache } = { manual: '', sections: new Map() }

export function registerManual() {
  handle('manual:list', () => manualInfos(requireWorkspace()))
  // 매뉴얼 하나를 통째로 지운다 (지금 매뉴얼은 안 됨). 제출해야 다른 사람에게 반영된다
  handle('manual:deleteManual', (id) => deleteManual(requireWorkspace(), id, ref().manual))
  handle('manual:config', () => settingsOf(loadManual(ref())))
  handle('manual:updateConfig', (patch) => {
    const r = ref()
    const next = mergeManual(loadManual(r), patch)
    saveManual(r, next)
    return settingsOf(next)
  })
  handle('manual:pickDocx', () =>
    pickPath({ title: '매뉴얼 Word 파일', properties: ['openFile'], filters: [{ name: 'Word', extensions: ['docx'] }] }),
  )
  handle('manual:analyzeDocx', (path) => analyzeInWorker(path, requirePandoc()))
  handle('manual:importDocx', async (input) => {
    const root = requireWorkspace()
    if (existsSync(join(root, 'manuals', input.id))) throw new Error(`이미 있는 매뉴얼 id입니다: ${input.id}`)
    const result = await importInWorker(
      {
        root,
        manual: input.id,
        docx: input.docx,
        pandoc: requirePandoc(),
        title: input.title.trim(),
        version: input.version.trim(),
        output: input.output.trim() || undefined,
        capture: {
          ...(input.capture.baseUrl.trim() ? { baseUrl: input.capture.baseUrl.trim() } : {}),
          viewport: input.capture.viewport,
        },
        code: input.code,
        keepSource: input.keepSource,
      },
      (progress) => send('import-progress', progress),
    )
    updateSettings({ manual: result.manual })
    return result.manual
  })
  handle('manual:tree', async () => {
    requireWorkspace()
    const r = ref()
    const modified = new Set((await gitOps.changes(r.root)).map((c) => c.path))
    return readTree(r, modified, new Set(listReviews(r)))
  })
  handle('manual:read', (path) => readSectionDoc(ref(), path))
  handle('manual:write', (path, body, meta) => writeSectionDoc(ref(), path, body, meta))
  handle('manual:create', (input) => createSection(ref(), input))
  handle('manual:remove', (path) => removeSection(ref(), path))
  handle('manual:moveChapter', (dir, toIndex) => [...moveChapter(ref(), dir, toIndex)])
  handle('manual:moveSection', (path, toIndex) => moveSection(ref(), path, toIndex).get(path) ?? path)
  handle('manual:todos', () => collectTodos(ref()))
  handle('manual:images', () => listImages(ref()))
  handle('manual:suggestImageId', (caption) => suggestImageId(ref(), caption))
  handle('manual:pickImageFile', () =>
    pickPath({
      title: '이미지 선택',
      properties: ['openFile'],
      filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'heic'] }],
    }),
  )
  handle('manual:importImage', ({ id, sourcePath, data }) => {
    // PNG가 아니면 macOS 이미지 디코더로 PNG로 바꾼다 (스크린샷 붙여넣기는 대부분 PNG)
    const raw = data ? Buffer.from(data) : sourcePath ? readFileSync(sourcePath) : undefined
    if (!raw) throw new Error('이미지가 없습니다')
    if (isPngBytes(raw)) return importImage(ref(), id, raw)
    const image = nativeImage.createFromBuffer(raw)
    if (image.isEmpty()) throw new Error('이미지를 읽지 못했습니다')
    return importImage(ref(), id, image.toPNG())
  })

  // Claude 변경 검토 (최신화가 고치기 직전 본문)
  handle('review:get', (path) => readReview(ref(), path) ?? null)
  handle('review:clear', (path) => clearReview(ref(), path))
  handle('preview:render', (_path, body, options) => {
    const r = ref()
    const versions = new Map(listImages(r).map((i) => [i.id, Math.round(i.mtime)]))
    return renderSection(requirePandoc(), r.manual, body, versions, options)
  })
  // 전체·장 미리보기. 화면별 결과는 본문이 같으면 다시 그리지 않는다 (매뉴얼을 바꾸면 비운다)
  handle('preview:manual', (chapterDir) => {
    const r = ref()
    if (previewCache.manual !== r.manual) previewCache = { manual: r.manual, sections: new Map() }
    const versions = new Map(listImages(r).map((i) => [i.id, Math.round(i.mtime)]))
    return renderManualPreview({ ref: r, pandoc: requirePandoc(), chapterDir, versions, cache: previewCache.sections })
  })

  handle('build:docx', (chapters) => {
    const { docx, warnings, issues } = buildDocx({ ...ref(), chapters, pandoc: requirePandoc() })
    return { docx, warnings, issues }
  })
  handle('build:open', async (path) => {
    const root = requireWorkspace()
    const error = await shell.openPath(resolveInside(root, relative(root, path)))
    if (error) throw new Error(error)
  })
}
