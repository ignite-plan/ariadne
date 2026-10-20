import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { repairImportArtifacts, repairMarkSpans, repairMarkup } from '../markup-repair.ts'

describe('깨진 표기 바로잡기', () => {
  it('Word 가져오기: 빈 굵게는 지우고, 닫는 별표가 이스케이프된 굵게는 닫는다', () => {
    assert.equal(repairImportArtifacts('The button is displayed.**\\**'), 'The button is displayed.')
    assert.equal(repairImportArtifacts('**\\**'), '')
    assert.equal(repairImportArtifacts('select a language using **radio buttons.\\**'), 'select a language using **radio buttons.**')
    // 멀쩡한 굵게·버튼은 그대로
    for (const ok of ['**Label**: text', 'Click **\\[Save\\]**.', 'a \\* b']) assert.equal(repairImportArtifacts(ok), ok)
  })

  it('형광펜: 목록 기호를 밖으로, 굵게를 쪼갠 괄호를 굵게 앞으로, 줄바꿈 표시를 밖으로', () => {
    assert.equal(repairMarkSpans('[    - Target audience changes]{.mark}'), '    - [Target audience changes]{.mark}')
    assert.equal(repairMarkSpans(' [ - If only the Title]{.mark}'), '  - [If only the Title]{.mark}')
    assert.equal(repairMarkSpans('[1. Step]{.mark}'), '1. [Step]{.mark}')
    assert.equal(repairMarkSpans('- **[Domain**: Placeholder]{.mark}'), '- [**Domain**: Placeholder]{.mark}')
    assert.equal(repairMarkSpans('- *[*Menu Path**: Displayed]{.mark}'), '- [**Menu Path**: Displayed]{.mark}')
    assert.equal(repairMarkSpans('  - [When you change it.\\]{.mark}'), '  - [When you change it.]{.mark}\\')
    for (const ok of ['- [**Domain**: ok]{.mark}', '**[Save]**', 'Click **\\[Save\\]**', '[text](https://x)']) assert.equal(repairMarkSpans(ok), ok)
  })

  it('여러 줄', () => {
    assert.equal(repairMarkup('a.**\\**\n[  - b]{.mark}\n'), 'a.\n  - [b]{.mark}\n')
  })
})
