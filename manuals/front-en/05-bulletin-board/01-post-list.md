---
title: Post List
routes: []
sources: []
i18nPrefix: []
---

## Post List

- Posts in the **Post List** are only displayed if the user has the appropriate access permissions for each post.

- If a post without access permission is clicked, a \"No Permission\" pop-up will appear and the content will not be viewable.

- For dealer-affiliated employee profiles, unread posts are displayed in **bold**, while read posts appear in **regular font**, allowing users to distinguish between read and unread posts.

- The post list displays the following required fields: **Post ID**, **Title**, and **Date**.

- Depending on the **Attachments** and **Additional Attribute** settings, list items may also appear in the search area and results.

- Posts may be displayed in the order they were updated in the BO, and any **Field Name** included in the search criteria will also be shown as a column in the list.

- Sorting options are available to organize posts by **Date** (latest to oldest) or **Title** (alphabetical ascending or descending).

- **Default search period (auto setting):** On the post list screen, the Date search condition is automatically initialized when the user enters the screen.

  - The **End date** is automatically set to **today's date (current date)**.

  - The **Start date** is automatically set to **1 year before today's date**.

    - Example) If today is 2026-04-20:

      - Start date: 2025-04-20

      - End date: 2026-04-20

- By default, **20 posts** are displayed, and you can select up to 50 posts to display from the bottom left.

- The post list includes a **pagination** feature that allows you to navigate between page groups using the **\< and \> buttons,** move to the first page using **\<\<,** and move to the last page using **\>\>.**

- Example screen when additional attributes are displayed**:**

![](images/post-list-img-1.png){width=5.17in}

Bulletin boards with additional attributes

**Search with Additional Attributes**

- An example of a search area with additional attributes is as follows:

  - For the **radio button** format, it appears in the search area as shown below, and the initial setting is provided with All selected.

  - You can search by selecting one value with the radio button.

![Search - Radio button](images/search-radio-button.png){width=6.79in}

- For **single/multiple selection dropdown** formats, they appear in the search area like the Tag example below, and the initial setting is provided with All selected.

- When **multiple selection dropdown** items are selected, the selected chip filters are displayed below.

![Search -- Single/Multi selection](images/search-single-multi-selection.png){width=6.79in}

- When selecting an item within a **single selection dropdown**, you can select one value.

![Search -- Single selection dropdown](images/search-single-selection-dropdown.png){width=4.29in}

- When selecting items within a **multiple selection dropdown**, you can select multiple values, and the selected values are displayed in the bottom area of the search filter.

![Search -- Multiple selection dropdown](images/search-multiple-selection-dropdown.png){width=4.43in}

- For Input box (text) type, users can directly enter text to search for values that match the data entered in the corresponding additional attribute Field Name.

![Search - Input box(text)](images/search-input-box-text.png){width=5.45in}

- When a specific field is selected in the dropdown, the selected value is displayed as a **chip filter** at the bottom of the search area, and when **\[Search\]** is clicked with that condition, search results matching the condition are displayed.

![Search - Chip filters](images/search-chip-filters.png){width=6.46in}

**\**

**Post Search Results Area**

- **Total:** The **total number of posts** displayed reflects the user\'s access permissions.

- **Sort by: Date** sorting is based on the post's publication start date --- you can sort from **latest to oldest** or **oldest to latest**. **Title** sorting arranges posts in **alphabetical order** --- ascending (A, B, C \~) or descending (Z, Y, X \~).

  -  **Important Notice:** posts are always displayed at the top of the list above regular posts, followed by the selected sorting order.

  - **New flag**: The **New** flag is automatically applied to new posts according to the tenant configuration.

- **Post ID**: The post ID is displayed.

- **Title:** Clicking on the title takes you to the post detail screen.

  - For important notice posts, they are fixed at the top and a fixed icon is displayed to the left of the title.

  - 

- ![](images/post-list-img-2.png){width=6.79in} 

![Post Search Results Area](images/post-search-results-area.png){width=3.89in}

Post -- Icon/Title/Date/Flag

