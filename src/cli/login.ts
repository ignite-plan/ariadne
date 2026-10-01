// usage: pnpm login --manual bo
import { createInterface } from 'node:readline/promises'
import { relative } from 'node:path'
import { parseArgs } from 'node:util'
import { defaultAuthFile, login } from '../core/index.ts'

process.loadEnvFile()
const { values } = parseArgs({ options: { manual: { type: 'string', default: 'bo' } } })
const baseUrl = process.env.BO_BASE_URL
if (!baseUrl) throw new Error('.env에 BO_BASE_URL이 없습니다')

const authFile = await login({
  baseUrl,
  authFile: defaultAuthFile({ root: process.cwd(), manual: values.manual! }),
  waitUntilDone: async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    await rl.question('브라우저에서 로그인(MFA 포함)을 마치고 BO 메인이 보이면 Enter를 누르세요.')
    rl.close()
  },
})
console.log(`saved ${relative(process.cwd(), authFile)}`)
