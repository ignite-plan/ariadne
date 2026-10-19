---
title: Bulletin Board Search & Result
routes:
  - /board/select
sources: []
i18nPrefix: []
---

## Bulletin Board Search & Result

- Use the search panel to find a bulletin board, then click its row in the list to view the posts of that bulletin board.\
  This screen is only for selecting a bulletin board. You cannot create, edit, or delete bulletin boards here.

**Search Panel**

- **Board ID / Board Name**: Select the search criterion, then enter the keyword.

  - The default criterion is **Board Name**.

  - The placeholder is "Please enter the board name" or "Please enter the board ID" depending on the selected criterion.

- **Menu-Board Mapping**: Filter by whether the bulletin board is mapped to a menu (**All** / **Yes** / **No**).

  - The default is **Yes**.

  - If you select **No**, the **Menu** drop-down is disabled.

- **Created By / Updated By**: Select the search criterion, then enter the user name or ID.

  - The default criterion is **Created By**.

  - The placeholder is "Please enter the user name or ID".

- **Created Date / Updated Date**: Select the search criterion, then enter the period (From ~ To).

  - The default is **All** (the entire period). The date fields are enabled after you select a criterion.

  - No limit is applied to the search period.

- **Menu**: Select one or more 1-depth menus.

  - Use the multi-select drop-down (placeholder "Please select the menu"). You can search for a menu in the drop-down.

  - The selected menus are displayed below as chips (for example, **Sales ×**). Clicking **×** on a chip also clears its check in the drop-down.

- Click **\[Reset\]** to clear the inputs and chips and return to the default values (for example, **Menu-Board Mapping** = **Yes**).

- Click **\[Search\]** to search with the entered conditions.

**Bulletin Board List**

- **Board ID**: The ID of the bulletin board.

- **Board Name**: The name of the bulletin board, displayed according to the language setting.

- **Menu-Board Mapping**: Whether the bulletin board is mapped to a menu.

- **Menu Path**: The path of the menu the bulletin board belongs to (for example, **Sales > Bulletins > 20-General**).

  - Bulletin boards with the same name in different menus are distinguished by **Menu Path**.

- **Created By**: The user who created the bulletin board.

- **Updated By**: The user who last updated the bulletin board.

- **Created Date**: The date the bulletin board was created.

- **Updated Date**: The date the bulletin board was last updated.

- If **Board Name** or **Menu Path** is too long, it is shortened with an ellipsis (...). Hover over it to see the full text in a tooltip.

- Click a row to go to the post list of that bulletin board.

- If the list fails to load, an error message and a **\[Retry\]** button are displayed.

<!-- TODO: 확인 필요 - Announcement 게시판은 Menu-Board Mapping이 No여도 목록 위쪽에 보이도록 예외 처리 (기획서 OI-03 개발 확인 중, 미결). STG에서는 Announcements가 목록 맨 위에 Mapping "-"로 보임 -->

<!-- TODO: 확인 필요 - 페이지네이션 여부 (Jira 2026-07-02 결정은 "페이지네이션 없이 전체 게시판을 한 페이지에", 같은 기획서 표에는 "1페이지 최대 100개"도 적혀 있음. 미결) -->

<!-- TODO: 확인 필요 - Menu Path 검색 방식 (현대 요청은 Menu Path를 최소 Level 1 기준으로 검색하는 것이며 Menu 드롭다운이 이를 맡는 것으로 보임, 기획서 OI-01/OI-02 미결) -->

- The bulletin board name and description are displayed at the top.

- A search area and post list for viewing posts belonging to that bulletin board are displayed
