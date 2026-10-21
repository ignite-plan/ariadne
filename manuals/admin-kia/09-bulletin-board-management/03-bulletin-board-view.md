---
title: Bulletin Board View
routes: []
sources: []
i18nPrefix: []
---

## Bulletin Board View

- When you click [a row]{.mark}in the bulletin board list, you move to the[Board Details full-page screen.]{.mark}
- You can access through the view button in the Board Name or Details column within the bulletin board list view results.
- Basic board data such as Board ID, Name, Description are displayed at the top. The Post Attribute Setting that specifies the attributes of posts connected to the bulletin board is displayed at the bottom.

![Bulletin board view](images/bulletin-board-view.png){width=6.26in}

**Bulletin board detail**

- **Board Name (EN, FR Required field):** For Announcement Boards, which are automatically created during tenant setup, the board name (EN/FR) and description **can be modified**. (e.g., EN Default: Announcement, FR Default: Annonce)

- **Board Description (Admin Use):** For Announcement Boards, which are automatically created during tenant setup, the board name and description **can be modified**

- When viewing an Announcement Board, a banner with the following information is displayed at the top of the screen.

- For Announcement Boards, the Edit button is enabled, but the Delete button is **not displayed**.

![Bulletin board- Announcement](images/bulletin-board-announcement.png){width=5.38in}

- **Board Basic Information**

![Bulletin board detail -- Basic information](images/bulletin-board-detail-basic-information.png){width=6.26in}

- [When the bulletin board is linked to a menu, a Menu Display Status banner is displayed at the top of the screen. It appears the same way on the view and edit screens.]{.mark}

- [**Menu-Board Mapping**: YES (green dot) or NO (gray dot).]{.mark}

- [**Menu Display Status**: Shows whether the linked menu is displayed, based on the menu\'s own Display Setting & Scheduled Display. What is shown depends on whether Mobile Web is enabled for the tenant.]{.mark}

- [The same banner change applies to the Menu Management and Post Management screens.]{.mark}

- [The banner is not displayed for Announcement Boards because they are not linked to a menu.]{.mark}

- Basic information related to the bulletin board is displayed.

- Board ID: Automatically assigned when creating a bulletin board. When entering this Board ID in the menu URL in menu management, menu and bulletin board mapping is possible

- Board Name: The bulletin board name, and when mapped to a menu, the bulletin board name is displayed on the front screen.

- [**Menu Path**: Displayed directly below Menu-Board Mapping. When the bulletin board is mapped to a menu, the full menu path (1 to 4 levels, all menu names shown, line breaks allowed) is displayed in the format Sales \> Bulletins \> 20-General. If Menu-Board Mapping is NO, or for an Announcement Board, - is displayed.]{.mark}

- Once the **Bulletin Board** is saved, the **\[Go to Manage Post\]** button will be displayed based on the user\'s permissions.

- If the **Bulletin Board** is linked to a **Menu**, the **\[Go to Manage Board\]** button will also be displayed based on permissions.

  - **\[Go to Manage Menu\]**: Navigates to the **Menu Details** screen linked to the bulletin board.

  - **\[Go to Manage Post\]**: Navigates to the **Post List** screen associated with the bulletin board.

- **Post Attribute Setting Information**

  - The Post Attribute setting information set during bulletin board creation/modification at the top is viewed.

  - For detailed explanation, refer to the \'Post Creation \> Post Attribute setting information\' section above

![Bulletin board detail -- Post Attribute setting](images/bulletin-board-detail-post-attribute-setting.png){width=6.26in}

- Values entered during post creation are displayed on the post inquiry screen

- **Posting Period**

    ![Bulletin board detail -- Post Attribute setting1](images/bulletin-board-view-img-1.png){width=6.26in}


- **Target Audience** (Job title, Dealer Distribution Group, Zone, District, Dealer)

    ![Bulletin board detail -- Post Attribute setting2](images/bulletin-board-view-img-2.png){width=6.26in}

- **Important Notice**

  ![Bulletin board detail -- Post Attribute setting3](images/bulletin-board-view-img-3.png){width=3.96in}

- **Notification**

  ![Bulletin board detail -- Post Attribute setting4](images/bulletin-board-view-img-4.png){width=4.71in}


- **Attachments**

    ![Bulletin board detail -- Post Attribute setting5](images/bulletin-board-view-img-5.png){width=4.29in}


- **Additional Attribute**

  ![Bulletin board detail -- Post Attribute setting6](images/bulletin-board-detail-post-attribute-setting6.png){width=4.58in}


**Bulletin Board Editing**

- Necessary actions are possible through the bottom buttons when viewing a bulletin board

  - \[**Delete**\]: Clicking the **\[Delete\]** button will trigger a **validation check** before the bulletin board can be deleted.

  - Deletion Not Allowed If:
    - The bulletin board is **mapped to a menu**.
    - The bulletin board **contains existing posts**.
    - In these cases, an **alert pop-up** will be displayed, and deletion will be **blocked**.
  - \[**Edit**\]: Clicking allows you to move to the bulletin board modification screen

- [**\[View List\]**: Displayed at the bottom left. Clicking it returns you to the bulletin board list.]{.mark}

- Bulletin board attribute values can be freely changed, but they are reflected in the post management screen according to the bulletin board attribute modification policy below.

  ![Editing Bulletin Board](images/bulletin-board-view-img-6.png){width=6.26in}


- **The bulletin board/post display policy according to bulletin board attribute modification is as follows:**

  - If the bulletin board attribute setting is changed from Enabled → Disabled, the input UI is not displayed on the Post creation/modification screen.

- For posts that already have data, the data is maintained.

  - If there is already entered data, the entered data is maintained on the inquiry screen (BO Bulletin Board List, BO Post View, FO Board List, FO Post View).

- For posts that do not have existing data, no data is displayed.

  - If the bulletin board attribute setting is changed from Enabled → Disabled → Enabled, the input UI is displayed on the Post creation/modification screen.

- For posts that already have data, the data is maintained.

  - If there is already entered data, all entered data is displayed on the inquiry screen (BO Bulletin Board List, BO Post View, FO Board List, FO Post View).

- For posts written in a previously Disabled state, default values are set because there are no entered values.

  - **Posting period**: unlimited posting

  - **Target audience**: all settings