- **Attachments:** Up to 5 attachments can be displayed.

  - If the attachment filename exceeds the area, you can see the full filename in a tooltip when hovering over the filename.

  - Clicking on the attachment icon and filename displays a preview popup, and watermarks are displayed on each page of PDF files.

  <!-- -->

  - The **watermark text** is displayed according to the following format and rules:

    - **Format**: *Dealer No - User ID (nickname) - Date -- Time*

      - **Example**: 1000-sujee-12/18/2024 9:40:16 AM

    - **Dealer No**: A value assigned when the dealer is created.

    - **User ID**: A value used like the dealer employee's nickname.

    - **Date**: Displayed in *MM/DD/YYYY* format, based on the local time zone.

    - **Time**: Displayed in *HH:MM:SS AM/PM* format, based on the local time zone.

![PDF preview](images/pdf-preview.png){width=3.14in}

- The top left of the popup window displays the filename and extension, and the top right has buttons for full view and close. ![](images/post-list-img-3.png){width=5.31in}

PDF Header Area

- Clicking on icons from the left performs the following actions:\
  ![](images/post-list-img-4.png){width=0.63in} ![](images/post-list-img-5.png){width=0.56in}\
  ![](images/post-list-img-6.png){width=2.33in}![](images/post-list-img-7.png){width=2.63in}\
  **- View settings**: You can set thumbnail preview view/normal page view.\
  ![](images/post-list-img-8.png){width=1.15in}\
  - View current page number/total page number, and view a page by entering the desired page number.\
  ![](images/post-list-img-9.png){width=1.72in}\
  **- Enlarge/Reduce**: You can enlarge or reduce the file by entering the file ratio and clicking the -/+ buttons (minimum 50%, maximum 150%).\
  ![](images/post-list-img-10.png){width=1.03in} ![](images/post-list-img-11.png){width=1.04in}\
  **- Two/Single Page:** You can set two-page view/one-page view.\
  ![](images/post-list-img-12.png){width=0.84in} ![](images/post-list-img-13.png){width=0.65in}\
  **- View:** You can set page height fit/page width fit view.\
  ![](images/post-list-img-14.png){width=0.47in}\
  ![](images/post-list-img-15.png){width=1.22in}\
  **- Page rotation:** You can rotate 90 degrees to the left.\
  ![](images/post-list-img-16.png){width=0.75in}\
  **- Download:** Clicking the download button takes you to the PDF file download page, where you can download the file with watermarks.\
  ![](images/post-list-img-17.png){width=0.56in}\
  - **Print:** Clicking the print button displays the print settings page, allowing you to print the file with watermarks.

<!-- -->

- **Additional Attribute:**

  - Additional attribute values set in the BO are displayed, and values are displayed according to five display formats.

  - **Single selection:** When selecting only one value, one value is shown as below, and it can be displayed by categories such as vehicle model names or engine types.\
    ![](images/post-list-img-18.png){width=1.35in} ![](images/post-list-img-19.png){width=1.01in}

  - **Multiple selection:** When selecting multiple values, multiple values are shown as below, and various characteristics can be listed and displayed.\
    ![](images/post-list-img-20.png){width=2.23in} ![](images/post-list-img-21.png){width=1.67in}

  - **Input box (text):** Displays a single text value entered for the corresponding Field Name. It is mainly used to show the official document number or document ID associated with the post's attachment.\
    ![](images/post-list-img-22.png){width=1.07in} ![](images/post-list-img-23.png){width=1.06in}

  - **Date selection:** Specific date or date + time data can be displayed. This can be used when certain events or notices occur.\
    ![](images/post-list-img-24.png){width=1.25in} ![](images/post-list-img-25.png){width=1.38in}

  - **Period selection:** Period or period + time data can be displayed, and this can be used to inform about specific event periods.\
    ![](images/post-list-img-26.png){width=1.13in} ![](images/post-list-img-27.png){width=1.24in}

- **Date:** The date when the post was published is displayed, following the American date format.\
  ![](images/post-list-img-28.png){width=1.36in}

**\**
