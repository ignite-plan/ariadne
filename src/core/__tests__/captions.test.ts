import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { captionKey, captionsInAst, mergeCaptionParagraphs, unwrapImageTables } from '../import/captions.ts'

const caps = ['Dealer Creation Failed', 'Business Email with domain selector', 'Company’s Email Domain', 'Search Result']

describe('Word 캡션 문단을 이미지 캡션으로', () => {
  it('이미지 다음 캡션 문단(빈 줄 건너)을 캡션으로 옮기고 문단을 지운다. 목록 안 이미지·형광펜·기울임·따옴표도', () => {
    const { lines, merged } = mergeCaptionParagraphs(
      [
        '- ![](images/a.png){width=4.16in}',
        '',
        'Dealer Creation Failed',
        '',
        '![대체 텍스트](images/b.png)',
        '',
        '*Business Email with domain selector*',
        '',
        '![](images/c.png)',
        '',
        "[Company's Email Domain]{.mark}",
        '',
        'Next paragraph.',
      ],
      caps,
    )
    assert.deepEqual(lines, [
      '- ![Dealer Creation Failed](images/a.png){width=4.16in}',
      '',
      '![Business Email with domain selector](images/b.png)',
      '',
      "![Company's Email Domain](images/c.png)",
      '',
      'Next paragraph.',
    ])
    assert.equal(merged.length, 3)
  })

  it('캡션이 아닌 문단, 여러 줄 문단, 다른 캡션이 있는 이미지는 그대로. 같은 캡션이면 겹친 문단만 지운다', () => {
    const keep = ['![](images/a.png)', '', 'Click the button.', '', '![](images/b.png)', '', 'Search Result', 'continues here.', '', '![Other](images/c.png)', '', 'Search Result']
    assert.deepEqual(mergeCaptionParagraphs(keep, caps).lines, keep)
    assert.deepEqual(mergeCaptionParagraphs(['![Search Result](images/d.png)', '', 'Search Result', ''], caps).lines, ['![Search Result](images/d.png)', ''])
  })

  it('윗줄 문장에 이어진 이미지는 빈 줄로 떼어 캡션이 붙는 그림으로 만든다 (목록 안 이어진 줄도)', () => {
    const { lines } = mergeCaptionParagraphs(['- Click the search icon.', '  ![](images/a.png){width=5in}', '', 'Search Result', '', 'Next.'], caps)
    assert.deepEqual(lines, ['- Click the search icon.', '', '  ![Search Result](images/a.png){width=5in}', '', 'Next.'])
  })

  it('pandoc AST(docx+styles)에서 캡션 스타일 문단 글자를 찾는다', () => {
    const div = (style: string, words: string[]) => ({
      t: 'Div',
      c: [['', [], [['custom-style', style]]], [{ t: 'Para', c: words.flatMap((w, i) => (i ? [{ t: 'Space' }, { t: 'Str', c: w }] : [{ t: 'Str', c: w }])) }]],
    })
    assert.deepEqual(captionsInAst([div('Caption', ['Login', 'screen']), div('Body Text', ['x']), div('caption', ['Logo'])]), ['Login screen', 'Logo'])
    assert.equal(captionKey('**Dealer** [List]{.mark}'), 'dealer list')
  })
})

describe('이미지만 든 칸 하나짜리 표 풀기', () => {
  it('표를 풀어 보통 이미지로 두고, 표 캡션(위에 나옴)은 지운다. 이미지에 캡션이 없으면 표 캡션을 쓴다', () => {
    const { lines, unwrapped } = unwrapImageTables([
      '- **When dealer creation succeeds**',
      '',
      '|  |',
      '|--------------------------------------------------|',
      '| ![Dealer Registration Notice](images/dealer-registration-notice.png){width=4.20in} |',
      '',
      ': Dealer Registration Notice',
      '',
      '|  |',
      '|------|',
      '| ![](media/image3.png#2){width=4.20in} |',
      '',
      ': Editing Post - Basic',
      '',
      'Next.',
    ])
    assert.deepEqual(lines, [
      '- **When dealer creation succeeds**',
      '',
      '![Dealer Registration Notice](images/dealer-registration-notice.png){width=4.20in}',
      '',
      '![Editing Post - Basic](media/image3.png#2){width=4.20in}',
      '',
      'Next.',
    ])
    assert.deepEqual(unwrapped, ['Dealer Registration Notice', 'Editing Post - Basic'])
  })

  it('글자나 칸이 더 있는 표, 이미지가 두 장인 표는 그대로', () => {
    const tables = [
      ['| Name | Value |', '|------|-------|', '| ![](images/a.png) |  |', '| Text |  |'],
      ['| Field | Desc |', '|---|---|', '| Name | Required |'],
      ['|  |  |', '|---|---|', '| ![](images/a.png) | ![](images/b.png) |'],
    ]
    for (const table of tables) assert.deepEqual(unwrapImageTables(table).lines, table)
  })
})

