// 매뉴얼 Word를 장/절 Markdown, 이미지, manual.yaml, reference.docx로 나눈다.
// analyzeDocx는 아무것도 쓰지 않고 구조와 경고만 돌려준다 (앱의 가져오기 미리보기)
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { createBodyWriter } from './import/body.ts'
import { matchDrawings, readDrawings, runPandoc } from './import/docx.ts'
import { guessTitle, guessVersion, structureFromHeadings, structureFromToc, titleCase } from './import/structure.ts'
import { loadManual, manualDir, mergeManual, saveManual, serializeFrontMatter, type Manual, type ManualRef } from './manual.ts'
import { ID_PATTERN, ID_RULE, slugify } from './naming.ts'
import { makeReference } from './reference.ts'

export { matchDrawings, type Drawing } from './import/docx.ts'
export { guessVersion } from './import/structure.ts'

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

interface ParsedChapter {
  no: number
  title: string
  slug: string
  intro: string[]
  sections: { title: string; slug: string; lines: string[] }[]
}

async function parseDocx(docx: string, pandoc: string, onProgress?: ImportOptions['onProgress']) {
  const source = resolve(docx)
  if (!existsSync(source)) throw new Error(`Word 파일이 없습니다: ${docx}`)
  const workDir = mkdtempSync(join(tmpdir(), 'manual-import-'))
  try {
    return await parseInto(workDir, source, pandoc, onProgress)
  } catch (error) {
    rmSync(workDir, { recursive: true, force: true })
    throw error
  }
}

// workDir는 parseDocx가 정리한다. 성공하면 호출한 쪽(analyzeDocx/importDocx)이 지운다
async function parseInto(workDir: string, source: string, pandoc: string, onProgress?: ImportOptions['onProgress']) {
  onProgress?.({ phase: 'convert' })
  await runPandoc(pandoc, [
    source,
    '-t', 'markdown-simple_tables-multiline_tables-grid_tables',
    '--wrap=none',
    `--extract-media=${workDir}`,
    '-o', join(workDir, 'full.md'),
  ])
  const warnings: string[] = []
  const allDrawings = readDrawings(source)

  const imageSrcs: string[] = []
  const lines = readFileSync(join(workDir, 'full.md'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/\]\(([^)\s]+\/media\/[^)\s]+)\)/g, (_, src: string) => `](${src}#${imageSrcs.push(src) - 1})`))
  const drawings = matchDrawings(imageSrcs, allDrawings)
  const unmatched = drawings.filter((d) => !d).length
  if (unmatched) {
    warnings.push(`Word에서 자르기·크기 정보를 찾지 못한 이미지 ${unmatched}장은 원본 그대로 넣었습니다. 미리보기로 확인하세요`)
  }

  const fromToc = structureFromToc(lines, warnings)
  const { starts, firstChapterLine } = fromToc ?? structureFromHeadings(lines)
  if (!starts.some((s) => s.entry.level === 1)) {
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
    images: imageSrcs.length,
  }
}

const countImages = (lines: string[]) => lines.join('\n').match(/!\[[^\]]*\]\([^)]+#\d+\)/g)?.length ?? 0
const hasContent = (lines: string[]) => lines.some((l) => l.trim())

function summarize(parsed: Awaited<ReturnType<typeof parseInto>>): DocxAnalysis {
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
  if (!ID_PATTERN.test(ref.manual)) throw new Error(`매뉴얼 id는 ${ID_RULE}`)
  const parsed = await parseDocx(docx, pandoc, onProgress)
  const dir = manualDir(ref)
  try {
    const manualFile = join(dir, 'manual.yaml')
    const existing: Manual = existsSync(manualFile) ? loadManual(ref) : { title: parsed.title, version: parsed.version, chapters: [] }
    // 넘긴 값만 바꾸고 나머지(video 등)는 기존 manual.yaml 그대로
    const given = Object.entries({ title, version, output, capture, code }).filter(([, v]) => v !== undefined)
    const manual = mergeManual(existing, Object.fromEntries(given))

    mkdirSync(join(dir, 'images'), { recursive: true })
    let written = 0
    let files = 0
    const clean = createBodyWriter({
      imagesDir: join(dir, 'images'),
      drawings: parsed.drawings,
      warnings: parsed.warnings,
      onImage: () => onProgress?.({ phase: 'images', done: ++written, total: parsed.images }),
    })

    const frontMatter = (sectionTitle: string) => `${serializeFrontMatter({ title: sectionTitle })}\n`

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
