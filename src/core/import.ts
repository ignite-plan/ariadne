// 매뉴얼 Word를 장/절 Markdown, 이미지, manual.yaml, reference.docx로 나눈다.
// analyzeDocx는 아무것도 쓰지 않고 구조와 경고만 돌려준다 (앱의 가져오기 미리보기)
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import YAML from 'yaml'
import { loadManual, manualDir, saveManual, type Manual, type ManualRef } from './manual.ts'
import { makeReference } from './reference.ts'

export interface ImportedSection {
  title: string
  slug: string
  images: number
}

export interface ImportedChapter {
  no: number
  title: string
  slug: string
  introImages: number
  // 장 제목과 첫 절 사이 본문이 있으면 00-intro.md가 된다
  hasIntro: boolean
  sections: ImportedSection[]
}

export interface DocxAnalysis {
  // 표지에서 추정한 매뉴얼 제목
  title: string
  // 파일 이름의 _v1.2.3에서 추정. 없으면 1.0.0
  version: string
  // 장/절을 어디서 찾았는지
  structure: 'toc' | 'headings'
  chapters: ImportedChapter[]
  images: number
  warnings: string[]
}

export type ImportProgress = { phase: 'convert' | 'images' | 'write' | 'reference'; done?: number; total?: number }

export interface ImportOptions extends ManualRef {
  docx: string
  pandoc?: string
  title?: string
  version?: string
  output?: string
  capture?: Manual['capture']
  code?: Manual['code']
  // 일부 장만 가져온다. 기존 manual.yaml의 같은 장은 바꾸고 나머지는 둔다
  chapters?: number[]
  // 원본 Word를 manuals/<m>/source/에 복사
  keepSource?: boolean
  // reference.docx 생성 (기본 true)
  reference?: boolean
  onProgress?: (progress: ImportProgress) => void
}

export interface ImportResult extends DocxAnalysis {
  manual: string
  files: number
}

interface Drawing {
  crop: { l: number; t: number; r: number; b: number }
  widthIn: number
  ratio: number
}

interface TocEntry {
  level: 1 | 2
  title: string
}

interface ParsedChapter {
  no: number
  title: string
  slug: string
  intro: string[]
  sections: { title: string; slug: string; lines: string[] }[]
}

const EMU_PER_INCH = 914400

function runPandoc(pandoc: string, args: string[]) {
  return new Promise<void>((done, fail) => {
    const child = spawn(pandoc, args)
    let err = ''
    child.stderr.setEncoding('utf8').on('data', (d) => (err += d))
    child.on('error', (e) => fail(new Error(`pandoc 실행 실패 (${pandoc}): ${e.message}`)))
    child.on('close', (code) => (code === 0 ? done() : fail(new Error(`pandoc 변환 실패: ${err}`))))
  })
}

