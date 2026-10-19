# Ariadne

Dealers 사용자 매뉴얼(영문, Word)을 만드는 리포입니다. BO, FO 등 매뉴얼 여러 개를 함께 관리합니다.

- 매뉴얼 원본은 `manuals/<매뉴얼 id>/`의 Markdown입니다(예: `manuals/bo/`). Word 파일은 원본으로 만드는 결과물입니다.
- **기획자**는 macOS 앱 **Ariadne**로 문서를 고치고, 화면을 캡처하고, Word를 만들고, 제출합니다. 터미널과 git은 몰라도 됩니다.
- **개발자**는 `pnpm` 명령과 Claude 스킬로 dealerhub-web 릴리즈 변경을 매뉴얼에 반영합니다.

## 문서

| 하고 싶은 일 | 보는 곳 |
|---|---|
| 앱 설치 | [설치 가이드](app/INSTALL.md) |
| 앱으로 매뉴얼 고치기 (기획자) | [기획자 사용법](docs/planner/README.md) |
| 매뉴얼에 없는 메뉴를 새로 쓰기 | [Claude로 초안 만들기](docs/planner/claude-features.md#claude로-초안-만들기) |
| 이미 있는 화면을 최신 기획서·화면에 맞추기 | [Claude로 최신화](docs/planner/claude-features.md#claude로-최신화) |
| 사용법 가이드 영상(자막, 내레이션) 만들기 | [가이드 영상 만들기](docs/planner/video.md) |
| Word 원본으로 새 매뉴얼 만들기 | [새 매뉴얼 가져오기](docs/planner/import.md) |
| 매뉴얼 문장 규칙 | [작성 규칙](docs/writing-rules.md) |
| 릴리즈 변경 반영, 신규 메뉴 추가, `pnpm` 명령 (개발자) | [개발자 사용법](docs/developer/manual.md) |
| 가이드 영상 시나리오 형식, CLI (개발자) | [가이드 영상 (개발자)](docs/developer/video.md) |
| 앱 수정·배포 (개발자) | [앱 개발](docs/developer/app.md) |

## 폴더

```
manuals/<id>/      매뉴얼 원본 (Markdown, 이미지, 가이드 영상 시나리오)
app/               기획자용 앱 Ariadne (Electron)
src/core, src/cli  빌드·캡처·영상 엔진과 pnpm 명령
docs/              사용법 문서 (기획자 / 개발자)
.claude/skills/    Claude 작업 절차 (앱의 초안·최신화·영상과 개발자용)
```
