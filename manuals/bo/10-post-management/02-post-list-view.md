---
title: Post List View
routes: []
sources: []
i18nPrefix: []
---

## Post List View

- The selected Bulletin Board Name is displayed at the top.\
  Alongside, the system shows whether the board is mapped to a menu, and displays the description of the board.

- **Board-to-Menu Mapping Status**

- If Board-Menu Mapping = Yes:

  - A \[Go to Manage Board\] button will appear on the right, depending on the user\'s permissions.

  - Clicking this button navigates to the BO Bulletin Board Detail screen (full page).

  - [The Menu Path of the mapped menu (all levels, up to 4 depths) is displayed in the header. For the Announcement board, \"-\" is displayed.]{.mark}

  <!-- TODO: STG에서 헤더에 Menu Path 표시가 보이지 않음 - 기획서(GIDPDVO-2053)는 Mapping=Yes일 때 Menu Path 표시, 위 Menu Path 문장은 기획서 기준으로 추가 -->

- If Board-Menu Mapping = No:

  - This indicates that the bulletin board is not mapped to any menu.

  <!-- -->

  - You can view posts according to specific conditions.

- [**Menu Display Status**: A banner in the header shows whether the menu is visible on the Front-end screen. The Announcement board is not mapped to a menu, so the banner is not displayed.]{.mark}

[  - If the tenant has Mobile Web enabled, PC and Mobile are each shown as Visible or Not Visible.]{.mark}

[  - If Mobile Web is disabled, only a single value (Visible or Not Visible) is shown.]{.mark}

[  - Visible is marked with a green dot and Not Visible with a gray dot.]{.mark}

[  - Hovering over the info icon shows a tooltip: \"This menu\'s visibility is based on its own Display Setting & Scheduled Display. If the parent menu is hidden, this menu will not appear on the Front-end screen, regardless of its own Display Setting.\"]{.mark}

[- \[View Board List\]: Located at the bottom left. Clicking it returns to the board selection screen.]{.mark}

![Post List -- Selecting board(Board-menu mapping= yes)](images/post-list-selecting-board-board-menu-mapping-yes.png){width=6.27in}

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2053 Menu Path·[View Board List] 추가, GIDPGRO-914 Menu Display Status 배너 -->

- [**Template Management** tab: Users with Write permission see a \[Template Management\] tab next to the Post List tab. Templates help you quickly fill in the title and content when creating a post.]{.mark}

[  - The list shows Template Title (truncated after 2 lines), Created By, Created Date (EST), Status (ON/OFF toggle) and \[Delete\].]{.mark}

[  - Drag the handle to reorder templates. Changes are saved automatically and a toast message is displayed.]{.mark}

[  - Hovering over a template title shows a preview popover with EN and FR tabs.]{.mark}

[  - Up to 50 templates can be created. When the limit is reached, \[New Template\] is disabled. Up to 20 templates can be in use (Active) at the same time.]{.mark}

[  - Templates cannot be edited.]{.mark}

[  - When \[Delete\] is clicked, a confirmation message is displayed: \"Are you sure you want to delete this template? This action cannot be undone.\"]{.mark}

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-149 Template Management 탭 화면 이미지 없음 -->

- You can search for posts based on keywords in Title, Author, Post ID.\
  ![](images/post-list-view-img-1.png){width=3.62in}

Post List -- Search filter 1

You can search for posts based on Created Date, Updated Date, Posting period.\
![](images/post-list-view-img-2.png){width=5.49in}

Post List -- Search filter 2

![](images/post-list-view-img-3.png){width=6.27in}

Post List -- Search filter 3

- [Date search period: By default, the last 1 year from today is set, and the period can be up to 1 year.]{.mark}

[  - Start Date: There is no limit on past dates. When Start Date is selected again, End Date is automatically adjusted to fall within 1 year of the new Start Date.]{.mark}

[  - End Date: Only dates from Start Date up to Start Date + 1 year can be selected. Changing End Date does not change Start Date.]{.mark}

[  - The date restrictions are explained in a tooltip.]{.mark}

  <!-- TODO: 확인 필요 - End Date 자동 설정의 세부 동작 (기획서 요약에 없음) -->

- Created Date: You can search for posts in order of most recent creation date.

- Updated Date: You can search for posts in order of most recent modification date.

- Posting Period: All posts included within the posting period are displayed, sorted by the most recent posting start date. (If the posting start date is the same, those with the most recent posting end date are displayed at the top.)

- If a Search Filter is added to an additional attribute, it becomes searchable.

- As shown in the example below for the Input box (text) type Search Filter, users can directly enter keywords to perform a search.

- \[Reset\]: When clicked, filter conditions are initialized and search results are also reset.

- \[Search\]: When clicked, it displays search results for posts that match the set conditions.

Post List: The list of posts matching the applied search criteria is displayed. You can change the sorting and display options as follows:

![Post List - detail](images/post-list-detail.png){width=6.27in}

- Sorting options are available to organize posts by **Date** (latest to oldest) or **Title** (alphabetical ascending or descending).

- By default, **20 posts** are displayed, and you can select up to 50 posts to display from the bottom left.

- The post list includes a **pagination** feature that allows you to navigate between page groups using the **\< and \> buttons,** move to the first page using **\<\<,** and move to the last page using **\>\>.[\
  ]{.mark}** ![](images/post-list-view-img-4.png){width=3.72in}

-[ [When \[New Post\] is selected in the viewed bulletin board, the post writing screen is displayed.]{.mark} \[New Post\] is visible only to users with Write permission, and it can always be used regardless of the menu\'s Mobile Display setting.]{.mark}

**\**

- **Post Creation**

  - Users with permission can write new posts.

  - The post writing screen allows input of title, content, attachments, etc.

  - Additional input attributes may be displayed differently depending on the bulletin board attribute settings.

![Creating Post](images/creating-post.png){width=4.10in}

There are required and optional values for post creation.

- **Board Name:** The name(board id) of the bulletin board to which the post belongs is displayed. (Automatically generated value)

![Creating Post -- Board name](images/creating-post-board-name.png){width=6.27in}

- **Display Setting (Required Field):** This setting determines whether the post will be displayed or not.

- **(Default) ON:** The post will be displayed once the posting period begins.

- **OFF:** The post will not be displayed, regardless of the posting period.

  - When Display setting = OFF, the following fields become **read-only** (values are retained):

  - Posting period, Important Notice, Notification

  - The help text is replaced with the **Display OFF** guidance message.

![Creating Post -- Display setting](images/creating-post-display-setting.png){width=6.27in}

![Creating Post -- Display setting modal](images/creating-post-display-setting-modal.png){width=2.68in}

![Creating Post -- Display setting](images/creating-post-display-setting-2.png){width=4.57in}

- **Posting period(Required field):** This is a function to set the period during which the post is published.

- (Default)As an initial setting, the posting start date is entered based on the time the post was created, and \'Unlimited Posting\' is set for the posting end date to have no deadline

![Creating Post -- Posting period](images/creating-post-posting-period.png){width=6.27in}

- When clicking on the calendar UI input field, you can select date and time.

- When Unlimited posting is unchecked, you can select the posting end date to schedule the end of the post.

- The posting start time setting cannot exceed the posting end date, and the posting end time cannot be set before the posting start date and time.

- ![](images/post-list-view-img-5.png){width=2.03in} ![](images/post-list-view-img-6.png){width=2.73in}

Calendar setting feature

- **Target Audience:** Selected publishing targets are published under AND conditions.

  - Selected values are displayed as chip filters.

  - (Default)Initial settings are displayed with all publishing targets selected, and the post is targeted at dealers belonging to the current publishing target group.

- **Job title**: Job title (information entered in Job Management)

  - Job title Display conditions

    - Such bulletin board must be linked to a menu

    - The linked menu should have at least one permission applied (access/read) 

    - The Job Title should have saved at least one permission(access/read) of the linked menu. 

    - The Job Title status must be \'Active\' in DEALERS BO Job Management screen

- **Dealer Distribution Group:** Dealer group (information entered in Dealer Group Management)

- **Dealer:** Dealership (information entered in Dealer Management)

- **Zone:** Location information (information entered in Dealer Zone/District Management)

- **District:** Location information (information entered in Dealer Zone/District Management), regional information under Zone (when Zone is clicked, Districts belonging under Zone are displayed)

- ![](images/post-list-view-img-7.png){width=6.27in}

Creating Post -- Target Audience

- When each publishing target input field is clicked, option values are displayed, and option values can be searched in the input field. (Like search)

- You can select publishing targets with checkboxes, and when the cursor moves, the selected publishing target option values are displayed in chip filter form below the input box. You can remove the publishing target option by pressing the X button on the chip filter.

- Specific job titles(Dealer Principal, Dealer Admin) in the Job Title field are automatically displayed as fixed by the system and cannot be deselected by operators.\
  ![](images/post-list-view-img-8.png){width=3.37in}

Target Audience -- dropdown setting

- **Important Notice**: This is a value for setting important notices.

  - When Enabled is selected, you can select the period to post as an important notice, and it is fixed at the top of the post list during the set period.

  - (Default) Disabled is selected as the initial setting.

- Note) The Bulletin Highlight on the home screen shows a collection of important notice posts set in each bulletin board.

  - When the Important Notice period ends, only the **pinned/important effect** ends. Post visibility still follows Display setting and Posting period rules.

  - Notification is automatically synced with Important Notice changes.\
    ![](images/post-list-view-img-9.png){width=5.67in}

Creating Post- Important notice 1

- Enabled selection screen\
  ![](images/post-list-view-img-10.png){width=5.67in}

Creating Post- Important notice 2

- You can set the important notice posting period. When you click on the calendar input field, you can select the important notice posting period (date and time).

- The important notice posting period setting follows the policy below. The date selection UI is deactivated according to the policy, and if there is a policy conflict, an alert popup is displayed upon saving.

- **Important notice policy**

  - The important notice start time setting cannot exceed the important notice end date

  - The important notice end time cannot be set before the important notice start date and time

  - Important notices cannot be set before the posting start time

  - Important notices cannot be set after the posting end time

![Important notice -- Calendar Setting](images/important-notice-calendar-setting.png){width=2.27in}

- **Notification:** This is a value for setting notifications and is optional.

  - The initial setting is set to Disabled.

  - When **Important Notice is turned ON**, the **Notification setting is automatically switched to ON**, and one-time email/FO notification is sent at the posting start time.

  - When **Important Notice is turned OFF**, the **Notification setting is also automatically turned OFF**.

  - After the notification has been sent once, the Notification value remains but the control becomes read-only and can no longer be changed.

- Initial setting (Disabled)

![Creating Post -- Notification 1](images/creating-post-notification-1.png){width=5.16in}

- When Enabled is set, notifications (including email) can be sent to the target audience.

![Creating Post -- Notification 2](images/creating-post-notification-2.png){width=6.27in}

- **Title/Content (Required field):** You can write the title and content of the post in English/French.

- These are required input values. The initial setting displays the EN tab.

  - Title: The title is limited to 200 characters.

  - Content: The content is limited to 50,000 characters.

  - If the character limit is exceeded, input is not possible.

![Creating Post -- Title/Contents1](images/creating-post-title-contents1.png){width=6.27in}

- You can use the editing tools provided by the editor tool.

![Creating Post -- Title/Contents2](images/creating-post-title-contents2.png){width=5.71in}

- When writing text content, character count is possible.

![Creating Post -- Title/Contents3](images/creating-post-title-contents3.png){width=3.01in}

- **Attachments:** You can attach files in English/French versions.![](images/post-list-view-img-11.png){width=5.76in}

Creating Post -- Attachments 1

- When Select File is clicked, a file upload window appears, and PDF format files can be attached.

- When \"The same attachments (EN) will be applied\" is clicked in the FR version attachment, the attachments registered in the English attachment are applied identically in the French version.

![](images/post-list-view-img-12.png){width=6.27in}

Creating Post -- Attachments 2

- If a file is attached, the number of attached files is displayed at the top.

- When the file icon is clicked, preview is possible.\
  ![](images/post-list-view-img-13.png){width=3.51in}

Creating Post -- Attachments 2(PDF)

- Additional Attribute: If additional attribute values have been added in the bulletin board management menu, the additional attribute field name is displayed.

- The display values, Search Availability (whether searchable), and whether required values are displayed according to the display format of the additional attribute selected in the bulletin board attributes.

- There are a total of 5 display formats for additional attributes, which can be set as follows:

- Period (MM-DD-YYYY \~ MM-DD-YYYY): This display format allows period selection.

- The initial setting displays a UI for selecting period dates and is displayed with no dates entered.

![](images/post-list-view-img-14.png){width=4.91in}

Creating Post -- Additional attribute example 1-1

- When the Include time toggle is selected, you can select the period date and time.

![](images/post-list-view-img-15.png){width=5.25in}

Creating Post -- Additional attribute example 1-2

- Date (MM-DD-YYYY): This display format allows date selection.

  - The initial setting displays a UI for selecting period dates and is displayed with no dates entered.

![Creating Post -- Additional attribute example 2-1](images/creating-post-additional-attribute-example-2-1.png){width=5.27in}

- When the Include time toggle is selected, you can select the date and time.

![](images/post-list-view-img-16.png){width=5.50in}

Creating Post -- Additional attribute example 2-2

- Single Selection (dropdowns): A dropdown box is created.

- The display values entered in the bulletin board additional attributes are displayed in the dropdown.

- Display value search is possible, and only one value can be selected.

- When a field is marked as Required in Bulletin Board \> Additional Attributes, an asterisk (\*) is displayed in front of the Field Name.

- For required fields, a value must be selected in order to save the post.

- ![](images/post-list-view-img-17.png){width=6.16in}

Creating Post -- Additional attribute example 3-1

- Since EN items and FR items form a pair, if you select one display value, the display value of the other language is also selected simultaneously. When changing, EN corresponds.

![Creating Post -- Additional attribute example 3-2](images/creating-post-additional-attribute-example-3-2.png){width=5.84in}

- Multi Selection (dropdowns): A dropdown box is displayed, showing the values entered in the bulletin board additional attributes. Detailed content search is possible, and multiple values can be selected.

![Creating Post -- Additional attribute example 4-1](images/creating-post-additional-attribute-example-4-1.png){width=5.84in}

- When multiple display values are selected, the selected display values are displayed as chip filters, and they can be deleted by clicking the X button on the chip filter.

- Since EN and FR items form a pair, when clicking on the EN display value, the corresponding EN display value is automatically selected.

![Creating Post -- Additional attribute example 4-2](images/creating-post-additional-attribute-example-4-2.png){width=5.64in}

- Single Selection (Radio button): The display values entered in the bulletin board additional attributes are displayed in radio buttons.

  - For radio buttons, if it\'s an optional value, a \'None\' option is additionally provided.

  - If a required value is selected, at least one option value must be selected to be saved.

![Creating Post -- Additional attribute example 5-1](images/creating-post-additional-attribute-example-5-1.png){width=6.77in}

- Input box (text): An input box is displayed, allowing users to manually enter text. This feature is primarily used to manage official document numbers linked to attachments or to track document IDs within posts.

  - If a required value is selected, at least one option value must be entered to be saved.

  - Input character limitations:\
    Up to 25 characters can be entered according to the following rules:

    - Text: English and French letters (uppercase/lowercase) are allowed

    - Spaces: Not allowed

    - Numbers: 0--9

    - Special characters: Only \* \# ; - \_ \' / ( ) . , ! are allowed

  - Duplicate input rules:\
    Duplicate values for the same Field Name within the same board are not allowed. However, the same value can be entered if either the Field Name or the Board is different.\
    When a duplicate occurs, an alert message is displayed and saving is not allowed.

![Creating Post -- Additional attribute example 6-1](images/creating-post-additional-attribute-example-6-1.png){width=6.27in}

![Figure 184 Creating Post -- Additional attribute example 6-2](images/figure-184-creating-post-additional-attribute-example-6-2.png){width=5.81in}

- Duplicate examples:

  - Same board + same Field Name + same value → Not allowed (e.g. (Board A) doc id = 10-10-2025 already exists → entering the same value again is not allowed.)\
    ![](images/post-list-view-img-18.png){width=4.28in}

  - Same board + different Field Name → Allowed (e.g. Within the same post: doc id = 10-10-2025, no = 10-10-2025 → allowed.)

  - Different boards + same Field Name → Allowed (e.g. (Board A) doc id = 10-10-2025, (Board B) doc id = 10-10-2025 → allowed.)

- Bottom action buttons are provided

  - \[Post Preview\]: When clicking on post preview, a post preview screen similar to the front screen is displayed, and you can check both EN and FR versions.

![Creating Post -- Post preview 1](images/creating-post-post-preview-1.png){width=5.08in}

- \[Cancel\]: When clicking on exit without saving the post, an alert popup is displayed.

- \[Save\]: When clicking on save post, it verifies validity and displays popups according to the conditions below.

<!-- -->

- If required values are not entered, the post cannot be saved.

- If all required values are entered, the post can be saved, but guidance popups are displayed according to the attribute values of the post.

- If the important notice period is incorrectly entered, a guidance popup appears to adjust the period. The important notice period must be entered within the posting period.

- If there is no target audience, the post can be saved, but a guidance popup appears indicating that there is no target audience.

- If the posting period is set to the current time, a guidance message appears indicating that the post will be published immediately, and it is published immediately.
