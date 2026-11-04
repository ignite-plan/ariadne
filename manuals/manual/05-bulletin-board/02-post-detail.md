---
title: Post Detail
routes: []
sources: []
i18nPrefix: []
refreshedFrom:
  - page: "609290272"
    version: 13
  - page: "690598529"
    version: 1
  - page: "690603322"
    version: 1
---

## Post Detail

- You can view posts registered in the BO.

![Post Detail](images/post-detail.png){width=6.79in}

- **Header:** An example of post header information is as follows.\

  ![Post - Header Area](images/post-header-area.png){width=5.68in}

- **Title:** The post title is displayed up to 200 characters.

- **Additional Attribute:** Depending on the use of Additional attributes entered in the BO, they may be displayed/not displayed. Up to 5 attributes are displayed in the configured order, and long values wrap to the next line. The input is limited to 50 characters.

- **Date:** The posting start date set in the BO posting period is displayed in the `MM(Alphabet) DD, YYYY` format (American date format).

  - **Edited:** An **Edited** label (French: **Modifié**) is displayed in the Date area when the post has been edited in the BO.

    - The changed content (title, content, Important Notice setting, additional attributes) is reflected in the post, and the post is treated as unread again.

    - Once a post has been edited, the label is always displayed. It appears only once, no matter how many times the post is edited.

    - The date is not updated when the post is edited.

    - The label is not added for date changes, permission changes (Target audience, Permission, Dealer, Job), or menu setting changes.

    - A post that becomes visible again after being hidden (Display OFF to ON) is labeled **Edited**. A post that becomes visible for the first time at its scheduled display time is treated as new and is not labeled.

    - The Edited label of the post detail is separate from the Edited label of the notification card. If only the period or target is changed, the notification card shows Edited, but the post detail does not.

    <!-- TODO: 확인 필요 - 첨부파일 변경이 Edited 트리거인지 (FE 공유 문서 GIDPGRO-824에는 있으나 상세 기획서 본문에는 첨부파일 언급 없음) -->

- **Content:** The Content entered in the BO post is displayed. It is displayed according to the styles added in the editor tool, such as text formats, lists, tables, images, icons, etc. entered in the Content.

- **Copy Link:** This is a function to copy the link to the post. It can be used when you need to share the post.\
  ![](images/post-detail-img-1.png){width=0.96in}

<!-- -->

- **Body:** An example of post body information is as follows.

![Post - Body](images/post-body.png){width=4.46in}

- **Image Gallery**

  - When an **image in the Content** is clicked, it is displayed in **Image gallery view.**

  - The image filename is displayed on the top left, and download and close buttons are displayed on the top right.

  - When **hovering over** the image filename, the full filename is displayed as a **tooltip.**

![](images/post-detail-img-2.png){width=6.79in}

- When there are 15 or more **thumbnails, previous and next buttons** appear on both sides of the bottom image thumbnails.

![Image Gallery](images/image-gallery.png){width=6.17in}

- **Attachment:** Up to 5 attachments can be displayed, and the number of attached files is displayed at the top. File preview and download are available.

![Post - Attachment](images/post-attachment.png){width=6.17in}

  - The file name (truncated with an ellipsis; the full name is shown on hover) and the file size are displayed, with Preview (magnifier) and Download icons.

  - **PDF preview:** If the PDF is 20MB or less, a preview popup with a watermark opens (a skeleton is shown while loading). If it exceeds 20MB, a **Preview Not Available** popup with **\[Cancel\]** and **\[Download\]** buttons is displayed.

  - **Download:** If the file is 50MB or less, the download proceeds without a loading UI. If it exceeds 50MB, a **Preparing download...** toast with a **\[Cancel\]** button is displayed.

  - If you leave the page while the download is being prepared, a **File Download in Progress** popup with **\[Leave\]** and **\[Stay\]** buttons is displayed. If a previous request is still being processed, a notice popup is displayed.

  - If an error occurs, a **Something Went Wrong** popup with a **\[Confirm\]** button is displayed.

  <!-- TODO: 확인 필요 - 기획서 요약은 이미지 파일 썸네일을 최대 10개로 하고 좌우 이동 버튼이 있다고 하나, 위 매뉴얼은 썸네일 15개 이상일 때 이동 버튼이 나타난다고 함 -->

- **Previous, Next:** Clicking allows you to see the previous or next post. The icon tooltips are Previous / Next. If there is no previous or next post, the button is hidden.

![Post - Preview/Next](images/post-preview-next.png){width=6.31in}

- **View List:** Clicking takes you to the post list screen.

- **Top:** Clicking takes you to the very top of the post. When scrolling down the post, the Top button appears in the bottom right.
