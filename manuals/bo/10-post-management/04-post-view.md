---
title: Post View
routes:
  - /board/1000890/post/1053426
sources: []
i18nPrefix: []
---

## Post View

- You can view saved posts.

- **Menu Display Status**: A banner at the top of the screen shows whether the menu linked to the bulletin board is visible on the Front-end screen. The Announcement board is not mapped to a menu, so the banner is not displayed.

  - If the tenant has Mobile Web enabled, PC and Mobile are each shown as Visible or Not Visible.

  - If Mobile Web is disabled, only a single value (Visible or Not Visible) is shown.

  - Visible is marked with a green dot, and Not Visible with a gray dot.

  - The fixed notice below the banner reads: "This menu's visibility is based on its own Display Setting & Scheduled Display. If the parent menu is hidden, this menu will not appear on the Front-end screen, regardless of its own Display Setting."

<!-- TODO: 확인 필요 - 게시글 조회 화면의 Menu Display Status 배너 (STG 확인 가능한 조회 화면은 메뉴와 연결되지 않은 Announcement 게시글뿐이라 배너가 보이지 않음. 배너 위치·고정 안내 문구 표시 방식은 기획서 요약 기준) -->

- Posts of a menu whose Mobile Display is Disabled do not appear in the Mobile Home Bulletin Highlight or the Mobile integrated search. The post view screen has no separate mobile setting.

![](images/post-view-img-1.png){width=4.88in}\
![](images/post-view-img-2.png){width=5.02in}\
![](images/post-view-img-3.png){width=5.68in}\
![](images/post-view-img-4.png){width=5.75in}

Post Detail

- **Post Status Information**

![Post Detail -- Post status information](images/post-detail-post-status-information.png){width=5.93in}

<!-- TODO: 이미지 갱신 필요 - GIDPGRO-914 조회 화면 상단 Menu Display Status 배너 추가 -->

- Board Name: The bulletin board name (bulletin board ID) to which the post belongs is displayed.

- Post ID: When the post is saved, the post ID is displayed.

- \[Copy Front-end URL\]: When clicked, the Front-end URL of the post is copied to the clipboard.

  - This feature allows administrators to easily copy and share the Front-end access URL of a post.

  - The button becomes visible after the post has been saved (i.e., when the post ID is generated) and you access the post detail view.

- Post status: The posting status is displayed according to the posting period of the post.

- Visible: Currently posted (when the current time is within the posting period), if it\'s currently being posted, the dot color in front of the posting status changes to green.

- Not visible: The post is currently not visible. Awaiting posting (when the posting start date has not arrived) or Posting ended (when the current time is after the posting end date)

- Display setting: The display setting for the post is shown.

<!-- -->

- **Post Attribute Information**\
  ![](images/post-view-img-5.png){width=6.27in}

Post Detail -- Post Attribute information

- Posting Period: The set posting period is shown.

  - If the posting period is set to indefinite, the posting start date and time is specified and Unlimited Posting is checked.

  - If the posting end date is specified, the posting start date and time \~ posting end date and time are displayed.

<!-- -->

- Target Audience: The target audience items are shown, and the post is published to targets that meet the AND conditions of the selected target audience. The selected option values are displayed as chip filters below.

  - If saved with the default settings, all target audience options are shown as All values.

- Important Notice: The set important notice value is displayed.

  - If the important notice setting is selected as Enabled:

    - The dot color is shown as green

    - The post has an important notice setting (icon) on the front and is displayed at the top of the post.

    - Posting periods are displayed at the top of the post with the most recent at the top.

  - If the important notice setting is selected as Disabled:

    - The dot color is shown as gray.

    - Posts without important notice settings are displayed the same as regular posts and are sorted by the most recent posting period.

- Notification: The set notification value is displayed.

  - If the notification setting is selected as Enabled:

    - The dot color is shown as green.

    - At the time the post is published, a summary email about the post is sent to the target audience.

  - If the notification setting is selected as Disabled:

    - The dot color is shown as gray.

    - No notifications or emails related to the post are sent.

- Title/Content(EN/FR): The title and content of the post entered in English/French are displayed.

  - EN/FR tabs are provided in the upper left.

  - By default, EN is displayed, showing the title and content entered in English.

  - Clicking the FR tab shows the title and content entered in French.

![Post Detail -- title/content](images/post-detail-title-content.png){width=6.27in}

- You can attach posts and images together.

- Attachments (EN/FR): Attached PDF files are displayed, and when the attached file icon or file name is clicked, file preview is possible.

- ![](images/post-view-img-6.png){width=6.27in}

Post Detail -- Attachments 1

- The total number of attached files is displayed in the upper left of the file, and the file size and download button are displayed to the right of the attached file.

![](images/post-view-img-7.png){width=3.44in}

