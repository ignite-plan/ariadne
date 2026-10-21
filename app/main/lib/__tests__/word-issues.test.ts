import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lazyImages, markWordIssues } from '../../../renderer/src/word-issues.ts'

describe('미리보기의 Word 표기 문제 표시', () => {
  it('태그 밖 글자의 **, {.mark}, ]{, 주석 흔적과 코드 블록을 표시한다', () => {
    const html = '<p>Path**: shown <a href="x**y">link</a> [text]{.mark} &lt;!-- TODO --&gt;</p><pre><code>x</code></pre>'
    const out = markWordIssues(html)
    assert.equal(out.match(/class="word-issue"/g)?.length, 4, 'Path**, ]{, 주석 여는·닫는 표기')
    assert.match(out, /<a href="x\*\*y">/, '태그 속성은 건드리지 않는다')
    assert.match(out, /<pre class="word-issue-block"/)
    assert.equal(markWordIssues('<p><strong>Label</strong>: ok</p>'), '<p><strong>Label</strong>: ok</p>')
  })

  it('이미지는 보일 때 불러온다', () => {
    assert.equal(lazyImages('<img src="a"><img loading="eager" src="b">'), '<img loading="lazy" src="a"><img loading="eager" src="b">')
  })
})
