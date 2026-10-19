# 작성 규칙

[← README](../README.md)

독자는 매뉴얼마다 다릅니다(BO: HMG/법인 운영자, FO: 딜러 사용자). 형식은 [`manuals/bo/_template.md`](../manuals/bo/_template.md)를 따릅니다.

- 영어, 현재형, 짧은 문장으로 씁니다.
- 화면 하나는 파일 하나이고, 제목(H2)도 하나입니다. 장 제목(H1)은 빌드가 붙입니다.
- 순서: 소개 bullet → 스크린샷 + caption → 항목 설명 → 버튼 동작 → 팝업은 해당 위치에 스크린샷 + 설명
- 항목은 `**Label**: 설명`으로 씁니다. 입력 항목은 하위 bullet에 Required/Optional, 제약(최대 길이, 형식), 기본값을 씁니다.
- 버튼은 `**\[Label\]**`로 씁니다.
- **UI 라벨은 실제 화면 문구(dealerhub-web `en.json`) 그대로** 씁니다.
- **근거 없는 정책은 쓰지 않습니다.** 확인이 필요하면 TODO(⚑)로 남깁니다.

```markdown
## Dealer List View

- This screen provides a list of all registered dealers.

![Dealer List](images/dealer-list.png){width=6.27in}

**Dealer Information Columns**

- **Status**: Current status of the dealer.

  - **Draft**: Dealer creation in progress.

- Click **\[Search\]** to apply the selected filters.
```
