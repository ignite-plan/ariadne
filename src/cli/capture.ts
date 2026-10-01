// usage: pnpm capture --manual bo [--only dealer-list,location-popup] [--threshold 0.005]
import { parseArgs } from 'node:util'
import { capture, defaultAuthFile } from '../core/index.ts'

process.loadEnvFile()
const { values } = parseArgs({
  options: {
    manual: { type: 'string', default: 'bo' },
    only: { type: 'string' },
    threshold: { type: 'string', default: '0.005' },
  },
})
const baseUrl = process.env.BO_BASE_URL
if (!baseUrl) throw new Error('.env에 BO_BASE_URL이 없습니다')
const ref = { root: process.cwd(), manual: values.manual! }
const authFile = defaultAuthFile(ref)

const report = await capture({
  ...ref,
  baseUrl,
  authFile,
  only: values.only?.split(','),
  threshold: Number(values.threshold),
}).catch((error: Error) => {
  if (error.message.includes(authFile)) throw new Error(`${error.message}: pnpm login --manual ${ref.manual}`)
  throw error
})

console.log(
  `changed ${report.changed.length} / unchanged ${report.unchanged.length} / skipped ${report.skipped.length} / failed ${report.failed.length}`,
)
for (const { id, error } of report.failed) console.log(`  ✗ ${id}: ${error}`)
