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
| 매뉴얼에 없는 메뉴를 새로 쓰기 | [Claude로 초안 만들기](#claude로-초안-만들기) |
| 이미 있는 화면을 최신 기획서·화면에 맞추기 | [Claude로 최신화](#claude로-최신화) |
| 매뉴얼 문장 규칙 | [작성 규칙](#작성-규칙) |
| 릴리즈 변경 반영, 신규 메뉴 추가 | [개발자 사용법](#개발자-사용법) |
| 사용법 가이드 영상(자막, 내레이션) 만들기 | [가이드 영상 만들기](#가이드-영상-만들기) |
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
| 형광펜 | `[글자]{.mark}` | 선택한 글자에 노란 형광펜 (Word 원본과 같은 노랑). 형광펜 안에서 다시 누르면 해제 |
| 가운데 정렬 | `{… align=center}` | 커서가 있는 줄의 이미지를 Word에서 가운데로. 다시 누르면 해제 |
| ⚑ | `<!-- TODO: … -->` | 확인이 필요한 메모. Word에는 나오지 않습니다 |
| ↶ ↷ | | 되돌리기 / 다시 실행 |

편집기 안의 회색 칩(`전체 6.27in`, `팝업 4.2in · 가운데`)은 이미지가 Word에 들어갈 크기와 정렬입니다. 크기를 바꾸려면 이미지를 지우고 다시 넣고, 가운데 정렬은 툴바 버튼이나 이미지 넣기 창의 **가운데 정렬**로 켭니다. 정렬을 켜지 않은 이미지는 지금처럼(캡션이 있으면 가운데, 없으면 왼쪽) 들어갑니다.

Word 원본을 가져오면 본문의 노란 형광펜이 그대로 남습니다(제목·이미지 캡션 안의 형광펜은 뺍니다).

### 이미지 넣기

- **새 스크린샷**: 편집기에 붙여 넣거나(⌘V) 파일을 끌어 놓습니다. 설명(caption, 영어)과 크기를 고르고 **넣기**를 누릅니다.
- **있는 이미지**: 툴바 🖼 → **있는 이미지**에서 검색해 고릅니다. 두 번 누르면 바로 들어갑니다.
- 크기: **전체 화면**(6.27in), **팝업**(4.2in), **작은 팝업**(3.4in), **아이콘**(0.24in, 문장 안에 들어감)

PNG가 아닌 이미지는 PNG로 바꿔 저장합니다.

### 화면 캡처 (STG)

화면이 바뀌었을 때 매뉴얼 이미지를 새로 찍습니다. 캡처 대상 주소와 화면 크기는 매뉴얼마다 정해져 있습니다(설정 → 매뉴얼).

1. 위쪽 **캡처**를 누릅니다.
2. 처음이거나 세션이 만료되었으면 **로그인**을 누릅니다. Chrome 창이 열리면 STG에 로그인(MFA 포함)하고, STG 화면이 보이면 앱에서 **로그인 완료**를 누릅니다. 로그인 세션은 매뉴얼마다 따로 둔 Chrome 프로필에 남아서 캡처·가이드 영상이 같이 씁니다. 세션이 만료되면 앱이 알려 주니 다시 로그인합니다.
   - **Claude 작업, 영상 만들기, 캡처는 함께 돌릴 수 있습니다.** 앱이 로그인 프로필로 화면 없는 Chrome을 하나 띄우고 작업마다 탭을 나눠 씁니다(같은 로그인을 쓰므로 서로 로그아웃시키지 않습니다).
   - **로그인, 미리보기, STG에서 기록**은 화면이 보이는 Chrome을 따로 띄우므로 다른 STG 작업이 없을 때만 할 수 있습니다. 버튼이 꺼져 있으면 마우스를 올려 어떤 작업 때문인지 확인합니다.
   - Claude 작업은 실행 중에 **숨기기**로 패널을 접을 수 있습니다. 위쪽 작업 표시(예: `Claude 최신화 · 3:12`, `영상 만들기 · 장면 2/5`)를 누르면 다시 열리고, 끝나면 알림이 뜹니다. Claude가 고치는 화면과 영상은 끝날 때까지 편집이 막히고, Claude 작업 중에는 제출할 수 없습니다.
   - 같은 BO 계정 설정(브라우저에 저장되는 필터·컬럼 등)은 탭끼리 공유됩니다. 영상은 첫 장면에서 화면을 직접 열고 필요한 필터를 맞추게 쓰는 것이 안전합니다.
   - 로그인 박스의 **확인**은 STG를 실제로 열어 세션이 살아 있는지 봅니다. 만료됐으면 "STG 로그인 필요"로 바뀌니 **다시 로그인**을 누릅니다. Claude 작업은 시작할 때 자동으로 확인합니다.
3. **지금 화면** 또는 **전체**에서 캡처할 이미지를 고르고 **N장 캡처**를 누릅니다.
4. 바뀐 이미지만 **지금 매뉴얼 / 새로 찍은 화면**으로 나란히 나옵니다. 반영할 것만 체크하고 **선택한 N장 반영**을 누릅니다.

- 캡처는 화면을 열고 찍기만 합니다. 저장, 삭제 같은 버튼은 누르지 않습니다.
- `수동` 표시가 붙은 이미지는 자동으로 찍지 않습니다(아이콘을 잘라 낸 이미지 등).
- 목록에 원하는 화면이 없으면 개발자에게 캡처 정의(`shots.ts`) 추가를 요청합니다.

### 가이드 영상 만들기

STG 화면을 녹화하고 영어 자막과 영어 내레이션을 넣어 사용법 영상(mp4)을 만듭니다. 영상은 시나리오(장면 목록)로 만들어서, 화면이 바뀌면 같은 시나리오로 다시 만들면 됩니다.

1. 위쪽 **영상**을 누릅니다. 처음이면 왼쪽에서 **로그인**(캡처와 같은 세션)과 음성 모델 **받기**(약 90MB, 한 번만)를 합니다.
2. **새 영상**을 누르고 연결할 화면과 영상 제목(영어)을 정합니다.
3. 장면을 채웁니다. 세 가지 방법을 섞어 써도 됩니다.
   - **Claude로 초안**: 연결한 매뉴얼 화면의 문장으로 내레이션을 쓰고, STG 화면을 확인해 단계를 만든 뒤 끝까지 실행해 봅니다. 몇 분 걸리고 내 Claude 사용량을 씁니다.
   - **STG에서 기록**(장면마다): Chrome 창이 열리면 평소처럼 누르고 입력합니다. 누른 것이 그 장면의 단계로 붙습니다. Chrome 창 오른쪽 아래 막대에서 **강조할 곳 고르기**(누르지 않고 강조), **가릴 곳 고르기**(영상에서 흐리게), **기다릴 글자 고르기**, **새 장면**, **기록 끝**을 씁니다.
   - **직접 쓰기**: 장면마다 내레이션을 쓰고 **+ 단계**로 화면 열기, 클릭, 입력, 선택, 강조, 멈춤을 넣습니다.
   - **Claude로 이 장면**(장면마다): 보여 줄 내용을 한국어로 적으면(예: "Job title 탭에서 Edit을 눌러 팝업에서 체크박스를 고르는 화면") Claude가 앞 장면을 재생해 그 화면을 열고, 이 장면의 내레이션과 단계를 채운 뒤 실행해 봅니다. **이 장면 채우기** 또는 **다음에 새 장면 넣기**를 고릅니다. 다른 장면은 바꾸지 않습니다. STG에 실제 저장 허용 영상에서는 쓸 수 없습니다.
4. 내레이션 옆 스피커 버튼으로 **음성을 들어 봅니다**(아래 내레이션 속도로). 화면 자막을 더 짧게 하려면 **화면 자막을 따로 쓰기**를 누릅니다.
   - 기본 정보에서 **자막 크기**(작게·보통·크게), **내레이션 속도**(0.8×~1.3×, 자막이 떠 있는 시간도 같이 바뀜), **조작 속도**(커서·입력·강조·장면 사이 쉬는 시간, 느리게·보통·빠르게)를 영상마다 고릅니다.
5. **미리보기**(처음부터) 또는 장면의 **여기부터 미리보기**로 Chrome 창에서 실행해 봅니다. 녹화하지 않습니다. 실패하면 그 단계가 빨갛게 표시됩니다.
6. **영상 만들기**를 누릅니다. **영상** 탭에서 바로 재생하고, **Finder에서 보기**로 파일(`dist/videos/<id>.mp4`, 자막 `.srt`·`.vtt`)을 엽니다.
7. 시나리오는 자동 저장되고 **제출**에 포함됩니다. 영상 파일은 크기 때문에 제출하지 않습니다. 필요한 곳에 따로 올립니다.

- 기본적으로 저장·삭제·발송·승인 버튼은 누르지 않고, 데이터를 바꾸는 요청도 막습니다. 막은 요청은 목록으로 알려 줍니다.
- 생성·수정 과정을 끝까지 보여 줘야 하면 **STG에 실제 저장 허용**을 켭니다. 입력값은 `Video Test {stamp}`처럼 테스트 데이터임을 알 수 있게 쓰고(`{stamp}`는 실행 시각), **정리 단계**에 만든 데이터를 지우는 단계를 넣습니다. Claude는 이 설정을 켜지 않습니다.
- **이메일·전화번호 가리기**는 화면에서 이메일·전화번호처럼 보이는 글자를 자동으로 흐리게 합니다.
- 기록한 단계가 이름 없는 아이콘을 눌렀다면 기록 막대에 경고가 나옵니다. 미리보기로 맞는지 확인하세요.

### 화면(섹션) 추가·삭제·순서

- **추가**: 목차 아래 **새 화면**을 누르거나, 장 이름 옆 **+**를 누릅니다. **빈 화면 직접 쓰기**를 고르고 장과 화면 이름(영어)을 넣습니다. 새 장은 원하는 위치(예: 8장)에 넣을 수 있습니다.
- **삭제**: 목차에서 화면에 마우스를 올리고 🗑를 누릅니다. 제출 전이면 **변경** 탭에서 되돌릴 수 있습니다.
- **순서 바꾸기**: 목차에서 장이나 화면을 끌어 다른 줄에 놓으면 그 자리로 옮겨집니다. 장 번호(폴더 번호)는 자동으로 다시 매겨집니다. 화면은 같은 장 안에서만 옮길 수 있고, 장 소개는 맨 앞에 고정입니다.

### Claude로 초안 만들기

매뉴얼에 없는 메뉴(예: Menu Management)의 화면 섹션 초안을 Claude가 씁니다. 근거는 **Confluence DLRS 기획서 최신 output**과 **실제 STG 화면**입니다.

준비(한 번만): 터미널의 Claude Code(`claude`)가 설치되어 있고, 인증(기본: `~/.zshrc`의 `ANTHROPIC_API_KEY`, 또는 설정 → 고급에서 claude.ai 로그인)이 되어 있고, Claude Code에 Atlassian(Confluence) MCP가 연결되어 있어야 합니다. 설정 → 환경 점검에서 확인할 수 있습니다.

1. **새 화면** → **Claude로 초안 만들기**
2. **메뉴 이름**(영어)과 **장**(새 장이면 이름과 위치)을 고릅니다. STG 경로나 메모를 알려 줄 수도 있습니다(선택).
3. **다음** → 점검 화면에서 Claude Code, Confluence, STG 로그인 상태를 확인합니다. STG 로그인이 없으면 여기서 로그인합니다.
4. **초안 만들기 시작**. Claude가 하는 일이 한 줄씩 나옵니다.
   - 기획서 검색·읽기 → STG 화면 열기·팝업 열기 → 캡처 저장 → 화면별 섹션 쓰기
   - 저장·삭제·승인·발송 같은 버튼은 앱이 거절하고(빨간 줄), STG로 가는 쓰기 요청도 막습니다
   - 언제든 **중지**할 수 있습니다
5. 끝나면 만든 화면, 이미지, TODO 수, 참고한 기획서 링크가 나옵니다. **TODO** 탭에서 확인할 곳을 보고 다듬은 뒤 **제출**합니다.

- 기획서와 STG 화면이 다르면 Claude가 판단하지 않고 `TODO: 기획서(…)는 A, STG 화면은 B`로 남깁니다.
- Claude가 만든 캡처 정의(`shots.ts`)가 같이 생겨서, 다음 릴리즈부터 **캡처** 버튼으로 다시 찍을 수 있습니다.
- 이미 매뉴얼에 있는 메뉴는 새로 만들지 않습니다. 그때는 [Claude로 최신화](#claude로-최신화)를 씁니다.
- 초안 하나에 수 분에서 10분 이상 걸리고, 내 Claude 사용량을 씁니다.
- 마음에 들지 않으면 **변경** 탭의 **모두 되돌리기**로 지우고 다시 만듭니다.

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

### Claude로 최신화

이미 있는 화면을 **최신 Confluence 기획서**와 **실제 STG 화면**에 맞춰 Claude가 고칩니다. 바뀐 곳만 고치고, 근거가 다르면 TODO로 남깁니다.

1. 시작하는 곳은 세 군데입니다.
   - 문서 위쪽 **✦ Claude로 최신화** (지금 화면)
   - 목차에서 화면에 마우스를 올리고 ✦ (그 화면)
   - 목차에서 장에 마우스를 올리고 ✦ (장 전체)
2. 점검 화면을 확인하고 **최신화 시작**을 누릅니다.
   - 먼저 최신 기획서를 한 번 요약하고, 화면을 **3개씩 동시에** 확인합니다.
   - 로그 위 화면 목록에서 화면별 진행(대기 / 진행 중 / 고침 / 바꿀 것 없음 / 건너뜀 / 실패)을 볼 수 있습니다. 화면을 누르면 그 화면의 로그만 보입니다.
3. 끝나면 **고친 화면 / 그대로인 화면 / 건너뛴 화면**이 나옵니다. 고친 화면을 누르면 그 화면의 첫 변경 위치가 열립니다.
4. **Claude 변경 검토**: Claude가 고친 화면은 목차에 `검토` 표시가 붙고, 화면을 열면 위쪽에 **Claude 변경** 막대가 나옵니다.
   - 미리보기에는 Claude가 넣은 글자가 초록 밑줄, 지운 글자가 빨간 취소선으로 보입니다(완성 문서 모양 그대로, 단어 단위). 편집기에는 바뀐 줄 왼쪽에 막대가 보입니다.
   - 비교 기준은 Claude가 고치기 직전 본문이라, 내가 전에 고친 내용과 섞이지 않습니다. 검토 전에 같은 화면을 다시 최신화해도 처음 원문과 비교합니다.
   - 막대의 ↑ ↓로 변경 사이를 옮겨 다니고, 다 보면 **검토 완료**를 누릅니다(표시만 끄고 내용은 그대로). 제출하거나 되돌리면 표시가 사라집니다.
   - 이 표시는 화면에만 보이고 매뉴얼 파일이나 Word에는 들어가지 않습니다. 노란 형광펜(Word로 나가는 서식)과는 다른 기능입니다.
5. 마음에 들지 않는 화면은 **변경** 탭에서 ↺로 되돌리고, 나머지를 **제출**합니다.

- **대기열**: 최신화가 도는 동안 다른 화면이나 장의 최신화를 열면 **대기에 추가 (N번째)**로 걸어 둘 수 있습니다(반영 범위도 함께 저장). 앞 작업이 끝나면(성공·실패·중지 모두) 다음 대기 작업이 자동으로 시작합니다.
  - 위쪽 작업 표시에 `대기 N`이 보입니다. 진행 패널의 **대기 중인 최신화**에서 ↑ ↓로 순서를 바꾸거나 빼고, **모두 비우기**로 비웁니다. **끝난 작업**에서 앞서 끝난 작업의 결과를 다시 엽니다.
  - 대기 작업을 시작하기 전에 STG 로그인을 확인합니다. 만료됐으면 대기열이 **멈춤**이 되니 다시 로그인한 뒤 **계속**을 누릅니다.
  - 대기열은 앱을 켜 둔 동안만 유지됩니다. 작업 중이거나 대기가 있을 때 앱을 끄면 확인 창이 뜹니다.
  - 초안 만들기와 영상 Claude 작업은 대기할 수 없습니다(한 번에 하나).

- 처음 최신화하는 화면은 Claude가 **자동 캡처 정의**도 채웁니다. 다음부터는 **캡처** 버튼으로 그 화면 이미지를 다시 찍을 수 있습니다.
- 개발자 PC처럼 설정 → 고급에 dealerhub-web 경로가 있으면, 코드 연결 키(sources, i18nPrefix)도 채웁니다. 코드는 읽기만 합니다.
- 최신화한 화면 파일 front-matter에 근거 기획서 버전(`refreshedFrom`)이 남습니다. 다음 최신화에서 **기획서가 그대로인 화면은 건너뜁니다.** 그래도 다시 보려면 **기획서가 안 바뀐 화면도 다시 확인**을 켭니다. 이 기록도 함께 제출하세요.
- **반영 범위**: 특정 기간이나 Jira 티켓의 변경만 반영하려면 시작 전에 패널의 **반영 범위**에 기간(예: 2026-05 ~ 2026-08)이나 티켓(예: `GIDPGRO-973, GIDPDVO-2067`)을 넣습니다.
  - 끝 달까지의 output만 근거로 쓰고, 문서 히스토리에서 그 기간·티켓의 변경만 골라 반영합니다. 해당 변경이 없는 화면은 건너뜁니다.
  - STG에는 범위 뒤 변경이 이미 들어가 있을 수 있어 **캡처 이미지는 다시 찍지 않습니다**. 이미지나 화면이 범위와 맞지 않는 곳은 TODO로 남습니다.
  - 일부만 반영한 것이라 `refreshedFrom`은 남기지 않습니다. 나중에 전체 최신화를 돌리면 다시 확인 대상이 됩니다.
- 장 전체 최신화는 처음에 15~25분쯤 걸립니다. 기획서가 그대로면 몇 분 안에 끝납니다.

### 변경 보기

**변경** 탭에서 화면 옆 ⑂를 누르면 마지막으로 제출된 내용과 지금 내용을 줄 단위로 비교합니다. 빨간 줄은 지운 것, 초록 줄은 추가한 것입니다. Claude가 고친 내용이나 내가 고친 내용을 제출 전에 확인할 때 씁니다.

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
| 일반 | 매뉴얼 선택, 제출 방식, 작업이 끝나면 알림(다른 앱을 보고 있을 때만 / 항상 / 끄기, 알림 시험) |
| 매뉴얼 | 지금 매뉴얼의 제목, 버전, Word 파일 이름, 캡처 주소와 화면 크기, 코드 연결. 바꾸면 제출해야 다른 사람에게 반영됩니다 |
| 계정 | GitHub 계정 확인, 토큰 바꾸기, 로그아웃 |
| 환경 점검 | pandoc, Chrome, 로그인 세션 상태와 설치 링크 |
| 고급 | 리포 주소, 작업 폴더, pandoc 경로, **Claude 인증**(ANTHROPIC_API_KEY / claude.ai 로그인), Claude Code CLI 경로, dealerhub-web 경로 |
| 변경 영향 | 개발자용. 두 릴리즈 사이 코드 변경이 어느 화면에 영향을 주는지 찾기 |
| 정보 | 앱 버전, 새 버전 확인 |

### 문제 해결

| 증상 | 해결 |
|---|---|
| 토큰이 유효하지 않거나 만료 | 설정 → 계정에서 새 토큰으로 바꿉니다 |
| 권한이 없습니다 / SSO | 토큰 페이지에서 `ignite-plan` 조직 SSO를 승인합니다. fine-grained 토큰이 막혀 있으면 classic 토큰(`repo` 권한)을 씁니다 |
| 미리보기가 안 나옴 | 설정 → 환경 점검에서 pandoc을 확인합니다 |
| 초안·최신화가 `ANTHROPIC_API_KEY(…1234)로 인증하지 못했습니다`로 실패 | `~/.zshrc`의 키가 만료·무효입니다(끝 4자리로 어느 키인지 확인). 키를 바꾸거나(앱 재시작 불필요), 설정 → 고급 → Claude 인증을 **claude.ai 로그인**으로 바꿉니다 |
| 초안·최신화가 `ANTHROPIC_AUTH_TOKEN(…1234)로 … 인증하지 못했습니다`로 실패 | `ANTHROPIC_AUTH_TOKEN`이 있으면 `ANTHROPIC_API_KEY`보다 먼저 쓰입니다. H-Chat 설정 스크립트는 `ANTHROPIC_API_KEY` + `ANTHROPIC_BASE_URL`만 쓰므로, `~/.zshrc`에 남은 `export ANTHROPIC_AUTH_TOKEN`을 지웁니다 |
| 초안·최신화가 `… 모델을 받지 않습니다`로 실패 | 게이트웨이(H-Chat 등)가 그 모델을 지원하지 않습니다(예: 4.6 지원 종료). `~/.zshrc`에 `export ANTHROPIC_MODEL="claude-sonnet-5"`처럼 쓸 수 있는 모델을 넣습니다. H-Chat은 Claude Code `2.1.278`(`npm i -g @anthropic-ai/claude-code@2.1.278`)을 씁니다 |
| 초안·최신화가 `claude.ai 로그인으로 인증하지 못했습니다`로 실패 | 터미널에서 `claude`를 열어 `/login` 하거나, Claude 인증을 **ANTHROPIC_API_KEY**로 바꿉니다 |
| 초안 만들기에서 Claude Code를 못 찾음 | 설정 → 환경 점검의 Claude Code에서 **앱 전용으로 설치**를 누릅니다(앱이 정한 버전을 받음). 특정 claude를 쓰려면 설정 → 고급 → Claude Code CLI 경로를 지정합니다 |
| 초안에 기획서 근거가 없음 | Claude Code에 Atlassian MCP가 연결됐는지 확인합니다(`claude mcp list`) |
| 캡처가 `세션 만료`로 실패 | 캡처 화면에서 **다시 로그인** |
| 동기화가 `오프라인` | 네트워크를 확인하고 동기화 표시를 다시 누릅니다. 편집과 저장은 오프라인에서도 됩니다 |
| 새 버전 알림 | 알림의 **업데이트** → **지금 다시 시작**. Claude 작업·영상 만들기 중에는 끝난 뒤 누릅니다. 안 되면 **직접 받기**로 dmg를 받아 덮어 설치합니다 |

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

### 준비

```bash
pnpm install
cp .env.example .env    # DEALERHUB_WEB_DIR(dealerhub-web 로컬 경로), BO_BASE_URL(bo 캡처 주소 덮어쓰기, 선택)
brew install pandoc     # Google Chrome도 필요
brew install ffmpeg     # 가이드 영상(pnpm video)에만 필요
```

사내망에서 Electron 바이너리 다운로드가 실패하면 `NODE_USE_SYSTEM_CA=1 node node_modules/electron/install.js`를 실행합니다.

### 명령

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

### 가이드 영상

시나리오 파일 하나로 STG 화면 녹화, 영어 자막, 영어 내레이션을 한 번에 만듭니다. 화면이 바뀌면 다시 실행하면 됩니다.

```bash
pnpm login --manual bo                       # 세션이 없을 때 (캡처와 같은 .auth/bo-profile)
pnpm video --manual bo --id dealer-list      # → dist/videos/dealer-list.mp4, .srt, .vtt
pnpm video --manual bo --id dealer-list --preview   # 시나리오 작성 중: 브라우저를 띄워 실행만 (음성·파일 없음)
```

- 결과 mp4에는 영상(h264), 내레이션(aac), 자막 트랙(mov_text)이 들어 있습니다. 자막은 화면에도 그려져 있어 어느 플레이어에서나 보입니다. `.srt`·`.vtt`는 LMS나 YouTube에 따로 올릴 때 씁니다.
- 내레이션은 로컬 TTS 모델 **Kokoro**(무료, API 키 없음)로 만듭니다. 첫 실행 때 모델(약 90MB)을 `.video-cache/models`에 받고, 만든 음성은 `.video-cache/tts`에 캐시합니다. 사내 TLS 프록시 때문에 `pnpm video`는 `--use-system-ca`로 실행됩니다.
- OpenAI 음성을 쓰려면 `manual.yaml`에 `video.tts.provider: openai`(voice 예: `alloy`)를 지정하고 `.env`에 `OPENAI_API_KEY`를 넣습니다. ElevenLabs는 사내 webfilter로 막혀 있습니다.

시나리오(`manuals/bo/videos/<id>.yaml`, id는 파일 이름)는 장면(scene) 목록입니다. 장면마다 `say`(자막 겸 내레이션)를 띄우고 `steps`의 조작을 함께 진행합니다. 장면 길이는 내레이션 길이에 맞춰집니다. 코드가 아닌 데이터라 정해진 단계만 실행합니다. 저장은 `saveVideo`(`YAML.stringify`)로만 해서 앱과 CLI가 같은 diff를 냅니다.

```yaml
title: Dealer List View                       # 시작 카드
intro: This video shows how to ...             # 시작 카드 내레이션
section: 02-dealer-management/01-dealer-list-view.md
maskPersonal: true                             # 이메일·전화번호처럼 보이는 글자 자동 blur
captionSize: large                             # 자막 크기 small|medium|large (없으면 manual.yaml video.captionSize, 그다음 medium)
speed: 1.1                                     # 내레이션 속도 0.8~1.3 (없으면 manual.yaml video.tts.speed, 그다음 1)
pace: slow                                     # 조작 속도 slow|normal|fast (커서·입력·강조·장면 사이 쉬는 시간)
mask: [{ role: cell, name: Owner }]            # 추가로 가릴 요소 (선택)
scenes:
  - say: The Dealer List screen provides a list of all registered dealers.
    steps:
      - open: /dealer/company
      - waitFor: { text: Total }
  - say: Click the Location icon to open a popup showing the dealer's registered address.
    steps:
      - click: { role: button, name: Location }
      - waitFor: { text: Location Information }
```

| 단계 | 동작 |
|---|---|
| `open: <path>` | `baseUrl` 기준 이동. 로그인 페이지로 튕기면 세션 만료로 멈춥니다 |
| `waitFor: <대상>` | 대상이 보일 때까지 기다립니다 (기본 15초) |
| `click: <대상>` | 커서를 옮기고, 대상을 강조한 뒤 누릅니다 |
| `type: { target, text }` | 한 글자씩 입력합니다 |
| `choose: { target, option }` | HDS(MUI) Select를 열고 옵션을 고릅니다. native select는 `select: { target, value }` |
| `highlight: { target, ms }` / `hover` / `scroll` / `pause: <ms>` | 누르지 않고 강조 / 올려놓기 / 스크롤 / 대기 |

대상은 `{ role, name }`(접근성 이름, 예: `button`/`Location`)을 먼저 쓰고, 없으면 `label`·`placeholder`·`text`를 씁니다. 같은 대상이 여러 개면 `nth`(0부터), 특정 행 안에서 찾으려면 `within`을 씁니다. 문자열의 `{stamp}`는 실행 시각(MMDDHHmm)으로 바뀝니다.

- 문장은 해당 매뉴얼 섹션에서 가져오고, UI 라벨은 `en.json` 그대로 씁니다([작성 규칙](#작성-규칙)).
- 기본적으로 저장/삭제/발송/승인 류 버튼(`Save`, `Save Draft`, `Delete`, `Discard`, `Send`, `Approve`, 정확히 `Create` 등, `src/core/safety.ts`)은 누르지 못하고, 쓰기 요청(PUT/PATCH/DELETE, 조회가 아닌 POST)도 막습니다. Claude STG 탐색과 같은 규칙입니다.
- 생성·수정 과정을 보여 줘야 하면 `mutates: true`로 표시하고 **STG 테스트 데이터로만** 실행합니다. 이름에 `Video Test {stamp}`를 쓰고, `cleanup` 단계에서 만든 데이터를 지웁니다. 이메일이 발송되는 화면은 테스트 계정 주소만 씁니다. 외부 시스템 연동이 있는 버튼(예: 딜러 생성 마지막 단계의 `Create`, HMG Partner 연동)은 누르지 않습니다.
- 새 시나리오는 `pnpm video --id <id> --preview`로 브라우저를 띄워 확인합니다. 특정 장면부터 보려면 `--from <장면 번호>`를 붙입니다(앞 장면은 녹화 없이 빠르게 재생).
- 앱은 같은 엔진을 `utilityProcess`(`app/main/video-worker.ts`)에서 돌립니다. 앱에는 ffmpeg(`ffmpeg-static`, GPL 빌드)가 들어 있고, 음성 모델은 앱이 `net.fetch`로 userData/models에 받습니다. 앱 E2E: `pnpm app:e2e:video [--app release/mac-arm64/Ariadne.app]`
- STG에서 기록(`src/core/video/record.ts`): 클릭은 페이지가 붙잡아 두고, 기록기가 Playwright 규칙으로 찾은 대상(role+이름 → label → placeholder → 글자, 몇 번째)으로 대신 누릅니다. 그래서 기록된 단계는 영상과 같은 규칙으로 한 번 실행된 것입니다.
- 사내망에서 `ffmpeg-static` 설치(바이너리 다운로드)와 `pnpm app:dist`(Electron 다운로드)는 `NODE_USE_SYSTEM_CA=1`이 필요합니다.

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
- `ARIADNE_CAPTURE_BASE_URL`은 캡처 주소를 덮어씁니다(E2E의 가짜 BO). `ARIADNE_CLAUDE_PATH`는 Claude Code CLI 위치를 덮어씁니다(E2E는 `app/e2e/fake-claude.mjs`: LLM 없이 Ariadne MCP 도구를 실제로 부름).
- 초안 만들기 구조: 앱이 `127.0.0.1` 임의 포트에 토큰을 붙여 Ariadne MCP(HTTP)를 열고, `claude -p --mcp-config … --allowedTools …`를 작업 폴더에서 실행합니다. 지시는 `.claude/skills/manual-draft/SKILL.md`(초안), `.claude/skills/manual-refresh/SKILL.md`(최신화)입니다. 허용 도구는 Read/Glob/Grep, `Edit|Write(./manuals/<m>/**)`, `mcp__ariadne`, Confluence 읽기 도구뿐이라 나머지는 `-p` 모드에서 자동 거절됩니다.
- 앱 main의 네트워크는 Electron `net.fetch`만 씁니다(사내 TLS 프록시 때문에 Node fetch가 실패). git은 isomorphic-git이라 기획자 PC에 Xcode CLT가 없어도 됩니다.
- 제출은 main에 바로 push합니다. 충돌하면 `ariadne/<login>-<시각>` 브랜치와 PR을 만듭니다.
- `ARIADNE_USER_DATA`로 앱 데이터(설정, 토큰, BO 세션) 위치를 바꿀 수 있습니다(E2E, 두 번째 프로필).
- Apple Developer ID가 없어 ad-hoc 서명만 합니다(`app/build/after-pack.cjs`). 자동 업데이트 대신 실행할 때 Releases의 `app-v*`를 확인해 알립니다.

### 앱 릴리즈

```bash
git tag app-v1.1.0 && git push origin app-v1.1.0
```

`.github/workflows/release-app.yml`이 테스트 후 dmg를 만들어 Release에 올립니다. 버전은 태그에서 정하고, Release 본문은 `app/INSTALL.md`입니다.

**서명**: 릴리스는 사내 자체 서명 인증서(`Ariadne Code Signing (Ignite)`, 2036-10까지)로 서명합니다. macOS가 앱을 "이 인증서로 서명한 `kr.co.ignite.ariadne`"로 알아봐서, 앱 안 업데이트를 해도 키체인(GitHub 토큰)·폴더 권한을 다시 묻지 않습니다.
- 인증서는 리포 Secrets `MAC_CERT_P12`(p12, base64)와 `MAC_CERT_PASSWORD`에 있습니다. 없으면 릴리스가 멈춥니다(ad-hoc 빌드가 나가면 모두 권한을 다시 허용해야 하므로).
- 원본 p12와 비밀번호는 Secrets 밖에도 안전한 곳에 보관합니다. 잃어버려 새 인증서를 만들면 다음 업데이트에서 모두 권한을 한 번 다시 허용해야 합니다.
- 로컬 `pnpm app:dist`는 인증서가 없으면 ad-hoc으로 서명합니다(`app/build/after-pack.cjs`).

### 구조

```
manuals/<id>/        매뉴얼 원본 (manual.yaml, 장/화면 .md, images/, shots.ts, reference.docx, source/원본.docx)
src/core/            빌드·캡처·로그인·affected·Word 가져오기 함수 (CLI와 앱 공용)
src/cli/             pnpm 명령 진입점
app/main/            Electron main (IPC, git, GitHub, pandoc 미리보기, 가져오기 utilityProcess)
app/main/lib/        Electron에 의존하지 않는 로직 (git, sections, stg, mcp, claude — 단위 테스트 대상)
app/preload/         window.ariadne 노출
app/renderer/        React UI
app/shared/api.ts    main ↔ renderer 계약
app/e2e/smoke.ts     빌드된 앱 E2E
```
