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

- You can then choose to create a new ID or link an existing one just like in the initial creation screen.

- If you are creating a new ID, **consent for account creation** is required to proceed with generating the ID.

- The field is labeled **ID** (not "HMG Partner ID"). A tooltip explains: "ID(Account) in this system is managed through hmg-PartnerID. The hmg-PartnerID is a unified account credential system provided by Hyundai Motor Group to business partners and suppliers accessing HMG systems and services."

<!-- -->

- Below the **Basic Information** title, a notice reads: "Once an ID is created, these fields can only be edited by the employee."

<!-- TODO: STG에 반영 범위 밖 변경 보임 - STG 수정 화면의 Basic Information 제목 아래에 안내 문구("Once an ID is created, these fields can only be edited by the employee.")가 보이지 않음 (기획서는 있음, STG 확인 필요) -->

- **First Name / Last Name**: Leading and trailing spaces, special characters, and numbers cannot be entered.

- **Picture**: Optional. If no picture is registered, the view screen shows an initials avatar (Latin names: first letters of First Name and Last Name, e.g., Isabel Marant → IM; non-Latin names: first letter of Last Name).

<!-- TODO: 확인 필요 - Dealer Principal은 사진이 필수라는 Jira 요건이 있으나 FO 기획서 필드 표(Picture: N)에는 반영되어 있지 않음 -->

- Account email: Cannot be modified on this screen once registered. The guide text reads "The employee's personal email, used to manage ID and send password reset requests."

<!-- -->

- **Password:** The password item is newly viewed. A **\[reset password\]** button is provided, which can reset the account\'s password.

  - Clicking the **Change Password** button will send a URL link to the registered email address, allowing the user to set a new password.

  - Once the password is successfully updated through the link, the new password will take effect.

- Pressing the **\[cancel\]** button does not save the changes, and pressing the **\[save\]** button applies the changes.
