// usage: pnpm build --manual bo [--chapters 2,5]
import { parseArgs } from 'node:util'
import { buildDocx } from '../core/index.ts'
import { MANUAL_OPTION, manualRef, numberList } from './common.ts'

const { values } = parseArgs({
  options: { ...MANUAL_OPTION, chapters: { type: 'string' } },
})

const { docx, warnings, issues } = buildDocx({
  ...manualRef(values.manual),
  chapters: numberList(values.chapters),
})
if (warnings) process.stderr.write(warnings)
// Word에 Markdown 표기가 글자로 그대로 나오는 곳
for (const { section, issues: list } of issues) process.stderr.write(`[Word 표기] ${section}\n  ${list.join('\n  ')}\n`)
console.log(docx)
