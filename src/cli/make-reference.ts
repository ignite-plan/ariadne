// 원본 Word의 서식으로 manuals/<m>/reference.docx를 만든다.
// usage: pnpm make:reference --docx ~/Desktop/Hyundai.docx --manual bo
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { makeReference, manualDir } from '../core/index.ts'

const { values } = parseArgs({
  options: { docx: { type: 'string' }, manual: { type: 'string', default: 'bo' } },
})
if (!values.docx) throw new Error('--docx is required')

console.log(makeReference(resolve(values.docx), resolve(manualDir({ root: process.cwd(), manual: values.manual! }), 'reference.docx')))
