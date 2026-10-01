// 1회성: 기존 Word 매뉴얼을 TOC 기준으로 장/절 Markdown으로 분리한다.
// usage: pnpm import:docx --docx ~/Desktop/Hyundai.docx --manual bo --chapters 2,3
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PNG } from 'pngjs'
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
interface Drawing {
  crop: { l: number; t: number; r: number; b: number }
  widthIn: number
  ratio: number
}

// pandoc은 Word의 자르기(srcRect)와 비율 변경을 버린다. 문서 순서대로 drawing 정보를 읽어 이미지에 다시 적용한다
const EMU_PER_INCH = 914400
const documentXml = execFileSync('unzip', ['-p', resolve(values.docx), 'word/document.xml'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
const drawings: Drawing[] = [...documentXml.matchAll(/<w:drawing>[\s\S]*?<\/w:drawing>/g)].map(([xml]) => {
  const [, cx, cy] = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"/)!
  const rect = xml.match(/<a:srcRect([^>]*)\/>/)?.[1] ?? ''
  const edge = (k: string) => Math.max(0, Number(rect.match(new RegExp(`\\b${k}="(-?\\d+)"`))?.[1] ?? 0)) / 100000
  return {
    crop: { l: edge('l'), t: edge('t'), r: edge('r'), b: edge('b') },
    widthIn: Number(cx) / EMU_PER_INCH,
    ratio: Number(cy) / Number(cx),
  }
})

let imageIndex = 0
const lines = readFileSync(join(workDir, 'full.md'), 'utf8')
  .split('\n')
  .map((l) => l.replace(/\]\(([^)\s]+\/media\/[^)\s]+)\)/g, (_, src: string) => `](${src}#${imageIndex++})`))
if (imageIndex !== drawings.length) throw new Error(`이미지 수 불일치: md ${imageIndex}, docx ${drawings.length}`)

// 자르기를 반영해 저장하고, 원본 표시 비율과 다르면(늘이기) 높이를 함께 돌려준다
function writeImage(src: string, dest: string, { crop, widthIn, ratio }: Drawing) {
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
      l.replace(/!\[([^\]]*)\]\(([^)#]+)#(\d+)\)(\{[^}]*\})?/g, (_, alt: string, src: string, index: string) => {
        // Word가 자동 생성한 한글 대체 텍스트는 caption이 아니다
        const caption = /[가-힣]/.test(alt) ? '' : alt
        const base = caption ? slugify(caption) : `${sectionSlug}-img-${++unnamed}`
        let name = base
        const taken = (n: string) => usedImages.has(n) || existsSync(join(manualDir, 'images', `${n}.png`))
        for (let n = 2; taken(name); n++) name = `${base}-${n}`
        usedImages.add(name)
        const size = writeImage(src, join(manualDir, 'images', `${name}.png`), drawings[Number(index)])
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
