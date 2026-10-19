---
title: Edit Dealer Employee
routes: [/dealer/employee/edit]
sources: []
i18nPrefix: []
---

## Edit Dealer Employee

- Pressing the **\[edit\]** button on the dealer employee view screen takes you to a screen to view the employee information.

![Edit Employee](images/edit-employee.png){width=5.24in}

The dealer employee information edit screen is mostly identical to the dealer creation screen.

- The parts that do not match the dealer creation screen are as follows:

- **ID:**

  - **If the ID has already been created:**\
    The ID cannot be modified or deleted.

  - If the user is a multi-dealer user, some information cannot be modified.

    - Name(First, Last Name)/Account email/Language

  - **If the ID has not been created:**\
    A message will appear indicating that the status must be set to Active before creating the ID.

![](images/edit-dealer-employee-img-1.png){width=6.79in}
<!-- TODO: 이미지 갱신 필요 - GIDPDVO-2350 'HMG Partner ID' 라벨이 'ID'로 변경됨 -->

ID Not existed

- When the **Status** is updated to **Active**, the Existing ID field is enabled.

- You can then choose to create a new HMG Partner ID or link an existing one just like in the initial creation screen.

- If you are creating a new HMG Partner ID, **consent for account creation** is required to proceed with generating the HMG Partner ID.

<!-- -->

- Account email: Cannot be modified on this screen once registered.

<!-- -->

- **Password:** The password item is newly viewed. A **\[reset password\]** button is provided, which can reset the account\'s password.

  - Clicking the **Change Password** button will send a URL link to the registered email address, allowing the user to set a new password.

  - Once the password is successfully updated through the link, the new password will take effect.

- Pressing the **\[cancel\]** button does not save the changes, and pressing the **\[save\]** button applies the changes.
