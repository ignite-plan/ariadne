import { defineVideo } from '../../../src/core/video/scenario.ts'

// 2. Dealer Management > Dealer List View. 조회만 한다
export default defineVideo({
  id: 'dealer-list',
  title: 'Dealer List View',
  intro: 'This video shows how to search for dealers and view their information in Dealer Management.',
  section: '02-dealer-management/01-dealer-list-view.md',
  scenes: [
    {
      say: 'The Dealer List screen provides a list of all registered dealers.',
      do: async (v) => {
        await v.goto('/dealer/company')
        await v.ready('text=Total')
      },
    },
    {
      say: 'Use the search filters to find dealers by company name, dealer number, dealer name, or status.',
      do: async (v) => v.highlight('form', 2500),
    },
    {
      say: 'For example, select Active as the status, and click Search.',
      do: async (v) => {
        // 두 번째 combobox가 Status (첫 번째는 검색 유형). STG에서 --headed로 확인
        await v.choose(v.page.getByRole('combobox').nth(1), 'Active')
        await v.click(v.page.getByRole('button', { name: 'Search', exact: true }))
        await v.ready('text=Total')
      },
    },
    {
      say: "Each row shows the dealer's zone, district, business end date, and current status.",
      do: async (v) => v.highlight(v.page.getByRole('row').nth(1), 2500),
    },
    {
      say: "Click the Location icon to open a popup showing the dealer's registered address.",
      do: async (v) => {
        await v.click(v.page.getByRole('button', { name: 'Location' }).first())
        await v.ready('text=Location Information')
      },
    },
    {
      say: 'Click OK to close the popup.',
      do: async (v) => v.click(v.page.getByRole('button', { name: 'OK', exact: true })),
    },
    {
      say: "To see more details, click the View icon. The dealer's detail page opens.",
      do: async (v) => {
        await v.click(v.page.getByRole('button', { name: 'View' }).first())
        await v.page.waitForLoadState('networkidle')
      },
    },
  ],
})
