---
title: <Screen Name>
routes:
  - /<bo route, path.ts 기준>
sources:
  - apps/hyundai-bo/src/pages/<Domain>/<Screen>/**
i18nPrefix:
  - <EN_KEY_PREFIX_>
---

## <Screen Name>

- One or two sentences on what this screen is for.

- What the user can do here (create, view, edit ...).

![<Caption>](images/<shot-id>.png){width=6.27in}

**<Group Title>**

- **<UI label exactly as en.json>**: What it shows or does.

- **Status**: Current status of the item.

  - **<Value>**: Meaning of the value.

- Click **\[<Button>\]** to <action>.

<!--
작성 규칙 (기존 매뉴얼에서 추출)
- 영어, 현재형, 짧은 문장. 대상 독자는 HMG/법인 BO 운영자
- 화면 1개 = 파일 1개 = H2 1개. 장(H1)은 manual.yaml이 만든다
- 구성 순서: 소개 bullet → 스크린샷 + caption → 항목 설명 → 버튼 동작 → 팝업은 해당 위치에 스크린샷 + 설명
- 입력 폼 항목은 "**Label**:" 다음 하위 bullet로 Required/Optional, 제약(최대 길이, 형식), 기본값
- UI 라벨은 en.json 값을 그대로 쓴다. 버튼은 **\[Label\]**
- 스크린샷 width: 전체 화면 6.27in, 팝업 3.4~4.2in, 인라인 아이콘 0.24in
- 근거가 없는 정책은 쓰지 않는다. "TODO: 확인 필요" HTML 주석으로 남긴다
-->
