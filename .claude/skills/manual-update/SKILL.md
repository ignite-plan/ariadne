---
name: manual-update
description: 릴리즈 변경분을 기존 매뉴얼에 반영한다. "매뉴얼 갱신", "이번 릴리즈 매뉴얼 업데이트" 요청 시 사용
---

# 매뉴얼 갱신

## 입력
- manual (기본 `bo`)
- base ref: 직전 매뉴얼 반영 릴리즈 브랜치. 모르면 사용자에게 묻는다
- head ref: 이번 릴리즈 브랜치 (기본 dealerhub-web HEAD)

## 절차
1. `pnpm affected --manual bo --base <base> --head <head>` → 영향 섹션, 변경 파일, 변경 i18n key, 섹션 이미지 목록
2. 재캡처
   - `.auth/bo.json`이 없거나 만료됐으면 사용자에게 `pnpm login --manual bo` 실행을 요청하고 기다린다 (MFA 수동)
   - `pnpm capture --manual bo --only <영향 섹션 이미지 id,...>`
   - `.capture/bo/report.json`의 changed / failed 확인. failed는 shots.ts 셀렉터를 고치고 재시도
3. 본문 수정 (섹션별)
   - dealerhub-web에서 `git diff <base>...<head> -- <files>`를 읽고, changed 이미지를 Read로 확인
   - en.json 라벨 변경은 본문의 해당 라벨을 그대로 치환
   - 항목 추가/삭제, 검증 규칙(최대 길이, 필수 여부), 버튼 동작 변경을 반영
   - 정책 근거가 필요하면 DealerHub 위키 SPEC(`wiki-ask`)을 본다. 없으면 `<!-- TODO: 확인 필요 -->`로 남기고 추측하지 않는다
   - 형식은 `manuals/bo/_template.md` 규칙을 따른다
4. `pnpm build --manual bo` 후 변경 섹션을 사용자에게 요약 (섹션, 바뀐 이미지, TODO)
5. `manual.yaml`의 version 올리기는 사용자에게 확인 후

## 금지
- 코드 변경과 무관한 문장 다듬기
- STG에서 저장/삭제/발송 버튼 클릭
