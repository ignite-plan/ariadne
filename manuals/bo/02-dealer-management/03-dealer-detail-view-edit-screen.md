---
title: Dealer Detail View /Edit Screen
routes:
  - /dealer/company/detail/:id
sources:
  - apps/hyundai-bo/src/pages/Dealer/Company/Detail/**
  - apps/hyundai-bo/src/pages/Dealer/Company/shared/**
i18nPrefix:
  - DEALER_VIEW
---

## Dealer Detail View /Edit Screen

- Clicking \[View Detail\] from the dealer list opens the detailed information screen of the selected dealer.

- Each section of the dealer's information is shown in tabs.

- Each tab can be edited separately depending on the type of information.

![Dealer Detail - Basic Information](images/dealer-detail-basic-information.png){width=5.89in}

- **Dealer basic information**

![Dealer Basic Information1](images/dealer-basic-information1-2.png){width=6.27in}

- **Dealer name**: Internally managed name.

- **DUNS Number:** The DUNS number assigned to the dealer.

- **Company name**: Official name of the dealership.

- **Dealer no.:** Dealer number issued by the Dealers system.

- **Company no**.: Company number issued by HMG Partner.

- **Email**: Email address of the dealership.

- **Company's Email Domain**:

  - Displays the company email domains registered for this dealer.

  - If a default domain is set, it is shown separately above the list.

- **Phone number:** Telephone number of the dealership.

- **Founding date**: Date the dealership was established.

- **Website**: Website of the dealership.

![Dealer Basic Information2](images/dealer-basic-information2-2.png){width=6.27in}

- Location

  - Detailed address is displayed as address line 1, address line 2, and zip/postal code.

  - Clicking \'View on map\' opens a map with the location.

- **Zone/district**: Region where the dealer is assigned.

- **Dealer Distribution Group**: The distribution group to which the dealer belongs.

![Dealer Basic Information3](images/dealer-basic-information3-2.png){width=6.27in}

- **Holding company:** The name of the holding company that the dealer is affiliated with.

- **Dealer category**: Automatically calculated based on business type.

  - 1S: Only General/retail or Agency registered.

  - 2S: Only After service registered.

  - 3S: Both General/retail (or Agency) and After service registered.

<!-- -->

- **Dealer management type**

  - Official dealer or Associate dealer.

- **Dealer type**

  - If management type is \'Official dealer\': Main, Sub, Satellite.

  - If management type is \'Associate dealer\': Authorized Reseller or Authorized Service Partner.

- Status: Status of the dealer.

![Dealer Basic Information4](images/dealer-basic-information4.png){width=6.27in}

- Number of facilities: Number of registered assets.

- Facility Purpose (Count): Number of assets by purpose.

- Facility Type (Count): Number of assets by type.

<!-- -->

- **change History**

![Dealer Change History](images/dealer-change-history.png){width=6.27in}

- This section allows you to view changes made to the **dealer information** after the dealer has been created.

- Clicking the **\[See All Changes\]** button opens a pop-up where you can view a **chronological list of changes**, starting from the most recent.

- Only changes made to the **Basic Info** section and **Dealer Principal** information are recorded and displayed.

![Dealer Change History Detail](images/dealer-change-history-detail.png){width=3.62in}

**Change Date**: The date and time when the change occurred.

**Change Info**: The specific field or item that was modified.

**Change Details**: Displays the value **before** and **after** the change.

**Updated By**: The employee number of the user who made the change.

- **Action buttons**

  - Clicking \'View List\' returns to the dealer list screen.

  - Clicking \'Edit\' switches to the edit mode.

<!-- -->

- **Edit Dealer Management (Basic Info)**

- Clicking the \[edit\] button from the basic info screen switches the view into edit mode.

- ![](images/dealer-detail-view-edit-screen-img-1.png){width=6.27in}

Editing Dealer - Basic Information

- The edit screen provides the same columns as the creation screen and allows new values to be selected.

  Dealer name, company name, company number, DUNS Number and dealer number cannot be modified.

**Dealer Business Information View**

This screen can be accessed by clicking the Business Info tab.

![Dealer Detail - Business Information](images/dealer-detail-business-information.png){width=4.53in}

- **Business information**

![Dealer Details - 2Business case](images/dealer-details-2business-case.png){width=5.03in}

- Business type

  - General/retail

  - After service

  - Agency

- Vehicle type

  - Passenger

  - Commercial

- Product type

  - Finished vehicles

  - Semi-finished

  - CPO

- EV Certification status

  - Certificated

  - Not Certificated

<!-- -->

- Other operating brand

  Brands other than Hyundai currently handled by the dealership

  Business start date

  Start date of this business activity

  Business end date

  End date of this business activity

  If only one business entry is registered, an \[add business\] button appears.

  You can register a new business directly from this screen.

  Each business entry has its own \[edit\] button.

  If a business entry has an edit history, a "change history" column is displayed.

  Clicking \[detail\] opens a popup showing edit history.

![Business Change History](images/business-change-history.png){width=4.82in}

- The popup displays the following information:

<!-- -->

- Updated Date: The date when the change was made.

- Updated By: The employee number of the person who made the change.

- Change: The field or item that was modified.

- Details: Shows the value before and after the change.

  Add New Business

  Clicking \[add business\] generates a new input section at the top of the screen.

  All fields and rules are the same as in the business creation screen (refer to dealer creation screen).

![Adding Business Information](images/adding-business-information.png){width=6.27in}

Clicking \[cancel\] cancels the new entry.

Clicking \[save\] registers the new business information.

**Edit Existing Business**

![Editing Business Information](images/editing-business-information.png){width=6.27in}

- Clicking \[edit\] puts the business entry into editable state.

- Business type cannot be changed.

- Clicking \[save\] applies the changes.

- Clicking \[cancel\] discards the changes and returns to the view screen.

**Facility info**

- When you select \"Facility Info\" in the tab, it moves to the asset information view screen.

![Dealer Detail - Facility Information](images/dealer-detail-facility-information.png){width=4.80in}

- Full Asset Information Map

![Facility Location Map](images/facility-location-map.png){width=6.27in}

- If the asset\'s address information is registered, a map showing the location of all assets is provided at the top.

- Different icons are displayed depending on the facility type

- In order: Showroom, workshop, training center![](images/dealer-detail-view-edit-screen-img-2.png){width=1.74in}

<!-- -->

- When you click on an icon on the map, it provides asset information and an external link icon to move to Google Maps.

- Clicking on the full screen changes the map to full view on the monitor screen.

- Information on all assets

  - Provided in tabs according to facility type

  - Displayed in order of Workshop, showroom, training, and tabs are only provided for facility types that have corresponding assets

  - Registered assets can be opened and closed in accordion form

- Facility information

![Dealer Facility Information1](images/dealer-facility-information1-2.png){width=6.27in}

- Facility purpose

<!-- -->

- Common Assets

- Sales Assets

- Service Assets

<!-- -->

- Facility type

  - Training Center

<!-- -->

- Facility space type column is not provided.

  - Workshop

  <!-- -->

  - Facility space type column is provided.

<!-- -->

- Provides one value corresponding to each item: Customer Lounge, Gate Reception, Repair Shop

  - Standalone

  - Solid-wall

  - Multi-brand

  - None

  <!-- -->

  - Showroom

    - Facility space type column is provided.

  <!-- -->

  - Provides one value corresponding to the item: showroom

  - Solid-wall

  - Multi-brand

  - None

  <!-- -->

  - Facility name: the name of an asset entered in English and French.

  - Ownership status

    - Owned

    - Leased

![Dealer Facility Information2](images/dealer-facility-information2-2.png){width=6.27in}

- Location: Address information of the asset.

- Vehicle type

<!-- -->

- The type of vehicle managed at this asset.

  - Passenger

  - Commercial

<!-- -->

- Opening time: The time when operations begin.

- Closing time: The time when operations end.

- Facility size: The area value of the corresponding asset.

- Photo: Image information of the asset.

- An \[Add Facility\] button is provided at the top, allowing immediate addition of assets when needed.

  - When this button is clicked, a popup is created where one asset can be added.

  - The input fields are the same as the values entered during creation

![Adding New Facility Information](images/adding-new-facility-information.png){width=5.59in}

- Facility Information Modification and Deletion

<!-- -->

- If you need to modify or delete the content of a specific asset, click the \[Delete\] and \[Edit\] buttons at the bottom.

  - At least one **Facility** entry is required, so the **\[Delete\]** button is not available when only one entry remains.

- Once deleted, you cannot restore the deleted content.

- When modifying, only that asset can be modified and the items entered during the original registration are displayed as they were.

- After modification, pressing \[Save\] will apply the changes and return to the inquiry screen.

- Clicking \[Cancel\] will return to the inquiry screen without applying the changes.

**Dealer principal information View**

![Dealer Detail - Dealer Principal](images/dealer-detail-dealer-principal.png){width=6.27in}

**Dealer principal information**

- Clicking the \[See Complete Details\] button allows you to view the Dealer Principal's **detailed information** on the **Dealer Employee Management** screen.

<!-- -->

- User No: The **User Number** of the Dealer Principal.

- Business phone: Work phone number of the representative.

- Name: Name of the dealer representative.

- First name

- Last name

- Language: Language setting of the representative.

- Business email: The business email address of the employee.

- Hyundai Start Date: Displays the period calculated based on the date the representative started working at Hyundai up to today.

  - The working period is displayed by calculating only the year and month information.

  - Calculated as 1 month from the month when employment began.

<!-- -->

- Year of CEO Enrollment: The year the CEO began working at the dealership.

- Status: The account status of the dealer employee.

- HMG Partner ID: The Partner ID of the dealer employee.

  - If no account exists, the message \"No account found\" will be displayed.

- **Change Dealer Principal**:\
  Clicking the **\[Reassign Dealer Principal\]** button next to the **User No.** opens a pop-up where you can change the Dealer Principal.

- ![](images/dealer-detail-view-edit-screen-img-3.png){width=5.65in}

Search User Popup

- The dealer principal can only be selected from among dealer employees belonging to that dealership.

- Enter the user No of the user you want to newly designate and press assign.

- When the **Dealer Principal** is changed, the **job** of the newly assigned Dealer Principal is automatically updated to **Dealer Principal**.

- The **previous Dealer Principal** will have their **status changed to Inactive**, and their **job assignment will be removed**.

- Therefore, if the previous Dealer Principal still needs access to **Dealers**, please review and update their **status and permissions** on the **Dealer Employee Management** screen.

- If you need to update the Dealer Principal's information, click the **\[See Complete Details\]** button and make the changes on the **Dealer Employee Management** screen.

<!-- -->

- Pressing \[View List\] moves to the dealer list screen.

<!-- -->

-
