---
title: Bulletin Board Creation
routes: []
sources: []
i18nPrefix: []
---

## Bulletin Board Creation

- Bulletin board creation is only possible for users with Write permission.

- Users with permissions see the **\[New Board\]** button in the bulletin board list view results, and can create a bulletin board through this button.

- On the bulletin board creation screen, you can enter basic Board information at the top, and at the bottom you can enter Post Attribute Settings that specify the attributes of posts.

- Default values are selected in the Post attribute setting.

![Creating Bulletin board](images/creating-bulletin-board.png){width=6.27in}

**\**

**Board Basic Information**

![Creating Bulletin board -- Basic information](images/creating-bulletin-board-basic-information.png){width=6.27in}

- **Board Name (EN, FR Required field):** The bulletin board name can be up to 50 characters.

  - Menu name and Board name are mapped 1:1, and when Board name is mapped to a menu, it is used as the menu name.

  - Duplicate board names are allowed; however, if the board is linked to a menu, it follows the duplication policy at the menu level.

  - When entering a board name, if a duplicate name is entered within the linked menu level, saving will not be possible.

- **Board Description (Admin Use):** The bulletin board description can be up to 200 characters.

**\**

**Post Attribute Setting Information**

- Post Attribute setting is a function that allows you to set the attributes of posts.

![Creating Bulletin board -- Post attribute setting information](images/creating-bulletin-board-post-attribute-setting-information.png){width=6.27in}

- The descriptions of each post attribute information are as follows:

**Posting Period**\
![](images/bulletin-board-creation-img-1.png){width=6.27in}

Creating Bulletin board -- Post attribute setting information1

- **Enabled(Default):** This is a function that allows you to set the posting period for posts, enabling features like scheduled posting.

<!-- -->

- When clicked, you can set the posting period on the post detail page, and the set posting period is displayed in the post list.

<!-- -->

- **Disabled:** When clicked, the posting period cannot be set on the post detail page.

<!-- -->

- When a post is saved, it is immediately displayed and the posting period is set to indefinite (9999-12-31).

- The posting period is displayed in the post list.

**Target Audience**

![Creating Bulletin board -- Post attribute setting information2](images/creating-bulletin-board-post-attribute-setting-information2.png){width=5.69in}

- **Enabled (Default):** This is a function that allows you to post to specific target audiences.

<!-- -->

- When clicked, the target audience setting UI and target audience option (Job title \~District) selection UI are displayed in the post details.

<!-- -->

- Selection boxes are displayed in the post according to the ON/OFF of the target audience options. If you toggle OFF, you cannot set the target audience.

<!-- -->

- **Job title:** Job role (eg. Sales manager, sales staff etc.)

- **Dealer distribution group:** Dealer group

- **Dealer:** Dealership

- **Zone:** The value entered in the dealer area setting, which is the zone to which the dealership belongs.

- **District:** The District value to which the dealership belongs, which is entered in the dealer area setting.

<!-- -->

- **Disabled:** You cannot specify a target audience.

- The target audience option UI is not displayed in the post details.

- If the bulletin board is linked to a menu, posts are displayed to all users who can access the menu.

**Important Notice**

![Creating Bulletin board -- Post attribute setting information3](images/creating-bulletin-board-post-attribute-setting-information3.png){width=4.90in}

- **Enabled (Default):** This is a function that allows you to set important notices.

- The important notice post and important notice posting period setting UI are displayed in the post details, and when the post is saved, it is fixed at the top of the BO/FO posts for the corresponding period.

- **Disabled:** You cannot set important notices.

- The important notice post setting UI is not displayed in the post details.

- If there is an important notice post that has already been set and the attribute value is changed, it can be fixed at the top for the set period.

**Notification**

![Creating Bulletin board -- Post attribute setting information4](images/creating-bulletin-board-post-attribute-setting-information4.png){width=5.31in}

- **Enabled (Default):** This is a function that allows you to set notifications.

- The Notification selection UI is displayed in the post details, and when a post is published with the notification function set, notifications and emails are sent to the target audience through the notification center.

- **Disabled:** You cannot set notifications.

- The Notification selection UI is not displayed in the post details.

**Attachments\**
![](images/bulletin-board-creation-img-2.png){width=4.53in}

Creating Bulletin board -- Post attribute setting information5

- **Enabled (Default):** This is a function that allows you to attach files.

- The attachment UI is displayed in the post details, and the attached file names are displayed in the BO/FO post list.

- **Disabled:** You cannot attach files.

- The attachment UI is not displayed in the post details. If there are already attached files, they remain displayed in the post list.

**Additional Attribute**

- The Additional Attribute function is a feature that allows you to add user-defined input fields when posting on a bulletin board, enabling diverse content classification or use as search criteria.

- Operators can freely create attributes on a per-bulletin board basis and set usage status, required status, search status, etc.

