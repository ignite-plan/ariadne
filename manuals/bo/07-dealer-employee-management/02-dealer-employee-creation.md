---
title: Dealer Employee Creation
routes: []
sources: []
i18nPrefix: []
---

## Dealer Employee Creation

![Creating Dealer Employee](images/creating-dealer-employee.png){width=6.25in}

- This is the screen for creating a new dealer employee account.

- Basic information

<!-- -->

- **Photo**: Optional. Register one photo of the dealer employee.

  - Only jpeg(jpg) and png formats are allowed, and a maximum of 20MB can be registered.

<!-- -->

- **Name:**

<!-- -->

- First name: Required. 20 characters allowed.

- Last name: Required. 20 characters allowed.

- **Status**: Status value of the dealer account.

- Active: Active state.

- If the account is initially set to **Active**, an **HMG Partner ID** can be created.

<!-- -->

- **New Account** option: Used when creating a new HMG Partner ID.

![Status - Active](images/status-active.png){width=6.27in}

- **HMG Partner ID**

<!-- -->

- The ID required to access the **Dealers** service.

- This is a **mandatory field** when the account is initially **Active**.

- Users can **log in to the service** using this ID.

- Must create an account with 5-10 digits combining English letters and numbers.

- Account duplication check is required. If not duplicated, the verify ID button changes to \[Verified\].

- Account creation consent is required.

<!-- -->

- ![](images/dealer-employee-creation-img-1.png){width=5.18in}

Already have an account option

- **Already have an account option:**

  - Select this when the employee already has an HMG Partner ID created as a member of another dealer and you want to add information for affiliation with an additional dealer.

  - Search for the HMG Partner ID previously used by an existing dealer employee.

  - When you click the \[Search\] button next to the input field, a popup window will open. In this popup, you can search for the HMG Partner ID.

![Search existing HMG PartnerID](images/search-existing-hmg-partnerid.png){width=4.63in}

- When you enter and search for the HMG Partner ID you want to link, some user information will be displayed so you can verify if it is the correct user.

<!-- -->

- ![](images/dealer-employee-creation-img-2.png){width=4.60in}

Search Result

- **\[Save\]**: some information for the employee will be imported:

  - Name / Email / Language details

  - If you edit this information, the changes will be applied to all employees sharing the same HMG Partner ID.

  - **\[Cancel**\]: Cancels this action.

- Inactive: Inactive state.

<!-- -->

- ![](images/dealer-employee-creation-img-3.png){width=6.27in}

Status - Inactive

- If the account is initially set to **Inactive**, **HMG Partner ID creation is not allowed**.

<!-- -->

- **Account Email:** Required. The personal email address for managing the employee\'s account.

- If an **HMG Partner ID** is created, a **URL to set the account password** will be sent to the registered account email address.

- If the employee later requests a password reset, a **password setup URL** will be sent to the same email address.

- **Business Phone**: Required. Dealer employee\'s work mobile phone number.

- Country code must be selected from either 1 or 82, with 1 provided as the default value.

- **Personal Phone**: Optional. Enter the dealer employee\'s personal phone number.

- Country code must be selected from either 1 or 82, with 1 provided as the default value.

- **Language:** Required. Value for setting the dealer employee\'s language.

- Determines the language displayed on the user\'s login screen and the emails sent.

- English is selected by default, and you can choose between English and French.

- **Date of Birth**: Optional. The dealer employee\'s birthday information.

- **Hyundai Start Date**: Required. Select the date when the dealer employee started working at Hyundai Motors.

<!-- -->

- Role & Organization information

- Dealer: This is the item for selecting the dealership to which the dealer employee belongs.

  - When you click the \[Search\] button, a popup is created where you can search for the dealership to which the dealer employee will belong.

  - Search by selecting one of Dealer no. or dealer name, then save the dealership information.

- ![](images/dealer-employee-creation-img-4.png){width=6.27in}

Search Dealer Popup

- Business Email: required.

  - The business email address of the employee.

  - If a company\'s email domain is registered for the selected dealer, the available domains are provided as a dropdown for selection.

  - Notification emails for posts published on Dealers will be sent to this email.

- **Job title**: User permissions can be granted through job title.

  - The permissions of the selected **job** are displayed in the **Menu Permission** section below.

<!-- -->

- **Menu Permission**

![Menu Permission](images/menu-permission.png){width=6.27in}

- This section displays the menu-level permissions mapped to the selected job.

- In addition to the permissions granted via the job, individual permissions can also be added manually if necessary.

<!-- -->

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

<!-- -->

- ![](images/dealer-employee-creation-img-5.png){width=0.41in}: Indicates a permission **defined by the job**. It **cannot be modified**.

- ![](images/dealer-employee-creation-img-6.png){width=0.42in}: Indicates that **additional permissions** can be assigned.

- ![](images/dealer-employee-creation-img-7.png){width=0.41in}: Indicates that **a lower-level permission is required** before this can be added.

- ![](images/dealer-employee-creation-img-8.png){width=0.41in}: Indicates a permission that was **manually granted to the individual**. This can be **unchecked** to remove it.

- Action buttons are provided at the bottom.

- Pressing the \[Create\] button at the bottom creates the dealer employee account.

- When a dealer employee account is created with an HMG Partner ID, a welcome invitation email is automatically sent to the registered Account Email.

- ![](images/dealer-employee-creation-img-9.png){width=4.59in}

Welcome invitation email