Post Detail -- Attachments 2

- When the file icon and file name are clicked, a file preview popup is displayed, and watermarks are displayed on each page of the PDF file.\
  ![](images/post-view-img-8.png){width=4.33in}

Post Detail -- Attachments preview pop-up

- The file name and extension are displayed in the upper left of the popup window, and the full-screen view button and close button can be clicked in the upper right.\
  ![](images/post-view-img-9.png){width=5.55in}

Post Detail -- Attachments preview pop-up1

- Clicking on icons from the left operates as follows:

![](images/post-view-img-10.png){width=0.63in} ![](images/post-view-img-11.png){width=0.56in}\
![](images/post-view-img-12.png){width=2.33in}![](images/post-view-img-13.png){width=2.63in}

Post Detail -- Attachments preview pop-up2

- View settings: Thumbnail preview view setting/Normal page view setting\
  ![](images/post-view-img-14.png){width=1.15in}

- View current page number/total page number, possible to view page by entering desired page number

![](images/post-view-img-15.png){width=1.72in}

- File ratio input and -/+ button click to zoom in and out of file (minimum 50%, maximum 150%)

![](images/post-view-img-16.png){width=1.03in} ![](images/post-view-img-17.png){width=1.04in}

- Two-page view/One-page view setting possible

![](images/post-view-img-18.png){width=0.84in} ![](images/post-view-img-19.png){width=0.65in}

- Page height fit/Page width fit view setting possible

![](images/post-view-img-20.png){width=0.47in}\
![](images/post-view-img-21.png){width=1.22in}

- Page rotation: 90 degrees rotation to the left

- ![](images/post-view-img-22.png){width=0.75in}

<!-- -->

- When the download button is clicked, it moves to the PDF file download page, and the file with watermark can be downloaded

  - ![](images/post-view-img-23.png){width=0.56in}

  - When the print button is clicked, the print settings page is displayed, and the file with watermark can be printed

  <!-- -->

  - Additional Attribute: You can view the entered additional attribute values.

  - The right column displays the additional attribute field names according to the user\'s language settings.

  - You can check whether each additional attribute item is searchable.

  - If the Search Availability value is ON, the Dot is displayed in green. The search filter for that additional attribute is displayed in the front post list search area.

  - If the Search Availability value is OFF, the Dot is displayed in gray and the search filter is not displayed.

![Post Detail -- Attachments preview pop-up](images/post-detail-attachments-preview-pop-up.png){width=6.77in}

- If the additional attribute value is period or date selection, the selected period and date are shown.

- If the additional attribute value is single selection, one display value each for EN and FR is shown.

- If the additional attribute value is multiple selection, the selected display values are shown separately for EN and FR.

- Change History: The post change history is shown.

  - All modifications due to changes in status values and attribute values within the post are recorded in the change history.

  - Status value and attribute value change records:

- Posting status information: Awaiting posting, Currently posted, Posting ended

- Posting attribute information: Target audience, Posting period, Important notice setting, Notification sending setting, Title (EN, FR), Content (EN, FR)

- Attachments: EN, FR

- Additional attributes

- If there are 5 or more records, right scroll is displayed

- Table columns

  - Change Date: Updated date

<!-- TODO: 확인 필요 - GIDPGRO-581 EST 시각 표기 방식 변경이 조회 화면 Change Date에 어떻게 적용되는지 (기획서 요약은 템플릿 Created Date만 명시, STG의 변경 이력은 비어 있어 확인 불가) -->

  - Change Info: Area and item name where the change information occurred

  - Change Details: Displays detailed content of values before/after change

  - User ID: Displays the name and User ID (employee number) of the user who performed the action

  - Auto Status Update: If automatically changed by the system due to set time or trigger, it is marked as \'Auto Status Update\'

![Post Detail -- Change history](images/post-detail-change-history.png){width=5.81in}

- Comments: Comments on the post are viewed.

![](images/post-view-img-24.png){width=6.77in}

Post Detail -- Comments 1

- Name, employee number, and author display are shown, and when you write a comment and click the Save button, the comment is registered.

- When a comment is registered, the total number of comments is displayed to the right of the Comments title.

![Post Detail -- Comments 2](images/post-detail-comments-2.png){width=6.04in}

- For comments you wrote yourself, a more options display appears on the right, and when clicked, you can edit and delete the comment.

- Bottom action buttons are provided.

<!-- -->

- \[View List\]: Move to list

- \[Delete\]: The delete button is only displayed for posts that have never been published, and when the button is clicked, permissions are verified and deletion is only possible if you have permission to write posts.

  - Deletion is only possible if you have permission

- \[Edit\]: After checking if you have permission to modify the post at the time of clicking, if you have permission, you enter the modification screen.
