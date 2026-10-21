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

describe('전체·장 미리보기 (Word와 같은 내용)', { skip: !findPandoc() && 'pandoc 없음' }, () => {
  it('manual.yaml 순서로 장·화면을 잇고, TODO는 빼고, 표기 문제를 찾고, 바뀐 화면만 다시 그린다', async () => {
    const { createFixture } = await import('../../../../src/core/__tests__/fixture.ts')
    const { renderManualPreview } = await import('../preview.ts')
    const { writeFileSync, readFileSync, mkdtempSync, chmodSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')
    const fx = createFixture()
    try {
      // pandoc 실행 횟수를 센다
      const dir = mkdtempSync(join(tmpdir(), 'pandoc-count-'))
      const counter = join(dir, 'count')
      writeFileSync(counter, '')
      const wrapper = join(dir, 'pandoc')
      writeFileSync(wrapper, `#!/bin/sh\necho x >> "${counter}"\nexec "${findPandoc()!.path}" "$@"\n`)
      chmodSync(wrapper, 0o755)
      const runs = () => readFileSync(counter, 'utf8').trim().split('\n').filter(Boolean).length

      writeFileSync(join(fx.dir, '02-dealer/01-list.md'), '---\ntitle: Dealer List\n---\n\n## Dealer List\n\n- Item <!-- TODO: 확인 필요 -->\n\n- **[Domain**: broken]{.mark}\n')
      const cache = new Map()
      const chapters = await renderManualPreview({ ref: fx.ref, pandoc: wrapper, cache })
      assert.deepEqual(chapters.map((c) => [c.no, c.title, c.sections.map((s) => s.path)]), [
        [1, 'Login', ['01-login/00-intro.md']],
        [2, 'Dealer', ['02-dealer/01-list.md', '02-dealer/02-create.md']],
      ])
      const list = chapters[1].sections[0]
      assert.equal(list.title, 'Dealer List')
      assert.doesNotMatch(list.html, /TODO|todo/, 'TODO는 Word처럼 뺀다')
      assert.ok(list.issues.some((i) => /Domain\*\*:/.test(i)), list.issues.join('\n'))
      assert.deepEqual(chapters[1].sections[1].issues, [])
      const first = runs()
      assert.equal(first, 6, '화면마다 HTML 한 번, 표기 검사 한 번')

      // 그대로면 다시 그리지 않고, 고친 화면만 다시
      await renderManualPreview({ ref: fx.ref, pandoc: wrapper, cache })
      assert.equal(runs(), first)
      writeFileSync(join(fx.dir, '02-dealer/02-create.md'), '## Dealer Creation\n\n- **Company name**: Required. Max 50.\n')
      const again = await renderManualPreview({ ref: fx.ref, pandoc: wrapper, cache, chapterDir: '02-dealer' })
      assert.equal(runs(), first + 2)
      assert.deepEqual(again.map((c) => c.dir), ['02-dealer'], '장만')
      assert.match(again[0].sections[1].html, /Max 50/)
    } finally {
      fx.cleanup()
    }
  })
})
