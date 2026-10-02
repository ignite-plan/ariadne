import { defineVideo } from '../../../src/core/video/scenario.ts'

// 2. Dealer Management > Dealer Creation Screen. STG에 실제로 Draft 딜러를 저장하고 cleanup에서 지운다.
// 마지막 단계의 Create는 HMG Partner 연동이 있어 누르지 않는다 (Save Draft까지만)
const stamp = new Date().toISOString().slice(5, 16).replace(/\D/g, '') // MMDDHHmm
const dealerName = `Video Test ${stamp}` // 최대 20자
const duns = `9${stamp}`.padEnd(9, '0').slice(0, 9)

export default defineVideo({
  id: 'dealer-create',
  title: 'Dealer Creation',
  intro: 'This video shows how to start registering a new dealer and save it as a draft.',
  section: '02-dealer-management/02-dealer-creation-screen.md',
  mutates: true,
  scenes: [
    {
      say: 'To register a new dealer, click Create New on the Dealer List screen.',
      do: async (v) => {
        await v.goto('/dealer/company')
        await v.ready('text=Total')
        await v.click(v.page.getByText('Create New', { exact: true }))
        await v.ready('text=Dealer Basic Information')
      },
    },
    {
      say: 'Dealer creation consists of four steps, starting with Dealer Basic Information.',
      do: async (v) => v.highlight(v.page.getByText('Dealer Basic Information').first(), 2000),
    },
    {
      say: 'Enter the dealer name in English and French. Each name can be up to 20 characters.',
      do: async (v) => {
        const names = v.page.getByPlaceholder(/Enter Dealer Name/)
        await v.type(names.nth(0), dealerName)
        await v.type(names.nth(1), dealerName)
      },
    },
    {
      say: 'Enter the 9-digit DUNS number, and the official company name.',
      do: async (v) => {
        await v.type(v.page.getByPlaceholder('Enter 9-digit DUNS Number'), duns)
        await v.type(v.page.getByPlaceholder(/Enter Legal Business Company Name/), `${dealerName} Inc.`)
      },
    },
    {
      say: 'You can save the form at any time, even with partial information. Click Save Draft.',
      do: async (v) => {
        await v.click(v.page.getByRole('button', { name: 'Save Draft' }))
        await v.page.waitForLoadState('networkidle')
      },
    },
    {
      say: 'The dealer is saved with the Draft status, and appears in the Dealer List as a draft entry.',
      do: async (v) => {
        await v.goto('/dealer/company')
        await v.ready(`text=${dealerName}`)
        await v.highlight(v.page.getByRole('row', { name: new RegExp(dealerName) }), 2500)
      },
    },
  ],
  // 만든 Draft를 지운다 (Delete 아이콘 → Discard)
  cleanup: async (v) => {
    await v.goto('/dealer/company')
    const row = v.page.getByRole('row', { name: new RegExp(dealerName) })
    await row.getByRole('button', { name: 'Delete' }).click()
    await v.page.getByRole('button', { name: 'Discard' }).click()
    await row.waitFor({ state: 'detached' })
  },
})
