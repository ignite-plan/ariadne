// usage: pnpm affected --manual bo --base release/2609-regular [--head release/2610-regular]
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEFAULT_LOCALE, findAffected } from '../core/index.ts'

process.loadEnvFile()
const { values } = parseArgs({
  options: {
    manual: { type: 'string', default: 'bo' },
    base: { type: 'string' },
    head: { type: 'string', default: 'HEAD' },
    locale: { type: 'string', default: DEFAULT_LOCALE },
  },
})
if (!values.base) throw new Error('--base is required')

const result = findAffected({
  root: process.cwd(),
  manual: values.manual!,
  repo: resolve(process.env.DEALERHUB_WEB_DIR ?? '../dealerhub-web'),
  base: values.base,
  head: values.head,
  locale: values.locale,
})
console.log(JSON.stringify(result, null, 2))
