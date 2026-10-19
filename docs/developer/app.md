# 앱 개발

[← README](../../README.md)

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

## 앱 릴리즈

```bash
git tag app-v1.1.0 && git push origin app-v1.1.0
```

`.github/workflows/release-app.yml`이 테스트 후 dmg를 만들어 Release에 올립니다. 버전은 태그에서 정하고, Release 본문은 `app/INSTALL.md`입니다.

**서명**: 릴리스는 사내 자체 서명 인증서(`Ariadne Code Signing (Ignite)`, 2036-10까지)로 서명합니다. macOS가 앱을 "이 인증서로 서명한 `kr.co.ignite.ariadne`"로 알아봐서, 앱 안 업데이트를 해도 폴더 같은 권한(TCC)을 다시 묻지 않습니다.
- **키체인은 서명으로 해결되지 않습니다.** 앱이 직접 만든 키체인 항목은 서명의 Team ID로 파티션을 정하는데, 자체 서명 인증서에는 Team ID가 없어 빌드마다 바뀌는 cdhash가 파티션이 됩니다. 그래서 Electron `safeStorage`를 쓰면 업데이트마다 키체인 암호를 다시 묻습니다(1.10.2까지).
- 그래서 GitHub 토큰은 `/usr/bin/security`로 저장합니다(`app/main/lib/keychain.ts`, 항목 `Ariadne GitHub Token`, account = 앱 데이터 폴더). 항목을 여는 것은 Apple이 서명한 `security`라 앱 서명과 상관없이 묻지 않습니다. 예전 `token.bin`은 처음 읽을 때 한 번 묻고 옮긴 뒤 지웁니다.
- 키체인을 새로 써야 하면 `safeStorage`·`keytar`가 아니라 `lib/keychain.ts`를 씁니다.
- 인증서는 리포 Secrets `MAC_CERT_P12`(p12, base64)와 `MAC_CERT_PASSWORD`에 있습니다. 없으면 릴리스가 멈춥니다(ad-hoc 빌드가 나가면 모두 폴더 권한을 다시 허용해야 하므로).
- 원본 p12와 비밀번호는 Secrets 밖에도 안전한 곳에 보관합니다. 잃어버려 새 인증서를 만들면 다음 업데이트에서 모두 폴더 권한을 한 번 다시 허용해야 합니다.
- 로컬 `pnpm app:dist`는 인증서가 없으면 ad-hoc으로 서명합니다(`app/build/after-pack.cjs`).

## 구조

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
