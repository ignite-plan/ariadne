---
title: Create Dealer Employee
routes: [/dealer/employee/create]
sources: []
i18nPrefix: []
---

## Create Dealer Employee

- Clicking **\[create new\]** at the top of the dealer employee list takes you to a screen to create a dealer employee.

![Create Dealer Employee](images/create-dealer-employee.png){width=4.49in}

In the **Basic information** area, enter the user\'s basic information:

![Employee - Basic information1](images/employee-basic-information1.png){width=6.79in}

- **First name(Required):** Maximum 20 characters can be entered. Leading and trailing spaces are not allowed. Special characters and numbers cannot be entered (the input is blocked and no error message is shown).

- **Last name(Required):** Maximum 20 characters can be entered. The same rules as First name apply.

- **Picture:** Optional. One image representing the user can be registered. If no picture is registered, the view screen shows an initials avatar: for Latin names, the first letters of the First name and Last name (e.g., Isabel Marant → IM); for non-Latin names, only the first letter of the Last name. Initials are not shown on the create and edit screens.

- **Status(Required):** Select the status of the dealer employee account.

  - **Inactive**: Indicates a deactivated status where the user cannot access the service. If the initial account is created with *Inactive* status, an ID cannot be created. The Account Email also cannot be entered. The Existing ID and ID fields are replaced by the banner "To proceed, the status must be Active."

![Status -- Inactive](images/status-inactive.png){width=6.79in}

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2350 Inactive 상태에서 Existing ID·ID 필드 대신 'To proceed, the status must be Active.' 배너 표시 -->

- **Active**: Indicates an activated status where the user can access the service. If the initial account status is set to *Active*, an ID can be created.

  - When active, the Existing ID field is enabled.

<!-- -->

- **Existing ID**

  - No, Create a new account: Proceeds with creating a new ID.

  - Yes, Use existing account: Links to an existing ID.

![Status -- Active: Create New HMG Partner ID](images/status-active-create-new-hmg-partner-id.png){width=6.79in}
<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2350 필드 레이블이 'HMG Partner ID'에서 'ID'로 변경됨 -->

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2350 'HMG Partner ID' 라벨이 'ID'로 변경, ID 필드 툴팁 추가 -->

- **ID :** This is the ID used to log in to the Dealers system. A tooltip on the field explains: "ID(Account) in this system is managed through hmg-PartnerID. The hmg-PartnerID is a unified account credential system provided by Hyundai Motor Group to business partners and suppliers accessing HMG systems and services."

  - An ID can only be created when the account is initially in an **Active** status, and creation is **mandatory** in this case.

    - Create a new account Case

    <!-- -->

    - Once created, the ID remains valid even if the account status is later changed to **Inactive**.

    - The ID must be between **5 to 10 characters**, using a combination of **letters and numbers.** The field guide reads "English letters and numbers only (max 10 characters)".

    <!-- TODO: 기획서(\[FO\] Dealer-Employee Management 화면)는 ID 규칙을 영문·숫자 5~40자로 기재하나 가이드 문구는 max 10 characters — 확인 필요 -->

    - **A duplicate check** is required. After entering your desired ID, click **\[Verify ID\]** to check for duplicates.

    - Consent to create the ID is mandatory.

![Status -- Active: Search existing HMG Partner ID](images/status-active-search-existing-hmg-partner-id.png){width=6.79in}

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2350 'HMG Partner ID' 라벨이 'ID'로 변경, 가이드 문구 'Search the ID to confirm and connect the account.' -->

- Use existing account Case

<!-- -->

- When registering an account with an existing ID as a dealer employee, enter the ID (guide: "Search the ID to confirm and connect the account.") and click the \[Search ID\] button.

- If the account exists, some user information will be displayed in the search results so you can verify the user.

- If the information is correct, click the \[Save\] button to add the employee details.

![Verifying user popup](images/verifying-user-popup.png){width=4.14in}

- If existing ID information is mapped and imported, the following fields cannot be edited

  - Name / Account Email / Language

![Reset HMG Partner ID](images/reset-hmg-partner-id.png){width=4.81in}

<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2350 'Reset HMG Partner ID'가 'Need to change? Reset ID' 문구로 변경 -->

