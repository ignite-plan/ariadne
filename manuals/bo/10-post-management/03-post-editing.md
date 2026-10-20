---
title: Post Editing
routes: []
sources: []
i18nPrefix: []
---

## Post Editing

• You can edit the content of existing posts or change posting conditions.![](images/post-editing-img-1.png){width=4.99in}

![Editing Post -- post attribute information 1](images/editing-post-post-attribute-information-1.png){width=5.28in}

Editing Post -- post attribute information 2

![](images/post-editing-img-2.png){width=6.27in}

Editing Post -- post attribute information3

<!-- TODO: 이미지 갱신 필요 - GIDPGRO-914 상단에 Menu Display Status(PC/Mobile)와 안내 문구가 추가됨 -->

- **Menu Display Status**: Shows whether the menu linked to the board is visible on the front-end screen.

  - When the tenant's mobile web is ON, both values are shown (for example, "PC: Visible | Mobile: Not Visible"). When it is OFF, only one value (Visible / Not Visible) is shown.

  - The notice "This menu's visibility is based on its own Display Setting & Scheduled Display. If the parent menu is hidden, this menu will not appear on the Front-end screen, regardless of its own Display Setting." is displayed below it.

• When modifying the posting period, the following policy applies: ![](images/post-editing-img-3.png){width=6.27in}

Editing Post -- Posting period 1

- When the posting period is modified, it changes to the modified posting period.

- The posting start date and time cannot be modified to a past time from the current point.

- When modifying the posting period of an important notice post, the following policy applies:

![](images/post-editing-img-4.png){width=4.88in}

Editing Post -- Important Notice 1

- When the important notice posting period is modified, it changes to the modified posting period.

- Important notice posts must be entered within the posting period. If not entered within the posting period, the important notice period cannot be saved.

- An important notice appears in the mobile home Bulletin Highlight only when the Mobile Display of its menu is Enabled. The Important Notice setting on this screen works the same way as before.

<!-- -->

- When changing the target audience, the following policy applies:

![Editing Post -- Target Audience 1](images/editing-post-target-audience-1.png){width=6.27in}

- Values selected in the target audience are published under AND conditions based on the currently selected target audience.

  - Dealer distribution group: The post is targeted at dealers belonging to the current Dealer distribution group.

  - Dealer: The post is targeted at the currently selected Dealer.

  - Zone: The post is targeted at Dealers belonging to the current Zone.

  - District: The post is targeted at Dealers belonging to the District under the current Zone.

- Post attribute information is displayed

- The entered values for Title/Content (EN/FR) are displayed.

![Editing Post -- Contents 1](images/editing-post-contents-1.png){width=6.27in}

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-149 Contents 영역에 [Load Template] 버튼과 Title/Summary 글자수 표시가 추가됨 -->

- **\[Load Template\]**: Fills the Title and Summary (EN/FR) with a saved template.

  - On the edit screen, a confirmation popup always appears first: "Applying a template will overwrite your current title and summary content for all languages. Do you want to continue?" Select **\[Confirm\]** to continue or **\[Cancel\]** to stop. (On the Post Details screen for a new post, this popup appears only when something has already been entered.)

  - In the "Select a Template" popup, select one template with the radio button. Only templates whose Status is ON are listed. If there is none, "No templates available." is displayed.

  - The Preview area on the right shows "Select a template to preview." until a template is selected. Images are shown as [image] and links as text only.

  - Select **\[Apply\]** to apply the template, or **\[Cancel\]** (or the close icon) to close the popup. When applied, the message "The template has been successfully applied." is displayed.

  - After applying, you can freely edit the content. Settings other than Title and Summary are not changed.

- Title allows up to 300 characters and Summary up to 50,000 characters. The number of characters entered is displayed.

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2055 FR 영역 상단에 번역 배너가 추가됨 (덮어쓰기 확인 팝업, 인라인 경고, Character Limit Exceeded 팝업도 해당) -->

- **[Translation banner**: A banner is displayed at the top of the FR area. It contains the **\[EN → FR Translate\]** button and the notice "Clicking the left button will translate the English text entered above and display the French translation in the field below." Only EN to FR translation is supported. The banner is displayed only to users with Write permission for creating and editing posts (it is hidden for Read-only users), and it is currently available only for tenants with two languages (EN, FR).]{.mark}

[  - **\[Translate\]** is enabled when the Title or Summary in the EN area has any content. If both are empty, it is disabled.]{.mark}

[  - While translating, a spinner is displayed on the button, the button is disabled, and the Title and Summary fields are read-only. They are released as soon as the translation completes or fails.]{.mark}

[  - Title and Summary are translated together. When the translation completes, the FR area is focused automatically and the fields are replaced with the translation result. Review and edit the translated content before saving.]{.mark}

  - If the FR Title or Body already has content, the popup "Overwrite existing content?" is displayed with the message "The existing content will be replaced. Do you want to continue?" Select **\[Confirm\]** to overwrite the content and move the focus to the translated area, or **\[Cancel\]** to stop.

  - If only some items fail, only the successfully translated items are entered, and the toast "Partial Translation Failure" is displayed with the message "Some items failed to translate. Please check which fields are missing and try again if needed."

  - After a failure, **\[Translate\]** is enabled again and the existing input is kept.

  - If the translated result exceeds the maximum length, it is not truncated and is entered in full. The inline warning "Translated title exceeds the maximum length (300 characters). Please edit before saving." or "Translated summary exceeds the maximum length (50,000 characters). Please edit before saving." is displayed below the field.

  - **\[Save\]** stays enabled when the limit is exceeded. Selecting it displays the popup "Character Limit Exceeded" with the message "The title cannot exceed 300 characters. Please check the length of the translated title and edit it." or "The summary cannot exceed 50,000 characters. Please check the length of the translated summary and edit it." The inline warning remains displayed.

 [ - If only the Title is entered in EN and the Body is empty, only the Title is translated. The existing required-field validation for the summary applies when saving.]{.mark}

- When attaching an image in the editor, only png, jpg, and jpeg files are allowed. For other formats, the popup "Unsupported file format. Accepted formats: png, jpg, jpeg" is displayed; select **\[Confirm\]** to return to the editing screen.

- Attachments (EN/FR):

<!-- -->

- Attached files are displayed, and file preview and download are possible.

- When viewing, downloading, or printing a file, watermarks are included on each page

![Editing Post -- Attachments](images/editing-post-attachments.png){width=5.89in}

- Additional Attribute displays the entered additional attribute values.

  - For required values, all are entered.

  - For optional values, they may not be entered.

  - If not entered, they are not displayed in the front post list and detail screen.

![Editing Post -- Additional attributes 1](images/editing-post-additional-attributes-1.png){width=5.53in}

- Bottom action buttons are provided.

  - \[Post preview\] (same as above)

  - \[Cancel\] (same as above)

  - \[Save\] (same as above)**\**
