// 장/절 나누기: Word 목차(TOC) 링크 또는 제목 스타일로 시작 줄을 찾는다
import { basename } from 'node:path'

export interface TocEntry {
  level: 1 | 2
  title: string
}

// pandoc 표시(앵커 []{#…}, 형광펜 {.mark}, 목차 링크, 굵게·인용·글머리표)를 걷어낸다
function stripMarkup(text: string) {
  return text
    .replace(/\[\]\{[^}]*\}/g, '')
    .replace(/\{\.mark\}/g, '')
    .replace(/\]\(#[^)]*\)/g, '')
    .replace(/[*\\[\]#>•]/g, '')
    .replace(/^\s*-\s+/, '')
}

// 목차 항목과 본문 제목을 맞춰 보는 비교용 문자열 (쪽 번호, 대소문자 무시)
export function plain(text: string) {
  return stripMarkup(text)
    .replace(/\s+\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// 원문 대소문자를 살린 제목
export function titleCase(line: string) {
  return stripMarkup(line)
    .trim()
    .replace(/^\d+\.\s*/, '')
    .replace(/\s+/g, ' ')
}

// 목차(TOC) 링크 줄로 장/절을 찾는다. 원본은 제목에 Heading 스타일을 쓰지 않은 곳이 많다
export function structureFromToc(lines: string[], warnings: string[]) {
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
export function structureFromHeadings(lines: string[]) {
  const starts: { entry: TocEntry; line: number }[] = []
  lines.forEach((l, line) => {
    if (/^# \S/.test(l)) starts.push({ entry: { level: 1, title: plain(l) }, line })
    else if (/^## \S/.test(l) && starts.length) starts.push({ entry: { level: 2, title: plain(l) }, line })
  })
  return { starts, firstChapterLine: starts[0]?.line ?? lines.length }
}

export function guessTitle(lines: string[], end: number) {
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
