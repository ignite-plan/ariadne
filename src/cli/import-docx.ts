// 매뉴얼 Word를 장/절 Markdown으로 나눈다. 앱의 "새 매뉴얼 가져오기"와 같은 함수를 쓴다.
// usage: pnpm import:docx --docx ~/Desktop/FO.docx --manual fo [--title ..] [--version 1.0.0] [--chapters 2,3] [--analyze]
import { parseArgs } from 'node:util'
import { analyzeDocx, importDocx } from '../core/index.ts'
import { MANUAL_OPTION, manualRef, numberList } from './common.ts'

const { values } = parseArgs({
  options: {
    docx: { type: 'string' },
    ...MANUAL_OPTION,
    chapters: { type: 'string' },
    title: { type: 'string' },
    version: { type: 'string' },
    output: { type: 'string' },
    'keep-source': { type: 'boolean', default: false },
    'no-reference': { type: 'boolean', default: false },
    analyze: { type: 'boolean', default: false },
  },
})
if (!values.docx) throw new Error('--docx is required')
const only = numberList(values.chapters)

if (values.analyze) {
  console.log(JSON.stringify(await analyzeDocx(values.docx), null, 2))
} else {
  const result = await importDocx({
    ...manualRef(values.manual),
    docx: values.docx,
    title: values.title,
    version: values.version,
    output: values.output,
    chapters: only,
    keepSource: values['keep-source'],
    reference: !values['no-reference'],
  })
  for (const c of result.chapters) {
    if (!only || only.includes(c.no)) {
      console.log(`${c.no}. ${c.title} (${c.sections.length + (c.hasIntro ? 1 : 0)} files)`)
    }
  }
  for (const w of result.warnings) console.warn(`⚠ ${w}`)
}
