// 섹션 본문을 pandoc HTML로 렌더링한다. Word 빌드와 같은 엔진이라 미리보기와 결과가 어긋나지 않는다
import { spawn } from 'node:child_process'
import { assetUrl } from '../../shared/api.ts'

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// TODO 주석은 Word에서 사라지지만 미리보기에서는 눈에 띄게 보여 준다
export function preprocess(body: string) {
  return body.replace(/<!--\s*TODO\b[:\s]*([\s\S]*?)-->/g, (_, text: string) => {
    return `<span class="todo">TODO: ${escapeHtml(text.trim().replace(/\s+/g, ' '))}</span>`
  })
}

// images/<id>.png → ariadne://ws/manuals/<m>/images/<id>.png
export function rewriteImages(html: string, manual: string, versions: Map<string, number> = new Map()) {
  return html.replace(/(<img\b[^>]*\bsrc=")images\/([^"]+)"/g, (_, head: string, file: string) => {
    const id = file.replace(/\.png$/, '')
    return `${head}${assetUrl(`manuals/${manual}/images/${file}`, versions.get(id))}"`
  })
}

export function runPandoc(pandoc: string, markdown: string, args: string[] = []) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(pandoc, ['-f', 'markdown', '-t', 'html5', '--wrap=none', ...args])
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8').on('data', (d) => (out += d))
    child.stderr.setEncoding('utf8').on('data', (d) => (err += d))
    child.on('error', (e) => reject(new Error(`pandoc 실행 실패 (${pandoc}): ${e.message}`)))
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`pandoc 실패: ${err}`))))
    child.stdin.end(markdown)
  })
}

export async function renderSection(pandoc: string, manual: string, body: string, versions?: Map<string, number>) {
  return rewriteImages(await runPandoc(pandoc, preprocess(body)), manual, versions)
}
