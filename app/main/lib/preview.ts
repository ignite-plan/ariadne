// 섹션 본문을 pandoc HTML로 렌더링한다. Word 빌드와 같은 엔진이라 미리보기와 결과가 어긋나지 않는다
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chapterNo, loadManual, sectionImages, type ManualRef } from '../../../src/core/manual.ts'
import { checkSections, stripComments } from '../../../src/core/word-check.ts'
import { assetUrl, type PreviewChapter } from '../../shared/api.ts'
import { readSectionDoc } from './sections.ts'

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// TODO 주석은 Word에서 사라지지만 미리보기에서는 눈에 띄게 보여 준다
export function preprocess(body: string) {
  return body.replace(/<!--\s*TODO\b[:\s]*([\s\S]*?)-->/g, (_, text: string) => {
    return `<span class="todo">TODO: ${escapeHtml(text.trim().replace(/\s+/g, ' '))}</span>`
  })
}

// images/<id>.png → ariadne://ws/manuals/<m>/images/<id>.png
export function rewriteImages(html: string, manual: string, versions: Map<string, number> = new Map()) {
  return html.replace(/(<img\b[^>]*\bsrc=")images\/([^"]+)"/g, (_, head: string, file: string) => {
    const id = file.replace(/\.png$/, '')
    return `${head}${assetUrl(`manuals/${manual}/images/${file}`, versions.get(id))}"`
  })
}

export function runPandoc(pandoc: string, markdown: string, args: string[] = []) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(pandoc, ['-f', 'markdown', '-t', 'html5', '--wrap=none', ...args])
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8').on('data', (d) => (out += d))
    child.stderr.setEncoding('utf8').on('data', (d) => (err += d))
    child.on('error', (e) => reject(new Error(`pandoc 실행 실패 (${pandoc}): ${e.message}`)))
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`pandoc 실패: ${err}`))))
    child.stdin.end(markdown)
  })
}

// word: Word와 같은 내용으로 (TODO 등 주석은 뺀다). 아니면 TODO를 눈에 띄게 보여 준다
export async function renderSection(pandoc: string, manual: string, body: string, versions?: Map<string, number>, { word = false } = {}) {
  return rewriteImages(await runPandoc(pandoc, word ? stripComments(body) : preprocess(body)), manual, versions)
}

// 화면별 렌더 결과. 본문이 그대로면 다시 그리지 않는다 (편집 중에는 고친 화면만 다시 그린다)
export type PreviewCache = Map<string, { hash: string; html: string; issues: string[] }>

const hashOf = (text: string) => createHash('sha1').update(text).digest('hex')

// 여러 화면을 Word와 같은 순서·내용으로 (전체 미리보기). chapterDir가 있으면 그 장만.
// 화면마다 Word에 표기가 글자로 찍히는 곳(word-check)도 함께 돌려준다
export async function renderManualPreview({
  ref,
  pandoc,
  chapterDir,
  versions,
  cache,
  concurrency = 6,
}: {
  ref: ManualRef
  pandoc: string
  chapterDir?: string
  versions?: Map<string, number>
  cache: PreviewCache
  concurrency?: number
}): Promise<PreviewChapter[]> {
  const chapters = loadManual(ref).chapters.filter((c) => !chapterDir || c.dir === chapterDir)
  const jobs = chapters.flatMap((chapter) =>
    chapter.sections.map((file) => {
      const path = `${chapter.dir}/${file}`
      const doc = readSectionDoc(ref, path)
      return { path, title: doc.meta.title ?? file, body: doc.body.trim() }
    }),
  )
  const queue = [...jobs]
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      // 이미지를 다시 찍으면(버전이 바뀌면) 다시 그린다
      const hash = hashOf(`${job.body}\n${sectionImages(job.body).map((id) => versions?.get(id) ?? '').join(',')}`)
      if (cache.get(job.path)?.hash === hash) continue
      const html = await renderSection(pandoc, ref.manual, job.body, versions, { word: true })
      const issues = checkSections([{ section: job.path, body: job.body }], pandoc)[0]?.issues ?? []
      cache.set(job.path, { hash, html, issues })
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker))
  return chapters.map((chapter) => ({
    dir: chapter.dir,
    no: chapterNo(chapter),
    title: chapter.title,
    sections: jobs
      .filter((j) => j.path.startsWith(`${chapter.dir}/`))
      .map((j) => ({ path: j.path, title: j.title, html: cache.get(j.path)!.html, issues: cache.get(j.path)!.issues })),
  }))
}
