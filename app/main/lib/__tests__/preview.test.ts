import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findPandoc } from '../environment.ts'
import { preprocess, renderSection, rewriteImages } from '../preview.ts'

describe('preview', () => {
  it('TODO 주석을 보이는 span으로 바꾸고 HTML을 이스케이프한다', () => {
    assert.equal(preprocess('a <!-- TODO: <b>확인</b> --> b'), 'a <span class="todo">TODO: &lt;b&gt;확인&lt;/b&gt;</span> b')
    assert.equal(preprocess('<!-- note -->'), '<!-- note -->')
  })

  it('이미지 경로를 ariadne://로, mtime을 버전으로', () => {
    const html = '<img src="images/dealer-list.png" style="width:6.27in" /><img src="https://x/y.png">'
    assert.equal(
      rewriteImages(html, 'bo', new Map([['dealer-list', 123]])),
      '<img src="ariadne://ws/manuals/bo/images/dealer-list.png?v=123" style="width:6.27in" /><img src="https://x/y.png">',
    )
  })

  const pandoc = findPandoc()
  it('pandoc으로 렌더링 (pandoc이 있을 때)', { skip: !pandoc && 'pandoc 없음' }, async () => {
    const html = await renderSection(
      pandoc!.path,
      'bo',
      '## Title\n\n- **Label**: text <!-- TODO: 확인 -->\n\n![Dealer List](images/dealer-list.png){width=6.27in}\n',
    )
    assert.match(html, /<h2 id="title">Title<\/h2>/)
    assert.match(html, /<strong>Label<\/strong>/)
    assert.match(html, /<span class="todo">TODO: 확인<\/span>/)
    assert.match(html, /<img src="ariadne:\/\/ws\/manuals\/bo\/images\/dealer-list.png" style="width:6.27in"/)
    assert.match(html, /<figcaption[^>]*>Dealer List<\/figcaption>/)
  })

  it('pandoc이 없으면 알기 쉬운 에러', async () => {
    await assert.rejects(renderSection('/nope/pandoc', 'bo', 'x'), /pandoc 실행 실패 \(\/nope\/pandoc\)/)
  })
})
