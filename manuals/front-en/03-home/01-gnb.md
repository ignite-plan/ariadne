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

    i.  [Regular → Important after sending:\
        No additional email or FO notification is sent.]{.mark}

    ii. [Important → Regular after sending:\
        No additional email or FO notification is sent.]{.mark}

  - Already-sent notifications are not resent, even if the user changes their notification settings later. Changes affect only future sends.

- Delivery rule by tenant business hours

  - Email and FO notifications are sent once at the posting start time (including the system's delay rule).

  - If a notification is generated outside the tenant's business hours, it is delivered in a batch at the start of the next business day based on the tenant's timezone.

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
