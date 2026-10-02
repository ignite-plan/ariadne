# Ariadne

Dealers 사용자 매뉴얼(영문, Word)을 만드는 리포입니다. BO, FO 등 매뉴얼 여러 개를 함께 관리합니다.

- 매뉴얼 원본은 `manuals/<매뉴얼 id>/`의 Markdown입니다(예: `manuals/bo/`). Word 파일은 원본으로 만드는 결과물입니다.
- **기획자**는 macOS 앱 **Ariadne**로 문서를 고치고, 화면을 캡처하고, Word를 만들고, 제출합니다. 터미널과 git은 몰라도 됩니다.
- **개발자**는 `pnpm` 명령과 Claude 스킬로 dealerhub-web 릴리즈 변경을 매뉴얼에 반영합니다.

| 하고 싶은 일 | 보는 곳 |
|---|---|
| 앱 설치 | [설치 가이드](app/INSTALL.md) |
| 앱으로 매뉴얼 고치기 | [기획자 사용법](#기획자-사용법) |
| Word 원본으로 새 매뉴얼 만들기 | [새 매뉴얼 가져오기](#새-매뉴얼-가져오기) |
| 매뉴얼 문장 규칙 | [작성 규칙](#작성-규칙) |
| 릴리즈 변경 반영, 신규 메뉴 추가 | [개발자 사용법](#개발자-사용법) |
| 앱 수정·배포 | [앱 개발](#앱-개발) |

---

## 기획자 사용법

### 설치와 첫 실행

[설치 가이드](app/INSTALL.md)를 따라 dmg를 설치합니다. 첫 실행 때는 앱이 순서대로 안내합니다.

1. **GitHub 연결**: GitHub 토큰을 붙여 넣습니다. 앱 안의 링크로 토큰 만드는 페이지가 열립니다.
2. **매뉴얼 내려받기**: 기본 위치는 `~/Documents/Ariadne`입니다.
3. **환경 점검**: pandoc(미리보기, Word 만들기)과 Chrome(화면 캡처)이 있는지 확인합니다.

두 번째 실행부터는 바로 편집 화면이 열립니다. 열 때마다 다른 사람이 올린 변경을 자동으로 받아 옵니다.

### 화면 구성

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Ariadne  Dealers Admin User Manual v1.0.7  [✓ 최신]   캡처  Word 만들기  제출  ⚙ │
├───────────────┬──────────────────────────────────────────────────────────┤
│ 목차 TODO 변경  │ 2. Dealer Management / Dealer List View  저장됨  편집|◫|미리보기 │
│ [화면 찾기]     │ › 섹션 정보 (개발자용)                                      │
│ 1 Back-office │ ┌ B [ ] • ⇥ 🖼 ⚑ ─────── ↶ ↷ ┐ ┌───────────────────────┐ │
│ 2 Dealer Mgmt │ │                            │ │                       │ │
│   Dealer List │ │  편집기                     │ │  미리보기 (Word 모양)   │ │
│   ...         │ │                            │ │                       │ │
│ [+ 새 화면]    │ └────────────────────────────┘ └───────────────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────┘
```

| 영역 | 설명 |
|---|---|
| 매뉴얼 이름 | 누르면 다른 매뉴얼로 바꾸거나 새 매뉴얼을 가져옵니다 |
| 동기화 표시 | `최신`, `새 변경 있음`, `합칠 변경 있음`, `오프라인`. 누르면 다시 받아 옵니다 |
| 목차 탭 | 장과 화면 목록입니다. 노란 숫자는 남은 TODO 수, 빨간 점은 아직 제출하지 않은 변경입니다 |
| TODO 탭 | 매뉴얼 전체의 TODO를 모아 보여 줍니다. 누르면 그 줄로 이동합니다 |
| 변경 탭 | 제출 전 변경 목록입니다. 항목마다 되돌릴 수 있습니다 |
| 편집 / ◫ / 미리보기 | 편집기만, 나란히, 미리보기만 보기 |
| 섹션 정보 | 코드와 매뉴얼을 잇는 값(routes, sources, i18nPrefix)입니다. 기획자는 건드리지 않아도 됩니다 |

### 문장 고치기

1. 왼쪽 **목차**에서 화면을 고릅니다. **화면 찾기**로 검색할 수 있습니다.
2. 가운데 편집기에서 고칩니다. 오른쪽 미리보기가 Word와 같은 모양으로 바로 바뀝니다.
3. 입력을 멈추면 자동 저장됩니다(`저장됨`). ⌘S로 바로 저장할 수도 있습니다.

툴바:

| 버튼 | 넣는 것 | 결과 |
|---|---|---|
| **B** | `**Label**` | 항목 이름 (굵게) |
| **[ ]** | `**\[Button\]**` | 버튼 이름 `[Save]` |
| • / ⇥ | `- ` / 들여쓰기 | 목록 / 하위 목록 |
| 🖼 | 이미지 | 아래 [이미지 넣기](#이미지-넣기) |
| ⚑ | `<!-- TODO: … -->` | 확인이 필요한 메모. Word에는 나오지 않습니다 |
| ↶ ↷ | | 되돌리기 / 다시 실행 |

편집기 안의 회색 칩(`전체 6.27in`)은 이미지가 Word에 들어갈 크기입니다. 크기를 바꾸려면 이미지를 지우고 다시 넣습니다.

### 이미지 넣기

- **새 스크린샷**: 편집기에 붙여 넣거나(⌘V) 파일을 끌어 놓습니다. 설명(caption, 영어)과 크기를 고르고 **넣기**를 누릅니다.
- **있는 이미지**: 툴바 🖼 → **있는 이미지**에서 검색해 고릅니다. 두 번 누르면 바로 들어갑니다.
- 크기: **전체 화면**(6.27in), **팝업**(4.2in), **작은 팝업**(3.4in), **아이콘**(0.24in, 문장 안에 들어감)

PNG가 아닌 이미지는 PNG로 바꿔 저장합니다.

### 화면 캡처 (STG)

화면이 바뀌었을 때 매뉴얼 이미지를 새로 찍습니다. 캡처 대상 주소와 화면 크기는 매뉴얼마다 정해져 있습니다(설정 → 매뉴얼).

1. 위쪽 **캡처**를 누릅니다.
2. 처음이거나 세션이 만료되었으면 **로그인**을 누릅니다. Chrome 창이 열리면 STG에 로그인(MFA 포함)하고, 앱에서 **로그인 완료**를 누릅니다. 로그인 세션은 매뉴얼마다 따로 저장합니다.
3. **지금 화면** 또는 **전체**에서 캡처할 이미지를 고르고 **N장 캡처**를 누릅니다.
4. 바뀐 이미지만 **지금 매뉴얼 / 새로 찍은 화면**으로 나란히 나옵니다. 반영할 것만 체크하고 **선택한 N장 반영**을 누릅니다.

- 캡처는 화면을 열고 찍기만 합니다. 저장, 삭제 같은 버튼은 누르지 않습니다.
- `수동` 표시가 붙은 이미지는 자동으로 찍지 않습니다(아이콘을 잘라 낸 이미지 등).
- 목록에 원하는 화면이 없으면 개발자에게 캡처 정의(`shots.ts`) 추가를 요청합니다.

### 화면(섹션) 추가·삭제

- **추가**: 목차 아래 **새 화면**을 누르거나, 장 이름 옆 **+**를 누릅니다. 장을 고르고 화면 이름(영어)을 넣습니다. 새 장도 만들 수 있습니다.
- **삭제**: 목차에서 화면에 마우스를 올리고 🗑를 누릅니다. 제출 전이면 **변경** 탭에서 되돌릴 수 있습니다.

### 새 매뉴얼 가져오기

BO 매뉴얼과 같은 형식의 Word 원본(FO 매뉴얼 등)으로 새 매뉴얼을 만듭니다.

1. 위쪽 매뉴얼 이름 → **새 매뉴얼 가져오기…**
2. **Word 파일 고르기…**로 원본을 고릅니다. 앱이 장, 화면, 이미지 수를 분석해 보여 줍니다. 이 단계에서는 아무것도 바뀌지 않습니다.
   - 노란 경고가 있으면 내용을 확인합니다. 예: 목차의 제목을 본문에서 못 찾은 경우, 이미지 수가 맞지 않는 경우
3. 정보를 확인합니다. 대부분 자동으로 채워집니다.

   | 항목 | 설명 |
   |---|---|
   | 매뉴얼 제목 | 표지에서 가져옵니다. 예: `Dealers FO User Manual` |
   | id | 폴더 이름(영문). 제목에서 만듭니다. 예: `fo` |
   | 버전 | 파일 이름의 `_v1.2.3`에서 가져옵니다. 없으면 `1.0.0` |
   | Word 파일 이름 | Word 만들기로 생기는 파일 이름. `{version}`은 버전으로 바뀝니다 |
   | 화면(코드) 연결 | 딜러포털 FO / BO / Dealer Profile. 고르면 캡처 주소가 채워집니다 |
   | 캡처 주소, 화면 크기 | STG 주소와 PC/모바일 |
   | 원본 Word 보관 | 켜 두면 `manuals/<id>/source/`에 원본을 같이 둡니다(나중에 서식을 다시 뽑을 때 필요) |

4. **가져오기**를 누르면 새 매뉴얼로 바뀝니다. 미리보기로 확인하고 **제출**합니다.

- 가져온 매뉴얼은 자동 캡처 정의가 비어 있습니다. 캡처가 필요하면 개발자에게 `shots.ts` 추가를 요청합니다.
- 잘못 가져왔으면 제출 전에 다른 매뉴얼로 바꾼 뒤 **변경** 탭의 **모두 되돌리기**로 지웁니다.

### Word 만들기

위쪽 **Word 만들기**에서 **전체 매뉴얼** 또는 **지금 장만**을 고릅니다. 완료 알림의 **열기**를 누르면 Word로 열립니다. 파일은 작업 폴더의 `dist/`에 생깁니다.

### 제출

1. 위쪽 **제출**을 누릅니다(숫자는 변경 수).
2. 바뀐 화면 목록을 확인하고, **무엇을 바꿨나요**를 한 줄로 고칩니다(자동으로 채워집니다).
3. **제출하고 바로 반영**을 누르면 매뉴얼 원본(GitHub)에 올라갑니다.

- 다른 사람이 먼저 올린 변경은 자동으로 합칩니다.
- 같은 문장을 동시에 고쳐 합칠 수 없으면, 앱이 PR을 만들어 개발자에게 넘깁니다. 내 수정은 사라지지 않습니다.
- 바로 반영하지 않고 개발자 검토를 거치려면 **설정 → 일반 → 제출 방식**을 **검토 후 반영 (PR)** 으로 바꿉니다.

### 되돌리기

**변경** 탭에서 항목 옆 ↺로 하나씩, 아래 **모두 되돌리기**로 전부 되돌립니다. 마지막으로 제출된 상태로 돌아갑니다.

### 설정 (⚙)

| 탭 | 내용 |
|---|---|
| 일반 | 매뉴얼 선택, 제출 방식 |
| 매뉴얼 | 지금 매뉴얼의 제목, 버전, Word 파일 이름, 캡처 주소와 화면 크기, 코드 연결. 바꾸면 제출해야 다른 사람에게 반영됩니다 |
| 계정 | GitHub 계정 확인, 토큰 바꾸기, 로그아웃 |
| 환경 점검 | pandoc, Chrome, 로그인 세션 상태와 설치 링크 |
| 고급 | 리포 주소, 작업 폴더, pandoc 경로, dealerhub-web 경로 |
| 변경 영향 | 개발자용. 두 릴리즈 사이 코드 변경이 어느 화면에 영향을 주는지 찾기 |
| 정보 | 앱 버전, 새 버전 확인 |

### 문제 해결

| 증상 | 해결 |
|---|---|
| 토큰이 유효하지 않거나 만료 | 설정 → 계정에서 새 토큰으로 바꿉니다 |
| 권한이 없습니다 / SSO | 토큰 페이지에서 `ignite-plan` 조직 SSO를 승인합니다. fine-grained 토큰이 막혀 있으면 classic 토큰(`repo` 권한)을 씁니다 |
| 미리보기가 안 나옴 | 설정 → 환경 점검에서 pandoc을 확인합니다 |
| 캡처가 `세션 만료`로 실패 | 캡처 화면에서 **다시 로그인** |
| 동기화가 `오프라인` | 네트워크를 확인하고 동기화 표시를 다시 누릅니다. 편집과 저장은 오프라인에서도 됩니다 |
| 새 버전 알림 | 알림의 **받기**로 dmg를 받아 덮어 설치합니다 |

---

## 작성 규칙

독자는 매뉴얼마다 다릅니다(BO: HMG/법인 운영자, FO: 딜러 사용자). 형식은 [`manuals/bo/_template.md`](manuals/bo/_template.md)를 따릅니다.

- 영어, 현재형, 짧은 문장으로 씁니다.
- 화면 하나는 파일 하나이고, 제목(H2)도 하나입니다. 장 제목(H1)은 빌드가 붙입니다.
- 순서: 소개 bullet → 스크린샷 + caption → 항목 설명 → 버튼 동작 → 팝업은 해당 위치에 스크린샷 + 설명
- 항목은 `**Label**: 설명`으로 씁니다. 입력 항목은 하위 bullet에 Required/Optional, 제약(최대 길이, 형식), 기본값을 씁니다.
- 버튼은 `**\[Label\]**`로 씁니다.
- **UI 라벨은 실제 화면 문구(dealerhub-web `en.json`) 그대로** 씁니다.
- **근거 없는 정책은 쓰지 않습니다.** 확인이 필요하면 TODO(⚑)로 남깁니다.

```markdown
## Dealer List View

- This screen provides a list of all registered dealers.

![Dealer List](images/dealer-list.png){width=6.27in}

**Dealer Information Columns**

- **Status**: Current status of the dealer.

  - **Draft**: Dealer creation in progress.

- Click **\[Search\]** to apply the selected filters.
```

---

## 개발자 사용법

### 매뉴얼 설정 (`manual.yaml`)

```yaml
title: Dealers Admin User Manual
version: 1.0.7
output: Hyundai-Dealers Admin User Manual_v{version}_EN   # Word 파일 이름
capture:
  baseUrl: https://stg-dealers-admin.hyundai-corp.io/ca/admin
  viewport: { width: 1440, height: 900 }                  # 없으면 1440x900
code:
  app: apps/hyundai-bo                                    # affected가 볼 en.json: <app>/src/locales/en.json
chapters: [...]
```

`manual.yaml`은 `YAML.stringify` 형식으로만 씁니다(`saveManual`). 앱과 CLI가 같은 diff를 내게 하기 위해서입니다.

### 준비

```bash
pnpm install
cp .env.example .env    # DEALERHUB_WEB_DIR(dealerhub-web 로컬 경로), BO_BASE_URL(bo 캡처 주소 덮어쓰기, 선택)
brew install pandoc     # Google Chrome도 필요
```

사내망에서 Electron 바이너리 다운로드가 실패하면 `NODE_USE_SYSTEM_CA=1 node node_modules/electron/install.js`를 실행합니다.

### 명령

| 명령 | 설명 |
|---|---|
| `pnpm login --manual bo` | 브라우저에서 STG BO MFA 로그인 → `.auth/bo.json` |
| `pnpm capture --manual bo [--only id,…]` | STG 캡처. 바뀐 이미지만 교체하고 `.capture/bo/report.json`에 결과를 남깁니다 |
| `pnpm affected --manual bo --base <ref> [--head <ref>]` | dealerhub-web 두 ref 사이 변경 → 영향 섹션, 변경 i18n key, 이미지 |
| `pnpm build --manual bo [--chapters 2,5]` | `dist/*.docx` |
| `pnpm import:docx --docx <file> --manual <id> [--title] [--version] [--keep-source]` | Word 원본 → 새 매뉴얼. `--analyze`는 분석만 합니다 |
| `pnpm make:reference --docx <file> --manual <id>` | 원본 서식으로 `reference.docx`를 다시 만듭니다 |
| `pnpm typecheck` / `pnpm test` | 타입 검사 / core + app 테스트 |

### 릴리즈 변경 반영

Claude Code에서 **"이번 릴리즈 매뉴얼 갱신"**(`manual-update` 스킬)이라고 하면 아래 과정을 대신합니다. 직접 할 때:

1. `pnpm affected --manual bo --base <직전 반영 릴리즈> --head <이번 릴리즈>`
2. `pnpm capture --manual bo --only <영향 섹션 이미지 id>`. 세션이 없으면 먼저 `pnpm login`
3. 영향 섹션 본문 수정: `en.json` 라벨 변경은 그대로 치환하고, 항목, 검증 규칙, 버튼 동작 변경을 반영합니다.
4. `pnpm build --manual bo`로 확인한 뒤 커밋합니다. `manual.yaml`의 `version`은 합의 후 올립니다.

### 신규 메뉴 추가

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

### 리모트

- `origin` = ignite-plan/ariadne: 기준 리포입니다. 앱의 기본 리포이고, 기획자 제출이 여기로 들어옵니다. 작업 전에 `git pull`을 합니다.
- `zi-gae` = zi-gae/ariadne: 미러입니다. `git push zi-gae main`으로 맞춥니다.

---

## 앱 개발

```bash
pnpm app:dev      # electron-vite dev (HMR)
pnpm app:build    # out/
pnpm app:dist     # release/Ariadne-<version>-arm64.dmg
ARIADNE_E2E_TOKEN=$(gh auth token) pnpm app:e2e [--app release/mac-arm64/Ariadne.app]
```

- E2E는 실제 GitHub에서 clone하고, 편집, 되돌리기, Word 만들기, 가짜 BO 캡처, Word 가져오기를 확인합니다. 제출(push)은 하지 않습니다.
- `ARIADNE_CAPTURE_BASE_URL`은 캡처 주소를 덮어씁니다(E2E의 가짜 BO).
- 앱 main의 네트워크는 Electron `net.fetch`만 씁니다(사내 TLS 프록시 때문에 Node fetch가 실패). git은 isomorphic-git이라 기획자 PC에 Xcode CLT가 없어도 됩니다.
- 제출은 main에 바로 push합니다. 충돌하면 `ariadne/<login>-<시각>` 브랜치와 PR을 만듭니다.
- `ARIADNE_USER_DATA`로 앱 데이터(설정, 토큰, BO 세션) 위치를 바꿀 수 있습니다(E2E, 두 번째 프로필).
- Apple Developer ID가 없어 ad-hoc 서명만 합니다(`app/build/after-pack.cjs`). 자동 업데이트 대신 실행할 때 Releases의 `app-v*`를 확인해 알립니다.

### 앱 릴리즈

```bash
git tag app-v1.1.0 && git push origin app-v1.1.0
```

`.github/workflows/release-app.yml`이 테스트 후 dmg를 만들어 Release에 올립니다. 버전은 태그에서 정하고, Release 본문은 `app/INSTALL.md`입니다.

### 구조

```
manuals/<id>/        매뉴얼 원본 (manual.yaml, 장/화면 .md, images/, shots.ts, reference.docx, source/원본.docx)
src/core/            빌드·캡처·로그인·affected·Word 가져오기 함수 (CLI와 앱 공용)
src/cli/             pnpm 명령 진입점
app/main/            Electron main (IPC, git, GitHub, pandoc 미리보기, 가져오기 utilityProcess)
app/main/lib/        Electron에 의존하지 않는 로직 (단위 테스트 대상)
app/preload/         window.ariadne 노출
app/renderer/        React UI
app/shared/api.ts    main ↔ renderer 계약
app/e2e/smoke.ts     빌드된 앱 E2E
```
