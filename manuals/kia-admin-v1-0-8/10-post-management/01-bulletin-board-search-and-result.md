---
title: Bulletin Board Search & Result
routes: []
sources: []
i18nPrefix: []
---

## Bulletin Board Search & Result

- Use the search panel to find a bulletin board, then click its row in the list to view the posts of that bulletin board.\
  This screen is only for selecting a bulletin board. You cannot create, edit, or delete bulletin boards here.



![Bulletin board List in Post management](images/bulletin-board-list-in-post-management.png){width=6.27in}


**Search Panel**



![Search panel](images/search-panel.png){width=6.27in}


- **Board ID / Board Name**: Select the search criterion, then enter the keyword.

  - The default criterion is **Board Name**.

  - The placeholder is "Please enter the board name" or "Please enter the board ID" depending on the selected criterion.

- **Menu-Board Mapping**: Filter by whether the bulletin board is mapped to a menu (**All** / **Yes** / **No**).
  - The default is **Yes**.
  - If you select **No**, the **Menu** drop-down is disabled.

- **Created By / Updated By**: Select the search criterion, then enter the user name or ID.
  - The default criterion is **Created By**.
  - The placeholder is "Please enter the user name or ID".

- **Created Date / Updated Date**: Select the search criterion, then enter the period (From \~ To).

  - The default is **All** (the entire period). The date fields are enabled after you select a criterion.

  - No limit is applied to the search period.

- **Menu**: Select one or more 1-depth menus.
  - Use the multi-select drop-down (placeholder "Please select the menu"). You can search for a menu in the drop-down.

  - The selected menus are displayed below as chips (for example, **Sales ×**). Clicking **×** on a chip also clears its check in the drop-down.

- Click **\[Reset\]** to clear the inputs and chips and return to the default values (for example, **Menu-Board Mapping** = **Yes**).

- Click **\[Search\]** to search with the entered conditions.


>
>

**Bulletin Board List**



![List](images/list.png){width=6.27in}



- **Board ID**: The ID of the bulletin board.
- **Board Name**: The name of the bulletin board, displayed according to the language setting.
- **Menu-Board Mapping**: Whether the bulletin board is mapped to a menu.
- **Menu Path**: The path of the menu the bulletin board belongs to (for example, **Sales \> Bulletins \> 20-General**).
  - Bulletin boards with the same name in different menus are distinguished by **Menu Path**.
- **Created By**: The user who created the bulletin board.
- **Updated By**: The user who last updated the bulletin board.
- **Created Date**: The date the bulletin board was created.
- **Updated Date**: The date the bulletin board was last updated.

- If **Board Name** or **Menu Path** is too long, it is shortened with an ellipsis (...). Hover over it to see the full text in a tooltip.

- Click a row to go to the post list of that bulletin board.

- If the list fails to load, an error message and a **\[Retry\]** button are displayed.

- The bulletin board name and description are displayed at the top.

- A search area and post list for viewing posts belonging to that bulletin board are displayed
