// 가져오기 마법사에서 고르는 dealerhub-web 앱과 캡처 기본값
export interface CodePreset {
  app: string
  label: string
  // STG 캡처 주소 기본값
  baseUrl: string
}

export const CODE_PRESETS: CodePreset[] = [
  { app: 'apps/hyundai-fo', label: '딜러포털 FO (hyundai-fo)', baseUrl: 'https://stg-dealers.hyundai-corp.io' },
  { app: 'apps/hyundai-bo', label: '딜러포털 BO (hyundai-bo)', baseUrl: 'https://stg-dealers-admin.hyundai-corp.io/ca/admin' },
  { app: 'apps/dealer-profile', label: 'Dealer Profile (dealer-profile)', baseUrl: '' },
]

export const VIEWPORTS = {
  desktop: { label: 'PC (1440×900)', width: 1440, height: 900 },
  mobile: { label: '모바일 (390×844)', width: 390, height: 844 },
} as const

export type ViewportKey = keyof typeof VIEWPORTS

export function viewportKey(viewport?: { width: number; height: number }): ViewportKey {
  return viewport && viewport.width < 800 ? 'mobile' : 'desktop'
}

// 매뉴얼 제목 → id 제안 (영문 slug). 영문이 없으면 manual
export function suggestManualId(title: string, taken: string[]) {
  const words = title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && !['dealers', 'dealer', 'user', 'manual', 'hyundai', 'the'].includes(w))
  const base = (words.join('-') || 'manual').slice(0, 32).replace(/-$/, '')
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}
