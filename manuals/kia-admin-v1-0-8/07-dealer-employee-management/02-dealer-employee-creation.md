---
title: Dealer Employee Creation
routes: []
sources: []
i18nPrefix: []
---

## Dealer Employee Creation

This is the screen for creating a new dealer employee account. ![Creating Dealer Employee](images/creating-dealer-employee.png){width=6.25in}

**Basic Information**

- **Photo**: Optional. Register one photo of the dealer employee.

  - Only jpeg(jpg) and png formats are allowed, and a maximum of 20MB can be registered.

  - Required for the **Dealer Principal**. If not uploaded, the error \"Please upload a photo\" is shown.

  - If no photo is registered, an auto-generated initial avatar is displayed for the employee on the View screen.

- **Name:**

  - First name: Required. 20 characters allowed. Leading/trailing spaces and special characters or digits are not allowed.
  - Last name: Required. 20 characters allowed. Leading/trailing spaces and special characters or digits are not allowed.

- **Language:** Required. Value for setting the dealer employee\'s language.

  - Determines the language displayed on the user\'s login screen and the emails sent.

  - The default is the dealership\'s primary language, and you can choose between the primary and secondary languages (e.g., English and French).

  - If the dealership supports only one language, the select is disabled.

- **Personal Phone**: Optional. Enter the dealer employee\'s personal phone number.

  - Country code must be selected from either +1 or +82, with +1 provided as the default value.

  - Up to 15 characters; only digits and \"-\" are allowed.

- **Date of Birth**: Optional. The dealer employee\'s birthday information. Select it from the calendar (MM-DD-YYYY).

- **Account Email:** Required when creating an ID. Tooltip: \"The employee's personal email, used to manage ID and send password reset requests.\"

  - Up to 50 characters, must include \"@\" and \".\", and the domain must be at least 2 characters.

  - If an **ID** is created, a **URL to set the account password** will be sent to the registered account email address.

  - If the employee later requests a password reset, a **password setup URL** will be sent to the same email address.

  - If the Status is Inactive, the Account Email cannot be entered and the banner \"To proceed, the status field below must be Active\" is displayed.

  - Duplicate values are allowed. For employees of multiple dealerships, changing it is applied to all of them.

- **Account Information**

- **Status**: Required. Select Active or Inactive. An ID can be created only when the status is Active.

- Active: Active state.

- If the account is initially set to **Active**, an **ID** can be created.

- **New Account** option: Used when creating a new ID.

![Status - Active](images/status-active.png){width=6.26in}

