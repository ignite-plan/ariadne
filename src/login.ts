// BO는 MPASS MFA가 있어 자동 로그인이 안 된다. 직접 로그인한 세션을 .auth/<manual>.json에 저장한다.
// usage: pnpm login --manual bo
import { mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'

process.loadEnvFile()
const { values } = parseArgs({ options: { manual: { type: 'string', default: 'bo' } } })
const baseUrl = process.env.BO_BASE_URL
if (!baseUrl) throw new Error('.env에 BO_BASE_URL이 없습니다')

const browser = await chromium.launch({ channel: 'chrome', headless: false })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
await page.goto(baseUrl)

const rl = createInterface({ input: process.stdin, output: process.stdout })
await rl.question('브라우저에서 로그인(MFA 포함)을 마치고 BO 메인이 보이면 Enter를 누르세요.')
rl.close()

mkdirSync('.auth', { recursive: true })
await context.storageState({ path: `.auth/${values.manual}.json` })
await browser.close()
console.log(`saved .auth/${values.manual}.json`)
