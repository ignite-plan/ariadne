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

- After entering a search term, pressing enter or selecting the search icon will execute the search with the entered term and take you to the integrated search results screen. (For integrated search results, see 3.Search Result below)



    ![Recent searches](images/gnb-img-2.png){width=4.36in}

- **Quick Link**

  - When Quick Link is clicked, the Quick Link screen is displayed. Please refer to the Quick Link description below.


     ![Quick Link](images/gnb-img-3.png){width=3.88in}


- **Notification:**

  - If there are notifications, the notification details will be displayed

  ![Notification](images/gnb-img-4.png){width=4.65in}

- If there are new notifications, a number notification badge will be displayed, and after the layer screen is displayed, the number notification badge will be reset.\

  ![New notification](images/gnb-img-5.png){width=6.06in}

- When the Notification button is clicked, the notification layer appears. In the Notification list, read and unread notifications are displayed separately.\

    ![Notification layer](images/gnb-img-6.png){width=3.50in}


- **Edited notifications**

  - When a post is edited, an **Edited** tag is displayed next to the date on the notification card. The card shows the latest title, icon, and time.

  - The following changes made in the Back Office post details trigger an edit: title, body, attachments, additional attributes, and Important notice. The edit applies immediately to posts that meet the notification sending conditions.

  - Each edit keeps the existing card and adds a new Edited card at the top of the list. The badge count also increases by 1 (e.g., 1 original notification + 10 edits = 11 cards, badge 11). A notification that was already read becomes unread again when the post is edited.

  - **Edited is not applied when:**

    - A menu setting is changed.

    - A post changes from displayed to hidden. The card does not change, and no Deleted tag is used.

    - Target audience, permission, dealer, or job is changed. Neither the Edited nor the Deleted tag is applied. If access is revoked, the existing card stays unchanged and an error is shown when it is clicked. If access is granted again, the existing card stays and the post can be opened by clicking it.

  - A post that changes from hidden to displayed (Display off → on) adds a new Edited card.

  - The first display of a scheduled post (Scheduled Display) is a new notification, not an Edited one. If the scheduled time of an already published post is changed and the post is displayed again, it is shown as Edited.

  - When a post is deleted or hidden, the existing card stays as it is and an error screen is shown when the card is clicked. The card does not move to the top.

  - **Icon change:** when a post changes between Regular and Important notice, the regular post icon and the important notice icon are swapped. When an attachment is added to a regular post, the icon changes to the attachment icon.

  - **Sort order**: newest first (received or edited time, descending). When events occur at the same time, unread regular notifications come first, then Edited, then read regular notifications. An Edited notification that occurs while scrolling is reflected in the order only after the user refreshes.

- A **Notification setting** button is displayed at the bottom of the notification layer. When this button is clicked, a notification settings screen is opened where the user can configure their notification type for the **currently active dealership** only. Settings do not apply across multiple dealerships.

- **Notification receive type**

  - Notification settings control **both email notifications and FO (web) notifications** in the same way.

  - Notification options:

    - **All notifications** (default): All posts where **Notification = ON** in Back Office, regardless of whether the post is marked as Important or Regular.

    - **Important notices only: Only posts where Important Notice = ON, the Important period is active, and Notification = ON in Back Office.**

![Notification setting](images/notification-setting.png){width=4.76in}

- **After Saving**

  - Any change to the notification receive type is applied immediately and is used for the next notification sending decision.

  - For scheduled posts, if a post is changed to Important before it is sent, users who selected Important notices only will be included in the email/notification recipients at the time of sending.

  - **When a post status is changed**:

    i.  **Regular → Important after sending:**\
        The notification is shown as Edited, moves to the top, becomes unread, and its icon is changed to the important notice icon. No additional email is sent.

    ii. **Important → Regular after sending**:\
        The notification is shown as Edited, moves to the top, becomes unread, and its icon is changed to the regular post icon. No additional email is sent.

  - A post with Display OFF and Notification ON is treated by the system as not sent. When the sending conditions are met later, it is sent as the first notification (Regular, or Important if it is an Important notice).

  - Already-sent notifications are not resent, even if the user changes their notification settings later. Changes affect only future sends.

- Delivery rule by tenant business hours

  - Email and FO notifications are sent once at the posting start time (including the system's delay rule).

  - If a notification is generated outside the tenant's business hours, it is delivered in a batch at the start of the next business day based on the tenant's timezone.

  - For the first publication of a post, the notification and email are sent with a 1-hour delay. For an edit to an already published post, the notification is reflected immediately and no additional email is sent.

- **Language setting:**

  - The language setting button is displayed.
  
     ![Language setting](images/gnb-img-7.png){width=5.68in}

- When clicked, language information is displayed in the right layer, and you can select a language using **radio buttons.**

   ![Language selection](images/gnb-img-8.png){width=2.59in}

- **Account:**
  - The user\'s account information is displayed.\

    ![Account](images/gnb-img-9.png){width=5.04in}

- If the user has registered a profile picture, the profile image is displayed. If an image has not been registered, an initials avatar is displayed instead. This applies to the GNB and the Account layer.

  - For Latin-script names, the first letter of the First Name and the first letter of the Last Name are used (e.g., Isabel Marant → IM).

- When account information is clicked, the user\'s profile image, name, Dealer Name, and Job title are displayed in the right Layer, and it\'s possible to view Profile, Reset password, and logout.

![Account Layer](images/account-layer.png){width=3.26in}

**Reset Password**

- When you click **Reset Password,** a URL to reset your password will be sent to your registered account email address.

- Once you complete the password change through the provided URL, the new password will be applied.
