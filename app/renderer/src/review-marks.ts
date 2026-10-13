// 미리보기에 Claude 변경을 표시한다: 고치기 전 HTML과 지금 HTML의 문단을 맞추고, 바뀐 문단 안은 단어 단위로
// 넣은 글자(<ins>)·지운 글자(<del>)를 끼워 넣는다. Markdown 서식 기호와 섞이지 않게 그려진 HTML에서 비교한다
import { alignBlocks, wordOps } from '../../shared/review-diff.ts'

const BLOCK = 'p, h1, h2, h3, h4, h5, h6, li, td, th, pre, dt, dd, figcaption, blockquote'
export const REVIEW_ATTR = 'data-review'

// 문단 단위: 안에 다른 문단이 없는 것. 문단 밖 이미지(그림)도 하나로 센다
function blocksOf(root: Element): Element[] {
  const blocks: Element[] = []
  root.querySelectorAll(`${BLOCK}, img`).forEach((el) => {
    if (el.tagName === 'IMG') {
      if (!el.closest(BLOCK)) blocks.push(el)
    } else if (!el.querySelector(BLOCK)) blocks.push(el)
  })
  return blocks
}

const imageKey = (img: Element) => (img.getAttribute('src') ?? '').replace(/\?.*$/, '')

function signature(el: Element) {
  if (el.tagName === 'IMG') return `img:${imageKey(el)}`
  const images = [...el.querySelectorAll('img')].map(imageKey).join(' ')
  return `${(el.textContent ?? '').replace(/\s+/g, ' ').trim()}${images ? ` [${images}]` : ''}`
}

function textNodes(root: Node) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  return nodes
}

// 글자 위치 [start, end)를 감싼다 (여러 글자 노드에 걸쳐도)
function wrapRange(block: Element, start: number, end: number) {
  let acc = 0
  for (const node of textNodes(block)) {
    const from = acc
    acc += node.length
    if (acc <= start || from >= end || node.parentElement?.closest('del.review-del')) continue
    let target = node
    if (start > from) target = target.splitText(start - from)
    if (end < acc) target.splitText(end - Math.max(start, from))
    const ins = document.createElement('ins')
    ins.className = 'review-ins'
    target.parentNode!.insertBefore(ins, target)
    ins.appendChild(target)
  }
}

// 글자 위치 at에 지운 글자를 끼워 넣는다
function insertDeleted(block: Element, at: number, text: string) {
  const del = document.createElement('del')
  del.className = 'review-del'
  del.textContent = text
  let acc = 0
  for (const node of textNodes(block)) {
    const end = acc + node.length
    if (at <= end) {
      const local = at - acc
      if (local === node.length) node.parentNode!.insertBefore(del, node.nextSibling)
      else if (local === 0) node.parentNode!.insertBefore(del, node)
      else node.parentNode!.insertBefore(del, node.splitText(local))
      return
    }
    acc = end
  }
  block.appendChild(del)
}

function markWords(before: Element, after: Element) {
  const ops = wordOps(before.textContent ?? '', after.textContent ?? '')
  // 뒤에서부터 적용해야 앞쪽 위치가 밀리지 않는다 (지운 글자를 끼우면 글자가 늘어난다)
  const position = (op: (typeof ops)[number]) => (op.type === 'ins' ? op.start : op.at)
  for (const op of [...ops].sort((x, y) => position(y) - position(x) || (x.type === 'ins' ? -1 : 1))) {
    if (op.type === 'ins') wrapRange(after, op.start, op.end)
    else insertDeleted(after, op.at, op.text)
  }
}

// 표시한 문단 수를 돌려준다
export function markReview(article: HTMLElement, beforeHtml: string): number {
  const beforeRoot = document.createElement('div')
  beforeRoot.innerHTML = beforeHtml
  const beforeBlocks = blocksOf(beforeRoot)
  const afterBlocks = blocksOf(article)
  const matches = alignBlocks(beforeBlocks.map(signature), afterBlocks.map(signature))
  let marked = 0
  // 지운 문단은 다음 남은 문단 앞에 흐리게 끼운다
  let pendingRemoved: Element[] = []
  const placeRemoved = (anchor?: Element) => {
    for (const old of pendingRemoved) {
      const ghost = document.createElement('div')
      ghost.className = 'review-block-del'
      ghost.setAttribute(REVIEW_ATTR, '')
      ghost.append(...[...old.childNodes].map((n) => n.cloneNode(true)))
      if (anchor) anchor.parentNode!.insertBefore(ghost, anchor)
      else article.appendChild(ghost)
      marked++
    }
    pendingRemoved = []
  }
  for (const match of matches) {
    if (match.kind === 'removed') {
      pendingRemoved.push(beforeBlocks[match.before])
      continue
    }
    const block = afterBlocks[match.after]
    placeRemoved(block.tagName === 'IMG' ? (block.closest('figure') ?? block) : block)
    if (match.kind === 'same') continue
    block.setAttribute(REVIEW_ATTR, '')
    marked++
    if (match.kind === 'added' || block.tagName === 'IMG') block.classList.add('review-block-add')
    else {
      block.classList.add('review-block-changed')
      markWords(beforeBlocks[match.before], block)
    }
  }
  placeRemoved()
  return marked
}
