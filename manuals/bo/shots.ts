import { defineShots } from '../../src/core/shot.ts'

// 컨텐츠 영역 셀렉터. HMG Admin 셸(헤더/LNB)을 제외한 BO 앱 루트
const CONTENT = '#root'
const DIALOG = '[role="dialog"], [role="alertdialog"]'

export const shots = defineShots([
  // 2. Dealer Management > Dealer List View
  { id: 'dealer-list', path: '/dealer/company', ready: 'text=Total', clip: CONTENT },
  {
    id: 'location-popup',
    path: '/dealer/company',
    ready: 'text=Total',
    steps: async (page) => {
      await page.getByRole('button', { name: 'Location' }).first().click()
      await page.getByText('Location Information').waitFor()
    },
    clip: DIALOG,
  },
  { id: 'dealer-list-search', path: '/dealer/company', ready: 'text=Total', clip: 'form, [class*="Filter"]' },
  { id: 'dealer-list-view-img-1', path: '/dealer/company', manual: true },
  { id: 'dealer-list-view-img-2', path: '/dealer/company', manual: true },
])
