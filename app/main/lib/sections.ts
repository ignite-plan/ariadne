// 섹션 Markdown, manual.yaml, 이미지 파일 조작. Electron에 의존하지 않는다 (단위 테스트 대상)
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { PNG } from 'pngjs'
import {
  chapterNo,
  joinSection,
  loadManual,
  manualDir,
  parseFrontMatter,
  saveManual,
  serializeFrontMatter,
  splitSection,
  type Manual,
  type ManualRef,
  type SectionMeta,
} from '../../../src/core/manual.ts'
import { ID_PATTERN, ID_RULE, slugify, uniqueName } from '../../../src/core/naming.ts'
import type { ImageInfo, ManualTree, NewSectionInput, SectionDoc, Todo } from '../../shared/api.ts'

// root 밖으로 나가는 경로(../)를 막는다
export function resolveInside(root: string, relPath: string) {
  const base = resolve(root)
  const target = resolve(base, relPath)
  if (target !== base && !target.startsWith(base + sep)) throw new Error(`허용되지 않은 경로: ${relPath}`)
  return target
}

export function listManuals(root: string) {
  const dir = join(root, 'manuals')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'manual.yaml')))
    .map((d) => d.name)
}

// manual.yaml에 등록된 섹션만 연다 (<chapter dir>/<file>)
function sectionFile(ref: ManualRef, path: string, manual = loadManual(ref)) {
  const [dir, file, ...rest] = path.split('/')
  const chapter = manual.chapters.find((c) => c.dir === dir)
  if (rest.length || !chapter?.sections.includes(file)) throw new Error(`manual.yaml에 없는 섹션: ${path}`)
  return join(manualDir(ref), dir, file)
}

