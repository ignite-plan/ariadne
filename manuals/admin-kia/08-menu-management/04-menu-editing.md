---
title: Menu Editing
routes: []
sources: []
i18nPrefix: []
---

## Menu Editing

- You can move to each editing screen by clicking the \[Edit\] button in Menu Details and Menu access permission.

**Display setting and Scheduled Display**

- Display setting (PC):

  - When changing the Display setting from Enabled to Disabled on the Menu Edit screen, a confirmation popup is always displayed, regardless of the Scheduled Display status or whether a date has been entered. (The Menu Creation screen has no popup.)

    - Title: "Do you want to hide this menu?"

    - Message: "Turning the Display Setting OFF will hide this menu and its sub-menus, and reset any related scheduled display settings."

    - **\[Cancel\]**: Closes the popup only, and the Display setting stays Enabled.

    - **\[Confirm\]**: Changes the Display setting to Disabled, greys out the whole Schedule Display section, and shows Scheduled Display as Disabled. The scheduled display settings are actually reset (date saved as empty) when \[Save\] is clicked.

  - When changing the Display setting from Disabled to Enabled, Scheduled Display is reset to Disabled even if it was previously Enabled (for example, with a past date), so the menu can be saved immediately without date validation.

- [Scheduled Display date:]{.mark}

  - [When Scheduled Display is switched from Disabled to Enabled, the date is empty (MM/DD/YYYY) and must be entered directly, as on the Menu Creation screen. A previously saved date is not restored, even if Scheduled Display is switched off and on again after saving.]{.mark}

  - [Selectable dates start from the next day. Today and past dates are greyed out.]{.mark}

  - [If only the Menu name, Menu type, description, or permissions are edited without changing the date, no validation error occurs even if the existing Display start date is in the past. If the date is changed, the new date validation is applied.]{.mark}

  - [If the start date of a menu that is currently visible is changed to a future date, the Change Start Date popup is displayed.]{.mark}

  - [If the selected date becomes a past date when saving (midnight boundary), a popup is displayed.]{.mark}


**Menu Access Permissions** 

  ![Menu access permissions List](images/menu-editing-img-1.png){width=6.26in}

- When clicking the \[Edit\] button in Menu access permission, [the conditions are checked in the following four steps, and a pop-up is displayed according to the first condition that applies. The same steps apply to both the Job title tab and the User name tab, and also to the first access right after a menu is created.]{.mark}

  1.  **Current menu has no menu permission**: The Add Menu Permission pop-up is displayed.

      - **\[Go to Setting\]**: Moves to the Menu Details tab of the current menu and focuses on the permission area.

      - **\[Later\]**: Closes the pop-up only.

  2.  **Parent menu has no menu permission** (skipped if there is no parent menu): The Add Parent Menu Permission pop-up is displayed.

      - **\[Go to Setting\]**: Moves to the Menu Details tab of the parent menu and focuses on the permission area.

      - **\[Later\]**: Closes the pop-up only.

  3.  **Current menu has Job title permissions other than Dealer Principal / Dealer Admin** (User name permissions on the User name tab): The Menu Access Permission pop-up is displayed, and you can grant permissions (Access, Read, etc.) to job titles (or user names) that can access the menu. For a 1 Depth menu, the same pop-up is displayed even if there are no such permissions.

  4.  **Parent menu has Job title permissions other than Dealer Principal / Dealer Admin** (User name permissions on the User name tab): The Import {target} Permissions pop-up is displayed. If there are none, the Add Parent Menu Access Permission pop-up is displayed. {target} is Job Title or User.

      - Import {target} Permissions: "Would you like to import {target} permissions from the parent menu? The parent menu's {target} permissions will be automatically applied to this menu."

        - **\[Import\]**: Copies the parent menu permissions to the current menu, closes the pop-up, and shows the copied permissions in the list screen.

        - **\[Add Manually\]**: Moves to the Edit screen with no permissions selected.

      - Add Parent Menu Access Permission:

        - **\[Go to Setting\]**: Moves to the Menu Access Permissions tab (list screen) of the parent menu.

        - **\[Later\]**: Closes the pop-up only.

        - On the User name tab, the pop-up message is "No menu access permissions have been set for the parent menu. Users must be added to the parent menu before they can be assigned to sub-menus."

- **\[Import\]** copies only the permissions that are registered in the Permission List of the current menu and also checked in the parent menu. For example, if the current menu has only Access and the parent menu has Access and Read, only Access is copied. After copying, the list is sorted by the Job title / User sorting rule.

- After clicking **\[Later\]**, clicking \[Edit\] again starts again from step 1. If the condition is not resolved, the same pop-up is displayed again.

![Menu access permissions List -- Import Job title pop-up](images/menu-editing-img-2.png){width=2.99in}

- In the Menu Access Permission pop-up, the Job title popup shows the Job titles that the User belongs to even if that User has permissions (Job and User permissions can overlap). The User name pop-up does not show Users who are already included in a selected Job title.

- A permission cannot be removed on the Job title tab if a sub-menu has the Job-access permission, and on the User name tab if a sub-menu has the User-access permission.

![Menu access permissions pop-up detail1](images/menu-editing-img-3.png){width=2.94in} 

![Menu access permissions pop-up detail2](images/menu-editing-img-4.png){width=2.94in}

- If there are modified permissions, saving is possible, and a permission change notification popup is displayed.
