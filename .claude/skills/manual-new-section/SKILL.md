---
name: manual-new-section
description: 매뉴얼에 없는 BO 메뉴의 섹션을 기존 포맷으로 작성하고 스크린샷을 자동 캡처한다. "신규 메뉴 매뉴얼 작성", "<메뉴> 매뉴얼 추가" 요청 시 사용
---

# 신규 메뉴 섹션 작성

## 1. 대상 확인
- dealerhub-web `apps/hyundai-bo/src/routes/path.ts`의 route와 `manuals/bo/**/*.md` front-matter `routes`를 비교해 미작성 메뉴 목록을 보여준다
- 사용자가 고른 메뉴만 진행한다

## 2. 근거 수집 (추측 금지)
- 페이지 코드: `apps/hyundai-bo/src/pages/<Domain>/**`, 도메인 `README.md`
- UI 라벨: `apps/hyundai-bo/src/locales/en.json` 값을 그대로 쓴다
- 정책·제약: DealerHub 위키 SPEC (`wiki-ask`). 코드에서 정책을 추론하지 않는다
- 근거가 없는 내용은 `<!-- TODO: 확인 필요 -->`

## 3. 화면 탐색과 캡처
- `.auth/bo.json` 세션으로 Playwright MCP에서 STG 화면을 직접 열어 구조를 확인한다. 로그인이 필요하면 사용자에게 요청
- 화면/팝업마다 `manuals/bo/shots.ts`에 shot을 추가한다. id는 caption slug (`enrollment-request-list`)
- 생성·수정 화면은 입력 상태까지만. **저장/삭제/발송/승인 버튼은 누르지 않는다**
- `pnpm capture --manual bo --only <ids>` 후 이미지를 Read로 확인

## 4. 작성
- `manuals/bo/<NN>-<chapter-slug>/<NN>-<screen-slug>.md`, `_template.md` 형식
- 장 번호는 기존 마지막 장 다음 번호. `manual.yaml`에 chapter/sections 추가
- 기존 섹션 하나(예: `02-dealer-management/01-dealer-list-view.md`)를 먼저 읽고 문체를 맞춘다

## 5. 확인
- `pnpm build --manual bo` 성공
- 사용자에게 섹션, 캡처 이미지, TODO 목록 보고