// 첫 H2를 화면 제목으로 본다. 없으면 front-matter title
export function sectionTitle(raw: string) {
  const { body } = splitSection(raw)
  return body.match(/^##\s+(.+)$/m)?.[1].trim() ?? parseFrontMatter(raw).title ?? ''
}

// <!-- TODO: ... --> 주석. line은 본문(front-matter 제외) 기준 1부터
export function extractTodos(body: string) {
  const todos: { line: number; text: string }[] = []
  for (const match of body.matchAll(/<!--\s*TODO\b[:\s]*([\s\S]*?)-->/g)) {
    const line = body.slice(0, match.index).split('\n').length
    todos.push({ line, text: match[1].trim().replace(/\s+/g, ' ') || 'TODO' })
  }
  return todos
}

export function readTree(ref: ManualRef, modified: Set<string> = new Set(), reviews: Set<string> = new Set()): ManualTree {
  const manual = loadManual(ref)
  const dir = manualDir(ref)
  return {
    manual: ref.manual,
    title: manual.title,
    version: manual.version,
    chapters: manual.chapters.map((chapter) => ({
      no: chapterNo(chapter),
      dir: chapter.dir,
      title: chapter.title,
      sections: chapter.sections.map((file) => {
        const path = `${chapter.dir}/${file}`
        const full = join(dir, chapter.dir, file)
        const raw = existsSync(full) ? readFileSync(full, 'utf8') : ''
        return {
          path,
          title: sectionTitle(raw) || file,
          todos: extractTodos(splitSection(raw).body).length,
          modified: modified.has(`manuals/${ref.manual}/${path}`),
          ...(reviews.has(path) ? { review: true } : {}),
        }
      }),
    })),
  }
}

export function readSectionDoc(ref: ManualRef, path: string): SectionDoc {
  const raw = readFileSync(sectionFile(ref, path), 'utf8')
  return { path, meta: parseFrontMatter(raw), body: splitSection(raw).body }
}

// meta가 없으면 기존 front-matter 원문을 그대로 둔다 (불필요한 diff 방지)
export function writeSectionDoc(ref: ManualRef, path: string, body: string, meta?: SectionMeta) {
  const file = sectionFile(ref, path)
  const { frontMatter } = splitSection(readFileSync(file, 'utf8'))
  const next = joinSection(meta ? serializeFrontMatter(meta) : frontMatter, body)
  if (next !== readFileSync(file, 'utf8')) writeFileSync(file, next)
}

export function collectTodos(ref: ManualRef): Todo[] {
  const manual = loadManual(ref)
  return manual.chapters.flatMap((chapter) =>
    chapter.sections.flatMap((file) => {
      const path = `${chapter.dir}/${file}`
      const raw = readFileSync(join(manualDir(ref), chapter.dir, file), 'utf8')
      const sectionTitleText = sectionTitle(raw) || file
      return extractTodos(splitSection(raw).body).map((t) => ({ path, sectionTitle: sectionTitleText, ...t }))
    }),
  )
}

const writeManual = (ref: ManualRef, manual: Manual) => saveManual(ref, manual)

const pad = (n: number) => String(n).padStart(2, '0')
const stripNo = (name: string) => name.replace(/^\d+-/, '')

// 장 번호는 폴더 앞 번호(08-)다. manual.yaml 순서대로 01-부터 다시 매기고 폴더 이름을 바꾼다.
// 이름이 겹치지 않게 임시 이름을 거쳐 두 번에 바꾼다. 바뀐 경로를 돌려준다 (old dir → new dir)
export function renumberChapters(ref: ManualRef, manual: Manual) {
  const dir = manualDir(ref)
  const moves = manual.chapters
    .map((chapter, i) => ({ chapter, from: chapter.dir, to: `${pad(i + 1)}-${stripNo(chapter.dir)}` }))
    .filter((m) => m.from !== m.to)
  moves.forEach((m, i) => renameSync(join(dir, m.from), join(dir, `.renumber-${i}`)))
  moves.forEach((m, i) => {
    renameSync(join(dir, `.renumber-${i}`), join(dir, m.to))
    m.chapter.dir = m.to
  })
  return new Map(moves.map((m) => [m.from, m.to]))
}

// 장 안 화면 파일 번호를 순서대로 다시 매긴다. 장 소개(00-intro.md)는 맨 앞일 때 00을 지킨다
function renumberSections(ref: ManualRef, chapter: Manual['chapters'][number]) {
  const dir = join(manualDir(ref), chapter.dir)
  const hasIntro = chapter.sections[0] === '00-intro.md'
  const moves = chapter.sections
    .map((file, i) => ({
      from: file,
      to: hasIntro && i === 0 ? file : `${pad(hasIntro ? i : i + 1)}-${stripNo(file)}`,
    }))
  const changed = moves.filter((m) => m.from !== m.to)
  changed.forEach((m, i) => renameSync(join(dir, m.from), join(dir, `.renumber-${i}`)))
  changed.forEach((m, i) => renameSync(join(dir, `.renumber-${i}`), join(dir, m.to)))
  chapter.sections = moves.map((m) => m.to)
  return new Map(changed.map((m) => [`${chapter.dir}/${m.from}`, `${chapter.dir}/${m.to}`]))
}

// 장을 toIndex(0부터) 위치로 옮긴다
export function moveChapter(ref: ManualRef, chapterDir: string, toIndex: number) {
  const manual = loadManual(ref)
  const from = manual.chapters.findIndex((c) => c.dir === chapterDir)
  if (from < 0) throw new Error(`없는 장: ${chapterDir}`)
  const [chapter] = manual.chapters.splice(from, 1)
  manual.chapters.splice(Math.max(0, Math.min(toIndex, manual.chapters.length)), 0, chapter)
  const renamed = renumberChapters(ref, manual)
  writeManual(ref, manual)
  return renamed
}

// 화면을 같은 장 안 toIndex 위치로 옮긴다. 장 소개는 맨 앞에 고정한다
export function moveSection(ref: ManualRef, path: string, toIndex: number) {
  const manual = loadManual(ref)
  const [dirName, file] = path.split('/')
  const chapter = manual.chapters.find((c) => c.dir === dirName)
  if (!chapter || !chapter.sections.includes(file)) throw new Error(`manual.yaml에 없는 섹션: ${path}`)
  if (file === '00-intro.md') throw new Error('장 소개는 맨 앞에 둡니다')
  const from = chapter.sections.indexOf(file)
  chapter.sections.splice(from, 1)
  const min = chapter.sections[0] === '00-intro.md' ? 1 : 0
  chapter.sections.splice(Math.max(min, Math.min(toIndex, chapter.sections.length)), 0, file)
  const renamed = renumberSections(ref, chapter)
  writeManual(ref, manual)
  return renamed
}

// 장 번호는 기존 마지막 장 다음, 파일 번호는 장 안 마지막 다음
export function createSection(ref: ManualRef, { title, chapterDir, newChapterTitle, chapterIndex }: NewSectionInput) {
  const name = title.trim()
  if (!name) throw new Error('화면 이름을 입력하세요')
  const slug = slugify(name)
  if (!slug) throw new Error('화면 이름은 영문으로 입력하세요')
  const manual = loadManual(ref)

  let chapter = manual.chapters.find((c) => c.dir === chapterDir)
  if (!chapter) {
    const chapterTitle = newChapterTitle?.trim()
    if (!chapterTitle || !slugify(chapterTitle)) throw new Error('새 장 이름을 영문으로 입력하세요')
    const no = Math.max(0, ...manual.chapters.map(chapterNo)) + 1
    chapter = { title: chapterTitle, dir: `${pad(no)}-${slugify(chapterTitle)}`, sections: [] }
    manual.chapters.push(chapter)
    mkdirSync(join(manualDir(ref), chapter.dir), { recursive: true })
  }

  const next = Math.max(0, ...chapter.sections.map((f) => Number.parseInt(f, 10) || 0)) + 1
  const file = `${pad(next)}-${slug}.md`
  const full = join(manualDir(ref), chapter.dir, file)
  if (existsSync(full)) throw new Error(`이미 있는 파일: ${chapter.dir}/${file}`)
  const body = `## ${name}\n\n- <!-- TODO: 이 화면의 용도를 한두 문장으로 작성 -->\n`
  writeFileSync(full, joinSection(serializeFrontMatter({ title: name }), body))
  chapter.sections.push(file)
  writeManual(ref, manual)
  // 새 장을 원하는 위치에 넣는다 (예: 메뉴 관리를 8장으로)
  if (!chapterDir && chapterIndex !== undefined) {
    const renamed = moveChapter(ref, chapter.dir, chapterIndex)
    return `${renamed.get(chapter.dir) ?? chapter.dir}/${file}`
  }
  return `${chapter.dir}/${file}`
}

// 섹션 파일과 manual.yaml 항목을 지운다. 비게 된 장도 지운다
export function removeSection(ref: ManualRef, path: string) {
  const manual = loadManual(ref)
  const file = sectionFile(ref, path, manual)
  const [dir, name] = path.split('/')
  const chapter = manual.chapters.find((c) => c.dir === dir)!
  chapter.sections = chapter.sections.filter((s) => s !== name)
  if (!chapter.sections.length) manual.chapters = manual.chapters.filter((c) => c !== chapter)
  rmSync(file)
  writeManual(ref, manual)
}

export function listImages(ref: ManualRef): ImageInfo[] {
  const dir = join(manualDir(ref), 'images')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => {
      const stat = statSync(join(dir, f))
      return { id: f.slice(0, -4), bytes: stat.size, mtime: stat.mtimeMs }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

// 겹치지 않는 이미지 id. caption slug, 겹치면 -2, -3 ...
export function suggestImageId(ref: ManualRef, caption: string) {
  const taken = new Set(listImages(ref).map((i) => i.id))
  return uniqueName(slugify(caption) || 'image', (id) => taken.has(id))
}

// PNG만 받는다. Word 빌드와 캡처 비교가 PNG 기준이라서
export function importImage(ref: ManualRef, id: string, bytes: Uint8Array) {
  if (!ID_PATTERN.test(id)) throw new Error(`이미지 id는 ${ID_RULE}`)
  try {
    PNG.sync.read(Buffer.from(bytes))
  } catch {
    throw new Error('PNG 이미지만 넣을 수 있습니다')
  }
  const dir = join(manualDir(ref), 'images')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${id}.png`), bytes)
  return id
}
