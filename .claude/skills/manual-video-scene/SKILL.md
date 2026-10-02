---
name: manual-video-scene
description: 가이드 영상 시나리오의 장면 하나를 기획자 요청(한국어 가능)대로 STG 화면을 보고 채운다. 다른 장면은 건드리지 않는다. Ariadne 앱 장면 편집기의 "Claude로 이 장면"이 이 절차로 실행한다(사람 확인 없이 진행)
---

# 가이드 영상 장면 하나 채우기 (요청 + STG)

사람에게 묻지 않고 끝까지 진행한다. 기획자가 앱에서 결과를 듣고 미리보기로 확인한다.

## 입력 (프롬프트 끝 "이번 작업"에 있다)
- 영상 시나리오 id, 대상 장면 번호(채우기 또는 그 다음에 새 장면 넣기), 기획자 요청(한국어일 수 있음), 연결된 매뉴얼 화면

## 도구
- `mcp__ariadne__video_get`: 시나리오 전체 (앞뒤 장면의 흐름, 문체 확인용)
- `mcp__ariadne__video_open_scene`: 대상 장면이 시작되는 화면까지 앞 장면을 재생해 연다. 돌려준 **접근성 트리의 이름이 대상(role, name)의 근거**다
- `mcp__ariadne__stg_click` / `stg_fill`: 이어서 화면을 살펴본다
- `mcp__ariadne__video_save_scene`: **대상 장면 하나만** 저장한다 (`video_save`는 이 작업에서 막혀 있다)
- `mcp__ariadne__video_check`: 대상 장면부터 실행해 본다 (`fromScene`)
- Read(작업 폴더). Bash, 웹, 하위 에이전트는 막혀 있다

## 1. 준비
1. `video_get`으로 시나리오를 본다. 바로 앞 장면이 끝나는 화면과 내레이션 문체를 확인한다
2. 연결된 매뉴얼 화면이 있으면 Read로 읽고, 요청한 내용을 설명하는 문장을 찾는다

## 2. 화면 확인 (STG)
1. `video_open_scene`을 "이번 작업"의 scene 값으로 부른다
2. 요청한 순서대로 `stg_click`/`stg_fill`로 따라가며, 단계에 쓸 대상의 role과 이름을 접근성 트리에서 그대로 옮긴다
3. **저장/삭제/승인/발송/등록 버튼은 누르지 않는다**. 팝업에서 무언가를 고르는 모습을 보여 줄 때는 고르기까지만 하고 Cancel(또는 닫기)로 닫는다

## 3. 장면 쓰기 (`video_save_scene`)
```yaml
say: Click Edit on the Job title tab to choose which job titles can access the menu.
steps:
  - click: { role: tab, name: Job title }
  - click: { role: button, name: Edit }
  - waitFor: { role: dialog }
  - click: { role: checkbox, name: Sales Manager }
  - pause: 1500
  - click: { role: button, name: Cancel }
```
- `say`는 **영어**, 현재형, 한두 문장. 요청이 한국어여도 영어로 쓴다. 매뉴얼 문장이 있으면 그것을 쓴다
- 단계와 대상 형식은 `manual-video-draft`와 같다 (`open`, `waitFor`, `click`, `type`, `choose`, `select`, `highlight`, `hover`, `scroll`, `pause`)
- 팝업이 열리거나 화면이 바뀌면 `waitFor`로 기다린다. 체크·선택한 결과를 보여 주려면 `pause`나 `highlight`를 둔다
- 장면이 끝날 때 화면은 다음 장면이 시작하기 좋은 상태로 둔다 (열었던 팝업은 닫는다)
- **내레이션에 TODO나 추측을 넣지 않는다**. 확인이 필요한 것은 마지막 요약의 `notes`에 적는다

## 4. 실행해 보기
1. `video_check`를 "이번 작업"의 fromScene 값으로 부른다
2. 실패하면 그 단계를 고쳐 `video_save_scene` → `video_check`를 반복한다 (세 번 고쳐도 같은 단계가 실패하면 빼고 `notes`에 적는다)
3. `video_check`는 STG 브라우저를 닫고 실행하므로, 다시 화면을 살펴보려면 `video_open_scene`부터 다시 부른다

## 5. 마지막 응답
짧은 한국어 요약 뒤에 아래 JSON 블록 하나로 끝낸다 (앱이 읽는다):

```json
{ "sections": [], "video": "menu-management", "scenes": 1, "todos": 0, "notes": "" }
```
