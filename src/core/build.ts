// manual.yaml 순서대로 Markdown을 합쳐 Word를 만든다.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chapterNo, loadManual, manualDir, outputName, readSection, stripFrontMatter, type ManualRef } from './manual.ts'

export interface BuildOptions extends ManualRef {
  // 빌드할 장 번호. 없으면 전체
  chapters?: number[]
  // 기본 <root>/dist
  outDir?: string
  // Finder에서 띄운 앱은 PATH에 /opt/homebrew/bin이 없어 절대 경로를 넘긴다
  pandoc?: string
}

export interface BuildResult {
  docx: string
  markdown: string
  // pandoc stderr (이미지 누락 등 경고)
  warnings: string
}

// 장 제목(H1)을 붙여 섹션을 이어 붙인 Markdown. front-matter는 뺀다
export function assembleMarkdown(ref: ManualRef, chapters?: number[]) {
  const manual = loadManual(ref)
  const targets = manual.chapters.filter((chapter) => !chapters || chapters.includes(chapterNo(chapter)))
  if (!targets.length) throw new Error(`빌드할 장이 없습니다: --chapters ${chapters?.join(',')}`)

  const body = targets
    .map((chapter) => {
      const sections = chapter.sections.map((file) => stripFrontMatter(readSection(ref, chapter, file)).trim())
      return [`# ${chapterNo(chapter)}. ${chapter.title}`, ...sections].join('\n\n')
    })
    .join('\n\n')
  return { manual, markdown: `---\ntitle: ${manual.title}\n---\n\n${body}\n` }
}

// 원본처럼 스크린샷에 accent1 테두리를 두른다. 인라인 아이콘(1in 미만)은 제외
const EMU_PER_INCH = 914400
export function addImageBorders(documentXml: string) {
  return documentXml.replace(/<pic:pic\b[\s\S]*?<\/pic:pic>/g, (pic) => {
    const cx = Number(pic.match(/<a:ext cx="(\d+)"/)?.[1] ?? 0)
    if (cx < EMU_PER_INCH) return pic
    return pic.replace(
      /<a:ln\b[^>]*>[\s\S]*?<\/a:ln>/,
      '<a:ln><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln>',
    )
  })
}

export function buildDocx({ chapters, outDir, pandoc = 'pandoc', ...ref }: BuildOptions): BuildResult {
  const { manual, markdown } = assembleMarkdown(ref, chapters)
  const dir = manualDir(ref)
  const distDir = outDir ?? resolve(ref.root, 'dist')
  mkdirSync(distDir, { recursive: true })
  const suffix = chapters ? `_ch${chapters.join('-')}` : ''
  const merged = join(distDir, `${ref.manual}${suffix}.md`)
  const docx = join(distDir, `${outputName(manual)}${suffix}.docx`)
  writeFileSync(merged, markdown)

  const result = spawnSync(
    pandoc,
    [
      merged,
      '-o', docx,
      '--toc',
      '--toc-depth=2',
      `--resource-path=${dir}`,
      `--reference-doc=${join(dir, 'reference.docx')}`,
    ],
    { encoding: 'utf8' },
  )
  if (result.error) throw new Error(`pandoc 실행 실패 (${pandoc}): ${result.error.message}`)
  if (result.status !== 0) throw new Error(`pandoc 실패 (exit ${result.status})\n${result.stderr}`)

  const work = mkdtempSync(join(tmpdir(), 'manual-build-'))
  try {
    execFileSync('unzip', ['-q', docx, 'word/document.xml', '-d', work])
    const docPath = join(work, 'word/document.xml')
    writeFileSync(docPath, addImageBorders(readFileSync(docPath, 'utf8')))
    execFileSync('zip', ['-q', docx, 'word/document.xml'], { cwd: work })
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  return { docx, markdown: merged, warnings: result.stderr }
}
