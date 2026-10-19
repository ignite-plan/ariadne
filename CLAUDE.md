# Ariadne (user-manual)

Dealers 사용자 매뉴얼 docs-as-code 리포 + 기획자용 편집 앱(Electron, dmg). 원본은 `manuals/<manual>/` Markdown, Word는 빌드 산출물.

## 구조
- `manuals/<id>/manual.yaml`: 제목, 버전, Word 파일 이름(`output`), 캡처(`capture.baseUrl/viewport`), 코드 연결(`code.app`), 장 순서. 장 번호는 디렉토리 prefix(`02-`). 쓸 때는 `saveManual`(YAML.stringify)만
- `manuals/<id>/source/`: 원본 Word. `pnpm import:docx`/앱의 새 매뉴얼 가져오기(`src/core/import.ts`)와 `make:reference`의 입력
- `manuals/bo/<NN>-<chapter>/<NN>-<screen>.md`: 화면 1개 = 파일 1개. front-matter `routes/sources/i18nPrefix`가 dealerhub-web 코드와의 연결 키
- `manuals/bo/images/<shot-id>.png`: 캡처 산출물. `manuals/bo/shots.ts`의 id와 같다
- `manuals/bo/videos/<id>.yaml`: 가이드 영상 시나리오 (데이터, id = 파일 이름). scene = `say`(자막+내레이션) + `steps`(정해진 단계만, `src/core/video/scenario.ts` zod 스키마). 쓸 때는 `saveVideo`(YAML.stringify)만. 엔진은 `src/core/video/` (overlay로 자막·커서를 페이지에 그림 → `page.screencast` 프레임 → ffmpeg h264+aac+mov_text). ffmpeg에 libass가 없어 자막을 ffmpeg로 새기지 않는다
- `.capture/<m>/review/<화면>.md.json`: Claude 변경 검토 기준. 최신화가 화면을 고치기 직전 본문을 남기고(이미 있으면 유지), 편집 화면이 지금 본문과 비교해 표시한다(`app/main/lib/review.ts`, 비교는 `app/shared/review-diff.ts`, 미리보기 표시는 `renderer/src/review-marks.ts`). 검토 완료·제출·되돌리기 때 지운다. 본문이 원문과 같아도 지우지 않는다(Claude가 아직 고치는 중일 수 있다)
- "내 PC에 기록만"(제출 창): `git.ts` `record`가 manuals/ 변경을 커밋만 한다(메시지 끝 `Ariadne-Record: true`, 원격 연결 없음). 변경 목록·변경 보기·되돌리기의 기준은 HEAD가 아니라 **마지막 제출 상태**(원격 main과의 merge-base, `baseCommit`)라 기록한 변경도 제출 전까지 변경 탭에 보인다. 제출하면 기록들을 메시지에 적어 한 커밋으로 올리고, 다 되돌리면 빈 기록은 정리한다. Claude 작업(`draft:start`)은 시작 전에 자동으로 기록한다
- Claude 최신화 대기열은 renderer `tasks.tsx`가 가진다(순수 함수 `app/shared/claude-queue.ts`, 앱을 켜 둔 동안만). main `draft.ts`는 지금처럼 한 번에 하나만 실행하고, 작업이 끝나면 renderer가 세션 확인 뒤 다음 항목을 시작한다. 끝난 작업 후처리는 `useClaudeDone`(상태가 아니라 완료 알림 구독)으로 해야 바로 이어지는 다음 작업에 묻히지 않는다
- `manuals/bo/reference.docx`: Word 스타일 템플릿 (`pnpm make:reference`로 원본에서 생성)
- 사용법 문서: `README.md`는 길잡이 표만, 기획자용은 `docs/planner/`(기능별 파일, 목차는 `docs/planner/README.md`), 개발자용은 `docs/developer/`, 작성 규칙은 `docs/writing-rules.md`. 기능을 바꾸면 해당 문서를 고친다
- `.env`: `DEALERHUB_WEB_DIR`, `BO_BASE_URL`(bo 캡처 주소 덮어쓰기, 선택)
- `src/core/`: 빌드·캡처·로그인·affected 함수. `root`/`manual`을 인자로 받고 `process.cwd()`·`.env`에 기대지 않는다 (CLI와 데스크톱 앱 공용)
- `src/cli/`: `pnpm` 명령 진입점. `.env`·인자를 읽어 core를 호출하는 얇은 래퍼
- `app/`: Ariadne 앱. `main/`(`ipc/<namespace>.ts`가 도메인별 IPC 핸들러, `ipc/context.ts`가 공용 상태·전제 조건 확인, `lib/`는 Electron 무관 로직), `preload/`, `renderer/`(React), `shared/api.ts`(IPC 계약. 채널은 `API_METHODS` 목록에서 만들고 main `handle()`·preload가 같이 쓴다. 메서드를 추가하면 목록에도 넣는다). 기획자 안내는 `app/INSTALL.md`
- 앱 가이드 영상: `renderer/.../VideoPanel.tsx`(목록·실행·재생) + `VideoEditor.tsx`(장면 편집). 영상 만들기·음성 듣기는 `main/video-worker.ts`(utilityProcess), STG 기록은 `main/lib/video-record.ts`(+`src/core/video/record.ts`), 음성 모델은 `main/lib/video-model.ts`(net.fetch → userData/models), ffmpeg는 번들된 `ffmpeg-static`(asar.unpacked)

