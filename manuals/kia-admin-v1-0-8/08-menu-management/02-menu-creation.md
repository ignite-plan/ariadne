---
title: Menu Creation
routes: []
sources: []
i18nPrefix: []
---

## Menu Creation

- Menu creation is only available to users with Write permission.

- Users with permissions can create 1-depth menus through the \[+ Group Addition\] button in the Menu List.

- When hovering over a created menu, you can create sub-menus up to 2-depth through 4-depth.

- When creating a menu, the Menu Detail tab is displayed on the right, where you can enter display properties, Menu Type, basic menu properties, permissions, etc.

- In the Menu Detail screen, you must enter required fields to create a menu.

![Creating Menu](images/creating-menu.png){width=6.26in}

**Menu Display Information**\
![](images/menu-creation-img-1.png){width=6.20in}

Creating Menu -- Display information

- A status banner at the top of the Menu Detail screen shows the current Display setting (On/Off). If the tenant's Mobile Web setting (Tenant Management \> Basic Information) is enabled, the banner shows separate PC and Mobile statuses; if disabled, only the PC status is shown and the Mobile Display setting field below is not displayed.

- **Display setting (Required field)**: A function to set whether the menu is displayed, allowing you to show or hide the menu in the front menu area.

  - **(Default) Enabled**: The menu can be displayed on the front screen, and the Scheduled Display function is activated.

  - **Disabled**: The menu is not displayed on the front screen, and the Scheduled Display function is deactivated. The menu is also shown as disabled in the menu tree.

  - [When creating a menu, switching the Display setting takes effect immediately without a confirmation popup.]{.mark}

  - **Created Date/Created By**: When saving a menu, the date the menu was created and the person who created it are automatically entered.

    - Creation rule: MM DD, YYYY (EST) / ID(employee number)

  - **Updated Date/Updated By**: The date the menu was modified and the person who modified it are automatically entered.

    - Creation rule: MM DD, YYYY (EST) / ID(employee number)

- [**Mobile Display setting (Required field)**: A function to control whether the menu and its sub-menus are displayed on the Mobile Front screen. Only displayed when the tenant's Mobile Web setting is enabled; if the tenant's Mobile Web setting is disabled, this field (and the Mobile status in the banner above) is not shown and only the PC Display setting applies.]{.mark}

<!-- -->

- \-[**(Default) Enabled**: Can be set to Enabled or Disabled while Display setting is Enabled. Guidance message: "Controls menu and submenu visibility on Mobile. Available only when Display Setting is ON.".]{.mark}

  - [**Disabled**: Automatically set to Disabled and cannot be changed while Display setting is Disabled. Guidance message: "Mobile Display Setting is disabled when this is OFF.".]{.mark}

<!-- -->

- **Scheduled Display**: A function to plan scheduled menu exposure by setting a specific future display start date, allowing the menu to be displayed on the front screen from that date. Scheduled Display is only available while Display setting is Enabled; when Display setting is Disabled, Scheduled Display is forced to Disabled and cannot be changed.

  - [**(Default) Disabled:** The scheduled menu exposure function is not used. The menu will appear on the Front screen within approximately 1-2 minutes after saving.]{.mark}

  - [**Enabled:** A Display start date field (date only, format MM/DD/YYYY, EST) is displayed. Only dates from the next day onward can be selected; today and past dates are disabled. The menu becomes visible on the Front screen at 00:00 EST of the selected date. Guidance message: "The menu will become visible on the Front screen at the start of the selected date (00:00 EST).".]{.mark}\
    ![](images/menu-creation-img-2.png){width=1.39in}

Calendar setting

- If the menu is saved without selecting a date, a validation popup "Please enter required information." is displayed.

- If the selected date becomes a past date (midnight boundary), a popup "Scheduled Display is set to a past date. Please adjust it to a future date." is displayed.

- While Scheduled Display is set to Disabled, date validation is skipped.

**Menu Basic Information**

![](images/menu-creation-img-3.png){width=5.31in}

![Creating Menu -- Basic information](images/creating-menu-basic-information.png){width=5.31in}

- **Menu Type (Required field)**: A function that determines the type of the menu. There are 3 menu types in total [(Same Tab, Bulletin board, New Tab)]{.mark}. When changing the menu type, some items will be reset. [Menu name, Menu-board mapping, Domain, and Menu URL are reset, while the Menu Permission List is kept as is.]{.mark}\
  ![](images/menu-creation-img-4.png){width=1.59in}

Menu type

- Domain: A function that specifies which domain the menu operates on. You can select a domain address. The required field input setting for Domain changes according to the Menu type.\
  ![](images/menu-creation-img-5.png){width=2.32in}

