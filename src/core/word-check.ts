// Word에 Markdown 표기가 글자로 그대로 찍히는 곳을 찾는다. pandoc이 읽은 결과(JSON AST)를 보고 판단한다.
// 예: 굵게를 쪼갠 형광펜(`- **[Domain**: …]{.mark}`), 가져오기가 남긴 빈 굵게(`**\**`), 형광펜 안의 목록 기호,
// 들여쓰기 때문에 생긴 코드 블록
import { spawnSync } from 'node:child_process'

// 주석(<!-- TODO … --> 등)은 Word에 넣지 않는다. 들여쓰기 때문에 코드 블록이 되면 글자로 찍히므로 pandoc 전에 지운다
export const stripComments = (markdown: string) => markdown.replace(/<!--[\s\S]*?-->/g, '')

type Node = { t?: string; c?: unknown } | Node[] | string | number | null

// 이 글자가 Word에 그대로 나오면 표기가 깨진 것이다
const RAW_MARKUP = /\*\*|\{\.mark\}|\]\{|<!--|-->/

// pandoc JSON AST의 blocks에서 문제를 찾는다 (같은 문제는 한 번만)
export function issuesInAst(blocks: unknown): string[] {
  const found = new Set<string>()
  const walk = (node: Node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.t === 'Str' && typeof node.c === 'string' && RAW_MARKUP.test(node.c)) found.add(`표기가 글자로 나옴: ${node.c}`)
    if (node.t === 'CodeBlock') {
      const text = String((node.c as [unknown, string])[1]).replace(/\s+/g, ' ').trim()
      found.add(`들여쓰기 때문에 코드 블록으로 나옴: ${text.slice(0, 60)}`)
    }
    if (node.t === 'Span') {
      const [[, classes], inlines] = node.c as [[string, string[]], { t: string; c?: string }[]]
      const first = inlines[0]
      if (classes.includes('mark') && first?.t === 'Str' && /^([-*+]|\d+[.)])$/.test(first.c ?? '')) {
        found.add(`형광펜 안에 목록 기호가 들어가 목록이 깨짐: ${first.c} …`)
      }
    }
    for (const value of Object.values(node)) walk(value as Node)
  }
  walk(blocks as Node)
  return [...found]
}

export interface SectionIssue {
  // <chapter dir>/<file>
  section: string
  issues: string[]
}

// 화면마다 pandoc으로 읽어 문제를 찾는다 (front-matter는 뺀 본문)
export function checkSections(sections: { section: string; body: string }[], pandoc = 'pandoc'): SectionIssue[] {
  const result: SectionIssue[] = []
  for (const { section, body } of sections) {
    const run = spawnSync(pandoc, ['-f', 'markdown', '-t', 'json'], { input: stripComments(body), encoding: 'utf8', maxBuffer: 1 << 28 })
    if (run.status !== 0 || !run.stdout) continue
    const issues = issuesInAst(JSON.parse(run.stdout).blocks)
    if (issues.length) result.push({ section, issues })
  }
  return result
}