## 명령
- `pnpm login --manual bo`: 브라우저에서 MFA 로그인 (사람이 직접). 세션은 유지되는 Chrome 프로필(`.auth/<m>-profile`, 앱은 userData/profiles/<m>)
- `pnpm capture --manual bo [--only ids]`: STG 캡처, 바뀐 이미지만 교체, `.capture/bo/report.json`
- `pnpm affected --manual bo --base <ref> [--head <ref>]`: dealerhub-web 변경 → 영향 섹션
- `pnpm build --manual bo`: `dist/<output>.docx`
- `pnpm import:docx --docx <file> --manual <id> [--analyze]`: Word 원본 → 매뉴얼
- `pnpm video --manual bo [--id ids] [--no-tts] [--headed] [--preview] [--from n]`: `dist/videos/<id>.mp4/.srt/.vtt`. TTS는 로컬 Kokoro(`.video-cache/`), 사내 TLS 프록시 때문에 `--use-system-ca`로 실행
- `pnpm typecheck`
- `pnpm test`: core + app 테스트 (`src/core/__tests__`, `app/main/lib/__tests__`). git 테스트는 로컬 `git http-backend`, 캡처 테스트는 설치된 Chrome 사용
- `pnpm app:dev` / `pnpm app:dist`(arm64 dmg, 사내망은 `NODE_USE_SYSTEM_CA=1`) / `pnpm app:e2e`(`ARIADNE_E2E_TOKEN` 필요, 제출은 안 함) / `pnpm app:e2e:video [--app <.app>]`(영상: 모델 받기, 내레이션 영상, 패키징 앱 검증)
- 앱 릴리즈: `app-v<version>` 태그를 `origin`에 push → Actions가 dmg를 Release에 올림. 사내 자체 서명 인증서(Secrets `MAC_CERT_P12`/`MAC_CERT_PASSWORD`)로 서명해 업데이트해도 폴더 같은 macOS 권한(TCC)이 유지된다. 시크릿이 없으면 릴리스가 멈춘다. 키체인은 서명으로 유지되지 않는다(Team ID가 없어 파티션이 빌드마다 바뀌는 cdhash) — 키체인은 `safeStorage`가 아니라 `app/main/lib/keychain.ts`(`/usr/bin/security`)로만 쓴다
- 리모트: `origin` = ignite-plan/ariadne(기준, 기획자 제출이 들어옴), `zi-gae` = zi-gae/ariadne(미러). PR 없이 main에 커밋하고 둘 다 push