// pandoc은 Word의 자르기(srcRect)와 비율 변경을 버린다. 문서 순서대로 drawing 정보를 읽어 이미지에 다시 적용한다
function readDrawings(docx: string): Drawing[] {
  const documentXml = execFileSync('unzip', ['-p', docx, 'word/document.xml'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  return [...documentXml.matchAll(/<w:drawing>[\s\S]*?<\/w:drawing>/g)].map(([xml]) => {
    const extent = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"/)
    const cx = Number(extent?.[1] ?? 0)
    const cy = Number(extent?.[2] ?? 0)
    const rect = xml.match(/<a:srcRect([^>]*)\/>/)?.[1] ?? ''
    const edge = (k: string) => Math.max(0, Number(rect.match(new RegExp(`\\b${k}="(-?\\d+)"`))?.[1] ?? 0)) / 100000
    return {
      crop: { l: edge('l'), t: edge('t'), r: edge('r'), b: edge('b') },
      widthIn: cx / EMU_PER_INCH,
      ratio: cx ? cy / cx : 0,
    }
  })
}

// 자르기를 반영해 저장하고, 원본 표시 비율과 다르면(늘이기) 높이를 함께 돌려준다
function writeImage(src: string, dest: string, drawing: Drawing | undefined, pandocSize: string | undefined) {
  if (!drawing || !drawing.widthIn) {
    copyFileSync(src, dest)
    return pandocSize ?? ''
  }
  const { crop, widthIn, ratio } = drawing
  const png = PNG.sync.read(readFileSync(src))
  const x = Math.round(png.width * crop.l)
  const y = Math.round(png.height * crop.t)
  const width = Math.round(png.width * (1 - crop.l - crop.r))
  const height = Math.round(png.height * (1 - crop.t - crop.b))
  if (width === png.width && height === png.height) copyFileSync(src, dest)
  else {
    const out = new PNG({ width, height })
    PNG.bitblt(png, out, x, y, width, height, 0, 0)
    writeFileSync(dest, PNG.sync.write(out))
  }
  const stretched = Math.abs(height / width - ratio) / ratio > 0.03
  const size = `width=${widthIn.toFixed(2)}in`
  return stretched ? `{${size} height=${(widthIn * ratio).toFixed(2)}in}` : `{${size}}`
}

// PNG가 아닌 이미지(EMF, JPEG 등)는 자르기를 적용하지 못한다. 확장자를 지키고 그대로 복사한다
function isPng(path: string) {
  const head = readFileSync(path).subarray(0, 4)
  return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
}

function plain(text: string) {
  return text
    .replace(/\[\]\{[^}]*\}/g, '')
    .replace(/\{\.mark\}/g, '')
    .replace(/\]\(#[^)]*\)/g, '')
    .replace(/[*\\[\]#>•]/g, '')
    .replace(/^\s*-\s+/, '')
    .replace(/\s+\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// 원문 대소문자를 살린 제목
function titleCase(line: string) {
  return line
    .replace(/\[\]\{[^}]*\}/g, '')
    .replace(/\{\.mark\}/g, '')
    .replace(/[*\\[\]#>•]/g, '')
    .replace(/^\s*-\s+/, '')
    .trim()
    .replace(/^\d+\.\s*/, '')
    .replace(/\s+/g, ' ')
}

// 목차(TOC) 링크 줄로 장/절을 찾는다. 원본은 제목에 Heading 스타일을 쓰지 않은 곳이 많다
function structureFromToc(lines: string[], warnings: string[]) {
  const firstChapterLine = lines.findIndex((l) => /^# 1\./.test(l))
  if (firstChapterLine < 0) return undefined
  const toc: TocEntry[] = lines
    .slice(0, firstChapterLine)
    .filter((l) => l.startsWith('['))
    .map((l) => {
      const title = plain(l)
      return { level: /^\d+\./.test(title) ? 1 : 2, title }
    })
  if (!toc.some((e) => e.level === 1)) return undefined

  const starts: { entry: TocEntry; line: number }[] = []
  let cursor = firstChapterLine
  for (const entry of toc) {
    const found = lines.findIndex((l, i) => i >= cursor && plain(l) === entry.title)
    if (found < 0) {
      warnings.push(`목차의 "${entry.title}"를 본문에서 찾지 못해 앞 항목에 합쳤습니다`)
      continue
    }
    starts.push({ entry, line: found })
    cursor = found + 1
  }
  return { starts, firstChapterLine }
}

// 목차가 없으면 Word 제목 스타일(제목 1 → #, 제목 2 → ##)로 나눈다
function structureFromHeadings(lines: string[]) {
  const starts: { entry: TocEntry; line: number }[] = []
  lines.forEach((l, line) => {
    if (/^# \S/.test(l)) starts.push({ entry: { level: 1, title: plain(l) }, line })
    else if (/^## \S/.test(l) && starts.length) starts.push({ entry: { level: 2, title: plain(l) }, line })
  })
  return { starts, firstChapterLine: starts[0]?.line ?? lines.length }
}

function guessTitle(lines: string[], end: number) {
  const cover = lines
    .slice(0, end)
    .filter((l) => l.trim() && !l.startsWith('[') && !l.startsWith('!['))
    .map((l) => l.replace(/[*\\#>]/g, '').replace(/\{[^}]*\}/g, '').trim())
    .filter((l) => l && !/^table of contents?$/i.test(l) && !/^목차$/.test(l))
  return cover.at(-1) ?? 'User Manual'
}

export function guessVersion(docx: string) {
  return basename(docx).match(/v(\d+(?:\.\d+){1,3})/i)?.[1] ?? '1.0.0'
}

async function parseDocx(docx: string, pandoc: string, onProgress?: ImportOptions['onProgress']) {
  const source = resolve(docx)
  if (!existsSync(source)) throw new Error(`Word 파일이 없습니다: ${docx}`)
  const workDir = mkdtempSync(join(tmpdir(), 'manual-import-'))
  onProgress?.({ phase: 'convert' })
  await runPandoc(pandoc, [
    source,
    '-t', 'markdown-simple_tables-multiline_tables-grid_tables',
    '--wrap=none',
    `--extract-media=${workDir}`,
    '-o', join(workDir, 'full.md'),
  ])
  const warnings: string[] = []
  const drawings = readDrawings(source)

  let imageIndex = 0
  const lines = readFileSync(join(workDir, 'full.md'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\]\(([^)\s]+\/media\/[^)\s]+)\)/g, (_, src: string) => `](${src}#${imageIndex++})`))
  if (imageIndex !== drawings.length) {
    warnings.push(`이미지 수가 다릅니다 (본문 ${imageIndex}, Word 도형 ${drawings.length}). 일부 이미지는 자르기를 적용하지 못합니다`)
  }

  const fromToc = structureFromToc(lines, warnings)
  const { starts, firstChapterLine } = fromToc ?? structureFromHeadings(lines)
  if (!starts.some((s) => s.entry.level === 1)) {
    rmSync(workDir, { recursive: true, force: true })
    throw new Error('장을 찾지 못했습니다. 목차(1. 제목 형식)나 Word 제목 1 스타일이 필요합니다')
  }

  const chapters: ParsedChapter[] = []
  starts.forEach(({ entry, line }, i) => {
    const end = starts[i + 1]?.line ?? lines.length
    const body = lines.slice(line + 1, end)
    if (entry.level === 1) {
      const title = titleCase(lines[line])
      const no = Number(entry.title.match(/^\d+/)?.[0] ?? chapters.length + 1)
      chapters.push({ no, title, slug: slugify(title) || `chapter-${no}`, intro: body, sections: [] })
      return
    }
    const chapter = chapters.at(-1)
    if (!chapter) return
    const sectionTitle = titleCase(lines[line])
    chapter.sections.push({
      title: sectionTitle,
      slug: slugify(entry.title) || `section-${chapter.sections.length + 1}`,
      lines: body,
    })
  })

  const nos = chapters.map((c) => c.no)
  if (new Set(nos).size !== nos.length) warnings.push(`장 번호가 겹칩니다: ${nos.join(', ')}`)

  return {
    workDir,
    lines,
    drawings,
    chapters,
    warnings,
    structure: (fromToc ? 'toc' : 'headings') as DocxAnalysis['structure'],
    title: guessTitle(lines, firstChapterLine),
    version: guessVersion(source),
    images: imageIndex,
  }
}

const countImages = (lines: string[]) => lines.join('\n').match(/!\[[^\]]*\]\([^)]+#\d+\)/g)?.length ?? 0
const hasContent = (lines: string[]) => lines.some((l) => l.trim())

function summarize(parsed: Awaited<ReturnType<typeof parseDocx>>): DocxAnalysis {
  return {
    title: parsed.title,
    version: parsed.version,
    structure: parsed.structure,
    images: parsed.images,
    warnings: parsed.warnings,
    chapters: parsed.chapters.map((c) => ({
      no: c.no,
      title: c.title,
      slug: c.slug,
      introImages: countImages(c.intro),
      hasIntro: hasContent(c.intro),
      sections: c.sections.map((s) => ({ title: s.title, slug: s.slug, images: countImages(s.lines) })),
    })),
  }
}

export async function analyzeDocx(docx: string, pandoc = 'pandoc'): Promise<DocxAnalysis> {
  const parsed = await parseDocx(docx, pandoc)
  try {
    return summarize(parsed)
  } finally {
    rmSync(parsed.workDir, { recursive: true, force: true })
  }
}

const SHOTS_TEMPLATE = `import { defineShots } from '../../src/core/shot.ts'

// 화면 캡처 정의. id는 images/<id>.png, path는 manual.yaml capture.baseUrl 기준.
// 저장/삭제/발송/승인 버튼은 누르지 않는다. 예시는 manuals/bo/shots.ts
export const shots = defineShots([])
`

export async function importDocx({
  docx,
  pandoc = 'pandoc',
  title,
  version,
  output,
  capture,
  code,
  chapters: only,
  keepSource = false,
  reference = true,
  onProgress,
  ...ref
}: ImportOptions): Promise<ImportResult> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(ref.manual)) throw new Error('매뉴얼 id는 영문 소문자, 숫자, -만 쓸 수 있습니다')
  const parsed = await parseDocx(docx, pandoc, onProgress)
  const dir = manualDir(ref)
  try {
    const manualFile = join(dir, 'manual.yaml')
    const existing: Manual | undefined = existsSync(manualFile) ? loadManual(ref) : undefined
    // 키 순서가 manual.yaml 순서가 된다
    const manual: Manual = {
      title: title ?? existing?.title ?? parsed.title,
      version: version ?? existing?.version ?? parsed.version,
      ...((output ?? existing?.output) ? { output: output ?? existing?.output } : {}),
      ...((capture ?? existing?.capture) ? { capture: capture ?? existing?.capture } : {}),
      ...((code ?? existing?.code) ? { code: code ?? existing?.code } : {}),
      chapters: existing?.chapters ?? [],
    }

    mkdirSync(join(dir, 'images'), { recursive: true })
    const usedImages = new Set<string>()
    const totalImages = parsed.images
    let written = 0
    let files = 0

    const clean = (body: string[], sectionSlug: string) => {
      let unnamed = 0
      return body
        .map((l) => l.replace(/^(> ?)+/, ''))
        .map((l) => l.replace(/\[\]\{#[^}]*\}/g, ''))
        .map((l) => l.replace(/\[([^\]]*)\]\{\.mark\}/g, '$1'))
        .map((l) =>
          l.replace(
            /!\[([^\]]*)\]\(([^)#]+)#(\d+)\)(\{[^}]*\})?/g,
            (_, alt: string, src: string, index: string, pandocSize?: string) => {
              // Word가 자동 생성한 한글 대체 텍스트는 caption이 아니다
              const caption = /[가-힣]/.test(alt) ? '' : alt
              const base = caption ? slugify(caption) || `${sectionSlug}-img` : `${sectionSlug}-img-${++unnamed}`
              const png = isPng(src)
              const ext = png ? 'png' : src.split('.').pop()!.toLowerCase()
              let name = base
              const taken = (n: string) => usedImages.has(n) || existsSync(join(dir, 'images', `${n}.${ext}`))
              for (let n = 2; taken(name); n++) name = `${base}-${n}`
              usedImages.add(name)
              const dest = join(dir, 'images', `${name}.${ext}`)
              const size = png
                ? writeImage(src, dest, parsed.drawings[Number(index)], pandocSize)
                : (copyFileSync(src, dest), pandocSize ?? '')
              if (!png) parsed.warnings.push(`PNG가 아닌 이미지(${ext})는 그대로 넣었습니다: images/${name}.${ext}`)
              onProgress?.({ phase: 'images', done: ++written, total: totalImages })
              return `![${caption}](images/${name}.${ext})${size}`
            },
          ),
        )
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    const frontMatter = (sectionTitle: string) =>
      `---\n${YAML.stringify({ title: sectionTitle, routes: [], sources: [], i18nPrefix: [] }).trim()}\n---\n\n`

    onProgress?.({ phase: 'write' })
    for (const chapter of parsed.chapters) {
      if (only && !only.includes(chapter.no)) continue
      const chapterDir = `${String(chapter.no).padStart(2, '0')}-${chapter.slug}`
      mkdirSync(join(dir, chapterDir), { recursive: true })
      const sectionFiles: string[] = []
      const intro = clean(chapter.intro, chapter.slug)
      if (intro) {
        writeFileSync(join(dir, chapterDir, '00-intro.md'), frontMatter(chapter.title) + intro + '\n')
        sectionFiles.push('00-intro.md')
      }
      chapter.sections.forEach((section, i) => {
        const file = `${String(i + 1).padStart(2, '0')}-${section.slug}.md`
        writeFileSync(
          join(dir, chapterDir, file),
          frontMatter(section.title) + `## ${section.title}\n\n` + clean(section.lines, section.slug) + '\n',
        )
        sectionFiles.push(file)
      })
      files += sectionFiles.length
      manual.chapters = manual.chapters.filter((c) => c.dir !== chapterDir)
      manual.chapters.push({ title: chapter.title, dir: chapterDir, sections: sectionFiles })
    }
    manual.chapters.sort((a, b) => a.dir.localeCompare(b.dir))
    saveManual(ref, manual)

    if (!existsSync(join(dir, 'shots.ts'))) writeFileSync(join(dir, 'shots.ts'), SHOTS_TEMPLATE)
    const template = join(ref.root, 'manuals', 'bo', '_template.md')
    if (!existsSync(join(dir, '_template.md')) && existsSync(template)) copyFileSync(template, join(dir, '_template.md'))
    if (keepSource) {
      mkdirSync(join(dir, 'source'), { recursive: true })
      copyFileSync(resolve(docx), join(dir, 'source', basename(docx)))
    }
    if (reference) {
      onProgress?.({ phase: 'reference' })
      makeReference(resolve(docx), join(dir, 'reference.docx'))
    }
    return { ...summarize(parsed), manual: ref.manual, files }
  } finally {
    rmSync(parsed.workDir, { recursive: true, force: true })
  }
}
