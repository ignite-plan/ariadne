# Ariadne

Dealers 사용자 매뉴얼 docs-as-code 리포와, 기획자가 이 리포를 터미널 없이 편집하는 macOS 앱.

- 원본은 `manuals/<manual>/` Markdown, Word(`dist/*.docx`)는 빌드 산출물
- 기획자는 **Ariadne 앱**(dmg)으로 편집·캡처·Word 빌드·제출 → [설치 가이드](app/INSTALL.md)
- 개발자는 `pnpm` CLI와 Claude 스킬(`manual-update`, `manual-new-section`)로 릴리즈 변경을 반영

## 구조

```
manuals/bo/          매뉴얼 원본 (manual.yaml, 장/화면 .md, images/, shots.ts, reference.docx)
src/core/            빌드·캡처·로그인·affected 함수. CLI와 앱이 같이 쓴다
src/cli/             pnpm 명령 진입점
app/main/            Electron main (IPC, git, GitHub, pandoc 미리보기)
app/main/lib/        Electron에 의존하지 않는 로직 (단위 테스트 대상)
app/preload/         window.ariadne 노출
app/renderer/        React UI
app/shared/api.ts    main ↔ renderer 계약
app/e2e/smoke.ts     빌드된 앱 E2E
```

## CLI

```bash
pnpm login --manual bo                        # STG BO MFA 로그인 → .auth/bo.json
pnpm capture --manual bo [--only ids]         # STG 캡처, 바뀐 이미지만 교체
pnpm affected --manual bo --base <ref> [--head <ref>]   # dealerhub-web 변경 → 영향 섹션
pnpm build --manual bo [--chapters 2,5]       # dist/*.docx
pnpm typecheck
pnpm test                                     # core + app 단위/통합 테스트
```

`.env`: `BO_BASE_URL`(STG), `DEALERHUB_WEB_DIR`(dealerhub-web 로컬 경로). pandoc, Google Chrome 필요.

## 앱 개발

```bash
pnpm app:dev                                  # electron-vite dev (HMR)
pnpm app:build                                # out/
pnpm app:dist                                 # release/Ariadne-<version>-arm64.dmg
ARIADNE_E2E_TOKEN=$(gh auth token) pnpm app:e2e [--app release/mac-arm64/Ariadne.app]
```

- 사내망은 TLS 가로채기 프록시가 있어 Node `fetch`가 실패한다. `pnpm install`이 Electron 바이너리를 못 받으면 `NODE_USE_SYSTEM_CA=1 node node_modules/electron/install.js`. 앱 안의 GitHub/git 통신은 Electron `net.fetch`(시스템 인증서)를 쓴다
- git은 isomorphic-git이라 기획자 PC에 Xcode CLT가 없어도 된다. 제출은 main에 바로 push, 충돌이면 `ariadne/<login>-<시각>` 브랜치 + PR
- `ARIADNE_USER_DATA`로 앱 데이터(설정, 토큰, BO 세션) 위치를 바꿀 수 있다 (E2E, 두 번째 프로필)
- Apple Developer ID가 없어 ad-hoc 서명만 한다 (`app/build/after-pack.cjs`). 자동 업데이트 대신 실행 시 GitHub Releases의 `app-v*`를 확인해 알린다

## 앱 릴리즈

```bash
git tag app-v1.1.0 && git push origin app-v1.1.0
```

`.github/workflows/release-app.yml`이 테스트 후 dmg를 만들어 Release에 올린다. 버전은 태그에서 정한다.