## 규칙
- 작성 형식은 `manuals/bo/_template.md`
- UI 라벨은 실제 화면 표기 그대로(STG 화면 또는 dealerhub-web `en.json`)
- 정책·화면 근거는 **Confluence DLRS 기획서 최신 output**(`[YYYYMMoutput][Phase3][BO|FO] <메뉴> 화면`, 연결된 정책 문서)이 우선. 위키 SPEC은 보조. 기획서와 화면이 다르면 판단하지 말고 TODO, 근거 없으면 TODO 주석, 추측 금지
- STG 캡처 중 저장/삭제/발송/승인 버튼 클릭 금지. 영상도 기본 금지(`src/core/safety.ts`를 Claude STG 탐색과 같이 씀: 버튼 이름 + 쓰기 요청 차단)이고, `mutates: true` 시나리오만 STG 테스트 데이터(`Video Test` 접두어)로 실제 저장하고 `cleanup`으로 지운다. 외부 연동 버튼(딜러 생성 최종 `Create` 등)은 누르지 않는다
- STG 로그인 세션은 `src/core/session.ts`의 유지 프로필(`openProfile`)로만 연다. storageState 파일로 새 컨텍스트를 여러 번 열면 BO 토큰 갱신 때문에 로그아웃된다. 프로필은 한 번에 Chrome 하나라, 앱은 `main/lib/browser-host.ts`가 프로필마다 headless Chrome 하나를 띄워 탭을 빌려 준다(영상 worker는 127.0.0.1 디버깅 포트로 `cdpTab`). `main/lib/profile-lock.ts`: 공유(Claude 작업·영상 만들기·캡처·세션 확인, 동시에 돈다) / 단독(로그인·미리보기·STG 기록, 화면이 보이는 Chrome이라 다른 작업이 없을 때 공유 Chrome을 닫고 띄운다)
- 공유 Chrome에서는 route·init script·binding을 **page 단위로만** 건다(`guardWrites(page)`, `page.addInitScript`, `page.exposeBinding`). `context.route`/`context.addInitScript`는 다른 탭(예: STG 저장 허용 영상, 자막 overlay)에 번진다. core 함수는 `openTab`(`session.ts` `OpenTab`)을 받고, 없으면 `profileTab`으로 단독 실행한다(CLI)
- 쓰기 요청 차단(`safety.ts` `isAllowedRequest`)은 로그인 세션 유지 POST(sso/auth 경로, token/refresh)를 통과시킨다. 막으면 BO 인증이 실패해 화면이 403
- 앱 main에서 네트워크는 `net.fetch`만 쓴다 (사내 TLS 프록시 때문에 Node fetch 실패). git은 isomorphic-git
- Skills: `manual-update`(릴리즈 반영), `manual-new-section`(신규 메뉴, 개발자 대화형), `manual-draft`(신규 메뉴 초안, 앱의 "Claude로 초안 만들기"), `manual-spec`(최신화 1단계 기획서 요약, `.capture/<m>/spec/`), `manual-refresh`(기존 화면 하나 최신화, 앱의 "Claude로 최신화"가 화면마다 3개씩 동시 실행), `manual-shots`(기존 화면 이미지의 캡처 정의만, 캡처 패널의 "Claude로 캡처 정의 만들기". 본문 편집 도구 없음, `save_shot`은 대상 화면 이미지 id만 받고 매뉴얼 이미지 대신 `.capture/<m>/defined/`에 찍으며, 이번에 등록한 정의는 `drop_shot`으로 뺀다), `manual-video-draft`(가이드 영상 시나리오 초안, 영상 패널의 "Claude로 초안"), `manual-video-scene`(영상 장면 하나 채우기, 장면 편집기의 "Claude로 이 장면") — 앱용은 모두 비대화형
- 영상 시나리오는 Claude가 `video_save`(YAML 형식 검사)로만 쓰고 `video_check`(headless 실행)로 확인한다. `mutates`는 Claude가 켤 수 없고, mutates 시나리오는 `video_check`가 실행하지 않는다
- 앱의 초안 만들기는 `claude -p`에 허용 도구만 준다: Read/Glob/Grep, `manuals/<m>/` 쓰기, Ariadne MCP(STG는 앱이 대신 열고 저장/삭제 버튼과 쓰기 요청을 막음), Confluence 읽기 도구
- 앱의 Claude Code는 앱 전용 고정 버전(`app/main/lib/claude-install.ts`의 `CLAUDE_CODE_VERSION`, npm `@anthropic-ai/claude-code-darwin-arm64`를 userData/tools/claude에)을 먼저 쓴다. API 키 방식이면 `--bare` + `CLAUDE_CONFIG_DIR=<userData>/claude`로 개인 CLAUDE.md·hooks·플러그인을 끊고, 대화 기록도 거기에 쌓인다(디버깅 시 `~/Library/Application Support/Ariadne/claude/projects`). 버전을 올릴 때는 앱 옵션(--bare, --strict-mcp-config, --tools, --effort, --model)을 실제로 확인한다. 앱 전용이 없으면(옛 앱에서 업데이트, 고정 버전 올림) 앱을 켤 때 renderer가 뒤에서 설치하고 예전 버전 폴더는 지운다. 내 PC의 claude는 H-Chat이 낮은 버전을 400으로 거절하므로, 그 오류(`isBlockingFailure`: 버전·인증·모델)가 나면 최신화는 묻지 않고 멈춘다
- claude.ai 로그인은 앱 안에서 `claude auth login --claudeai`(터미널 없이 브라우저를 열고 코드도 stdin으로 받음)와 `auth status --json`으로 한다(`app/main/lib/claude-login.ts`, IPC `claudeLogin`). 로그인 모드 환경(키 변수 뺌, 기본 설정 폴더)이라 터미널의 claude와 로그인을 같이 쓴다
- 앱의 `claude -p`는 `--strict-mcp-config`(Ariadne + 연결된 Atlassian만, 설정은 `~/.claude.json`에서 옮기고 mcp-atlassian은 `ENABLED_TOOLS`·`READ_ONLY_MODE`로 Confluence 읽기만)와 `--tools`(기본 도구 제한)로 실행한다. PC의 MCP·도구 정의를 전부 실으면 첫 턴부터 문맥이 13만 토큰이 되어 자동 요약을 반복하다 멈춘다 (`app/main/lib/run-mcp.ts`)
