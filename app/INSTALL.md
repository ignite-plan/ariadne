# Ariadne 설치 가이드

Dealers 사용자 매뉴얼을 고치고, BO 화면을 캡처하고, Word로 만드는 앱입니다. Apple Silicon(M1 이상) Mac 전용입니다.

## 1. 설치

1. 아래 **Assets**에서 `Ariadne-<버전>-arm64.dmg`를 받습니다.
2. dmg를 열고 **Ariadne**를 **응용 프로그램** 폴더로 끌어 놓습니다.
3. 응용 프로그램에서 Ariadne를 엽니다. 처음에는 "확인되지 않은 개발자" 경고가 뜹니다.
   - **시스템 설정 → 개인정보 보호 및 보안**으로 가서 아래쪽 "Ariadne이(가) 차단되었습니다" 옆의 **그래도 열기**를 누릅니다.
   - 한 번만 하면 됩니다. 사내 배포용 앱이라 Apple 공증을 받지 않았기 때문입니다.

> 경고 없이 열리지 않으면 터미널에서 `xattr -dr com.apple.quarantine /Applications/Ariadne.app`을 실행한 뒤 다시 엽니다.

## 2. 처음 실행

앱이 순서대로 안내합니다.

1. **GitHub 연결**: 앱 안의 **토큰 만들기 페이지 열기**를 눌러 토큰을 만듭니다.
   - Resource owner: `ignite-plan`
   - Repository access: **Only select repositories** → `ariadne`
   - Permissions: **Contents** Read and write, **Pull requests** Read and write, **Issues** Read and write (문제 신고)
   - 만든 토큰(`github_pat_…`)을 붙여 넣습니다. 토큰은 macOS 키체인에 암호화해 저장합니다.
2. **매뉴얼 내려받기**: 기본 폴더는 `~/Documents/Ariadne`입니다.
3. **환경 점검**
   - **pandoc**(미리보기·Word 만들기): 없으면 앱이 자동으로 받아 설치합니다 (약 40MB). 설치할 일이 없습니다.
   - **Claude Code**(Claude 기능): 앱 전용 고정 버전을 자동으로 받아 설치합니다 (약 220MB).
   - **Google Chrome**(선택, 화면 캡처)
4. **STG 로그인**: 화면 캡처·Claude 기능을 쓰려면 앱에서 STG에 한 번 로그인합니다 (MFA).

## Claude 기능 (초안·최신화·가이드 영상)

이미 터미널에서 Claude Code를 쓰고 있다면(**`~/.zshrc`의 `ANTHROPIC_API_KEY`** 또는 claude.ai 로그인, **Atlassian MCP 연결**) 따로 할 일이 없습니다.

- 앱은 모두 같은 환경에서 돌도록 **앱 전용 Claude Code(고정 버전)**를 첫 실행 때 받아 씁니다(약 220MB). 내 PC에 설치된 claude 버전과 상관없습니다.
- API 키 방식이면 개인 Claude 설정(내 CLAUDE.md, hooks, 플러그인)은 앱 작업에 섞이지 않습니다. Atlassian MCP 설정만 내 Claude Code에서 가져옵니다.

- 인증은 자동으로 고릅니다: 키가 있으면 API 키, 없으면 claude.ai 로그인
- 모델은 기본 `claude-sonnet-5[1m]`입니다 (설정 → 고급 → Claude 모델)
- 설정 → 환경 점검에서 Claude Code와 Confluence 연결을 확인할 수 있습니다

## 3. 쓰는 법

문장 고치기, 이미지 넣기, 화면 캡처, Word 만들기, 제출, 문제 해결은 [기획자 사용법](../docs/planner/README.md)에 있습니다.

새 버전이 나오면 앱 위쪽에 알림이 뜹니다. **업데이트**를 누르면 앱이 새 버전을 받아 두고(1분 안쪽), **지금 다시 시작**을 누르면 바꿔 끼운 뒤 다시 열립니다. 잘 안 되면 알림의 **직접 받기**로 dmg를 받아 덮어 설치합니다.
