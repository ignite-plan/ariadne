import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { htmlToMarkdown, pastedRequest, tidyText, type PasteNode } from '../../../renderer/src/rich-paste.ts'

// DOM 없이 노드 모양만 만든다
const el = (name: string, ...children: (PasteNode | string)[]): PasteNode => el2(name, {}, ...children)
const el2 = (name: string, attrs: Record<string, string>, ...children: (PasteNode | string)[]): PasteNode => {
  const nodes = children.map((c): PasteNode => (typeof c === 'string' ? { nodeType: 3, nodeName: '#text', textContent: c, childNodes: [] } : c))
  return { nodeType: 1, nodeName: name, textContent: null, childNodes: nodes, getAttribute: (n) => attrs[n] ?? null }
}

describe('요청 칸 붙여넣기', () => {
  it('제목·문단·겹친 목록을 Markdown으로 (Notion·Confluence)', () => {
    const body = el(
      'BODY',
      el('H2', 'A. 게시판 목록'),
      el('H3', '장면 1. 화면 진입'),
      el(
        'UL',
        el('LI', el('P', '내레이션: Post Management is where you create posts.')),
        el('LI', el('P', '단계'), el('UL', el('LI', '누르기: GNB의 Post Management'), el('LI', "'Post Management' 제목 강조 (2초)"))),
      ),
      el('H3', '장면 2. 게시판 목록 소개'),
      el('P', '내레이션: The list shows every board.'),
    )
    assert.equal(
      htmlToMarkdown(body),
      [
        '## A. 게시판 목록',
        '',
        '### 장면 1. 화면 진입',
        '',
        '- 내레이션: Post Management is where you create posts.',
        '- 단계',
        '  - 누르기: GNB의 Post Management',
        "  - 'Post Management' 제목 강조 (2초)",
        '',
        '### 장면 2. 게시판 목록 소개',
        '',
        '내레이션: The list shows every board.',
      ].join('\n'),
    )
  })

  it('Google Docs의 aria-level 목록, 번호 목록, 줄바꿈, 표', () => {
    const body = el(
      'BODY',
      el2('B', { id: 'docs-internal-guid-1' }, el('UL', el2('LI', { 'aria-level': '1' }, '단계'), el2('LI', { 'aria-level': '2' }, '강조 (1.5초)'))),
      el('OL', el('LI', '첫째'), el('LI', '둘째')),
      el('P', '한 줄', el('BR'), '두 줄'),
      el('TABLE', el('TR', el('TD', '이름'), el('TD', '값'))),
    )
    assert.equal(htmlToMarkdown(body), ['- 단계', '  - 강조 (1.5초)', '1. 첫째', '2. 둘째', '한 줄', '두 줄', '이름 | 값'].join('\n'))
  })

  it('서식 없는 글은 빈 줄이 여러 개일 때만 하나로 줄인다', () => {
    const parse = () => el('BODY')
    assert.equal(pastedRequest('', '장면 1\n\n\n\n\n내레이션: x  \n\n\n단계', parse), '장면 1\n\n내레이션: x\n\n단계')
    assert.equal(pastedRequest('', '그냥 한 줄', parse), undefined)
    assert.equal(pastedRequest('', '줄\n\n문단', parse), undefined)
    assert.equal(tidyText('\r\na\r\n\r\n\r\nb '), 'a\n\nb')
  })
})