- If the information is incorrect, click "Reset ID" in the "Need to change? Reset ID" text below the ID field to reset and re-enter the information.

![Employee - Basic information2](images/employee-basic-information2.png){width=6.79in}

- **Account email(required):** The employee's personal email, used to manage ID and send password reset requests. Account-related notifications, such as password resets, will be sent to this address.

- **Business Email(Required):** The business email address. If a domain is registered for the dealership, the domain must be selected from the registered domains.

![When domain information is present](images/when-domain-information-is-present.png){width=6.79in}

- **Business Phone(Required):** Enter the user\'s business phone number.

  - Select international number from 1 or 82. 1 is provided as default.

- **Personal Phone:** Optional. Enter the user\'s personal phone number.

  - Select international number from 1 or 82. 1 is provided as default.

- **Language(Required):** This is a value that sets the language of the dealer employee.

  - It determines the language displayed on the user\'s login screen and the emails sent.

  - English is selected by default. Choose between English and French.

- **Date of Birth:** Optional. Enter the user\'s birthday.

- **Hyundai Start date(Required):** Enter the date when the user started working at Hyundai. The date you open the create screen (the registration date) is entered automatically, and you can select a different date from the calendar.

<!-- -->

- In the **Role & Organization Information** section, you can configure the user\'s permissions.

![Employee - Role](images/employee-role.png){width=6.12in}

- **Job Title:** User permissions can be assigned through the selected job title.\
  Once a job is selected for a user, the corresponding menu permissions mapped to that job can be viewed in **the Menu Permission** section.

- If the dealer employee\'s **status** is set to Active, selecting a job is mandatory.\
  If the status is Inactive, assigning a job is optional.

- Users with access to **the Dealer Employee Management** screen and the ability to create new employees must be granted the Super Admin job title.\
  A maximum of **three Super Admins** can be assigned per dealer.

- **The Dealer Principal** cannot be assigned through this screen, and the job title of a Dealer Principal cannot be modified.

- **Menu Permission**: This section displays the menu-level permissions mapped to the selected job.

- In addition to the permissions granted via the job, individual permissions can also be added manually if necessary.

- **Permission Descriptions:**

  - **All**: Grants all available permissions for the selected menu at once.

  - **Access**: Makes the menu visible to the employee.

  - **Read**: Allows the user to view the bulletin board and read the details within the menu area.

![Employee - Role setting](images/employee-role-setting.png){width=6.79in}

- **How to Grant Permissions**

<!-- -->

- You must have at least **Access** permission for a **1st-level menu** in order to assign permissions to its **2nd-level menus**.

- If a **2nd-level menu** has existing permissions, you **cannot remove all permissions** from its parent **1st-level menu**.

- **Access** permission is required before **Read** permission can be granted.\
  Similarly, **Read** permission is required before **Write** permission can be granted.

- If both **Access** and **Read** permissions are granted, you **cannot uncheck only Access**.

- Unchecking **Access** will also remove **Read** permission.

<!-- -->

- ![](images/create-dealer-employee-img-1.png){width=0.41in}: Indicates a permission **defined by the job**. It **cannot be modified**.

- ![](images/create-dealer-employee-img-2.png){width=0.42in}: Indicates that **additional permissions** can be assigned.

- ![](images/create-dealer-employee-img-3.png){width=0.41in}: Indicates that **a lower-level permission is required** before this can be added.

- ![](images/create-dealer-employee-img-4.png){width=0.41in}: Indicates a permission that was **manually granted to the individual**. This can be **unchecked** to remove it.

**Bottom Button & Account Creation Process**

- Clicking the **\[cancel\]** button returns to the previous screen without saving the entered content. Clicking the **\[create\]** button creates a new dealer employee account with the entered content.

- If an **ID** is newly created, an email will be sent to the **registered email address** containing a link to create the account and set a password through the **HMG Partner** system. Using this link, the employee can complete the password setup.

- When a dealer employee account is created with an ID, a welcome invitation email is automatically sent to the registered Account Email.

- ![](images/create-dealer-employee-img-5.png){width=4.59in}

Welcome invitation email
