// 테스트용 임시 리포. manuals/demo에 장 2개, 섹션 3개
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'

export const SECTIONS: Record<string, string> = {
  '01-login/00-intro.md': `---
title: Login
routes: []
sources: []
i18nPrefix: []
---

Log in with MPASS.
`,
  '02-dealer/01-list.md': `---
title: Dealer List View
routes:
  - /dealer/company
sources:
  - apps/hyundai-bo/src/pages/Dealer/Company/List/**
i18nPrefix:
  - DEALER_LIST_
---

## Dealer List View

![Dealer List](images/dealer-list.png){width=6.27in}

![](images/location-popup.png){width=3.4in}
`,
  '02-dealer/02-create.md': `---
title: Dealer Creation
sources:
  - apps/hyundai-bo/src/pages/Dealer/Company/Create/**
i18nPrefix:
  - DEALER_CREATE_
---

## Dealer Creation

- **Company name**: Required.
`,
}

export function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'manual-test-'))
  const dir = join(root, 'manuals', 'demo')
  mkdirSync(join(dir, 'images'), { recursive: true })
  writeFileSync(
    join(dir, 'manual.yaml'),
    `title: Demo Manual
version: 0.1.0
chapters:
  - title: Login
    dir: 01-login
    sections:
      - 00-intro.md
  - title: Dealer
    dir: 02-dealer
    sections:
      - 01-list.md
      - 02-create.md
`,
  )
  for (const [path, md] of Object.entries(SECTIONS)) {
    mkdirSync(join(dir, path.split('/')[0]), { recursive: true })
    writeFileSync(join(dir, path), md)
  }
  return { ref: { root, manual: 'demo' }, dir, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

// 단색 PNG. paint로 일부 픽셀을 바꾼다
export function writePng(path: string, width: number, height: number, paint?: (x: number, y: number) => boolean) {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const on = paint?.(x, y) ?? false
      png.data[i] = on ? 255 : 0
      png.data[i + 1] = 0
      png.data[i + 2] = 0
      png.data[i + 3] = 255
    }
  }
  writeFileSync(path, PNG.sync.write(png))
}
