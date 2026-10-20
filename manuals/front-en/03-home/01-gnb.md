---
title: GNB
routes: []
sources: []
i18nPrefix: []
---

## GNB

- GNB (Global Navigation Bar). Logo, search box, favorites, notifications, language settings, account information, and menu are displayed.

![GNB(Global Navigation Bar)](images/gnb-global-navigation-bar.png){width=6.79in}

- **Logo**

- The service logo is displayed at the top left, and clicking on the logo will take you to the home screen.

- ![](images/gnb-img-1.png){width=6.79in}

Logo image

- **Search Bar**

  - A search box is displayed to the right of the logo.

![Search Bar](images/search-bar.png){width=6.79in}

- When clicking on the search box, keyboard input is activated and up to 10 recent searches are displayed. When hovering the mouse over a recent search term, a delete button appears, and clicking it immediately deletes that search history.

- After entering a search term, pressing enter or selecting the search icon will execute the search with the entered term and take you to the integrated search results screen. (For integrated search results, see 3.Search Result below)**\**
  ![](images/gnb-img-2.png){width=5.13in}

Recent searches

- 

- **Multi-Dealer Switch**

- ![](images/gnb-img-3.png){width=5.95in}

Multi dealer switch

- The GNB displays the name of the currently active dealer.

- Multi-dealer users: an arrow icon is displayed, and clicking the dealer name or icon opens a dealer selection box.

![Multi dealer switch selection box](images/multi-dealer-switch-selection-box.png){width=5.37in}

- Dealers are grouped by brand: HYUNDAI (listed first) and GENESIS as separate sections. Only the brand section(s) applicable to the user are displayed.

- Only dealers where the employee status is Active are listed, in alphabetical order (A--Z). The currently active dealer is shown in bold with a check icon.

- A vertical scroll is provided if the list exceeds the maximum height of the selection box.

- After switching, the user is redirected to the Home screen of the newly selected dealer.

<!-- -->

- **Quick Link**

  - When Quick Link is clicked, the Quick Link screen is displayed. Please refer to the Quick Link description below.**\**
    ![](images/gnb-img-4.png){width=5.05in}

Quick Link

- **Notification:**

  - If there are notifications, the notification details will be displayed![](images/gnb-img-5.png){width=5.05in}

Notification

- If there are new notifications, a number notification badge will be displayed, and after the layer screen is displayed, the number notification badge will be reset.\
  ![](images/gnb-img-6.png){width=2.40in}

New notification

- When the Notification button is clicked, the notification layer appears. In the Notification list, read and unread notifications are displayed separately.\
  ![](images/gnb-img-7.png){width=2.35in}

Notification layer

<!-- TODO: 이미지 갱신 필요 - GIDPGRO-669 알림 카드 날짜 옆 Edited 태그 표시 (gnb-img-7) -->

- *[*Edited notifications**]{.mark}

[  - When a post is edited, an **Edited** tag is displayed next to the date on the notification card. The card shows the latest title, icon, and time.]{.mark}

[  - The following changes made in the Back Office post details trigger an edit: title, body, attachments, additional attributes, and Important notice. The edit applies immediately to posts that meet the notification sending conditions.]{.mark}

[  - Each edit keeps the existing card and adds a new Edited card at the top of the list. The badge count also increases by 1 (e.g., 1 original notification + 10 edits = 11 cards, badge 11). A notification that was already read becomes unread again when the post is edited.]{.mark}

[  - Edited is not applied when:]{.mark}

[    - A menu setting is changed.]{.mark}

[    - A post changes from displayed to hidden. The card does not change, and no Deleted tag is used.]{.mark}

[    - Target audience, permission, dealer, or job is changed. Neither the Edited nor the Deleted tag is applied. If access is revoked, the existing card stays unchanged and an error is shown when it is clicked. If access is granted again, the existing card stays and the post can be opened by clicking it.]{.mark}

[  - A post that changes from hidden to displayed (Display off → on) adds a new Edited card.]{.mark}

