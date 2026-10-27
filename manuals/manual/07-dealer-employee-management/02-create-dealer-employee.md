---
title: Create Dealer Employee
routes: []
sources: []
i18nPrefix: []
---

## Create Dealer Employee

- Clicking **\[create new\]** at the top of the dealer employee list takes you to a screen to create a dealer employee.

![Create Dealer Employee](images/create-dealer-employee.png){width=5.08in}

- In the **Basic information** area, enter the user\'s basic information:

![Employee - Basic information1](images/employee-basic-information1.png){width=6.79in}

- **First name(Required):** Maximum 20 characters can be entered.

- **Last name(Required):** Maximum 20 characters can be entered.

- **Picture:** Optional. One image representing the user can be registered.

- **Status(Required):** Select the status of the dealer employee account.

  - **Inactive**: Indicates a deactivated status where the user cannot access the service. If the initial account is created with *Inactive* status, an HMG Partner ID cannot be created. The Account Email also cannot be entered.

- ![](images/create-dealer-employee-img-1.png){width=6.79in}

Status -- Inactive

- **Active**: Indicates an activated status where the user can access the service. If the initial account status is set to *Active*, an HMG Partner ID can be created.

  - When active, the Existing HMG Partner ID field is enabled.

    - **Existing HMG Partner ID**

      - No, Create a new account: Proceeds with creating a new HMG Partner ID.

      - Yes, Use existing account: Links to an existing HMG Partner ID.

![Status -- Active: Create New HMG Partner ID](images/status-active-create-new-hmg-partner-id.png){width=6.79in}

- **HMG Partner ID :** This is the ID used to log in to the Dealers system.

  - An HMG Partner ID can only be created when the account is initially in an **Active** status, and creation is **mandatory** in this case.

    - Create a new account Case

    <!-- -->

    - Once created, the ID remains valid even if the account status is later changed to **Inactive**.

    - The ID must be between **5 to 10 characters**, using a combination of **letters and numbers.**

    - **A duplicate check** is required. After entering your desired ID, click **\[Verify ID\]** to check for duplicates.

    - Consent to create the HMG Partner ID is mandatory.

![Status -- Active: Search existing HMG Partner ID](images/status-active-search-existing-hmg-partner-id.png){width=5.72in}

- Use existing account Case

<!-- -->

- When registering an account with an existing HMG Partner ID as a dealer employee, enter the HMG Partner ID and click the \[Search ID\] button.

- If the account exists, some user information will be displayed in the search results so you can verify the user.

- If the information is correct, click the \[Save\] button to add the employee details.

![Verifying user popup](images/verifying-user-popup.png){width=4.48in}

- If existing HMG Partner ID information is mapped and imported, the following fields cannot be edited

  - Name / Account Email / Language

![Reset HMG Partner ID](images/reset-hmg-partner-id.png){width=5.07in}

- If the information is incorrect, click \[Reset HMG Partner ID\] below the HMG Partner ID field to reset and re-enter the information.

![Employee - Basic information2](images/employee-basic-information2.png){width=6.79in}

- **Account email(required):** The email address linked to the HMG Partner ID. Account-related notifications, such as password resets, will be sent to this address.

- **Business Email(Required):** The business email address. If a domain is registered for the dealership, the domain must be selected from the registered domains.

- ![When domain information is present](images/when-domain-information-is-present.png){width=6.79in}

- **Business Phone(Required):** Enter the user\'s business phone number.

  - Select international number from 1 or 82. 1 is provided as default.

- **Personal Phone:** Optional. Enter the user\'s personal phone number.

  - Select international number from 1 or 82. 1 is provided as default.

- **Language(Required):** This is a value that sets the language of the dealer employee.

  - It determines the language displayed on the user\'s login screen and the emails sent.

  - English is selected by default. Choose between English and French.

- **Date of Birth:** Optional. Enter the user\'s birthday.

- **Genesis Start date(Required):** Enter the date when the user started working at Genesis.

<!-- -->

- In the **Role & Organization Information** section, you can configure the user\'s permissions.

![Employee - Role](images/employee-role.png){width=6.19in}

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

- ![](images/create-dealer-employee-img-2.png){width=0.41in}: Indicates a permission **defined by the job**. It **cannot be modified**.

- ![](images/create-dealer-employee-img-3.png){width=0.42in}: Indicates that **additional permissions** can be assigned.

- ![](images/create-dealer-employee-img-4.png){width=0.41in}: Indicates that **a lower-level permission is required** before this can be added.

- ![](images/create-dealer-employee-img-5.png){width=0.41in}: Indicates a permission that was **manually granted to the individual**. This can be **unchecked** to remove it.

**Bottom Button & Account Creation Process**

- Clicking the **\[cancel\]** button returns to the previous screen without saving the entered content. Clicking the **\[create\]** button creates a new dealer employee account with the entered content.

- If an **HMG Partner ID** is newly created, an email will be sent to the **registered email address** containing a link to create the account and set a password through the **HMG Partner** system. Using this link, the employee can complete the password setup.

- [When a dealer employee account is created with an HMG Partner ID, a welcome invitation email is automatically sent to the registered Account Email.]{.mark}

![Welcome invitation email](images/welcome-invitation-email.png){width=4.28in}

- 

**View Dealer Employee**

- You can view the detailed information of an employee by clicking the Partner ID or name area in the dealer employee list.

- If the employee is a dealer principal, a badge saying dealer principal is displayed.

- If an **HMG Partner ID** has not been created, an **\"HMG Partner ID Required\"** badge will be displayed.

- Clicking **\[Reset Password\]** in the upper right will send a link to the registered email address to set a new password.\
  Once the password is changed through the link, the new password will be applied.

- Clicking the **\[Edit\]** button in the upper right navigates to the screen where employee information can be modified.

- Clicking the **\[View List\]** button at the bottom takes you to the **Dealer Employee List** screen.

- ![View Employee details](images/view-employee-details.png){width=5.46in}

- The dealer employee detail screen provides the following information:

![Employee details1](images/employee-details1.png){width=6.79in}

- If a dealer employee photo is registered, it provides the photo.

  - **User No.**: Once the dealer employee information is registered, a unique employee number is automatically generated and displayed by the Dealers system.

  - **First name**

  - **Last name**

  - **Status**

  - **HMG Partner ID**: If the HMG Partner ID has not been created, a message indicating that creation is required will be displayed.

[\
]{.mark}![](images/create-dealer-employee-img-6.png){width=5.65in}

HMG Partner ID Not existed

- ![Employee details2](images/employee-details2.png){width=6.79in}

- **Account Email**

- **Business Email**

- **Business Phone**

- **Personal Phone:** If not registered, it is provided as a blank.

- **Language**

- **Age:** Based on the dealer employee\'s birthday information, the age is calculated and displayed on the screen.

- **Genesis Start Date:** Based on the date when Genesis work started, the period worked at Genesis as of today is calculated and displayed.

  - The working period is calculated and displayed with only year and month information.

  - It is calculated as 1 month from the month when work started.

<!-- -->

- **Role & Organization information**

![Employee details3](images/employee-details3.png){width=5.31in}

- **Job title:** Displays the job title assigned to the account.

- **Menu Permission**

  - Displays all menus and permissions assigned to the employee.
