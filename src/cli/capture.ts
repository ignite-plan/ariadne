// usage: pnpm capture --manual bo [--only dealer-list,location-popup] [--threshold 0.005]
import { parseArgs } from 'node:util'
import { capture, defaultProfileDir } from '../core/index.ts'
import { baseUrlOverride, loadEnv, MANUAL_OPTION, manualRef, withReloginHint } from './common.ts'

loadEnv()
const { values } = parseArgs({
  options: {
    ...MANUAL_OPTION,
    only: { type: 'string' },
    threshold: { type: 'string', default: '0.005' },
  },
})
const ref = manualRef(values.manual)
const profileDir = defaultProfileDir(ref)

const report = await capture({
  ...ref,
  baseUrl: baseUrlOverride(ref.manual),
  profileDir,
  only: values.only?.split(','),
  threshold: Number(values.threshold),
}).catch((error: unknown) => {
  throw new Error(withReloginHint(error, ref, profileDir), { cause: error })
})

console.log(
  `changed ${report.changed.length} / unchanged ${report.unchanged.length} / skipped ${report.skipped.length} / failed ${report.failed.length}`,
)
for (const { id, error } of report.failed) console.log(`  ✗ ${id}: ${error}`)
