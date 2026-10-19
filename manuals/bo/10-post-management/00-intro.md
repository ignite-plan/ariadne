---
title: Post Management
routes: []
sources: []
i18nPrefix: []
---

- The **Post Management** page in the **BO** allows users to **create**, **edit**, and **delete** posts under each bulletin board.

- When you select a **Bulletin Board**, you can check whether it is **linked to a menu**.\
  The attributes of each post are determined based on the **Post Attribute Settings** of the selected bulletin board.

![Post List -- Initial View](images/post-list-initial-view.png){width=4.22in}

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2053 왼쪽 게시판 트리와 오른쪽 목록 분할 화면이 게시판 선택 화면과 게시글 목록 전체 페이지로 분리됨 -->

![](images/post-management-img-1.png){width=5.52in}

Post List -- Selecting board

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2053 게시판 선택이 왼쪽 트리에서 게시판 선택 화면의 표 목록으로 바뀜 -->

- When you access the **Post Management** menu, the board selection screen opens as a full page with a table of bulletin boards. Click a bulletin board row to open its post list.

- The post list opens as a full page. To return to the board selection screen, click **\[View Board List\]** at the bottom left of the post list.

- Above the post list, two tabs are available.
  - **Post List**: The default tab.
  - **Template Management**: Visible only to users with Write permission.

- The **Menu Display Status** banner is shown at the top of the post list. Its content depends on whether Mobile Web is enabled for the tenant.
  - If Mobile Web is ON, both values are shown: "PC: Visible/Not Visible  Mobile: Visible/Not Visible".
  - If Mobile Web is OFF, only a single value (Visible/Not Visible) is shown.
  - Visible is marked with a green dot, and Not Visible with a gray dot.
  - Hover over the ⓘ icon to see a tooltip: "This menu's visibility is based on its own Display Setting & Scheduled Display. If the parent menu is hidden, this menu will not appear on the Front-end screen, regardless of its own Display Setting."
<!-- TODO: STG의 Menu Display Status는 Visible 값 하나만 확인됨(테넌트 모바일웹 OFF로 추정). ⓘ 아이콘과 툴팁, 초록/회색 점은 STG에서 확인하지 못함 -->
<!-- TODO: 확인 필요 - 게시판 선택 화면의 검색 항목(Board ID / Board Name, Menu-Board Mapping 등) 설명 반영 범위 (7월 정기배포 반영 범위 미결) -->
