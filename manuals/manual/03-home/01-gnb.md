---
title: GNB
routes: []
sources: []
i18nPrefix: []
refreshedFrom:
  - page: "536947651"
    version: 1
---

## GNB

- GNB (Global Navigation Bar). Logo, search box, favorites, notifications, language settings, account information, and menu are displayed.

![](images/gnb-img-1.png){width=6.79in}Figure 7 GNB(Global Navigation Bar)

- **Logo**

  - The service logo is displayed at the top left, and clicking on the logo will take you to the home screen.\

    ![Logo image](images/logo-image.png){width=2.94in}

- **Search Bar**

  - A search box is displayed to the right of the logo.

    ![Search Bar](images/search-bar.png){width=2.94in}

- When clicking on the search box, keyboard input is activated and up to 10 recent searches are displayed. When hovering the mouse over a recent search term, a delete button appears, and clicking it immediately deletes that search history.


- English uppercase and lowercase letters are treated as the same character when filtering.

- After entering a search term, pressing enter or selecting the search icon will execute the search with the entered term and take you to the integrated search results screen. (For integrated search results, see 3.Search Result below)

  ![Recent searches](images/recent-searches.png){width=2.99in}

- **Multi-Dealer Switch**

![Multi dealer switch](images/multi-dealer-switch.png){width=6.79in}

- The GNB displays the name of the currently active dealer.

- Single-dealer users: the arrow icon is not displayed and clicking the dealer name has no effect.

- Multi-dealer users: an arrow icon is displayed, and clicking the dealer name or icon opens a dealer selection box. The same policy applies to custom screens.

![Multi dealer switch selection box](images/multi-dealer-switch-selection-box.png){width=6.79in}

- Dealers are grouped by brand: HYUNDAI (listed first) and GENESIS as separate sections. The order is fixed (HYUNDAI, then GENESIS), even when viewed from Genesis. Only the brand section(s) applicable to the user are displayed. If the user has multiple dealers in only one brand, only that brand section is displayed (a Kia multi-dealer user sees only Kia).


- A vertical scroll is provided if the list exceeds the maximum height of the selection box.



- **Dealer Employee Management**

  - Displayed in the GNB only when the user's job title is Super admin. Selecting it opens the Dealer Employee Management screen.

- **Quick Link**

  - When Quick Link is clicked, the Quick Link screen is displayed. Please refer to the Quick Link description below.

    ![Quick Link](images/quick-link.png){width=2.49in}

- **Notification:**

<!-- TODO: 확인 필요 - 기획서(홈기본화면)에 알림 레이어와 알림 설정 상세가 없음. 아래 알림 설정/수신 유형/발송 규칙은 다른 근거로 확인 필요 -->

  - If there are notifications, the notification details will be displayed.\

    ![Notification](images/notification.png){width=2.38in}

- If there are new notifications, a number notification badge will be displayed, and after the layer screen is displayed, the number notification badge will be reset.\

  ![New notification](images/new-notification.png){width=2.86in}

- When the Notification button is clicked, the notification layer appears. In the Notification list, read and unread notifications are displayed separately.

![Notification layer](images/notification-layer.png){width=1.64in}

- A **Notification setting** button is displayed at the bottom of the notification layer. When this button is clicked, a notification settings screen is opened where the user can configure their notification type for the **currently active dealership** only. Settings do not apply across multiple dealerships.

- **Notification receive type**

  - Notification settings control **both email notifications and FO (web) notifications** in the same way.

  <!-- -->

  - Notification options:

    - **All notifications** (default): All posts where **Notification = ON** in Back Office, regardless of whether the post is marked as Important or Regular.

    - **Important notices only:** Only posts where Important Notice = ON, the Important period is active, and Notification = ON in Back Office.

![Notification setting](images/notification-setting.png){width=4.31in}

- After Saving

  - Any change to the notification receive type is applied immediately and is used for the next notification sending decision.

  - For scheduled posts, if a post is changed to Important before it is sent, users who selected Important notices only will be included in the email/notification recipients at the time of sending.

  - When a post status is changed:

    i.  Regular → Important after sending:\
        No additional email or FO notification is sent.

    ii. Important → Regular after sending:\
        No additional email or FO notification is sent.

  - Already-sent notifications are not resent, even if the user changes their notification settings later. Changes affect only future sends.