- Dealer Employee View

![](images/dealer-employee-creation-img-10.png){width=5.04in}

Dealer Employee Detail

From the dealer employee list, you can view detailed information about a dealer employee by clicking on their ID or name.

- If the dealer employee is registered as a **\'dealer principal\'**, a **\'dealer principal\' badge** is displayed at the top.

- If the dealer employee\'s **HMG Partner ID** has not been created, an **\"HMG Partner ID Required\"** badge will be displayed.

<!-- -->

- **Basic information**

  - User No.: A system-generated user number.

    Name: Employee\'s name information is displayed

    First name

    Last name

    Status: The status of the account

    HMG Partner ID

  1.  If not created: The message \"Account creation is required\" will be displayed.

  2.  If created: The ID will be displayed.

  3.  Resend Invitation

  4.  Resends the account activation email to employees who have not completed registration.

  5.  Displayed when the employee has an HMG Partner ID and is in Not Registered status.

  6.  The system checks the employee\'s current registration status via HMG Partner ID.

      - If still Not Registered → requests HMG Notification to resend the email

      - If already Registered → hides the Resend Invitation and Resend Invitation Log buttons.

  7.  Resend Invitation Log

<!-- -->

- Shows a list of successful manual resend attempts only.

- Available only while the employee has not completed registration.

- When the employee completes registration, the Resend Invitation feature and its log are no longer displayed.

  Password:

  Provides a \[Reset Password\] button to reset the password.

  Clicking the corresponding button will send a **URL to set a new password** to the registered email address.

  **Account Email:** Employee\'s email information. The email address linked to the HMG Partner ID.

  Business phone: Employee\'s work phone number

  Personal phone: Employee\'s personal phone number

  Language: Employee\'s language setting value

  Age: Displays the age calculated based on the dealer employee\'s birthday information

  **Hyundai Start Date:** Displays the period calculated based on the date the employee started working at Hyundai up to today.

  The working period is displayed by calculating only the year and month information.

  Calculated as 1 month from the month when employment began.

  1.  **Year of CEO Enrollment:** The year the CEO began working at the dealership. This column is displayed only for the Dealer Principal.

<!-- -->

- **Role & organization information**

  Dealer: The name of the dealership to which the employee belongs is indicated.

  Business Email: The business email address of the employee. Notification emails for posts published on Dealers will be sent to this email.

  Job title: Displays the job title assigned to the account.

- **Menu Permission**

  Displays the menu-level permissions granted through the employee's job assignment as well as any individually added permissions.

  Only the menus and permissions assigned to the employee will be shown.

- **Change History**

  Shows any changes made **after the employee account was created**.

  Clicking the **\[See All Changes\]** button allows you to view the employee's change history.

![Change History Popup](images/change-history-popup-2.png){width=6.27in}

**Change Date**: The date and time when the change occurred.

**Change Info**: The specific field that was updated.

**Change Details**: Detailed information about what was changed.

**Updated By**: The **User ID** of the person who made the change.

If the change was made from the **FO (Front Office)**, the **HMG Partner ID** will be shown.

If the change was made from the **BO (Back Office)**, the **Login ID** will be shown.

- Action buttons are provided at the bottom

  Clicking \[View List\] at the bottom returns to the inquiry screen

  Pressing the \[Edit\] button modifies the employee\'s information

<!-- -->

- Dealer Employee Editing

![Editing Dealer Employee](images/editing-dealer-employee.png){width=6.26in}

When modifying dealer information, the screen displays the fields entered during dealer creation, and most are provided in a form that can be modified.

- If the HMG Partner ID has not been created, changing the status to Active will enable HMG Partner ID creation.

<!-- -->

- ![](images/dealer-employee-creation-img-11.png){width=6.27in}

Initial Active Status applied

- As shown on the creation screen, you can either create a new HMG Partner ID or link a user who already has an existing HMG Partner ID.

- The account creation process will follow the **same flow as in the Dealer Employee Creation** screen.

  - If you link an existing user, the values connected to the HMG Partner ID---such as name, email, and language---will be imported from the other registered account.

  <!-- -->

  - If the user is associated with multiple dealers,

    - editing this information will also update the data for all employees sharing the same HMG Partner ID.

    - Name (First/Last Name)

    - Account Email

    - Language

  <!-- -->

  - When creating a new account

    - Must create an account with 5-10 digits combining English letters and numbers.

- Account duplication check is required. If not duplicated, the verify ID button changes to \[Verified\].

- Account creation is completed only after the user provides consent.

- The \[Reset Password\] function is also available on the Dealer Modification screen.

- **Role & Organization Information**

  - Dealer: You can change the dealer the employee is affiliated with.

    - If the employee is a Dealer Principal, the affiliated dealer cannot be changed.

    - If the dealership affiliation changes, the Business Email must be re-entered.

    - Dealer Principals and Super Admins cannot change their dealership directly. They must modify their Job first to change the dealership information.

  - Job Title: You can change the employee's assigned job.

  <!-- -->

  - If the employee is a Dealer Principal, the role can only be reassigned to another user via the \[Reassign Dealer Principal\] button on the Dealer Management screen.

  - When the job is changed, the Menu Permissions will be reset based on the new job's default permissions.\
    Any previously assigned individual permissions will also be cleared.

- Action buttons are provided at the bottom

  - \[Cancel\] Does not save changes and returns to the previous screen

  - \[Save\] Saves the changes.
