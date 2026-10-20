---
title: Edit Dealer Employee
routes: [/dealer/employee/edit]
sources: []
i18nPrefix: []
---

## Edit Dealer Employee

- Pressing the **\[edit\]** button on the dealer employee view screen takes you to a screen to view the employee information.



![Edit Employee](images/edit-employee-2.png){width=4.2in}



The dealer employee information edit screen is mostly identical to the dealer creation screen.

- The parts that do not match the dealer creation screen are as follows:

- **ID:**

  - **If the ID has already been created:**\
    The ID cannot be modified or deleted.

  - If the user is a multi-dealer user, some information cannot be modified.

    - Name(First, Last Name)/Account email/Language

  - **If the ID has not been created:**\
    A message will appear indicating that the status must be set to Active before creating the ID.



![Create ID](images/create-id.png){width=6.27in}



ID Not existed

- When the **Status** is updated to **Active**, the Existing ID field is enabled.

- You can then choose to create a new ID or link an existing one just like in the initial creation screen.

- If you are creating a new ID, **consent for account creation** is required to proceed with generating the ID.


<!-- -->

- Below the **Basic Information** title, a notice reads: "Once an ID is created, these fields can only be edited by the employee."

- **First Name / Last Name**: Leading and trailing spaces, special characters, and numbers cannot be entered.

- **Picture**: Optional. If no picture is registered, the view screen shows an initials avatar (Latin names: first letters of First Name and Last Name, e.g., Isabel Marant → IM; non-Latin names: first letter of Last Name).

<!-- TODO: 확인 필요 - Dealer Principal은 사진이 필수라는 Jira 요건이 있으나 FO 기획서 필드 표(Picture: N)에는 반영되어 있지 않음 -->

- Account email: Cannot be modified on this screen once registered. The guide text reads "The employee's personal email, used to manage ID and send password reset requests."

<!-- -->

- **Password:** The password item is newly viewed. A **\[reset password\]** button is provided, which can reset the account\'s password.

  - Clicking the **Change Password** button will send a URL link to the registered email address, allowing the user to set a new password.

  - Once the password is successfully updated through the link, the new password will take effect.

- Pressing the **\[cancel\]** button does not save the changes, and pressing the **\[save\]** button applies the changes.
