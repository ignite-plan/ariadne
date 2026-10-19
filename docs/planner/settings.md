# 설정과 문제 해결

[← 기획자 사용법](README.md)

## 설정 (⚙)

| 탭 | 내용 |
|---|---|
| 일반 | 매뉴얼 선택, 제출 방식, 작업이 끝나면 알림(다른 앱을 보고 있을 때만 / 항상 / 끄기, 알림 시험) |
| 매뉴얼 | 지금 매뉴얼의 제목, 버전, Word 파일 이름, 캡처 주소와 화면 크기, 코드 연결. 바꾸면 제출해야 다른 사람에게 반영됩니다 |
| 계정 | GitHub 계정 확인, 토큰 바꾸기, 로그아웃 |
| 환경 점검 | pandoc, Chrome, Claude Code, ffmpeg, 음성 모델, 로그인 세션 상태. pandoc과 Claude Code는 **자동으로 설치** / **앱 전용으로 설치**로 앱이 받습니다 |
| 고급 | 리포 주소, 작업 폴더, pandoc 경로, **Claude 인증**(ANTHROPIC_API_KEY / claude.ai 로그인), Claude 생각량, Claude 모델, Claude Code CLI 경로, dealerhub-web 경로 |
| 변경 영향 | 개발자용. 두 릴리즈 사이 코드 변경이 어느 화면에 영향을 주는지 찾기 |
| 정보 | 앱 버전, 새 버전 확인, **문제 신고**(오류 기록을 붙여 GitHub Issue로 올림. 토큰·키·내 PC 경로는 가림) |

## 문제 해결

| 증상 | 해결 |
|---|---|
| 토큰이 유효하지 않거나 만료 | 설정 → 계정에서 새 토큰으로 바꿉니다 |
| 권한이 없습니다 / SSO | 토큰 페이지에서 `ignite-plan` 조직 SSO를 승인합니다. fine-grained 토큰이 막혀 있으면 classic 토큰(`repo` 권한)을 씁니다 |
| 미리보기·Word 만들기가 안 됨 | 설정 → 환경 점검에서 pandoc의 **자동으로 설치**를 누릅니다 |
| 초안·최신화가 `ANTHROPIC_API_KEY(…1234)로 인증하지 못했습니다`로 실패 | `~/.zshrc`의 키가 만료·무효입니다(끝 4자리로 어느 키인지 확인). 키를 바꾸거나(앱 재시작 불필요), 설정 → 고급 → Claude 인증을 **claude.ai 로그인**으로 바꿉니다 |
| 초안·최신화가 `ANTHROPIC_AUTH_TOKEN(…1234)로 … 인증하지 못했습니다`로 실패 | `ANTHROPIC_AUTH_TOKEN`이 있으면 `ANTHROPIC_API_KEY`보다 먼저 쓰입니다. H-Chat 설정 스크립트는 `ANTHROPIC_API_KEY` + `ANTHROPIC_BASE_URL`만 쓰므로, `~/.zshrc`에 남은 `export ANTHROPIC_AUTH_TOKEN`을 지웁니다 |
| 초안·최신화가 `… 모델을 받지 않습니다`로 실패 | 게이트웨이(H-Chat 등)가 그 모델을 지원하지 않습니다(예: 4.6 지원 종료). `~/.zshrc`에 `export ANTHROPIC_MODEL="claude-sonnet-5"`처럼 쓸 수 있는 모델을 넣습니다. H-Chat은 Claude Code `2.1.278`(`npm i -g @anthropic-ai/claude-code@2.1.278`)을 씁니다 |
| 초안·최신화가 `claude.ai 로그인으로 인증하지 못했습니다`로 실패 | 터미널에서 `claude`를 열어 `/login` 하거나, Claude 인증을 **ANTHROPIC_API_KEY**로 바꿉니다 |
| 초안 만들기에서 Claude Code를 못 찾음 | 설정 → 환경 점검의 Claude Code에서 **앱 전용으로 설치**를 누릅니다(앱이 정한 버전을 받음). 특정 claude를 쓰려면 설정 → 고급 → Claude Code CLI 경로를 지정합니다 |
| 초안에 기획서 근거가 없음 | Claude Code에 Atlassian MCP가 연결됐는지 확인합니다(`claude mcp list`) |
| 캡처가 `세션 만료`로 실패 | 캡처 화면에서 **다시 로그인** |
| 최신화 대기열이 `멈춤` | 다음 작업을 시작하기 전에 STG 세션이 만료됐습니다. 다시 로그인한 뒤 진행 패널에서 **계속** |
| 로그인·미리보기·STG에서 기록 버튼이 꺼져 있음 | 다른 STG 작업(Claude, 영상 만들기, 캡처)이 도는 중입니다. 마우스를 올리면 어떤 작업인지 보입니다 |
| 그 밖의 문제 | 설정 → 정보 → **문제 신고** |
| 동기화가 `오프라인` | 네트워크를 확인하고 동기화 표시를 다시 누릅니다. 편집과 저장은 오프라인에서도 됩니다 |
| 새 버전 알림 | 알림의 **업데이트** → **지금 다시 시작**. Claude 작업·영상 만들기 중에는 끝난 뒤 누릅니다. 안 되면 **직접 받기**로 dmg를 받아 덮어 설치합니다 |