[  - The first display of a scheduled post (Scheduled Display) is a new notification, not an Edited one. If the scheduled time of an already published post is changed and the post is displayed again, it is shown as Edited.]{.mark}

[  - When a post is deleted or hidden, the existing card stays as it is and an error screen is shown when the card is clicked. The card does not move to the top.]{.mark}

    <!-- TODO: 확인 필요 - Page Not Found 안내 문구('Possible reasons: Incorrect URL / Page has been deleted / Page has been moved' 추가) 최종 반영 여부 (GIDPGRO-669 Jira 댓글, 기획서 요약에 최종 반영 확인 없음) -->

[  - Icon change: when a post changes between Regular and Important notice, the regular post icon and the important notice icon are swapped. When an attachment is added to a regular post, the icon changes to the attachment icon.]{.mark}

[  - Sort order: newest first (received or edited time, descending). When events occur at the same time, unread regular notifications come first, then Edited, then read regular notifications. An Edited notification that occurs while scrolling is reflected in the order only after the user refreshes.]{.mark}

- A **Notification setting** button is displayed at the bottom of the notification layer. When this button is clicked, a notification settings screen is opened where the user can configure their notification type for the **currently active dealership** only. Settings do not apply across multiple dealerships.

- **Notification receive type**

  - Notification settings control **both email notifications and FO (web) notifications** in the same way.

  <!-- -->

  - Notification options:

    - **All notifications** (default): All posts where **Notification = ON** in Back Office, regardless of whether the post is marked as Important or Regular.

    - **Important notices only: Only posts where Important Notice = ON, the Important period is active, and Notification = ON in Back Office.**

![Notification setting](images/notification-setting.png){width=4.76in}

- **After Saving**

  - Any change to the notification receive type is applied immediately and is used for the next notification sending decision.

  - For scheduled posts, if a post is changed to Important before it is sent, users who selected Important notices only will be included in the email/notification recipients at the time of sending.

  - When a post status is changed:

    i.  Regular → Important after sending:\
        The notification is shown as Edited, moves to the top, becomes unread, and its icon is changed to the important notice icon. No additional email is sent.

    ii. Important → Regular after sending:\
        The notification is shown as Edited, moves to the top, becomes unread, and its icon is changed to the regular post icon. No additional email is sent.

  - A post with Display OFF and Notification ON is treated by the system as not sent. When the sending conditions are met later, it is sent as the first notification (Regular, or Important if it is an Important notice).

  - Already-sent notifications are not resent, even if the user changes their notification settings later. Changes affect only future sends.

- Delivery rule by tenant business hours

  - Email and FO notifications are sent once at the posting start time (including the system's delay rule).

  - If a notification is generated outside the tenant's business hours, it is delivered in a batch at the start of the next business day based on the tenant's timezone.

  - For the first publication of a post, the notification and email are sent with a 1-hour delay. For an edit to an already published post, the notification is reflected immediately and no additional email is sent.

<!-- -->

- **Language setting:**

  - The language setting button is displayed.**\**
    ![](images/gnb-img-8.png){width=2.33in}

Language setting

- When clicked, language information is displayed in the right layer, and you can select a language using **radio buttons.\**
  ![](images/gnb-img-9.png){width=2.59in}

Language selection

- **Account:**

  - The user\'s account information is displayed.\
    ![](images/gnb-img-10.png){width=2.86in}

Account

- If the user has registered a profile picture, the profile image is displayed. If an image has not been registered, an initials avatar is displayed instead. This applies to the GNB and the Account layer.

  - For Latin-script names, the first letter of the First Name and the first letter of the Last Name are used (e.g., Isabel Marant → IM).

  - The font, size, and color of the avatar follow the design definition.

- When account information is clicked, the user\'s profile image, name, Dealer Name, and Job title are displayed in the right Layer, and it\'s possible to view Profile, Reset password, and logout.



![Account Layer](images/account-layer-2.png){width=6.27in}

**\**



**Reset Password**

- When you click **Reset Password,** a URL to reset your password will be sent to your registered account email address.

- Once you complete the password change through the provided URL, the new password will be applied.
