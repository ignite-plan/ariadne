# 개발자 사용법

[← README](../../README.md)

## 매뉴얼 설정 (`manual.yaml`)

```yaml
title: Dealers Admin User Manual
version: 1.0.7
output: Hyundai-Dealers Admin User Manual_v{version}_EN   # Word 파일 이름
capture:
  baseUrl: https://stg-dealers-admin.hyundai-corp.io/ca
  viewport: { width: 1440, height: 900 }                  # 없으면 1440x900
code:
  app: apps/hyundai-bo                                    # affected가 볼 en.json: <app>/src/locales/en.json
video:
  tts: { provider: kokoro, voice: af_heart, speed: 1 }    # 가이드 영상 내레이션 (없으면 이 값)
  viewport: { width: 1920, height: 1080 }                 # 영상 화면 크기 (없으면 1920x1080. BO는 1440이면 오른쪽이 잘림)
  mask: ['header div:has(> span):not(:has(button))']      # 모든 영상에서 흐리게 할 CSS (헤더 로그인 사용자 이름)
chapters: [...]
```

`manual.yaml`은 `YAML.stringify` 형식으로만 씁니다(`saveManual`). 앱과 CLI가 같은 diff를 내게 하기 위해서입니다.

## 준비

```bash
pnpm install
cp .env.example .env    # DEALERHUB_WEB_DIR(dealerhub-web 로컬 경로), BO_BASE_URL(bo 캡처 주소 덮어쓰기, 선택)
brew install pandoc     # Google Chrome도 필요
brew install ffmpeg     # 가이드 영상(pnpm video)에만 필요
```

사내망에서 Electron 바이너리 다운로드가 실패하면 `NODE_USE_SYSTEM_CA=1 node node_modules/electron/install.js`를 실행합니다.

## 명령

| 명령 | 설명 |
|---|---|
| `pnpm login --manual bo` | 브라우저에서 STG BO MFA 로그인 → 유지되는 Chrome 프로필 `.auth/bo-profile` |
| `pnpm capture --manual bo [--only id,…]` | STG 캡처. 바뀐 이미지만 교체하고 `.capture/bo/report.json`에 결과를 남깁니다 |
| `pnpm affected --manual bo --base <ref> [--head <ref>]` | dealerhub-web 두 ref 사이 변경 → 영향 섹션, 변경 i18n key, 이미지 |
| `pnpm build --manual bo [--chapters 2,5]` | `dist/*.docx` |
| `pnpm import:docx --docx <file> --manual <id> [--title] [--version] [--keep-source]` | Word 원본 → 새 매뉴얼. `--analyze`는 분석만 합니다 |
| `pnpm make:reference --docx <file> --manual <id>` | 원본 서식으로 `reference.docx`를 다시 만듭니다 |
| `pnpm video --manual bo [--id id,…] [--no-tts] [--headed] [--preview] [--from n]` | 가이드 영상. `manuals/bo/videos/<id>.yaml` → `dist/videos/<id>.mp4`·`.srt`·`.vtt` |
| `pnpm typecheck` / `pnpm test` | 타입 검사 / core + app 테스트 |

## 릴리즈 변경 반영

Claude Code에서 **"이번 릴리즈 매뉴얼 갱신"**(`manual-update` 스킬)이라고 하면 아래 과정을 대신합니다. 직접 할 때:

1. `pnpm affected --manual bo --base <직전 반영 릴리즈> --head <이번 릴리즈>`
2. `pnpm capture --manual bo --only <영향 섹션 이미지 id>`. 세션이 없으면 먼저 `pnpm login`
3. 영향 섹션 본문 수정: `en.json` 라벨 변경은 그대로 치환하고, 항목, 검증 규칙, 버튼 동작 변경을 반영합니다.
4. `pnpm build --manual bo`로 확인한 뒤 커밋합니다. `manual.yaml`의 `version`은 합의 후 올립니다.

## 신규 메뉴 추가

Claude Code에서 **"<메뉴> 매뉴얼 추가"**(`manual-new-section` 스킬)라고 하면 됩니다. 직접 할 때:

1. `manuals/bo/<NN>-<chapter>/<NN>-<screen>.md`를 `_template.md` 형식으로 만들고 `manual.yaml`에 추가합니다. 앱의 **새 화면**으로 만들어도 됩니다.
2. front-matter `routes`, `sources`, `i18nPrefix`를 채웁니다. 이 값이 있어야 `affected`가 변경을 추적합니다.
3. `manuals/bo/shots.ts`에 캡처를 정의합니다. id는 caption slug입니다. 저장, 삭제, 발송, 승인 버튼은 누르지 않게 합니다.

```ts
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
{ id: 'dealer-list-view-img-1', path: '/dealer/company', manual: true }, // 자동 캡처 안 함
```

4. `pnpm capture --manual bo --only <ids>` → `pnpm build --manual bo`

## 리모트

- `origin` = ignite-plan/ariadne: 기준 리포입니다. 앱의 기본 리포이고, 기획자 제출이 여기로 들어옵니다. 작업 전에 `git pull`을 합니다.
- `zi-gae` = zi-gae/ariadne: 미러입니다. `git push zi-gae main`으로 맞춥니다.
