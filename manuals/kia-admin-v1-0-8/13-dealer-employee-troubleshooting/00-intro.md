---
title: Dealer Employee Troubleshooting
routes: []
sources: []
i18nPrefix: []
refreshedFrom:
  - page: "303907333"
    version: 199
---

<!-- TODO: 확인 필요 - STG에서 이 화면의 경로를 찾지 못함 (/troubleshooting, /trubleshooting, /dealer/troubleshooting 모두 404, 사이드 메뉴에도 없음). 라벨·이미지는 기획서 요약 기준으로만 갱신 -->

- **The Dealer Employee Troubleshooting** screen is a Back Office tool for head office operators.

- It helps operators quickly diagnose why a specific dealer employee:

- cannot log in to the system, or

- cannot see a specific **menu or post on the Front Office.**

- The screen provides **real-time status** based on the current database and allows operators to open related management screens to correct settings without IT support.



![Dealer Employee TroubleShooting](images/dealer-employee-troubleshooting.png){width=6.27in}



Dealer Employee Troubleshooting

**Dealer User Status Search**

- At the top of the screen, the **Dealer User Status** area is displayed.

- Operators must first specify **which dealer** and **which user** they want to diagnose.

- **Search fields:**

  - **Dealer Name (required):** Select the dealer to which the user belongs using a dropdown or auto-complete search.

  - **ID (required):** Enter the ID of the specific dealer employee.

- When the screen is first opened, only the search area and the **Search** button are displayed. Until a user is specified, the guide message "Please select a dealer and a user to check the dealer user status." is shown and the Content Status area is hidden.

- The **Search** button becomes active only when both Dealer Name and ID are entered.



![Dealer User Status](images/dealer-user-status-2.png){width=6.27in}



- When **Search** is clicked: The system validates that the entered **Dealer Name** and **ID** combination exists.

- If the ID does not belong to the selected dealer, the help text "No search result. Please enter the exact ID" is displayed before the diagnosis runs.

- If the user is found, the **User Status Summary** table is displayed and the **Content Status** search area below is reset.

- After a search, the **Reset** button is displayed. Clicking **Reset** clears both the top and bottom areas, and the **Reset** button disappears.

**User Status Summary**

- **The User Status Summary table** displays the basic login-related status of the dealer employee.

- **Main items:**

  - **User No:** Dealer employee number and account status (Active / Inactive)

    - Linked to the Dealer Employee Management detail screen.

  - **ID:** The user's ID

    - The ID status is not displayed.

    - No link is provided.

  - **Dealer Info:** Dealer No, Dealer Name, and dealer status

    - Status: Active / Under termination / Terminated / Inactive

    - Linked to the Dealer Management detail screen**.**

  - **Job Title:** Job title assigned to the user and its status

    - Status: Active / Inactive

    - Linked to the Job Management detail screen.

  - **Last Login:** Date and time of the user's last login, received from HMG Partner ID

    - Format: MM(Alphabet)-DD-YYYY HH:mm:ss {timezone}. The timezone follows the tenant of the dealer being viewed.

    - The value is per tenant, so a user belonging to multiple dealers shows the same value for every dealer in the same tenant.

    - If there is no login information, "No Login History" is displayed.

    - If the lookup fails, an error icon is displayed with the tooltip "Data is temporarily unavailable."

    - No link is provided.

- **Tag color:**

  - **Green:** Login possible.

  - **Gray:** Login not possible.

- Login is possible when User is Active, Dealer is Active or Under termination, and Job Title is Active. Login is not possible when the Dealer is Terminated or Inactive, the User is Inactive, or the Job Title is Inactive.

- Related error codes: AUTH_404_002 (user or dealer inactive), AUTH_403_005 (Job inactive), COMMON_500 (other external issues).

- **The Checked Date (MM-DD-YYYY HH:MM zzz) is displayed to show when the user status was retrieved. It shows the server response time.**

- **Deep links buttons:**

  - **[For each row, a \[Go to Setting\] button is displayed only if the operator has read permission or higher for the target management screen.]{.mark}**

  - **When clicked:**

    - **If the operator has permission, the corresponding detail screen (Dealer Employee / Dealer / Job) opens in a new tab.**

    - **If the operator has no permission, an Access Denied error screen is displayed.**