- Additional attribute usage limit: Up to 5 can be used per menu (bulletin board)

![](images/bulletin-board-creation-img-3.png){width=6.27in}

![Creating Bulletin board -- Post attribute setting information6](images/creating-bulletin-board-post-attribute-setting-information6.png){width=6.27in}

- **Enabled:** You can create multiple attributes using Additional attribute.

  - Up to 10 additional attributes can be created per bulletin board, but only up to 5 can be used.

  - When using the added attribute items, the corresponding attribute item UI is displayed in the post details.

- **Disabled (Default):** Additional attribute values cannot be used.

  - The additional attribute UI is not displayed in the post details.

  - If there are previously created attributes, their values are maintained.

- When the \[Add\] button is clicked, the popup below appears, and you can set attributes for creating additional attributes.

- When an Additional attribute is added, the summary information of the added attributes is displayed based on EN/FR as shown below.

![Creating Bulletin board -- Additional attribute setting detail](images/creating-bulletin-board-additional-attribute-setting-detail.png){width=6.27in}

- When you click the language (EN/FR) tab, you can check the attribute items based on each language.

  - **Field Name:** Field name

  - **Display Format:** Shows the selected display format

  - **Display Values:** Shows the entered display values

  - **Usage Status:** Usage status

  - **Detail:** Delete, Edit buttons displayed (refer to modification and deletion conditions below)

**Additional attribute popup**

- The Additional attribute popup title is displayed according to whether the bulletin board name is saved.

- If the bulletin board has been saved and assigned a name, the bulletin board name is displayed.

- When initially created, the Field Name and Display Format are displayed, and additional input fields appear depending on the selected Display Format.

- If the Display Format is changed while values have already been entered in the popup, those values will be reset according to the new Display Format's input requirements.

- The save button is activated when all required values are entered in the additional attribute popup.

![Additional attribute setting pop-up](images/additional-attribute-setting-pop-up.png){width=5.17in}

![](images/bulletin-board-creation-img-4.png){width=2.50in}![](images/bulletin-board-creation-img-5.png){width=2.71in}

Additional attribute setting pop-up - Display format

**Field Name (Required field)**

- Operators can specify user-defined input field names. Field names can be up to 50 characters (including English, French, dashes, and numbers) by language (English, French).

- Field name EN/FR language-specific duplicate check: When entering additional attributes within a bulletin board, duplicate field names cannot be used.

![Additional attribute setting pop-up -- Field name](images/additional-attribute-setting-pop-up-field-name.png){width=5.39in}

**Display Format (Required field)**

- This is a function that allows you to set the input method. You can select from 6 different display formats, and once you specify and save a display format, you cannot modify the format later.

![Additional attribute setting pop-up - Display format 1](images/additional-attribute-setting-pop-up-display-format-1.png){width=5.57in}

- **Single Selection (dropdowns):** Displayed as dropdowns, only one option can be selected

- **Single Selection (radio buttons):** Displayed as radio buttons, only one option can be selected

- **Multi-selection (dropdowns):** Displayed as dropdowns, multiple options can be selected

- **Period (MM-DD-YYYY \~ MM-DD-YYYY):** Displayed as a calendar UI, period selection is possible

- **Date (MM-DD-YYYY):** Displayed as a calendar UI, date selection is possible

- **Input box(text):** Displayed as a text input field where users can directly enter text values.\
  ![](images/bulletin-board-creation-img-6.png){width=4.33in}

Additional attribute setting pop-up -- Display format 2

**Display Values (Required field for dropdowns, radio buttons)**

- This is a function that registers a list of values that users can select. Display values require multilingual input (EN/FR). Display values appear when single/multiple selection is made in the display format.

- Display value can be up to 50 characters (including English, French, dashes, and numbers) by language (English, French).

- **Display values** list EN/FR language-specific duplicate check: Prevents the same Display values from being entered more than once.

- For dropdowns, up to 30 entries are possible; for radio buttons, up to 5 entries are possible.

- Display Values List

- **NO.:** Display Values order

- **En:** Display Values English input field displayed

- **Fr:** Display Values French input field displayed

- **Detail:** Delete, move icons displayed

- Add button displayed in the bottom right

- **Scroll:** Right scroll is created when there are 5 or more Display Values

![Additional attribute setting pop-up -- Display values setting 1](images/additional-attribute-setting-pop-up-display-values-setting-1.png){width=4.97in}

- Example of screen display when there are 5 or more display values (a scroll is created on the right.)\
  ![](images/bulletin-board-creation-img-7.png){width=4.26in}

Additional attribute setting pop-up -- Display values setting 2

- When **the \[+Add\] button** is clicked, EN and FR input field UIs are displayed as a pair at the bottom, and you can add up to 30 for Dropdowns and up to 5 for Radio buttons.

- If a display value is not entered, or if one of the EN or FR values is not entered, an alert message is displayed at the bottom.

