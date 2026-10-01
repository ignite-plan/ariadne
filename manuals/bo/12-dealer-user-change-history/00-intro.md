---
title: Dealer User Change History
routes: []
sources: []
i18nPrefix: []
---

![Dealer User change history](images/dealer-user-change-history.png){width=6.27in}

- The Dealer User Change History screen provides a centralized audit log for tracking all changes made to dealer employee information and permissions.

- All change history records are automatically retained for a defined period and then permanently deleted. The retention period depends on the type of change:

  - **User information changes** (e.g., creating, updating, or deleting employee profiles) are kept for **1 year** from the date of the change.

  - **Permission-related changes** (e.g., granting, modifying, or revoking roles and access rights) are kept for **5 years** from the date of the change. This also includes any changes to user status or permission status.

<!-- -->

- When the screen is first opened, only the search area is displayed. The result table is shown only after a search is executed.

- A guidance message is displayed before the first search: \"Please set the search conditions to proceed.\"

**Search Area**

- Multiple conditions are combined with AND logic.

- **Updated By (ID)**

  - Search by the ID of the user who created or updated the employee information.

  - Front Office changes display the HMG Partner ID; Back Office changes display the HMG SSO ID.

- **Updated By (Name)**

  - Search by the name of the user who created or updated the employee information.

- **Search (Keyword)**

  - Search by keyword with partial match applied.

  - Available target fields: Name (default), Partner ID, User No, Dealer

- **Dealer**

  - Search by the dealer of the target employee.

- **Zone / District**

  - Zone and District can be selected.

- **Updated Information**

  - Search by the employee information field where the change occurred.

- **Change Source**

  - Search by the screen where the change occurred.

  - Fixed values: Employee management / Job Management / Menu Management.

- **Change Type**

  - Search by the type of change. Multiple selections allowed.

  - Available values: Creation / Modification / Deletion / Activation / Deactivation.

- **Updated Date**

  - Search by change date in EST. Maximum period: 6 months.

  - Default start date: current date -- 1 day.

- **Buttons**

  - Reset: Clears all search conditions.

  - Search: Executes the search.

**Result Area**

![Result Area](images/result-area.png){width=4.03in}

- Total record count, sort order, records per page, and pagination are displayed above the result table.

- Default sort: Updated date, latest first.

- The table displays one row per field-level change. When multiple fields are updated simultaneously, a separate row is generated per field.

- Table Columns

  - **Updated By (ID):** HMG Partner ID (Front Office) or HMG SSO ID (Back Office).

  - **Updated By (Name):** {First name}{Last name} (Front Office) or HMG SSO registered name (Back Office).

  - **User No.:** Employee number assigned by the dealer.

  - **Partner ID**: HMG Partner ID of the target employee.

  - **Name**: First name Last name.

  - **Dealer**: Dealer Name

  - **Zone / District**: Zone and District of the dealer.

  - **Change Source**: Employee management / Job Management / Menu Management.

  - **Change Type**: Creation / Modification / Deletion / Activation / Deactivation.

    - When a Job is activated or deactivated, the detailed permissions of that Job use the same Change Type.

    - Permission removal or input value removal is treated as Modification.

    - When Dealer Admin / Dealer Principal automatically receive menu access, Change Source is displayed as Employee management.

  - **Before Change / After Change**: Value before and after the change. Displayed as a hyphen (-) if no value exists.

    - Individual menu permissions are displayed as \$Permission name\$-\$Menu name\$.

    - Job names are displayed as hyperlinks. Clicking opens the Job detail screen in a new tab. If the user lacks view permission, a \"no permission\" message is shown.

  - **Updated Date (EST)**: MM-DD-YYYY HH:MM (e.g., Aug-19-2026 23:10).

**\**
