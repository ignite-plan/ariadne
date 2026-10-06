---
name: manual-draft
description: 매뉴얼에 없는 메뉴의 화면 섹션 초안을 Confluence 기획서와 STG 화면만으로 끝까지 작성한다. Ariadne 앱의 "Claude로 초안 만들기"가 이 절차로 실행한다(사람 확인 없이 진행). "<메뉴> 매뉴얼 초안", "manual-draft" 요청 시 사용
---

# 매뉴얼 초안 작성 (Confluence + STG)

사람에게 묻지 않고 끝까지 진행한다. 모르는 것은 추측하지 말고 TODO로 남긴다. 기획자가 앱에서 검토한다.

## 입력 (프롬프트 끝 "이번 작업"에 있다)
- 매뉴얼 id, 메뉴 이름, 넣을 위치(기존 장 또는 새 장 + 위치), STG 경로 힌트(없을 수 있음)

## 도구
- `mcp__ariadne__*`: 매뉴얼 목차(`manual_outline`), 섹션 만들기(`create_section`), STG 화면(`stg_open`/`stg_click`/`stg_fill`), 캡처 저장(`save_shot`)
- Confluence 읽기 도구 (기획자 Atlassian MCP). **쓰기는 하지 않는다**
- Read/Glob/Grep(작업 폴더), `manuals/<id>/` 안의 Write/Edit. Bash, 웹, 하위 에이전트는 막혀 있다

## 1. 준비
1. `manual_outline`으로 목차, 템플릿(`template`), 예시(`example`), 캡처 주소를 본다. 템플릿과 예시를 Read로 읽고 문체·형식을 맞춘다
2. 이미 같은 메뉴 섹션이 있으면 새로 만들지 말고 마지막 요약에 그 사실만 적는다

## 2. 근거 수집 (Confluence, 스페이스 DLRS)
- **화면 기획서**: 제목이 `[YYYYMMoutput][Phase3][BO|FO] <메뉴> 화면` 형식이다. 같은 화면 기획서가 월별로 여러 개면 **가장 최근 output**을 쓴다. 문서 히스토리 표의 변경 내역도 읽는다
- **정책 문서**: 화면 기획서 머리의 "정책 문서" 링크(예: `[Phase3][BO] 메뉴/게시판 관리 정책`)
- **메뉴 위치/URL**: `법인 별 BO 메뉴 LIST` 문서에서 메뉴의 path를 찾는다 (STG 경로 힌트가 없을 때)
- 읽은 문서는 제목, URL, 버전(가능하면)을 기억해 요약에 넣는다

## 3. 화면 확인 (STG)
1. `stg_open`으로 메뉴 화면을 연다. 돌려준 **접근성 트리의 이름이 UI 라벨의 근거**다 (기획서 표기와 다르면 화면 표기를 쓴다)
2. 스크린샷은 대화에 크게 쌓인다. 화면 구성을 처음 볼 때와 `save_shot` 직전에만 Read로 본다 (라벨 확인은 접근성 트리로 충분하다). STG 응답은 짧게 온다: 팝업이 열려 있으면 그 팝업만, 화면 이동 직후엔 앞부분(4000자), 같은 화면에서 누르기·입력한 뒤에는 **앞 응답과 달라진 줄만** 온다(나머지는 앞 응답 그대로). `full: true`는 대화에 크게 쌓이니 잘린 뒤쪽이 꼭 필요할 때만 쓴다. 이름은 role 뒤 따옴표 안의 것을 그대로 쓴다 (안내 문구·선택값·도움말 문장이 아니다)
3. 목록 → 상세 → 생성/수정 → 팝업 순으로 `stg_click`으로 연다. 생성/수정 화면은 `stg_fill`로 입력 상태까지만 만든다
4. **저장/삭제/승인/발송/등록 버튼은 누르지 않는다** (앱이 거절하고 쓰기 요청도 막는다. 거절되면 그 단계를 건너뛴다)
5. 로그인 페이지로 넘어가면(세션 만료) 화면 작업을 멈추고 기획서만으로 쓰되, 이미지 자리에 `<!-- TODO: STG 로그인 후 캡처 필요 -->`

## 4. 캡처
- 섹션에 넣을 이미지마다 `save_shot`. id는 caption slug(`menu-list`, `menu-creation-popup`), 팝업은 `clip: '[role="dialog"]'`
- steps는 `stg_click`/`stg_fill`로 실제로 열어 본 순서 그대로 넣는다
- `ready`와 `waitFor`는 접근성 트리에서 실제로 본 텍스트만 쓴다 (예: `text=Total 4`보다 `text=Total`). 8초 안에 안 보이면 실패하니, 실패하면 locator를 바꾸거나 빼고 다시 저장한다
- 본문 표기: 전체 화면 `![Menu List](images/menu-list.png){width=6.27in}`, 팝업 `{width=4.2in}`, 작은 팝업 `{width=3.4in}`

## 5. 작성
1. 화면마다 `create_section`. 새 장이면 `newChapterTitle`과 `chapterIndex`(0부터)를 준다. 두 번째 화면부터는 돌려받은 장 폴더(`chapterDir`)를 쓴다
2. 돌려받은 file을 **먼저 Read한 뒤** Write로 본문을 쓴다 (Read 없이 Write하면 거절된다). front-matter는 `routes`에 STG path만 넣고, `sources`/`i18nPrefix`는 비워 둔다 — 개발자가 채운다
3. 형식 (`_template.md`):
   - 영어, 현재형, 짧은 문장. 화면 1개 = 파일 1개 = `##` 제목 1개
   - 순서: 소개 bullet 1~2개 → 스크린샷 → `**Group Title**` 아래 항목 설명 → 버튼 동작 → 팝업은 그 위치에 스크린샷 + 설명
   - 항목: `- **Label**: description`. 입력 항목은 하위 bullet로 Required/Optional, 제약(최대 길이, 형식), 기본값
   - 버튼: `**\[Label\]**`. Label은 화면 표기 그대로
4. **근거 규칙**
   - 정책·제약(최대 길이, 필수 여부, 권한, 노출 조건)은 기획서에 있는 것만 쓴다
   - 근거가 없으면 `<!-- TODO: 확인 필요 - <무엇> -->`
   - 기획서와 화면이 다르면 `<!-- TODO: 기획서(<문서 제목>)는 <A>, STG 화면은 <B> -->` — 어느 쪽이 맞는지 판단하지 않는다
   - 기획서의 미결/검토 중 표시는 확정된 것처럼 쓰지 않는다

## 6. 마지막 응답
짧은 한국어 요약 뒤에 아래 JSON 블록 하나로 끝낸다 (앱이 읽는다):

```json
{
  "sections": ["08-menu-management/01-menu-list-view.md"],
  "images": ["menu-list"],
  "todos": 3,
  "sources": [{ "title": "[202606output][Phase3][BO] 메뉴 관리 화면", "url": "https://hmg.atlassian.net/wiki/spaces/DLRS/pages/536957869", "version": "v12" }],
  "notes": "Mobile Display Setting은 테넌트 설정에 따라 보이지 않아 캡처하지 못함"
}
```
