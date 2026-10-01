# user-manual

Dealers 사용자 매뉴얼 docs-as-code 리포. 원본은 `manuals/<manual>/` Markdown, Word는 빌드 산출물.

## 구조
- `manuals/bo/manual.yaml`: 제목, 버전, 장 순서. 장 번호는 디렉토리 prefix(`02-`)
- `manuals/bo/<NN>-<chapter>/<NN>-<screen>.md`: 화면 1개 = 파일 1개. front-matter `routes/sources/i18nPrefix`가 dealerhub-web 코드와의 연결 키
- `manuals/bo/images/<shot-id>.png`: 캡처 산출물. `manuals/bo/shots.ts`의 id와 같다
- `manuals/bo/reference.docx`: Word 스타일 템플릿 (`pnpm make:reference`로 원본에서 생성)
- `.env`: `BO_BASE_URL`(STG), `DEALERHUB_WEB_DIR`
- `src/core/`: 빌드·캡처·로그인·affected 함수. `root`/`manual`을 인자로 받고 `process.cwd()`·`.env`에 기대지 않는다 (CLI와 데스크톱 앱 공용)
- `src/cli/`: `pnpm` 명령 진입점. `.env`·인자를 읽어 core를 호출하는 얇은 래퍼

## 명령
- `pnpm login --manual bo`: 브라우저에서 MFA 로그인 후 세션 저장 (사람이 직접)
- `pnpm capture --manual bo [--only ids]`: STG 캡처, 바뀐 이미지만 교체, `.capture/bo/report.json`
- `pnpm affected --manual bo --base <ref> [--head <ref>]`: dealerhub-web 변경 → 영향 섹션
- `pnpm build --manual bo`: `dist/*.docx`
- `pnpm typecheck`
- `pnpm test`: core 단위 테스트 (`src/core/__tests__`)

## 규칙
- 작성 형식은 `manuals/bo/_template.md`
- UI 라벨은 dealerhub-web `en.json` 값 그대로. 정책 근거는 DealerHub 위키 SPEC. 근거 없으면 TODO 주석, 추측 금지
- STG 캡처 중 저장/삭제/발송/승인 버튼 클릭 금지
- Skills: `manual-update`(릴리즈 반영), `manual-new-section`(신규 메뉴)
