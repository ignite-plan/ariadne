// usage: pnpm build --manual bo [--chapters 2,5]
import { parseArgs } from 'node:util'
import { buildDocx } from '../core/index.ts'
import { MANUAL_OPTION, manualRef, numberList } from './common.ts'

const { values } = parseArgs({
  options: { ...MANUAL_OPTION, chapters: { type: 'string' } },
})

const { docx, warnings } = buildDocx({
  ...manualRef(values.manual),
  chapters: numberList(values.chapters),
})
if (warnings) process.stderr.write(warnings)
console.log(docx)
