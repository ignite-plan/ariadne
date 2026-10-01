// 1회성: 기존 Word 매뉴얼을 TOC 기준으로 장/절 Markdown으로 분리한다.
// usage: pnpm import:docx --docx ~/Desktop/Hyundai.docx --manual bo --chapters 2,3
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import YAML from 'yaml'

interface TocEntry {
  level: 1 | 2
  title: string
}

interface Chapter {
  no: number
  title: string
  slug: string
  intro: string[]
  sections: { title: string; slug: string; lines: string[] }[]
}

const { values } = parseArgs({
  options: {
    docx: { type: 'string' },
    manual: { type: 'string', default: 'bo' },
    chapters: { type: 'string' },
  },
})

if (!values.docx) throw new Error('--docx is required')

const manualDir = resolve('manuals', values.manual!)
const workDir = mkdtempSync(join(tmpdir(), 'manual-import-'))
execFileSync('pandoc', [
  resolve(values.docx),
  '-t', 'markdown-simple_tables-multiline_tables-grid_tables',
  '--wrap=none',
  `--extract-media=${workDir}`,
  '-o', join(workDir, 'full.md'),
])
const lines = readFileSync(join(workDir, 'full.md'), 'utf8').split('\n')

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

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const firstChapterLine = lines.findIndex((l) => /^# 1\./.test(l))
const toc: TocEntry[] = lines
  .slice(0, firstChapterLine)
  .filter((l) => l.startsWith('['))
  .map((l) => {
    const title = plain(l)
    return { level: /^\d+\./.test(title) ? 1 : 2, title }
  })

// TOC 제목과 같은 본문 줄을 순서대로 찾는다. 원본은 제목에 Heading 스타일을 쓰지 않은 곳이 많다.
const starts: { entry: TocEntry; line: number }[] = []
let cursor = firstChapterLine
for (const entry of toc) {
  const found = lines.findIndex((l, i) => i >= cursor && plain(l) === entry.title)
  if (found < 0) throw new Error(`본문에서 제목을 찾지 못함: ${entry.title}`)
  starts.push({ entry, line: found })
  cursor = found + 1
}

const chapters: Chapter[] = []
starts.forEach(({ entry, line }, i) => {
  const end = starts[i + 1]?.line ?? lines.length
  const body = lines.slice(line + 1, end)
  if (entry.level === 1) {
    const title = titleCase(lines[line])
    chapters.push({
      no: Number(entry.title.match(/^\d+/)![0]),
      title,
      slug: slugify(title),
      intro: body,
      sections: [],
    })
    return
  }
  chapters.at(-1)!.sections.push({ title: titleCase(lines[line]), slug: slugify(entry.title), lines: body })
})

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

const usedImages = new Set<string>()

function clean(body: string[], sectionSlug: string) {
  let unnamed = 0
  return body
    .map((l) => l.replace(/^(> ?)+/, ''))
    .map((l) => l.replace(/\[\]\{#[^}]*\}/g, ''))
    .map((l) => l.replace(/\[([^\]]*)\]\{\.mark\}/g, '$1'))
    .map((l) =>
      l.replace(/!\[([^\]]*)\]\(([^)]+)\)(\{[^}]*\})?/g, (_, alt: string, src: string, attrs = '') => {
        // Word가 자동 생성한 한글 대체 텍스트는 caption이 아니다
        const caption = /[가-힣]/.test(alt) ? '' : alt
        const width = attrs.match(/width="([^"]+)"/)?.[1]
        const base = caption ? slugify(caption) : `${sectionSlug}-img-${++unnamed}`
        let name = base
        const taken = (n: string) => usedImages.has(n) || existsSync(join(manualDir, 'images', `${n}.png`))
        for (let n = 2; taken(name); n++) name = `${base}-${n}`
        usedImages.add(name)
        copyFileSync(src, join(manualDir, 'images', `${name}.png`))
        const size = width ? `{width=${Number.parseFloat(width).toFixed(2)}in}` : ''
        return `![${caption}](images/${name}.png)${size}`
      }),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function frontMatter(title: string) {
  return `---\n${YAML.stringify({ title, routes: [], sources: [], i18nPrefix: [] }).trim()}\n---\n\n`
}

const targets = values.chapters?.split(',').map(Number)
mkdirSync(join(manualDir, 'images'), { recursive: true })

interface Manual {
  title: string
  version: string
  chapters: { title: string; dir: string; sections: string[] }[]
}

const manualFile = join(manualDir, 'manual.yaml')
const manual: Manual = existsSync(manualFile)
  ? YAML.parse(readFileSync(manualFile, 'utf8'))
  : { title: 'Dealers Admin User Manual', version: '1.0.7', chapters: [] }

for (const chapter of chapters) {
  if (targets && !targets.includes(chapter.no)) continue
  const dir = `${String(chapter.no).padStart(2, '0')}-${chapter.slug}`
  mkdirSync(join(manualDir, dir), { recursive: true })
  const files: string[] = []
  const intro = clean(chapter.intro, chapter.slug)
  if (intro) {
    writeFileSync(join(manualDir, dir, '00-intro.md'), frontMatter(chapter.title) + intro + '\n')
    files.push('00-intro.md')
  }
  chapter.sections.forEach((section, i) => {
    const file = `${String(i + 1).padStart(2, '0')}-${section.slug}.md`
    writeFileSync(
      join(manualDir, dir, file),
      frontMatter(section.title) + `## ${section.title}\n\n` + clean(section.lines, section.slug) + '\n',
    )
    files.push(file)
  })
  manual.chapters = manual.chapters.filter((c) => c.dir !== dir)
  manual.chapters.push({ title: chapter.title, dir, sections: files })
  console.log(`${chapter.no}. ${chapter.title} → ${dir} (${files.length} files)`)
}

manual.chapters.sort((a, b) => a.dir.localeCompare(b.dir))
writeFileSync(manualFile, YAML.stringify(manual))
