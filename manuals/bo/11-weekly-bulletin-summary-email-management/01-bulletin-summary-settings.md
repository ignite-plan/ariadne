---
title: Bulletin Summary Settings
routes: []
sources: []
i18nPrefix: []
---

## Bulletin Summary Settings

- This feature allows you to configure settings for both Auto Summary and Manual Summary.

- The Manual Summary section is only visible to users with the appropriate permissions.

![Weekly Bulletin Summary Email List - Settings](images/weekly-bulletin-summary-email-list-settings.png){width=6.27in}

- **Auto Summary (Weekly)**:\
  This feature automatically sends a weekly bulletin summary email to designated recipients.\
  When you click **\[Set Schedule\]**, a **Set Schedule** pop-up will appear, allowing you to modify the Auto Summary schedule and Email address.

![Weekly Bulletin Summary Email List -- Auto summary](images/weekly-bulletin-summary-email-list-auto-summary.png){width=4.27in}

- By default, the **Weekly Bulletin Summary** is generated every **Monday at 8:00 AM**.\
  Each summary includes posts from the **previous Monday at 00:00** to **Sunday at 11:59 PM**.

- If the **delivery day** is changed in the **Set Schedule** pop-up, the updated schedule will take effect starting **the following day** (i.e., the new schedule becomes active from the next day).

- **New Scheduled Date**: Displays the next scheduled summary date based on the updated setting.

- **To Email address**: You can enter one or more recipient email addresses.\
  Based on the entered addresses, the bulletin summary email is automatically sent on a weekly basis.

  - When entering multiple email addresses, use a **semicolon (;)** to separate each address.

  - The email address must include **@** and follow a valid format.\
    If any address is invalid, sending will be blocked and an error alert will be shown.

  - A maximum of **10 email addresses** can be entered.\
    Once 10 addresses have been entered, further semicolon inputs will be disabled.

![](images/bulletin-summary-settings-img-1.png){width=4.59in}[\
]{.mark}![](images/bulletin-summary-settings-img-2.png){width=4.59in}

Weekly Bulletin Summary Email List -- Auto summary Set schedule 1

- The currently selected schedule day is displayed, and the delivery **schedule can be changed to any day from Monday to Sunday.**\
  ![](images/bulletin-summary-settings-img-3.png){width=5.09in}

Weekly Bulletin Summary Email List -- Auto summary Set schedule 2

- Manual Summary: You can generate a **Bulletin Summary** by selecting a date range of up to **7 days**.

  - After selecting the period and clicking **\[Generate\]**, the **Bulletin Summary Email** pop-up will appear if the selected range passes validation.

  - When selecting the **start and end dates**, the total number of posts within the selected period will be displayed.

  - If the selected range does **not meet the validation criteria**, the summary cannot be generated.

- **(Default)**: The start and end dates are automatically set to a **3-day range**, ending **one day before today**.

Date Range Conditions:

- **Today's date cannot be selected** --- only past dates are allowed.

- You can select a range of up to **7 days in the past**.

- **Future dates are not allowed**, including today, to prevent exceptions.[\
  ]{.mark} ![](images/bulletin-summary-settings-img-4.png){width=2.21in}

Weekly Bulletin Summary Email List -- Manual summary Data range 1

\[Generate\] Button Activation Conditions

- If the **total number of posts** within the selected date range is **100 or more**, or **zero**, an alert message will be displayed and the **\[Generate\]** button will be **disabled**.\
  ![](images/bulletin-summary-settings-img-5.png){width=4.56in}

Weekly Bulletin Summary Email List -- Manual summary Data range 2

- **Email Send Settings**: Only users with Write permission can send emails.

**\**

**Email Input Rules**

- When entering multiple email addresses, use a **semicolon (;)** to separate each address.

- The email address must include **@** and follow a valid format.\
  If any address is invalid, sending will be blocked and an error alert will be shown.

- A maximum of **10 email addresses** can be entered.\
  Once 10 addresses have been entered, further semicolon inputs will be disabled.

  - ![](images/bulletin-summary-settings-img-6.png){width=3.64in}

Weekly Bulletin Summary Email List -- Email send setting 1

- For users with **Read** permission, only the **Bulletin Summary content area** is displayed.\
  ![](images/bulletin-summary-settings-img-7.png){width=4.01in}

Weekly Bulletin Summary Email List -- Email send setting 2
