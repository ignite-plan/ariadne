---
title: Bulletin Board List
routes:
  - /board
sources: []
i18nPrefix: []
---

## Bulletin Board List

- When accessing the Bulletin Board Management menu, a full page with a search panel and a **list of registered bulletin boards** opens. The previous board tree panel and inline detail panel are no longer displayed.

- The bulletin board list displays Board ID, Board Name, Menu-Board Mapping, Menu Path, Created By, Updated By, Created Date, and Updated Date.

- When clicking the **\[+ New Board\]** button at the top right, you move to the bulletin board creation page.

- When clicking a row in the list, you move to the **Board Details** page of the bulletin board.

- When a tenant or brand is added, the system automatically creates an **Announcement Board**, which is a system-fixed bulletin board that cannot be deleted.

  - The Announcement Board is identified by the **\"System\"** label displayed in the board list.

  - The Announcement Board has predefined properties that cannot be modified. These items are visible on the view screen but cannot be edited or modified on the edit screen.

    - The following attributes are **Enabled (mandatory and always active)**: Posting Period, Important Notice (top pinning), Notification, and Attachments.

    - The following attributes are **Disabled**: Post Target and Additional Properties.


![Bulletin board List](images/bulletin-board-list-2.png){width=6.27in}


**Bulletin Board Search & Result**

- Search conditions in the search panel:

  - **Board ID / Board Name**: Select the criteria in the dropdown (default: Board Name) and enter text. The placeholder changes according to the selected criteria (`Please enter the board name` / `Please enter the board ID`).

  - **Menu-Board Mapping**: Select **All**, **Yes**, or **No** (default: All).

  - **Created By / Updated By**: Select the criteria in the dropdown (default: Created By) and enter a user name or ID (`Please enter the user name or ID`).

  - **Created Date / Updated Date**: Select the criteria in the dropdown (default: All), then enter the From \~ To dates (MM-DD-YYYY). The date fields are enabled after you select a criteria other than All.

  - **Menu**: Select one or more top-level (depth 1) menus in the multi-select dropdown (`Please select the menu`). Typing in the field filters the options. Selected menus are checked and displayed as chips below the field; clicking the **x** on a chip removes the chip and clears the check. Boards linked to the sub-menus of the selected menu are also searched.

- Clicking the **\[Reset\]** button clears all entered text and chips and returns the dropdowns and radio buttons to their default values.

- When Menu-Board Mapping is set to **No**, the Menu dropdown is disabled.

- Bulletin board list:

  - **Menu-Board Mapping** shows whether the board is linked to a menu, and **Menu Path** shows the menu hierarchy separated by `>` (for example, `Sales > Bulletins > 20-General`). If the board is not linked to a menu, `-` is displayed in Menu Path.

  - **Created By / Updated By** are displayed in the `Name(Employee ID)` format.

  - The Announcement Board is displayed at the top of the list, followed by the other boards in ascending order of Board ID.

  - If a value is longer than the column width, it is truncated with `...`, and the full text is displayed as a tooltip when you hover over it.


![Bulletin board List 1](images/bulletin-board-list-1.png){width=6.27in}
