// usage: pnpm login --manual bo
import { createInterface } from 'node:readline/promises'
import { relative } from 'node:path'
import { parseArgs } from 'node:util'
import { defaultProfileDir, loadManual, login } from '../core/index.ts'

try {
  process.loadEnvFile()
} catch {
  // .env 없이 manual.yaml capture.baseUrl만 써도 된다
}
const { values } = parseArgs({ options: { manual: { type: 'string', default: 'bo' } } })
const ref = { root: process.cwd(), manual: values.manual! }
const baseUrl = (values.manual === 'bo' && process.env.BO_BASE_URL) || loadManual(ref).capture?.baseUrl
if (!baseUrl) throw new Error(`manuals/${values.manual}/manual.yaml에 capture.baseUrl이 없습니다`)

const profileDir = await login({
  baseUrl,
  profileDir: defaultProfileDir(ref),
  waitUntilDone: async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    await rl.question('브라우저에서 로그인(MFA 포함)을 마치고 BO 메인이 보이면 Enter를 누르세요.')
    rl.close()
  },
})
console.log(`saved ${relative(process.cwd(), profileDir)} (유지되는 Chrome 프로필)`)
