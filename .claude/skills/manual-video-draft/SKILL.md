---
name: manual-video-draft
description: 매뉴얼 화면 하나(또는 연결된 여러 화면을 잇는 흐름)의 사용법 가이드 영상 시나리오(manuals/<m>/videos/<id>.yaml)를 매뉴얼 본문과 STG 화면으로 끝까지 작성한다. Ariadne 앱의 가이드 영상 "Claude로 초안"이 이 절차로 실행한다(사람 확인 없이 진행). "<화면> 가이드 영상 시나리오", "manual-video-draft" 요청 시 사용
---

# 가이드 영상 시나리오 초안 (매뉴얼 + STG)

사람에게 묻지 않고 끝까지 진행한다. 기획자가 앱에서 내레이션을 듣고, 미리보기로 확인하고, 고친다.

## 입력 (프롬프트 끝 "이번 작업"에 있다)
- 매뉴얼 id, 영상 시나리오 id, 연결된 매뉴얼 화면(없거나 여러 개일 수 있음, 영상에 나오는 순서), STG 경로 힌트
- 기획자 요청(있으면): 보여 줄 범위·순서·장면 수 같은 요청을 먼저 따른다. 단 저장/삭제 버튼 금지와 `mutates`를 켜지 않는 규칙은 요청으로 바뀌지 않는다

## 도구
- `mcp__ariadne__video_get` / `video_save` / `video_check`: 시나리오 읽기, 저장(형식 검사), STG에서 실행해 보기
- `mcp__ariadne__stg_open` / `stg_click` / `stg_fill`: 화면 확인. 돌려준 **접근성 트리의 이름이 대상(role, name)의 근거**다. STG 응답 형식과 이름 쓰는 법은 아래 '작업 방식 (앱 실행 공통)'을 따른다
- Confluence 읽기 도구(있으면), Read/Glob/Grep(작업 폴더). Bash, 웹, 하위 에이전트는 막혀 있다

## 1. 준비
1. `video_get`으로 지금 시나리오, 연결 화면 파일(`sections`), 예시(`example`)를 받는다. 예시 YAML을 Read로 읽고 형식을 맞춘다
2. 연결 화면 Markdown을 모두 Read로 읽는다. **내레이션 문장은 이 본문에서 가져온다** (영어, 현재형, 짧게). 장면 순서는 연결 화면 순서, 그 안에서는 본문 순서를 따른다
   - 연결 화면이 여러 개면 영상 하나로 이어지게 쓴다: 앞 화면의 마지막 장면 다음에 다음 화면으로 넘어가는 장면(그 화면의 `routes`로 `open` 또는 화면 안 버튼·메뉴 `click`, 그리고 `waitFor`)을 넣고, 내레이션도 넘어가는 이유를 한 문장으로 잇는다. 화면마다 시작 카드를 따로 만들지 않는다 (`intro`는 영상 전체 한 문장)
3. 연결 화면이 없으면 Confluence 화면 기획서(`[YYYYMMoutput][Phase3][BO|FO] <메뉴> 화면`, 가장 최근 output)로 쓴다

## 2. 화면 확인 (STG)
1. `stg_open`으로 화면을 연다 (경로: 힌트 → 연결 화면 front-matter `routes`. 화면이 여러 개면 화면마다 연다)
2. 본문이 설명하는 순서대로 `stg_click`/`stg_fill`로 열어 보며, 단계에 쓸 대상의 role과 이름을 접근성 트리에서 그대로 옮긴다
3. **저장/삭제/승인/발송/등록 버튼은 누르지 않는다**. 생성·수정 화면은 입력 상태와 저장 버튼 강조(`highlight`)까지만 보여 준다. 시나리오의 `mutates`(STG 저장 허용)는 켜지 않는다 — 기획자가 정한다

## 3. 시나리오 쓰기 (`video_save`에 YAML 전체)
```yaml
title: Dealer List View
intro: This video shows how to search for dealers and view their information.
sections:
  - 02-dealer-management/01-dealer-list-view.md
maskPersonal: true
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
- 단계: `open`(경로), `waitFor`, `click`, `type: { target, text }`, `choose: { target, option }`(HDS/MUI 선택 상자), `select: { target, value }`(기본 select), `highlight: { target, ms }`, `hover`, `scroll`, `pause`(ms)
- 대상: `{ role, name }` 우선(접근성 트리 표기 그대로) → `label` → `placeholder` → `text`. 같은 것이 여럿이면 `nth`(0부터), 행 안의 버튼은 `within: { role: row, name: ... }`
- 장면 하나 = 내레이션 한두 문장 + 그 문장이 설명하는 조작. 첫 장면은 `open`과 화면이 준비됐는지 `waitFor`로 시작한다
- 화면 전환이나 팝업 뒤에는 `waitFor`로 다음 화면의 글자를 기다린다
- 항목 설명만 있는 문장은 그 영역을 `highlight`로 보여 준다
- `sections`는 받은 그대로 둔다. `title`은 화면 이름(여러 화면이면 흐름 이름, 예: Dealer Search and Creation), `intro`는 "This video shows how to …" 한 문장. `maskPersonal: true`는 그대로 둔다
- **내레이션에 TODO나 추측을 넣지 않는다** (소리 내어 읽힌다). 확인이 필요한 것은 마지막 요약의 `notes`에 적는다
- 내레이션의 UI 라벨은 화면 표기 그대로 쓴다

## 4. 실행해 보기
1. `video_check`로 처음부터 실행한다. 실패하면 돌려준 장면·단계를 고쳐 `video_save` → `video_check`를 반복한다 (특정 장면부터는 `fromScene`)
2. 세 번 고쳐도 같은 단계가 실패하면 그 단계를 빼고 `notes`에 적는다
3. 로그인 페이지로 넘어가면(세션 만료) 실행해 보기를 멈추고 `notes`에 적는다

## 5. 마지막 응답
짧은 한국어 요약 뒤에 아래 JSON 블록 하나로 끝낸다 (앱이 읽는다):

```json
{
  "sections": [],
  "video": "dealer-list",
  "scenes": 6,
  "todos": 0,
  "sources": [{ "title": "02-dealer-management/01-dealer-list-view.md" }],
  "notes": "Business ending in 필터는 STG에 데이터가 없어 결과 화면을 보여 주지 못함"
}
```
