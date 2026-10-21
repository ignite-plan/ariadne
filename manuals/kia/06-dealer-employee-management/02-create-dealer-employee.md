---
title: Create Dealer Employee
routes: []
sources: []
i18nPrefix: []
---

## Create Dealer Employee

- Clicking **\[create new\]** at the top of the dealer employee list takes you to a screen to create a dealer employee.

  ![Creating Dealer Employee](images/image-13.png){width=4.2in}

In the **Basic Information** area, enter the user\'s basic information:

  ![Basic Information](images/image-14.png){width=3.4in align=center}

- **First name(Required):** Maximum 20 characters. Leading and trailing spaces, special characters and numbers cannot be entered.

- **Last name(Required):** Maximum 20 characters. The same rules as First name apply.

- **Picture:** Click the picture area and select an image from your computer. A registered picture is displayed as a circle. Click the x button to delete it.

- **Account email(Required when Status is Active):** The employee's personal email, used to manage the ID and send password reset requests. Account-related notifications, such as password resets, are sent to this address.
  - It cannot be entered when the Status is Inactive.
  - If an existing ID is imported, the field is disabled.

- **Personal Phone:** Optional. Enter the user\'s personal phone number (up to 15 digits; numbers and '-' only).

  - Select international number from 1 or 82. 1 is provided as default.

- **Language(Required):** This is a value that sets the language of the dealer employee.

  - It determines the language displayed on the user\'s login screen and the emails sent.

  - English is selected by default. Choose between English and French.

- **Date of Birth:** Optional. Enter the user\'s birthday.

**Account Information**

![Account Information](images/account-information.png){width=4.20in}

- **Status(Required):** Select the status of the dealer employee account.

  - **Inactive**: The user cannot access the service. An ID cannot be created, and the Existing ID and ID fields are replaced by the banner "To proceed, the status must be Active."

- **Active**: Indicates an activated status where the user can access the service. If the initial account status is set to *Active*, an ID can be created.

  - When active, the Existing ID field is enabled.

- **Existing ID**

  - No, Create a new account: Proceeds with creating a new ID.

![Existing ID is No](images/existing-id-is-no.png){width=6.27in}

- Yes, Use existing account: Links to an existing ID.

![Existing ID is Yes](images/existing-id-is-yes.png){width=4.20in}

- **ID :** This is the ID used to log in to the Dealers system. A tooltip on the field explains: "ID(Account) in this system is managed through hmg-PartnerID. The hmg-PartnerID is a unified account credential system provided by Hyundai Motor Group to business partners and suppliers accessing HMG systems and services."

  - An ID can only be created when the account is initially in an **Active** status, and creation is **mandatory** in this case.

    - Create a new account Case

    - Once created, the ID remains valid even if the account status is later changed to **Inactive**.

    - The ID must be between **5 to 40 characters**, using **letters and numbers** only. The field guide reads "English letters and numbers only (5-40 characters)".

    - **A duplicate check** is required. After entering your desired ID, click **\[Verify ID\]** to check for duplicates. The button is disabled until at least 5 characters are entered. If the ID is already in use, the message "This ID is already taken. Please try another ID" is shown.

    - Consent to create the ID is mandatory.

- **Use existing account Case**

- When registering an account with an existing ID as a dealer employee, enter the ID (guide: "Search the ID to confirm and connect the account.") and click the \[Search ID\] button.

- If the account exists, some user information will be displayed in the search results so you can verify the user.

- If the information is correct, click the \[Save\] button to add the employee details.

![Verifying user popup](images/verifying-user-popup.png){width=4.14in}

- If existing ID information is mapped and imported, the following fields cannot be edited

  - Name / Account Email / Language

- If the information is incorrect, click "Reset ID" in the "Need to change? Reset ID" text below the ID field to reset and re-enter the information.

**Business Information**

![Business Information](images/business-information.png){width=4.20in}

- **Business Phone(Required):** Enter the user\'s business phone number.

  - Select international number from 1 or 82. 1 is provided as default.

- **Business Email(Required):** The business email address. If a domain is registered for the dealership, the domain must be selected from the registered domains.

![When domain information is present](images/when-domain-information-is-present.png){width=6.79in}

- **Kia Start date(Required):** Enter the date when the user started working at Kia. The date you open the create screen (the registration date) is entered automatically, and you can select a different date from the calendar.

**Job & Menu Permission** - In the **Job & Menu Permission** section, you can configure the user\'s permissions.

![Job&Menu Permission](images/jobandmenu-permission.png){width=4.20in}

- **Job Title:** Changing the job title resets all menu permission selections. User permissions can be assigned through the selected job title.\
  Once a job is selected for a user, the corresponding menu permissions mapped to that job can be viewed in **the Menu Permission** section.

- If the dealer employee\'s **status** is set to Active, selecting a job is mandatory.\
  If the status is Inactive, assigning a job is optional.

- The **Dealer Admin** job title is shown in the list only when the logged-in user is a Dealer Principal or a Dealer Admin.\

- **Menu Permission**: This section displays the menu-level permissions mapped to the selected job.

- In addition to the permissions granted via the job, individual permissions can also be added manually if necessary.

- **Permission Descriptions:**

  - **All**: Grants all available permissions for the selected menu at once.

  - **Access**: Makes the menu visible to the employee.

  - **Read**: Allows the user to view the bulletin board and read the details within the menu area.



![](images/image-15.png){width=3.4in align=center}


**How to Grant Permissions**

- You must have at least **Access** permission for a **1st-level menu** in order to assign permissions to its **2nd-level menus**.

- If a **2nd-level menu** has existing permissions, you **cannot remove all permissions** from its parent **1st-level menu**.

- **Access** permission is required before **Read** permission can be granted.

- If both **Access** and **Read** permissions are granted, you **cannot uncheck only Access**.

- Unchecking **Access** will also remove **Read** permission.

- ![](images/create-dealer-employee-img-1.png){width=0.41in}: Indicates a permission **defined by the job**. It **cannot be modified**.

- ![](images/create-dealer-employee-img-2.png){width=0.42in}: Indicates that **additional permissions** can be assigned.

- ![](images/create-dealer-employee-img-3.png){width=0.41in}: Indicates that **a lower-level permission is required** before this can be added.

- ![](images/create-dealer-employee-img-4.png){width=0.41in}: Indicates a permission that was **manually granted to the individual**. This can be **unchecked** to remove it.

**Bottom Button & Account Creation Process**

- Clicking the **\[cancel\]** button opens a confirmation message, "This will delete all entered content. Are you sure you want to proceed?". Choosing to discard returns to the previous screen without saving the entered content. Clicking the **\[create\]** button creates a new dealer employee account with the entered content.

- If an **ID** is newly created, an email will be sent to the **registered email address** containing a link to create the account and set a password through the **HMG Partner** system. Using this link, the employee can complete the password setup.

- When a dealer employee account is created with an ID, a welcome invitation email is automatically sent to the registered Account Email.

- When an employee who already has an ID is added as an employee of a dealership and an Employee no. is issued, a "dealership added" notification email is sent to that employee's Account Email.


![Email](images/image-16.png){width=4.2in}