- **ID**

  - Tooltip: \"ID(Account) in this system is managed through hmg-PartnerID. The hmg-PartnerID is a unified account credential system provided by Kia Motor Group to business partners and suppliers accessing HMG systems and services.\"
  - The ID required to access the **Dealers** service.
  - This is a **mandatory field** when the account is initially **Active**.
  - Users can **log in to the service** using this ID.
  - Must create an account with 5-40 characters combining English letters and numbers (placeholder: \"English letters and numbers only (5-40 characters)\").
  - Account duplication check is required. Click \[Verify ID\] to check; if the ID is a duplicate, \"This ID is already taken. Please try another ID\" is shown. If not duplicated, the button changes to \[Verified\] and becomes disabled. If you edit the ID afterwards, it returns to \[Verify ID\].
  - Account creation consent is required. If the consent checkbox is not checked, \"Consent is required to create an HMG Partner ID.\" is shown.

![](images/dealer-employee-creation-img-1.png){width=5.18in}

- **Already have an account option:**

  - Select this when the employee already has an ID created as a member of another dealer and you want to add information for affiliation with an additional dealer.

  - Search for the ID previously used by an existing dealer employee.

  - When you click the \[Search\] button next to the input field, the **Search ID** popup window will open. In this popup, enter the ID (placeholder: \"Enter ID\") and search. \[Search\] is enabled only after at least 5 characters are entered.

![Search existing HMG PartnerID](images/search-existing-hmg-partnerid.png){width=4.63in}

- When you enter and search for the ID you want to link, some user information will be displayed so you can verify if it is the correct user.
- ![](images/dealer-employee-creation-img-2.png){width=4.60in}

Search Result

- **\[Save\]**: some information for the employee will be imported:

  - Name / Email / Language details

  - If you edit this information, the changes will be applied to all employees sharing the same ID.

  - **\[Cancel**\]: Cancels this action.

- Inactive: Inactive state.

- ![](images/dealer-employee-creation-img-3.png){width=6.26in}

Status - Inactive

- If the account is initially set to **Inactive**, **ID creation is not allowed**. Only the message \"To proceed, the status must be Active.\" is shown.

- If you change the selection between **New Account** and **Already have an account** after loading an account or clicking \[Verify ID\], the message \"This action will clear all previously entered data. Do you want to continue?\" is shown. Selecting \[Continue\] clears all entered values.

- **Business Information**

- Dealer: This is the item for selecting the dealership to which the dealer employee belongs.

  - When you click the \[Search\] button, a popup is created where you can search for the dealership to which the dealer employee will belong.

  - Search by selecting one of Dealer no. or dealer name, then save the dealership information.

![](images/dealer-employee-creation-img-4.png){width=6.26in}

Search Dealer Popup

- Business Email: required.

  - The business email address of the employee.

  - If a company\'s email domain is registered for the selected dealer, the available domains are provided as a dropdown for selection.

  - Notification emails for posts published on Dealers will be sent to this email.

  - Disabled until a dealer is selected.

  - The same value as the Account Email is allowed. If the email is already used by another person (based on the HMG Partner ID), \"This email address is already registered.\" is shown.

  - When a domain is provided, the default is the default domain set in Dealer Management (or the first registered domain if none is set). The local part allows up to 20 characters. If the domain does not match, \"Please select a new domain to proceed.\" is shown.

  - If you change the Dealer while a Business Email is already entered, the message \"Changing the dealer information will clear the current Business Email address. Do you want to proceed?\" is shown. Selecting proceed clears the email.

- **Business Phone**: Required. Dealer employee\'s work mobile phone number.

  - Country code must be selected from either +1 or +82, with +1 provided as the default value.

  - Up to 15 characters; only digits and \"-\" are allowed.

- **Kia Start Date** (shown as \"{brand} Start Date\"): Required. Select the date when the dealer employee started working at the brand. Today\'s date is automatically entered when the form is first opened, and it can be changed from the calendar. Format: MM-DD-YYYY.

- **Job & Menu Permission**

- **Job title**: User permissions can be granted through job title. Required when the Status is Active, optional when Inactive. Only active jobs from Job management are listed, and Dealer Principal is not listed.

  - If the Dealer Admin limit for the dealer is exceeded, a modal \"{job name} are limited to a maximum of {n} per dealer\" is shown, the Job select turns red and \"This job is unavailable. Choose another one.\" is displayed.

  - Until a job is selected, the 1st-level menus are collapsed and permissions cannot be granted.

  - Changing the job resets all settings.

  - The permissions of the selected **job** are displayed in the **Menu Permission** section below.

- **Menu Permission**

![Menu Permission](images/menu-permission.png){width=6.26in}

- This section displays the menu-level permissions mapped to the selected job.

- In addition to the permissions granted via the job, individual permissions can also be added manually if necessary.

- Permission Descriptions:

  - All: Grants all available permissions for the selected menu at once.

  - Access: Makes the menu visible to the employee.

  - Read: Allows the user to view the bulletin board and read the details within the menu area.

  - Write: Allows the user to create, edit and delete the content.

- How to Grant Permissions

- You must have at least Access permission for a 1st-level menu in order to assign permissions to its 2nd-level menus.

- If a 2nd-level menu has existing permissions, you cannot remove all permissions from its parent 1st-level menu.

- Access permission is required before Read permission can be granted.\
  Similarly, Read permission is required before Write permission can be granted.

- If both Access and Read permissions are granted, you cannot uncheck only Access.

- Unchecking Access will also remove Read permission.

- ![](images/dealer-employee-creation-img-5.png){width=0.41in}: Indicates a permission **defined by the job**. It **cannot be modified**.

- ![](images/dealer-employee-creation-img-6.png){width=0.42in}: Indicates that **additional permissions** can be assigned.

- ![](images/dealer-employee-creation-img-7.png){width=0.41in}: Indicates that **a lower-level permission is required** before this can be added.

- ![](images/dealer-employee-creation-img-8.png){width=0.41in}: Indicates a permission that was **manually granted to the individual**. This can be **unchecked** to remove it.

- Action buttons are provided at the bottom.

- Pressing the \[Create\] button at the bottom creates the dealer employee account.

- When a dealer employee account is created with an ID, a welcome invitation email is automatically sent to the registered Account Email.

- ![](images/dealer-employee-creation-img-9.png){width=4.59in}

Welcome invitation email

- Dealer Employee View

![](images/dealer-employee-creation-img-10.png){width=5.04in}

Dealer Employee Detail

From the dealer employee list, you can view detailed information about a dealer employee by clicking on their ID or name.

- If the dealer employee is registered as a **\'dealer principal\'**, a **\'dealer principal\' badge** is displayed at the top.

- If the dealer employee\'s ID has not been created, an **\"Account Creation is Required\"** badge will be displayed.

- If registering the employee\'s permissions failed, a **\"Job Assignment Needed\"** badge will be displayed.

- **Basic information**

  - User No.: A system-generated user number.

  <!-- -->

  - Name: Employee\'s name information is displayed

    First name

    Last name

    Status: The status of the account

    ID

  1.  If not created: The message \"Account creation is required\" will be displayed.

  2.  If created: The ID will be displayed.

  3.  Resend Invitation

  4.  Resends the account activation email to employees who have not completed registration.

  5.  Displayed when the employee has an ID and is in Not Registered status.

  6.  The system checks the employee\'s current registration status via the ID.

      - If still Not Registered → requests HMG Notification to resend the email

      - If already Registered → hides the Resend Invitation and Resend Invitation Log buttons.

  7.  Resend Invitation Log

- Shows a list of successful manual resend attempts only.

- Available only while the employee has not completed registration.

- When the employee completes registration, the Resend Invitation feature and its log are no longer displayed.

<!-- -->

- Password:

  Provides a \[Reset Password\] button to reset the password.

  Clicking the corresponding button will send a **URL to set a new password** to the registered email address.

  **Account Email:** Employee\'s email information. The email address linked to the HMG Partner ID.

  Business phone: Employee\'s work phone number

  Personal phone: Employee\'s personal phone number

  Language: Employee\'s language setting value

  Last Login: The employee\'s last login date and time. Displayed only on the View screen, and only for employees who have an ID. If there is no login history, \"No Login History\" is shown. If the lookup fails, \"Data is temporarily unavailable.\" is shown.

  Age: Displays the age calculated based on the dealer employee\'s birthday information

  **Kia Start Date:** Displays the period calculated based on the date the employee started working at Kia up to today.

  The working period is displayed by calculating only the year and month information.

  Calculated as 1 month from the month when employment began.

  1.  **Year of CEO Enrollment:** The year the CEO began working at the dealership. This column is displayed only for the Dealer Principal.

<!-- -->

- **Role & organization information**

<!-- -->

- Dealer: The name of the dealership to which the employee belongs is indicated.

  Business Email: The business email address of the employee. Notification emails for posts published on Dealers will be sent to this email.

  Job title: Displays the job title assigned to the account.

<!-- -->

- **Menu Permission**

<!-- -->

- Displays the menu-level permissions granted through the employee's job assignment as well as any individually added permissions.

  Only the menus and permissions assigned to the employee will be shown.

<!-- -->

- **Change History**

<!-- -->

- Shows any changes made **after the employee account was created**.

  Clicking the **\[See All Changes\]** button allows you to view the employee's change history.

![Change History Popup](images/change-history-popup-2.png){width=6.26in}

**Change Date**: The date and time when the change occurred.

**Change Info**: The specific field that was updated.

**Change Details**: Detailed information about what was changed.

**Updated By**: The **User ID** of the person who made the change.

If the change was made from the **FO (Front Office)**, the **HMG Partner ID** will be shown.

If the change was made from the **BO (Back Office)**, the **Login ID** will be shown.

- Action buttons are provided at the bottom

<!-- -->

- Clicking \[View List\] at the bottom returns to the inquiry screen

  Pressing the \[Edit\] button modifies the employee\'s information

<!-- -->

- Dealer Employee Editing

![Editing Dealer Employee](images/editing-dealer-employee.png){width=6.26in}

When modifying dealer information, the screen displays the fields entered during dealer creation, and most are provided in a form that can be modified.

- If the HMG Partner ID has not been created, changing the status to Active will enable HMG Partner ID creation.
- ![](images/dealer-employee-creation-img-11.png){width=6.26in}

Initial Active Status applied

- As shown on the creation screen, you can either create a new HMG Partner ID or link a user who already has an existing HMG Partner ID.

- The account creation process will follow the **same flow as in the Dealer Employee Creation** screen.

  - If you link an existing user, the values connected to the HMG Partner ID---such as name, email, and language---will be imported from the other registered account.

  - If the user is associated with multiple dealers,

    - editing this information will also update the data for all employees sharing the same HMG Partner ID.

    - Name (First/Last Name)

    - Account Email

    - Language

  - When creating a new account

    - Must create an account with 5-40 characters combining English letters and numbers.

- Account duplication check is required. If not duplicated, the verify ID button changes to \[Verified\].

- Account creation is completed only after the user provides consent.

- The \[Reset Password\] function is also available on the Dealer Modification screen.

- **Role & Organization Information**

  - Dealer: You can change the dealer the employee is affiliated with.

    - If the employee is a Dealer Principal, the affiliated dealer cannot be changed.

    - If the dealership affiliation changes, the Business Email must be re-entered.

    - Dealer Principals and Super Admins cannot change their dealership directly. They must modify their Job first to change the dealership information.

  - Job Title: You can change the employee's assigned job.

  - If the employee is a Dealer Principal, the role can only be reassigned to another user via the \[Reassign Dealer Principal\] button on the Dealer Management screen.

  - When the job is changed, the Menu Permissions will be reset based on the new job's default permissions.\
    Any previously assigned individual permissions will also be cleared.

- Action buttons are provided at the bottom

  - \[Cancel\] Does not save changes and returns to the previous screen

  - \[Save\] Saves the changes.
