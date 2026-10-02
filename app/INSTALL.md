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
   - **pandoc**(필수, 미리보기·Word 만들기): https://github.com/jgm/pandoc/releases/latest 에서 `pandoc-<버전>-arm64-macOS.pkg`를 받아 설치합니다.
   - **Google Chrome**(선택, 화면 캡처)

## 3. 쓰는 법

문장 고치기, 이미지 넣기, 화면 캡처, Word 만들기, 제출, 문제 해결은 [사용법](https://github.com/ignite-plan/ariadne#기획자-사용법)에 있습니다.

새 버전이 나오면 앱 위쪽에 알림이 뜹니다. 같은 방법으로 dmg를 받아 덮어 설치합니다.
