---
title: GNB
routes: []
sources: []
i18nPrefix: []
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

- After entering a search term, pressing enter or selecting the search icon will execute the search with the entered term and take you to the integrated search results screen. (For integrated search results, see 3.Search Result below)

  ![Recent searches](images/recent-searches.png){width=2.99in}

- **Multi-Dealer Switch**

![Multi dealer switch](images/multi-dealer-switch.png){width=6.79in}

- The GNB displays the name of the currently active dealer.

- Multi-dealer users: an arrow icon is displayed, and clicking the dealer name or icon opens a dealer selection box.

![Multi dealer switch selection box](images/multi-dealer-switch-selection-box.png){width=6.79in}

- Dealers are grouped by brand: HYUNDAI (listed first) and GENESIS as separate sections. Only the brand section(s) applicable to the user are displayed.

- Only dealers where the employee status is Active are listed, in alphabetical order (A--Z). The currently active dealer is shown in bold with a check icon.

- A vertical scroll is provided if the list exceeds the maximum height of the selection box.

- After switching, the user is redirected to the Home screen of the newly selected dealer.

<!-- -->

- 

- **Quick Link**

  - When Quick Link is clicked, the Quick Link screen is displayed. Please refer to the Quick Link description below.

    ![Quick Link](images/quick-link.png){width=2.49in}

- **Notification:**

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

  - The language setting button is displayed.

    ![Language setting](images/language-setting.png){width=2.30in}

- When clicked, language information is displayed in the right layer, and you can select a language using **radio buttons.**

  ![Language selection](images/language-selection.png){width=3.22in}

- **Account:**

  - The user\'s account information is displayed.\

    ![Account](images/account.png){width=3.46in}

- If the user has registered a profile picture, the profile image is displayed. If an image has not been registered, a default image is displayed.

- When account information is clicked, the user\'s profile image, name, Dealer Name, and Job title are displayed in the right Layer, and it\'s possible to view Profile, Reset password, and logout.\
  
  ![Account layer](images/account-layer.png){width=2.28in}

**Profile Screen View:**

- When **Profile** is clicked, users can view their registered profile information.

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

![Reset Password](images/reset-password.png){width=3.44in}

- When you click **Reset Password,** a URL to reset your password will be sent to your registered account email address.

- Once you complete the password change through the provided URL, the new password will be applied.