Domain dropdown

- Menu URL: A function to enter the actual page address (URL) that will be connected when a user clicks on the menu. The Domain and Menu URL are combined to complete the link. For menus linked to bulletin boards, the bulletin board ID is automatically entered.

  - [**Input rules**: Up to 240 characters. An empty or null value is automatically set to \'/\'. If the value does not start with a leading \'/\', it is automatically corrected to start with \'/\' at the time of **\[Save\]**. Spaces inside the value are allowed. Pasting more than 240 characters shows an immediate inline error "Menu URL Maximum {limit} chars.".]{.mark}

  - Example:

    - Domain: [https://dealers.kia-corp.io](https://dealers.hyundai-corp.io)

    - Menu URL: /board/238\
      ![](images/menu-creation-img-6.png){width=3.04in}

Linking menu-board mapping - Domain and Menu URL

- [**Is this page implemented with DEALERS' Frontend Library?**: A radio button that marks whether the linked page is built with the DEALERS Frontend Library, so the Front GNB/LNB menu can be highlighted accurately. Displayed below Menu URL only when Menu Type is Same Tab or New Tab and a Domain address (not "No selection (Directory)") is selected; not displayed for Bulletin Board menus or when Domain is "No selection (Directory)".]{.mark}

  - [**YES**: The system automatically appends ?menuId={menuId} to the saved Menu URL.]{.mark}

  - [**(Default) NO**: The Menu URL is saved as entered, without the menuId parameter.]{.mark}

- (Default) [Same Tab]{.mark}: When selected, Domain has \"No selection (Directory)\" selected, and Menu name must be entered as required.

  - **Purpose**: Used as a general menu type, can be used as a Directory menu or Link page navigation menu.\
    ![](images/menu-creation-img-7.png){width=3.69in}

Menu type -- [Same Tab]{.mark} information 1

- Menus with \"No selection (directory)\" selected in Domain do not navigate to any screen when clicked. They can be used as directory-purpose menus in a folder open/close format.\
  ![](images/menu-creation-img-8.png){width=3.32in}

Menu type -- [Same Tab]{.mark} information 2(Domain: No selection)

- If you select and save a domain address, clicking the menu on the front screen will navigate to that link address.\
  ![](images/menu-creation-img-9.png){width=3.34in}

Menu type -- [Same Tab]{.mark} information3 (Domain: address)

- Bulletin Board: When selected, the \'Menu-Board Mapping\' function is exposed, Domain becomes a required field, and Menu name, Domain, Menu URL are set to read-only. (Existing values are removed if any.)

  - **Purpose**: Can be used as a Bulletin board menu where posts can be published.\
    ![](images/menu-creation-img-10.png){width=4.17in}

Menu type -- Bulletin board information 1

- Menu-Baord Mapping(Required field): When selecting a bulletin board from the dropdown, Menu name, Domain, and Menu URL are automatically entered according to the selected board information.\
  ![](images/menu-creation-img-11.png){width=2.48in}![](images/menu-creation-img-12.png){width=2.42in}

Menu type -- Bulletin board information 2

- Menus and bulletin boards can be mapped 1:1, and only mappable bulletin boards are displayed in the dropdown. Bulletin boards already linked to menus are not displayed in the dropdown.\
  ![](images/menu-creation-img-13.png){width=4.80in}

Menu type -- Bulletin board information 3

- [New Tab]{.mark}: When selected, Menu name and Domain must be entered as required. An [New Tab]{.mark} guidance message is displayed under Menu type.

  - **Purpose**: Can be used as an External Link menu that opens in a new tab to domain addresses other than Dealers page addresses.

  - Domain becomes a required field, and you can create menus that open in new tabs by selecting addresses registered in Domain.\
    ![](images/menu-creation-img-14.png){width=5.04in}

Menu type -- [New Tab]{.mark} information 1

- Since Domain is a required field, it cannot be saved in \"No selection (Directory)\" state.\
  ![](images/menu-creation-img-15.png){width=3.69in}

Menu type -- [New Tab]{.mark} information 2

- If you select and save an external link address in Domain, clicking the menu on the front screen will open a new tab to that address.\
  ![](images/menu-creation-img-16.png){width=4.50in}

Menu type -- [New Tab]{.mark} information 3

- Domain Setting

![Domain Setting](images/domain-setting.png){width=5.30in}

- The \[Domain setting\] button is only displayed to users with super administrator permissions, allowing them to manage the Domain List.

![Domain Setting -- List view](images/domain-setting-list-view.png){width=3.79in}

- New domains can be added through the \[+Add\] button, and existing domains can be edited/deleted.

- You can click the domain edit button to enter Domain and SSO callback path.

![](images/menu-creation-img-17.png){width=6.26in}![](images/menu-creation-img-18.png){width=6.26in}

Editing Domain Setting

- [**Domain**: Placeholder "e.g., https://example.com", with a character counter (n/100) shown below the input. Validated in order, with an inline error for the first rule that fails:]{.mark}

  - [Required (e.g., "Domain is required.")]{.mark}

  - [Maximum 100 characters (e.g., "Domain Maximum 100 chars.")]{.mark}

  - [Must start with a scheme (\'http://\' or \'https://\')]{.mark}

  - [Must not end with a trailing \'/\']{.mark}

  - [Must not contain spaces]{.mark}

  - [Must be a valid URL format]{.mark}

  - [Must not contain a query string or fragment]{.mark}

  - [Must not duplicate an existing domain]{.mark}

- [**SSO callback path** supports SSO that allows movement to all services with just HMG-admin and Dealers system login. Placeholder "e.g., /sso/callback", with a character counter (n/90) shown below the input.]{.mark}

- [**SSO callback path input rules**: Up to 90 characters can be entered, starting with \'/\'. Leading/trailing spaces are trimmed automatically. An empty or null value is automatically set to \'/\'. Absolute URLs are not allowed, and a trailing \'/\' is not allowed (except when the value is a single \'/\').]{.mark}

- Clicking **\[Save\]** in the Domain Setting popup immediately reflects the change in the Domain List, regardless of whether the menu itself is saved.

![](images/menu-creation-img-19.png){width=6.26in}![](images/menu-creation-img-20.png){width=6.26in}

Creating Menu -- Basic information 2

- Menu Name (Front-end screen) (Required field): Menu name can be entered up to 50 characters in EN and FR. [The languages follow the Primary/Secondary languages set in Tenant Management; for a tenant without a Secondary language, only the Primary language is entered.]{.mark}

- Menu Description (Front-end screen): Menu description displayed on the front screen, can be entered up to 200 characters in EN and FR. [All characters, including special characters, are allowed. The languages follow the same Primary/Secondary setting as Menu Name.]{.mark}

- Menu Description (For Admin Use): Menu description entered by operators for internal management purposes, can be entered up to 300 characters.

**Menu Display Information** ![](images/menu-creation-img-21.png){width=6.26in}

Creating Menu -- Permission List information 1

- Menu Permission List: A function to add/delete and manage permissions for the menu.

- Menu permissions must have higher-level permissions added first before lower-level permissions can be added. (Permission hierarchy: Access \> Read)

- Menu permissions can be added through the Menu permission \[+Add\] button, and can be saved when all required fields are entered.

- [Menu permissions can be added, edited, and deleted regardless of the Domain setting, including for Same Tab menus whose Domain is "No selection (Directory)". Permissions added to a parent Directory menu are used when granting Job Title and User permissions to its sub-menus.]{.mark}

- Permission(Required field): Access, Read can be selected, and duplicates are not allowed.

- Permission Description: You can enter a description of the permission. Up to 200 characters can be entered in EN and FR.

- **Permission Code:** Refers to the permission code automatically issued by the system for each menu upon creation. This field is **read-only** and cannot be modified by operators.

  - **Generation Rule:**

    - Format: M{timestamp}\_{permission type}

    - **Timestamp:** Automatically generated by backend logic at the time of menu permission creation. All permissions belonging to the same menu share the same timestamp.

    - **Permission Type:** Fixed lowercase values --- access, read

  - **Example:**

    - Menu 1: M1232938201_access, M1232938201_read

    - Menu 2: M1232938202_access, M1232938202_read

  - **Uniqueness:** Duplicate codes are not allowed across the entire system. Uniqueness is guaranteed by the system.

  - **Display Policy:** The Permission Code field is not displayed on the Create or List screen. It is only visible on the Edit screen after saving, displayed as read-only for reference purposes.

- ![](images/menu-creation-img-22.png){width=3.08in}

Adding Permission

- You can edit and delete by clicking the Menu permission edit/delete buttons.\
  ![](images/menu-creation-img-23.png){width=6.22in}

Editing and Deleting Menu permissions

- When deleting, if there are Access permissions in sub-menus, permission removal is not possible.

**Menu Save/Cancel**

- **\[Save\]:** When clicked, if required input values are missing, it cannot be saved and a popup corresponding to validity verification is displayed. When the menu is successfully saved, the menu inquiry screen is displayed.

- **\[Cancel\]**: When clicked, if there are changes, an alert is displayed indicating that unsaved changes will be deleted, then the previous screen is displayed.