- Delivery rule by tenant business hours

  - Email and FO notifications are sent once at the posting start time (including the system's delay rule).

  - If a notification is generated outside the tenant's business hours, it is delivered in a batch at the start of the next business day based on the tenant's timezone.

<!-- -->

- **Language setting:**

    ![Language setting](images/language-setting.png){width=2.30in}

- When clicked, language information is displayed in the right layer, and you can select a language using **radio buttons.**

  ![Language selection](images/language-selection.png){width=3.22in}

- **Account:**

  - The user\'s account information is displayed.\

    ![Account](images/account.png){width=3.46in}

- If the user has registered a profile picture, the profile image is displayed. If an image has not been registered, a default image is displayed.

- When account information is clicked, the user\'s profile image, name, Dealer Name, and Job title are displayed in the right Layer, and it\'s possible to use My Profile, Reset Password, My dealership, and Logout. Company name, business email, and business phone are also shown with icons.

- **My Profile** opens the user profile screen, and **My dealership** opens the My Dealership screen.

<!-- TODO: 기획서(홈기본화면)는 GIDPGRO-331로 프로필 화면을 분리했다고 함. 아래 Profile Screen View 섹션의 유지 여부 확인 필요 -->\
  
  

![Account layer](images/account-layer-3.png){width=4.2in}




**Profile Screen View:**

- When **My profile** is clicked, users can view their registered profile information.

- On this screen, users can only view the registered profile information; modification or deletion is not possible.

- If a photo is registered to the account, the registered photo will be displayed.

- Name information and the user\'s email are displayed.

- If the user is a dealer principal, that badge will be displayed on the left.

![Profile](images/profile.png){width=5.28in}

- User information, information about the dealer company the user belongs to, and information about the dealer representative are displayed in the right area.

<!-- -->

- **Profile area**

  - **Picture**

  - **Name**

  - **Account Email:** Account email information.

    - Account-related emails will be sent to this address. If a password reset is requested, an email with instructions will be sent to this address.

- **My profile area**

  - **Partner id:** The user\'s account ID

  - **Business Email:** The business email address.

    - Notification emails for new posts published on Dealers will be sent to this address.

  - **Business phone:** The registered user\'s business phone number

  - **Personal phone:** The registered user\'s personal phone number. If this information is not registered, it is marked with \'-\'

  - **Language:** Displays the default language value

  - **Age:** Calculates and displays the age based on the registered birth date information. If this information is not registered, it is marked with \'-\'

<!-- -->

- **Company overview**

  - **Company name:** The name of the dealer company to which the user belongs

  - **Email:** The email information of the affiliated dealer company

  - **Website:** The website address of the affiliated dealer company

  - **Phone number:** The phone number of the affiliated dealer company

  - **Address:** The address information of the affiliated dealer company

  - **Zip/postal code:** The postal code of the affiliated dealer company\'s address

  - **Founding date:** The establishment date of the affiliated dealer company

  - **Total facilities:** The number of assets registered to the affiliated dealer company

  - **Facility purposes(registered):** The number of assets according to the purpose of the registered assets

  <!-- -->

  - **Dealer principal information**

    - **First name:** The dealer representative\'s name information, surname

    - **Last name:** The dealer representative\'s name information, first name

    - **Email:** The dealer representative\'s email information

    - **Business phone:** The dealer representative\'s phone number

**Reset Password**


- When you click **Reset Password,** a **Reset password** modal is displayed with the message "Reset password? A password reset link will be sent via email."

  - **Cancel**: The modal closes and no password-related action is performed.

  - **Confirm**: The modal closes and a URL to reset your password is sent to your registered account email address.

- If the request fails with a 400 error, the message "For security reasons, we cannot resend the password reset email at this time because the password was recently changed. Please try again later." is displayed. For any other error, "An error occurred while communicating with the external system. Please try again later." is displayed. Both messages have a **Confirm** button.

- Once you complete the password change through the provided URL, the new password will be applied.
