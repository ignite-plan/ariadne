---
title: Menu
routes: []
sources: []
i18nPrefix: []
---

## Menu

**GNB Menu**

- The menu configured in **BO \> Menu Management** will be displayed.

- The way each menu is shown depends on the menu type selected in BO.

- If **the menu type is General**, the user will be redirected directly to the entered URL.

  - If the menu type is General and the Domain is set as Directory, clicking the GNB (Global Navigation Bar) menu will not redirect the user; instead, it will serve as a directory menu, displaying its 2nd to 4th depth sub-menus.

- If **the menu type is Bulletin Board**, the user will be redirected to the linked bulletin board screen.

  - If the menu type is Outlink, an icon indicating a new tab will appear next to the menu name. Clicking the menu will open the outlink URL entered in the Domain field in a new browser tab.

- The menu is only visible to users with the appropriate access permissions configured in BO \> Menu Management and for those whose Job Title or Username has been granted access in BO \> Job Management.

- GNB menu displays only 1depth menu, and when a menu is selected, you will be directed to the detailed screen of that menu.

![GNB Menu](images/menu-img-1.png){width=6.79in}

- When hovering the mouse over a 1depth menu, the entire 2 \~ 4depth menu layer of that menu is displayed, and when a menu is selected, you will be directed to the detailed screen of that menu.

- **Menu dropdown:** When hovering the mouse over a 1depth menu, you can check the lower 2 \~4 depth menus through the menu dropdown.

![Menu dropdown](images/menu-dropdown.png){width=6.79in}

**SNB Menu**

- Displays the menu set in BO \> Menu management.

- The menu is displayed only to users whose Job Title or Username has been granted access in BO \> Job Management, and who have menu access permissions configured in BO \> Menu Management.

- This is the SNB(Side Navigation Bar) menu that appears when selecting a 1\~4depth menu.

<!-- -->

- **The 1depth menu** of the selected menu is marked as selected in the GNB, and the corresponding 2\~4depth menus are displayed in a tree structure.

![SNB (Side Navigation Bar) Menu](images/snb-side-navigation-bar-menu.png){width=6.79in}

- When a menu is selected, you will be directed to the detailed screen of that menu, and the selected **menu name** is displayed on the right page.

![Selected Menu](images/selected-menu.png){width=3.99in}

**Click on SNB Menu**

- **Initial Entry**

  - When initially entering by clicking on a 1depth menu, the 2depth menus are displayed in a collapsed state.

  - ![2depth menus](images/menu-img-2.png){width=2.04in}

- **Expand and Collapse**

  - Menus with an **\'arrow\' icon** can be expanded and collapsed.

  - When clicking on an SNB menu of 2depth or higher, the menus below the 2depth are displayed.

  - If the menu name exceeds the allocated display width, it is truncated with an ellipsis (**...**).

  - When the user hovers the mouse over the truncated menu name, a tooltip is displayed showing the full menu name.

![Expanded menu1](images/expanded-menu1.png){width=1.92in}

- **Accessing Other Menus**

  - You can expand other menus even if there are already expanded menus.

![Expanded menu2](images/expanded-menu2.png){width=1.88in}
