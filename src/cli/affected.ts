// usage: pnpm affected --manual bo --base release/2609-regular [--head release/2610-regular]
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEFAULT_LOCALE, findAffected } from '../core/index.ts'
import { loadEnv, MANUAL_OPTION, manualRef } from './common.ts'

loadEnv()
const { values } = parseArgs({
  options: {
    ...MANUAL_OPTION,
    base: { type: 'string' },
    head: { type: 'string', default: 'HEAD' },
    locale: { type: 'string', default: DEFAULT_LOCALE },
  },
})
if (!values.base) throw new Error('--base is required')

const result = findAffected({
  ...manualRef(values.manual),
  repo: resolve(process.env.DEALERHUB_WEB_DIR ?? '../dealerhub-web'),
  base: values.base,
  head: values.head,
  locale: values.locale,
})
console.log(JSON.stringify(result, null, 2))
