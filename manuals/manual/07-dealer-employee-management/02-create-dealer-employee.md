---
title: Create Dealer Employee
routes: []
sources: []
i18nPrefix: []
refreshedFrom:
  - page: "196779663"
    version: 142
  - page: "196834759"
    version: 10
  - page: "690988964"
    version: 1
---

## Create Dealer Employee

- Clicking **\[create new\]** at the top of the dealer employee list takes you to a screen to create a dealer employee.



![Create Dealer Employee](images/create-dealer-employee-2.png){width=6.27in}



- In the **Basic information** area, enter the user\'s basic information:





![Employee - Basic Information](images/employee-basic-information-2.png){width=4.2in align=center}


- **First name(Required):** Maximum 20 characters can be entered. Leading and trailing spaces, special characters and numbers are not allowed. The guide text is "First Name (max 20 characters)". If left empty, "Please fill in this field." is displayed.

- **Last name(Required):** Maximum 20 characters can be entered. Leading and trailing spaces, special characters and numbers are not allowed. If left empty, "Please fill in this field." is displayed.

- **Picture:** Optional. One image representing the user can be registered. It is required if the employee is a Dealer Principal.

-  **Account email**(Required when Status is Active): The employee’s personal email, used to manage the ID and send password reset requests. Account-related notifications, such as password resets, are sent to this address.
    - It cannot be entered when the Status is Inactive.
    - If an existing ID is imported, the field is disabled.
      
- 	**Personal Phone**: Optional. Enter the user's personal phone number (up to 15 digits; numbers and ‘-’ only).
    - Select international number from 1 or 82. 1 is provided as default.
- **Language(Required)**: This is a value that sets the language of the dealer employee.
  - It determines the language displayed on the user's login screen and the emails sent.
  - English is selected by default. Choose between English and French.
- **Date of Birth**: Optional. Enter the user's birthday.

**Account Information**



![Account Information](images/account-information.png){width=4.2in}


- **Status(Required):** Select the status of the dealer employee account.

    - **Inactive**: The user cannot access the service. An ID cannot be created, and the Existing ID and ID fields are replaced by the banner “To proceed, the status must be Active.”
  - **Active**: Indicates an activated status where the user can access the service. If the initial account status is set to *Active*, an HMG Partner ID can be created.

  - When active, you can choose between **New Account** and **Already have an account** for the ID.

    - **New Account**: Proceeds with creating a new ID.

    - **Already have an account**: Links to an existing ID.

  - If you change the account type after account information has been loaded or **\[verify id\]** has been done, the modal \"This action will clear all previously entered data. Do you want to continue?\" appears. **\[cancel\]** keeps the current state, and **\[Continue\]** clears all entered values.



![Status - Active case](images/status-active-case.png){width=6.27in}



- **ID:** This is the HMG Partner ID used to log in to the Dealers system. The tooltip reads "ID(Account) in this system is managed through hmg-PartnerID."

  - An HMG Partner ID can only be created when the account is initially in an **Active** status, and creation is **mandatory** in this case.

    - Create a new account Case

    <!-- -->

    - Once created, the ID remains valid even if the account status is later changed to **Inactive**.

    - The ID must be between **5 to 40 characters**, using **English letters (a-z, A-Z) and numbers only.** The placeholder is \"English letters and numbers only (5-40 characters)\".

    - **A duplicate check** is required. After entering your desired ID, click **\[verify id\]** to check the format and duplicates. The button is disabled while fewer than 5 characters are entered.

      - If the ID is already in use, \"This ID is already taken. Please try another ID\" is displayed.

      - If the ID is available, the button changes to a disabled **\[verified\]**. If you edit the text, it returns to **\[verify id\]**.

    - Consent to create the HMG Partner ID is mandatory. Check the consent box: \"I confirm that the personal data has been lawfully collected from users with their proper consent in accordance with applicable laws such as the Personal Information Protection Act and GDPR, and that the users have given prior consent to account creation by an administrator.\"



![Status Active - Create New ID](images/status-active-create-new-id-2.png){width=4.2in}



- Use existing account Case

<!-- -->

- When registering an account with an existing HMG Partner ID as a dealer employee, select **Already have an account** and click the **\[Search\]** button. The \"Search ID\" popup opens.