- When the delete icon is clicked, deletion is possible without an alert for initial creation.

- However, when modifying a Display value, it cannot affect previously entered values, but you can no longer select pre-modification values in posts, so an alert is displayed.

**Description (Required field for dropdowns)**

- Used as placeholder text and is the text displayed in the BO post select box when dropdown is selected in the display format. ![](images/bulletin-board-creation-img-8.png){width=4.91in}

Additional attribute setting pop-up -- Description

**Usage Status (Required field)**

- **Usage status** can be set On/Off, and a popup appears indicating that selection is not possible when the number of additional attributes in use exceeds 5.

- **When On is clicked**, the Additional attribute field name selection UI is displayed on the BO post writing screen for operators.

- When Usage status is changed to OFF, both Required field and Search filter are changed to OFF.

- **Note:** When Usage status is OFF, the Additional attribute cannot be set in BO Post management and is not displayed in the BO Bulletin board \> List setting area. The value is also not displayed on the FO screen.

![](images/bulletin-board-creation-img-9.png){width=5.42in}

Additional attribute setting pop-up -- Usage status

**Required Field (Required field)**

- Required field (function to check if the additional attribute is a required input value for posts)

- The (Default) value is set to OFF, and ON/OFF settings can be configured.

- Note: When Required field is ON, the Additional attribute value is marked as required (\*) in BO Post management and is also displayed as required in the BO Bulletin board \> List setting area. When Required field is OFF, it can be used as an optional value.![](images/bulletin-board-creation-img-10.png){width=5.14in}

Additional attribute setting pop-up -- Required field

**Search Filter**

- Search filter (function to set the additional attribute as a search filter in the front search area)

- Note: If ON, it is automatically displayed in the front post list, added to the search area, and set as required in the list settings. (Always ON, Read only). When the Search filter for additional attributes is turned OFF, the corresponding additional attribute search filter is not displayed on the front end.

![Additional attribute setting pop-up -- Search filter](images/additional-attribute-setting-pop-up-search-filter.png){width=5.95in}

- Additional attribute popup save and modification policy

- The save button is activated when required values are entered.

**Integrated Search Filter**

- Integrated Search filter (function to set the additional attribute as a search filter in the front integrated search area)

- Note:

  - When set to ON, the field is included in the front-end global search and can be searched.

  - When set to OFF, the field is excluded from the front-end global search.

  - After saving or editing, it may take up to 2 hours for the field to be indexed or excluded from the global search results.

![Additional attribute setting pop-up -- Integrated Search filter](images/additional-attribute-setting-pop-up-integrated-search-filter.png){width=6.16in}

**Additional Attribute View**

- You can view, edit, and delete additional attribute items created in Post Attribute Setting \> Additional Attribute.

- Created additional attributes are displayed when writing posts in the corresponding bulletin board.

- When a post with additional attributes is saved, you can check the additional attributes in the front post list and post details.

- The main information of the created additional attribute items is displayed in the post attribute setting \> Additional Attribute list.

- When the language (EN/FR) tab is clicked, each language standard can be checked

  - Field Name: Field name (Display entered values)

  - Display Format: Shows the selected display format

  - Display Values: Shows the entered display values

  - Usage Status: Usage status

  - Detail: Delete, Edit buttons displayed (refer to modification and deletion conditions below)

  - Example screen when EN tab is clicked

![Additional attribute detail (English tab)](images/additional-attribute-detail-english-tab.png){width=5.97in}

- Example screen when FR tab is clicked

![Additional attribute detail (France tab)](images/additional-attribute-detail-france-tab.png){width=5.99in}

- \[**Edit**\]: When clicked, the additional attribute popup is displayed and non-modifiable items are deactivated (see detailed description below)

- \[**Delete**\]: Cannot be deleted if Usage Status=ON, additional attribute values that have been used in posts cannot be deleted.

**Additional Attribute Modification and Deletion\**
![](images/bulletin-board-creation-img-11.png){width=2.73in}

Editing Additional attribute setting

- Usage status toggle: When ON is clicked, if the number of uses exceeds 5, a popup indicating it is unavailable is displayed

  - **\[Edit**\]: When clicked, the additional attribute popup is displayed and non-modifiable items are deactivated

  - Display Values, Description, Usage Status, Required Field, Search Filter can be modified

  - **Display value**: When modifying, it cannot affect previously entered values, but pre-modification values can no longer be selected in posts.

  - **Post impact**: When modifying/deleting Display value, Display values entered in existing posts remain unchanged, but Display values that can be selected when entering BO posts are modified/deleted.

**Bulletin Board Save/Cancel**

- \[Save\]: When clicked, if required input values are missing, saving is not possible, and a popup corresponding to validity verification is displayed after validity verification.

<!-- -->

- \[Cancel\]: When clicked, if there are changes, an alert is displayed indicating that unsaved changes will be deleted, then the previous screen is displayed

**\**
