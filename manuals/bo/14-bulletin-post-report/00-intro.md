---
title: Bulletin Post Report
routes: []
sources: []
i18nPrefix: []
---

![Bulletin Post Report screen](images/bulletin-post-report-screen.png){width=5.87in}

- The **Bulletin Post Report** screen is a Back Office report tool that allows operators to verify whether a **specific post** (important notice / training / announcement-type content) was read by its target audience.

- It helps operators:

  - check the **read rate** for a single post,

  - I dentify **unread users**, and

  - use the result for follow-up communication (e.g., reminders) and operational monitoring.

**Content Info (Search / Post Status)**

- Operators must search by **Post ID** to generate the report.

- Search field:

  - **Post ID (Required / Input)**

- [**\[Search\]** button is enabled after 1 character is entered. Clicking it retrieves post info and **resets the User Report** section.]{.mark}

- Validation / empty state:

  - If an invalid Post ID is entered, a help message is displayed and no result is shown.

![Bulletin Post Report screen- search](images/bulletin-post-report-screen-search.png){width=4.03in}

**Content Info (Result Details)**

- After a successful search, the **Content Info** table displays key post information and exposure status:

  - **Menu Status:** Indicates if the **menu** (including parent menus) is visible on FO.

  - **Bulletin board name**

  - **Post ID / Post Name**

  - **Posting period:** Displayed in the **tenant time zone**.

  - **Post Status:** Indicates if the post is visible based on Display setting and Posting period.

  - **View Rate (%):** Real-time calculated rate ((Read count / Total target users) × 100). If Total target users = 0, displays N/A.

  - **Checked Date:** Timestamp (UTC) when the result was retrieved.

  - [**Deep Link Operator Navigation):** In Content Info, related items (Menu, Board, Post) provide **\[Go to Setting\]** deep links to their respective management screens.]{.mark}

  <!-- -->

  - If the operator has **read permission or higher**, the detail screen opens in a **new tab**.

  - If no permission, an **Access Denied** screen is shown.

![Bulletin Post Report screen- content info](images/bulletin-post-report-screen-content-info.png){width=6.27in}

**User Report (User List for the Selected Post)**

- Displays the user list for the selected post.

  - **1 row = 1 Partner ID (unique user)**.

  - Read status is determined **per user**: if a user read the post in **any affiliated dealership context**, they are marked as **Read = Yes**.

  - Default sorting: **Dealer No ascending**, then **Partner ID ascending**.

  - Pagination follows BO common components.

- **Filters**

  - Filters apply **within the selected post\'s user list**.

  - Filter fields: **Dealer Name**, **HMG Partner ID**, **Read Status** (All/Read/Unread), **Zone**, **District** (enabled after Zone selection).

  - [**\[Search\]** applies filters; **\[Reset\]** restores defaults.]{.mark}

![Bulletin Post Report screen- filters](images/bulletin-post-report-screen-filters.png){width=6.27in}

- **Multi-Dealership Display**

  - For users with multiple dealerships, the User Report shows only **one representative dealership** in the list, based on the current filter context.

  - If a user has additional affiliations, it is summarized as and (n) more, and a modal/popup can be opened to view the full list (sorted by Dealer No ascending).

![Bulletin Post Report screen- user report](images/bulletin-post-report-screen-user-report.png){width=4.88in}

![Bulletin Post Report screen- multi-dealership modal](images/bulletin-post-report-screen-multi-dealership-modal.png){width=4.32in}

- **No-result/ Error Handing**

  - In the following cases, the **User report** area is disabled and only a guide message is shown.

    - If filter result is 0

    - If data loading fails

![No result case example](images/no-result-case-example.png){width=4.46in}
