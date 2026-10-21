---
title: Menu View
routes: []
sources: []
i18nPrefix: []
---

## Menu View

![Menu view](images/menu-view.png){width=6.26in}

Menu Detail

- When a menu is successfully saved or when you click a menu name in the Menu List, you move to the menu detail screen.

- The Menu Detail tab displays saved menu property data, and Menu Access Permission displays job title and user settings that can access the menu.

- [**Menu Display Status**: The banner at the top of the Menu Details tab shows whether the selected menu is currently visible on the Front-end screen.]{.mark}

  - [**Visible** (green dot): The menu is displayed on the Front-end screen.]{.mark}

  - [**Not Visible** (gray dot): The menu is not displayed on the Front-end screen.]{.mark}

  - [If the tenant uses Mobile Web, the banner shows both values, for example "PC: Visible Mobile: Not Visible". If the tenant does not use Mobile Web, the banner shows a single value, for example "Visible".]{.mark}

  - [Hover over the info icon to see how visibility is decided. For a 1st-depth menu, the tooltip reads "This menu's visibility is based on its own Display Setting & Scheduled Display." For 2nd- to 4th-depth menus, the tooltip adds "If the parent menu is hidden, this menu will not appear on the Front-end screen, regardless of its own Display Setting."]{.mark}

  - [A menu is visible when Display Setting is Enabled and Scheduled Display is Disabled, or when Scheduled Display is Enabled and the display start date has passed. A menu is not visible when Display Setting is Disabled (including its submenus), or when Scheduled Display is Enabled and the display start date is in the future.]{.mark}

- [**Scheduled Display**: When Scheduled Display is Enabled, **Display start date** is shown as a date (MM/DD/YYYY) and the menu is displayed from 00:00 on the selected date. When Scheduled Display is Disabled, the Display start date field is hidden.]{.mark}

- **Created Date/Created By**: When saving a menu, the date the menu was created and the person who created it are automatically entered.

  - Creation rule: MM DD, YYYY (EST) / ID(employee number)

- **Updated Date/Updated By**: The date the menu was modified and the person who modified it are automatically entered.

  - Creation rule: MM DD, YYYY (EST) / ID(employee number)

- When Menu type is selected as Bulletin board, \[Go to manage Board\] and \[Go to manage Post\] buttons are displayed according to permissions.

  - **\[Go to manage Board\]**: When clicked, moves to the bulletin board inquiry screen linked to the menu.

  - **\[Go to manage Post\]**: When clicked, moves to the post list screen of the bulletin board linked to the menu.
