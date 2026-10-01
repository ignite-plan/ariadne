// manual.yaml 순서대로 Markdown을 합쳐 Word를 만든다.
// usage: pnpm build --manual bo [--chapters 2,5]
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import YAML from 'yaml'

const { values } = parseArgs({
  options: { manual: { type: 'string', default: 'bo' }, chapters: { type: 'string' } },
})

const manualDir = resolve('manuals', values.manual!)
const manual = YAML.parse(readFileSync(join(manualDir, 'manual.yaml'), 'utf8'))
const targets = values.chapters?.split(',').map(Number)

function stripFrontMatter(md: string) {
  return md.replace(/^---\n[\s\S]*?\n---\n/, '')
}

const chapters = (manual.chapters as { title: string; dir: string; sections: string[] }[]).filter(
  (chapter) => !targets || targets.includes(Number.parseInt(chapter.dir, 10)),
)
if (!chapters.length) throw new Error(`빌드할 장이 없습니다: --chapters ${values.chapters}`)

const body = chapters
  .map((chapter) => {
    const no = Number.parseInt(chapter.dir, 10)
    const sections = chapter.sections.map((file) =>
      stripFrontMatter(readFileSync(join(manualDir, chapter.dir, file), 'utf8')).trim(),
    )
    return [`# ${no}. ${chapter.title}`, ...sections].join('\n\n')
  })
  .join('\n\n')

const distDir = resolve('dist')
mkdirSync(distDir, { recursive: true })
const suffix = targets ? `_ch${targets.join('-')}` : ''
const merged = join(distDir, `${values.manual}${suffix}.md`)
const output = join(distDir, `Hyundai-Dealers Admin User Manual_v${manual.version}_EN${suffix}.docx`)
writeFileSync(merged, `---\ntitle: ${manual.title}\n---\n\n${body}\n`)

execFileSync(
  'pandoc',
  [
    merged,
    '-o', output,
    '--toc',
    '--toc-depth=2',
    `--resource-path=${manualDir}`,
    `--reference-doc=${join(manualDir, 'reference.docx')}`,
  ],
  { stdio: 'inherit' },
)

// 원본처럼 스크린샷에 accent1 테두리를 두른다. 인라인 아이콘(1in 미만)은 제외
const EMU_PER_INCH = 914400
const work = mkdtempSync(join(tmpdir(), 'manual-build-'))
execFileSync('unzip', ['-q', output, 'word/document.xml', '-d', work])
const docPath = join(work, 'word/document.xml')
const doc = readFileSync(docPath, 'utf8').replace(/<pic:pic\b[\s\S]*?<\/pic:pic>/g, (pic) => {
  const cx = Number(pic.match(/<a:ext cx="(\d+)"/)?.[1] ?? 0)
  if (cx < EMU_PER_INCH) return pic
  return pic.replace(
    /<a:ln\b[^>]*>[\s\S]*?<\/a:ln>/,
    '<a:ln><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln>',
  )
})
writeFileSync(docPath, doc)
execFileSync('zip', ['-q', output, 'word/document.xml'], { cwd: work })
rmSync(work, { recursive: true, force: true })

console.log(output)
