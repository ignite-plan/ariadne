// Claude 요청 칸 붙여넣기. 문서(Google Docs·Notion·Confluence·Word)에서 복사한 글을 글자만 받으면 제목·목록 기호가 빠지고
// 빈 줄이 몇 개씩 들어가 장면·단계의 위아래가 사라진다. 서식(HTML)을 Markdown 제목·들여쓴 목록으로 옮긴다 (DOM 없이 테스트하려고 노드 모양만 받는다)

export interface PasteNode {
  nodeType: number
  nodeName: string
  textContent: string | null
  childNodes: ArrayLike<PasteNode>
  getAttribute?: (name: string) => string | null
}

const ELEMENT = 1
const TEXT = 3
const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'TITLE', 'TEMPLATE'])
const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'DL', 'DT', 'DD', 'UL', 'OL', 'LI'])

export function htmlToMarkdown(root: PasteNode) {
  const out: string[] = []
  let line = ''
  // 지금 줄 앞에 붙일 것 (제목 #, 목록 -). 글자가 나와 줄을 낼 때 쓴다 (목록 안 문단 <li><p>에서도 기호가 남게)
  let prefix = ''

  const flush = () => {
    const text = line.replace(/\s+/g, ' ').trim()
    if (text) {
      out.push(prefix + text)
      prefix = ''
    }
    line = ''
  }

  const walk = (node: PasteNode, depth: number, counter?: { n: number }) => {
    if (node.nodeType === TEXT) {
      line += node.textContent ?? ''
      return
    }
    if (node.nodeType !== ELEMENT && node.nodeName !== '#document-fragment') return
    const name = node.nodeName.toUpperCase()
    if (SKIP.has(name)) return
    if (name === 'BR') return flush()
    const heading = /^H([1-6])$/.exec(name)
    if (heading) {
      flush()
      if (out.length) out.push('')
      prefix = `${'#'.repeat(Number(heading[1]))} `
    } else if (name === 'LI') {
      flush()
      // Google Docs는 목록을 겹치지 않고 aria-level로 깊이를 적는다
      const level = Number(node.getAttribute?.('aria-level') ?? 0)
      const indent = '  '.repeat(level > 0 ? level - 1 : Math.max(0, depth - 1))
      prefix = indent + (counter ? `${++counter.n}. ` : '- ')
    } else if ((name === 'TD' || name === 'TH') && line.trim()) {
      line += ' | '
    } else if (BLOCK.has(name)) {
      flush()
    }
    const list = name === 'UL' || name === 'OL'
    const next = list ? depth + 1 : depth
    const nextCounter = name === 'OL' ? { n: 0 } : name === 'UL' ? undefined : counter
    for (const child of Array.from(node.childNodes)) walk(child, next, nextCounter)
    if (heading || BLOCK.has(name)) flush()
    if (heading) out.push('')
  }

  walk(root, 0)
  flush()
  return tidyText(out.join('\n'))
}

// 줄 끝 공백을 지우고 연달은 빈 줄은 하나로
export function tidyText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// 요청 칸에 넣을 글. 그대로 붙여도 되면 undefined
export function pastedRequest(html: string, plain: string, parse: (html: string) => PasteNode) {
  if (html.trim()) {
    const markdown = htmlToMarkdown(parse(html))
    if (markdown) return markdown
  }
  return /\n[ \t]*\n[ \t]*\n/.test(plain) ? tidyText(plain) : undefined
}