- **Login availability:**

  - **If User, Dealer, and Job Title are all in a login-available state, the dealer employee is treated as able to log in, and the Content Status area becomes enabled.**

  - **If any of these is in a login-not-available state, the dealer employee is treated as unable to log in, and the Content Status search area is disabled with a guidance message.**

**Content Status**

- **The Content Status** area is used to diagnose whether specific menus and posts are visible for the selected dealer employee.

- This area is available **only** when the Dealer User Status is in a login-available state.

- Guide message: "Please search by menu or Post ID to diagnose the content status."

- **Search type:**

  - **Menu (default)**

  - **Post**

- **Search conditions:**

  - **When Menu is selected:** Menu Name (Required / Auto-complete)

    - **All menu types can be selected:** General, Bulletin board, Outlink.

    - Menu items are displayed in newest-created order.

    - Display format examples:

    - Sales board(12345) → bulletin board menu (Board ID displayed)

    - Sales → General menu (no Board ID)

    - Incentive Board → Outlink menu

  - **When Post is selected:** Post ID (Input)

    - Used when diagnosing visibility of a specific post.

- **Buttons:**

  - **[\[Search\]:]{.mark}**

    - Executes diagnosis for the selected dealer user and the specified Menu or Post.

    - A loading indicator is displayed on the button while the diagnosis is running.

  - **[\[Reset\]:]{.mark}**

    - Clears the current search conditions and diagnostic result, and returns the Content Status area to the default state.

![Dealer Employee Troubleshooting -- Content Status(menu)](images/dealer-employee-troubleshooting-content-status-menu.png){width=6.26in}

![Dealer Employee Troubleshooting -- Content Status(post)](images/dealer-employee-troubleshooting-content-status-post.png){width=6.26in}

**Diagnostic Result**

- After search, the **Diagnostic Result (Content Status Summary)** table is displayed.

- **Common columns:**

  - **Step:** Step number (varies by menu depth and post location).

  - **Check Item**: Item being validated at each step (e.g. parent menu display status, menu access permission, post schedule, etc.).

  - Result: Success / Fail.

  - **Details:**

    - [Displays a \[Go to Setting\] button when the operator has permission to open the related BO setting screen in a new tab.]{.mark}

  - **Checked Date:**

    - [The date and time (MM-DD-YYYY HH:MM zzz) when the diagnosis result was retrieved.]{.mark}

- Typical checks when diagnosing a **menu:**

  - Parent menu display status (conditional)

  - Menu display status

  - Menu access permission (Job Title-based)

  - Menu--board mapping (for bulletin board type menus)

- Typical checks when diagnosing a **post:**

  - Menu-related checks (if the post is linked to a menu)

  - Post display status (Display ON/OFF, posting period)

  - Post Target Audience matching:

    - Compares Job Title, Dealer, Dealer Distribution Group, Zone, and District with the post's targeting conditions.

- **[\[Go to Setting\] behavior:]{.mark}**

  - Menu-related steps: open the **Menu Management detail** or access-permission screen.

  - Board-related steps: open the **Bulletin Board Management** detail screen.

  - Post-related steps: open the **Post Management detail** screen.

  - After changes are made, operators can return to the Troubleshooting screen and click **Search** again to confirm that the Result changes to Success.

**Cases Where Diagnosis Is Not Available**

- In the following cases, the **Content Status** search area is disabled and only a guide message is shown.

- **User cannot log in**

  - Reason: User, Dealer, or Job Title status prevents login.

  - Message: "Please check the dealer user's Access Status. The current Dealer User Status does not allow for system login"

- **User is Super Admin**

  - Reason: Super Admins may have exception-based access to all menus and posts, so detailed condition checks in Content Status are not meaningful.

  - Message: "Detailed diagnostic is not available for Super Admin users. Super Admins can access all posts due to administrative privilege exceptions."

  <!-- TODO: 확인 필요 - Super Admin을 진단 대상에서 제외하는 것이 맞는지 기획서에서 미결 상태 -->

- **Other external errors (e.g. COMMON_500)**

  - Reason: External system errors prevent status/permissions from being retrieved correctly.

  - Message: "Something Went Wrong ... contact your system administrator."



![Content Status Not Visible Case](images/content-status-not-visible-case.png){width=6.27in}
