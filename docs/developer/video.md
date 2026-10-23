# 가이드 영상 (개발자)

[← README](../../README.md)

## 가이드 영상

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
sections: [02-dealer-management/01-dealer-list-view.md] # 문장 출처인 매뉴얼 화면, 영상에 나오는 순서 (여러 개 가능. 예전 section 하나도 읽는다)
maskPersonal: true                             # 이메일·전화번호처럼 보이는 글자 자동 blur
maskSystem: true                               # GNB 좌측 상단 시스템 이름·법인/대리점 선택 blur (overlay.ts SYSTEM_MASK)
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
| `upload: { target, file }` | 대상을 눌러 뜬 파일 선택 창에 파일을 넣습니다. `file`은 매뉴얼 폴더 기준 경로(예: `videos/files/photo.png`). `mutates: true` 시나리오만 |

대상은 `{ role, name }`(접근성 이름, 예: `button`/`Location`)을 먼저 쓰고, 없으면 `label`·`placeholder`·`text`를 씁니다. 같은 대상이 여러 개면 `nth`(0부터), 특정 행 안에서 찾으려면 `within`을 씁니다. 문자열의 `{stamp}`는 실행 시각(MMDDHHmm)으로 바뀝니다.

- 문장은 해당 매뉴얼 섹션에서 가져오고, UI 라벨은 `en.json` 그대로 씁니다([작성 규칙](../writing-rules.md)).
- 기본적으로 저장/삭제/발송/승인 류 버튼(`Save`, `Save Draft`, `Delete`, `Discard`, `Send`, `Approve`, 정확히 `Create` 등, `src/core/safety.ts`)은 누르지 못하고, 쓰기 요청(PUT/PATCH/DELETE, 조회가 아닌 POST)도 막습니다. Claude STG 탐색과 같은 규칙입니다.
- 생성·수정 과정을 보여 줘야 하면 `mutates: true`로 표시하고 **STG 테스트 데이터로만** 실행합니다. 이름에 `Video Test {stamp}`를 쓰고, `cleanup` 단계에서 만든 데이터를 지웁니다. 이메일이 발송되는 화면은 테스트 계정 주소만 씁니다. 외부 시스템 연동이 있는 버튼(예: 딜러 생성 마지막 단계의 `Create`, HMG Partner 연동)은 누르지 않습니다.
- 새 시나리오는 `pnpm video --id <id> --preview`로 브라우저를 띄워 확인합니다. 특정 장면부터 보려면 `--from <장면 번호>`를 붙입니다(앞 장면은 녹화 없이 빠르게 재생).
- 앱은 같은 엔진을 `utilityProcess`(`app/main/video-worker.ts`)에서 돌립니다. 앱에는 ffmpeg(`ffmpeg-static`, GPL 빌드)가 들어 있고, 음성 모델은 앱이 `net.fetch`로 userData/models에 받습니다. 앱 E2E: `pnpm app:e2e:video [--app release/mac-arm64/Ariadne.app]`
- STG에서 기록(`src/core/video/record.ts`): 클릭은 페이지가 붙잡아 두고, 기록기가 Playwright 규칙으로 찾은 대상(role+이름 → label → placeholder → 글자, 몇 번째)으로 대신 누릅니다. 그래서 기록된 단계는 영상과 같은 규칙으로 한 번 실행된 것입니다.
- 사내망에서 `ffmpeg-static` 설치(바이너리 다운로드)와 `pnpm app:dist`(Electron 다운로드)는 `NODE_USE_SYSTEM_CA=1`이 필요합니다.
