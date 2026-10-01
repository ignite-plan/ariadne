// usage: pnpm build --manual bo [--chapters 2,5]
import { parseArgs } from 'node:util'
import { buildDocx } from '../core/index.ts'

const { values } = parseArgs({
  options: { manual: { type: 'string', default: 'bo' }, chapters: { type: 'string' } },
})

const { docx, warnings } = buildDocx({
  root: process.cwd(),
  manual: values.manual!,
  chapters: values.chapters?.split(',').map(Number),
})
if (warnings) process.stderr.write(warnings)
console.log(docx)