- Enter the ID in the **ID** field (hint: \"Enter ID\"). The **\[Search\]** button is enabled when 5 or more characters are entered. Click **\[cancel\]** to close the popup.

- If the account exists, \"We found an account that matches your search. Would you like to link this account to the new user profile?\" is displayed with the First/Last name (last 1 character masked with *) and Email (last 2 characters of the local part masked with *) so you can verify the user.

- If the information is correct, click the **\[save\]** button. The name, Account Email and language are loaded and overwrite the entered values, and they can no longer be edited. The toast "User profile added successfully" is displayed. Click **\[cancel\]** to not link the account.

- Other results:

  - No matching account: \"Sorry, no matching accounts were found. Please try searching again\" with **\[close\]**.

  - Error: \"An error has occurred. Please try again.\" with **\[Close\]**.

  - Brand mismatch (Kia vs. Hyundai/Genesis): \"This account cannot be added as an employee\" with **\[close\]**.


![Verifying User popup](images/verifying-user-popup-2.png){width=4.2in}



- If existing HMG Partner ID information is mapped and imported, the following fields are managed together with the HMG Partner ID, and changes are synchronized

  - Name / Account Email / Language

  - In a multi-dealership setup, the policy applies per HMG Partner ID. The User No. is assigned separately for each dealership, and the other items are managed per dealership.



![Reset ID](images/reset-id.png){width=3.4in}


- If the information is incorrect, click \[Reset HMG Partner ID\] below the HMG Partner ID field to reset and re-enter the information.


![Employee - Business Information](images/employee-business-information.png){width=4.2in}

- **Business Phone(Required):** Enter the user\'s business phone number.

  - Select international number from 1 or 82. 1 is provided as default.

 
- **Business Email(Required):** The email address used to receive service notifications. The tooltip reads \"Used for receiving notifications whenever new content is published. Input requires prior confirmation of Dealer.\"

  - It is disabled until a Dealer is selected. The same value as the Account Email can be used, and the format rules are the same.

  - If a domain is registered for the dealership, the domain must be selected from the registered domains. The default is the default domain in dealer management (or the first registered one), and the local part can be up to 20 characters. If no domain is registered, a plain text input is provided.

  - Changing the Dealer clears the Business Email. If a value is entered, the modal \"Changing the dealer information will clear the current Business Email address. Do you want to proceed?\" appears with **\[cancel\]** / **\[proceed\]**.

- ![When domain information is present](images/when-domain-information-is-present.png){width=6.79in}

- **Genesis Start Date(Required):** The date of creation is selected automatically and can be changed from the calendar.

<!-- -->

- In the **Job & Menu Permission** section, you can configure the user\'s permissions.



![Employee- Job & Menu Permission](images/employee-job-and-menu-permission.png){width=4.2in}



- **Job Title:** Changing the job title resets all menu permission selections. User permissions can be assigned through the selected job title.
  - Once a job is selected for a user, the corresponding menu permissions mapped to that job can be viewed in the Menu Permission section.
  - If the dealer employee's status is set to Active, selecting a job is mandatory.
  - If the status is Inactive, assigning a job is optional.
-  The Distributor Admin job title is shown in the list only when the logged-in user is a Dealer Principal or a Distributor Admin.
  
- The number of Dealer Admins per dealer is limited. If the limit is exceeded when you click [Create], an alert is displayed and the Job Title field is marked in red with “This job is unavailable. Choose another one.”
- **Menu Permission**: This section displays the menu-level permissions mapped to the selected job.
- In addition to the permissions granted via the job, individual permissions can also be added manually if necessary.



- **Permission Descriptions:**

  - **All**: Grants all available permissions for the selected menu at once.

  - **Access**: Makes the menu visible to the employee.

  - **Read**: Allows the user to view the bulletin board and read the details within the menu area.



![Employee - Role setting](images/employee-role-setting-2.png){width=4.2in}



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

- Clicking the **\[cancel\]** button returns to the previous screen without saving the entered content.

- Clicking the **\[create\]** button creates a new dealer employee account with the entered content.

- When validation passes, the dealer employee is registered and an HMG Partner ID creation is requested. On success, the screen returns to the list.

- If an ** ID** is newly created, a welcome invitation email is sent immediately to the **Account Email** in the user\'s language with the brand template, containing a link to set a password through the **HMG Partner** system. The link is valid for 12 hours. No new invitation email is sent to an employee who linked an existing ID.


![Welcome invitation email](images/welcome-invitation-email.png){width=4.28in}



**View Dealer Employee**




- You can view the detailed information of an employee by clicking the Partner ID or name area in the dealer employee list.

- If the employee is a dealer principal, a badge saying dealer principal is displayed.

- If an **ID** has not been created, an **\" ID Required\"** badge will be displayed.

- Clicking **\[Reset Password\]** in the upper right will send a link to the registered email address to set a new password.\
  Once the password is changed through the link, the new password will be applied.

- Clicking the **\[Edit\]** button in the upper right navigates to the screen where employee information can be modified.

- Clicking the **\[View List\]** button at the bottom takes you to the **Dealer Employee List** screen.

![View Employee](images/view-employee.png){width=6.27in}


- The dealer employee detail screen provides the following information:

- If a dealer employee photo is registered, it provides the photo. If no photo is registered, an initial avatar is automatically displayed instead.
- **First name**
- **Last name**
- **Account Email**: The employee’s personal email, used to manage ID and send password reset requests.
- **Personal Phone**: If not registered, it is provided as a blank.
-** Language**
- **Age**: Based on the dealer employee's birthday information, the age is calculated and displayed on the screen.
-**User No**.: Once the dealer employee information is registered, a unique employee number is automatically generated and displayed by the Dealers system.
- **Status**
- **ID**: If the ID has not been created, a message indicating that creation is required will be displayed.
- **Business Phone**
- **Business Email**
- **Genesis Start date**: Based on the date when Genesis work started, the period worked at Genesis as of today is calculated and displayed.
  - The working period is calculated and displayed with only year and month information.
- It is calculated as 1 month from the month when work started.
-**Job title**: Displays the job title assigned to the account.
**- Menu Permission**
  - Displays all menus and permissions assigned to the employee.
