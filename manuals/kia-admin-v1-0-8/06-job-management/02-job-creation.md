---
title: Job Creation
routes: []
sources: []
i18nPrefix: []
---

## Job Creation

![Creating Job](images/creating-job.png){width=4.74in}

**Job Information**

**• Job Title**

- This is a **required field**.

- Must be entered in both **English and French**.

- Maximum length: **20 characters**.

**• Description**

- This is an **optional field**.

- Provides a brief explanation of the job role.

- Maximum length: **50 characters**.

**Menu Permission**

- Only **Active menus** are displayed.

- Displays the permissions that have been configured in the **Menu Management** screen.

- Define the menu permissions to be mapped to the job being created.

- Menu permissions follow a **hierarchical structure**:

  - The **parent menu** must have at least **Access** permission to allow permission assignment to its **child menus**.

  - **Access** permission is required to add **Read** permission.

  - **Read** permission is required to add **Write** permission.

  - The **All** button selects **all available permissions** for that menu.

- Permission options are displayed as **checkboxes**:

  - ![](images/job-creation-img-1.png){width=0.53in} **(Empty)**: Permission can be granted.

  - ![](images/job-creation-img-2.png){width=0.56in} **(Partially enabled)**: Can be granted if the parent permission is assigned.

  - ![](images/job-creation-img-3.png){width=0.56in} **(Checked)**: Permission has been granted.

- Enter keywords in the **search bar** to quickly find a specific menu.

  - The menu's **hierarchy structure** is also visible for context.

![Searching Keywords](images/searching-keywords.png){width=4.51in}

**Quick Link Preset**

- This is a feature that allows administrators to **predefine Quick Links** for each Job.

- When a dealer employee is assigned to a Job for the first time, and there are no existing Quick Links, the preset Quick Links for that Job are automatically applied.

- Editing the preset for a Job does not affect users who already have their own Quick Links.

- If a user loses access permission to a menu, the corresponding Quick Link is automatically removed.

- A tooltip is provided to check the permission requirements for registering a Quick Link.

![Quick Link Preset Management](images/quick-link-preset-management.png){width=6.26in}

- Up to 20 Quick Links can be registered for each Job.

- Clicking the star icon next to a menu adds it to the Quick Link preset.

- ![](images/job-creation-img-4.png){width=0.22in} : Status of being added to quick link

- ![](images/job-creation-img-5.png){width=0.22in} : Status of not being added to quick link

- ![](images/job-creation-img-6.png){width=0.23in height=0.27in} : Status requiring permission to add Quick Link

- Clicking the star icon next to a menu adds it to the Quick Link preset.

- Selected menus are displayed in the Quick Link list on the right side of the screen.

- Clicking the six-dot icon and dragging changes the order of Quick Links.

- When 20 items are already registered, an alert is displayed: "You can add up to 20 items."

- Clicking the star icon again removes the menu from the Quick Link list.

**Import Job**

- A feature that allows you to **copy the permissions** from an existing job.

![Import Job popup](images/import-job-popup.png){width=5.58in}

- The **\[Import Job\]** button on the right allows you to **load the permission list** from an already existing job.

- Select a job and click **\[Import\]** to apply its permissions.

- The Quick Link presets configured for that job are imported together.

- If any job permissions have already been configured on the current screen, they will **not be overwritten** by the import.

Action Buttons

- **\[Create\]**: Creates a new job. A unique **Job Code** will be generated upon creation.

- **\[Cancel\]**: Cancels the creation process. Any entered information will **not be saved**.
