// manual.yaml 순서대로 Markdown을 합쳐 Word를 만든다.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chapterNo, loadManual, manualDir, outputName, readSection, stripFrontMatter, type ManualRef } from './manual.ts'
import { checkSections, stripComments, type SectionIssue } from './word-check.ts'

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
  // Word에 Markdown 표기가 글자로 그대로 나오는 화면 (굵게·형광펜이 깨진 곳 등)
  issues: SectionIssue[]
}

// 장 제목(H1)을 붙여 섹션을 이어 붙인 Markdown. front-matter는 뺀다
export function assembleMarkdown(ref: ManualRef, chapters?: number[]) {
  const manual = loadManual(ref)
  const targets = manual.chapters.filter((chapter) => !chapters || chapters.includes(chapterNo(chapter)))
  if (!targets.length) throw new Error(`빌드할 장이 없습니다: --chapters ${chapters?.join(',')}`)

  const sections: { section: string; body: string }[] = []
  const body = targets
    .map((chapter) => {
      const bodies = chapter.sections.map((file) => {
        const text = stripFrontMatter(readSection(ref, chapter, file)).trim()
        sections.push({ section: `${chapter.dir}/${file}`, body: text })
        return text
      })
      return [`# ${chapterNo(chapter)}. ${chapter.title}`, ...bodies].join('\n\n')
    })
    .join('\n\n')
  return { manual, markdown: `---\ntitle: ${manual.title}\n---\n\n${body}\n`, sections }
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

// 이미지 가운데 정렬: {align=center}가 붙은 이미지 문단에 reference.docx의 가운데 정렬 그림 스타일(Figure)을 입힌다.
// pandoc은 이미지 정렬을 직접 지원하지 않는다. 목록 안 이미지도 목록 기호를 유지한 채 가운데가 된다.
// 형광펜 [글자]{.mark}는 pandoc이 그대로 Word 노란 형광펜(w:highlight yellow)으로 만든다
export const CENTER_FILTER = `
local function centered_image(content)
  if #content ~= 1 or content[1].t ~= 'Image' then return nil end
  local img = content[1]
  if img.attributes.align ~= 'center' then return nil end
  img.attributes.align = nil
  return img
end
local function wrap(block)
  local img = centered_image(block.content)
  if not img then return nil end
  return pandoc.Div({ pandoc.Para({ img }) }, { ['custom-style'] = 'Figure' })
end
return {
  { Para = wrap, Plain = wrap },
  { Image = function(img) img.attributes.align = nil; return img end },
}
`

export function buildDocx({ chapters, outDir, pandoc = 'pandoc', ...ref }: BuildOptions): BuildResult {
  const { manual, markdown, sections } = assembleMarkdown(ref, chapters)
  const dir = manualDir(ref)
  const distDir = outDir ?? resolve(ref.root, 'dist')
  mkdirSync(distDir, { recursive: true })
  const suffix = chapters ? `_ch${chapters.join('-')}` : ''
  const merged = join(distDir, `${ref.manual}${suffix}.md`)
  const docx = join(distDir, `${outputName(manual)}${suffix}.docx`)
  // TODO 등 주석은 Word에 넣지 않는다 (들여쓴 주석이 코드 블록이 되어 글자로 찍히지 않게 미리 지운다)
  writeFileSync(merged, stripComments(markdown))
  // pandoc은 앱(asar) 안 파일을 못 읽으므로 필터를 임시 파일로 쓴다
  const filterDir = mkdtempSync(join(tmpdir(), 'manual-filter-'))
  const filter = join(filterDir, 'center.lua')
  writeFileSync(filter, CENTER_FILTER)

  const result = spawnSync(
    pandoc,
    [
      merged,
      '-o', docx,
      '--toc',
      '--toc-depth=2',
      `--resource-path=${dir}`,
      `--reference-doc=${join(dir, 'reference.docx')}`,
      `--lua-filter=${filter}`,
    ],
    { encoding: 'utf8' },
  )
  rmSync(filterDir, { recursive: true, force: true })
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
  return { docx, markdown: merged, warnings: result.stderr, issues: checkSections(sections, pandoc) }
}
