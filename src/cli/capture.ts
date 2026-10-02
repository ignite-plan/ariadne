// usage: pnpm capture --manual bo [--only dealer-list,location-popup] [--threshold 0.005]
import { parseArgs } from 'node:util'
import { capture, defaultProfileDir } from '../core/index.ts'

try {
  process.loadEnvFile()
} catch {
  // .env 없이 manual.yaml capture.baseUrl만 써도 된다
}
const { values } = parseArgs({
  options: {
    manual: { type: 'string', default: 'bo' },
    only: { type: 'string' },
    threshold: { type: 'string', default: '0.005' },
  },
})
// .env BO_BASE_URL은 bo 매뉴얼의 캡처 주소를 덮어쓴다 (예전 설정 호환)
const baseUrl = values.manual === 'bo' ? process.env.BO_BASE_URL : undefined
const ref = { root: process.cwd(), manual: values.manual! }
const profileDir = defaultProfileDir(ref)

const report = await capture({
  ...ref,
  baseUrl,
  profileDir,
  only: values.only?.split(','),
  threshold: Number(values.threshold),
}).catch((error: Error) => {
  if (error.message.includes(profileDir)) throw new Error(`${error.message}: pnpm login --manual ${ref.manual}`)
  throw error
})

console.log(
  `changed ${report.changed.length} / unchanged ${report.unchanged.length} / skipped ${report.skipped.length} / failed ${report.failed.length}`,
)
for (const { id, error } of report.failed) console.log(`  ✗ ${id}: ${error}`)
