---
title: Dealer Creation Screen
routes: []
sources: []
i18nPrefix: []
---

## Dealer Creation Screen

- This screen is used to register a new dealer and consists of 4 steps in total.

- You can proceed to the next step without entering all required information, and it is possible to temporarily save the form with only partial information entered.

- During this process, the dealer\'s status becomes \"Draft\", and the dealer will appear in the Dealer List as a draft entry.



![Creating Dealer- Basic Information](images/creating-dealer-basic-information-2.png){width=4.2in}



- Dealer basic information



![Dealer Basic Information1](images/dealer-basic-information1-3.png){width=4.2in}



- **Dealer name**:

  - Required field.
  
  - Internal name used for management purposes.
  
  - Fields available in both English and French.
  
  - Maximum 20 characters per language.

- **Business No.**:

  - Required field.
  
  - Must be an alphanumeric combination (English letters and digits), up to 20 characters.
  
  - Must be unique.

- **Company name**:
  
  - Required field.
  
  - Official name of the dealer company.
  
  - This is the name visible to end users on the front-end.

- **Email**:
  
  - Optional field.
  
  - Email address of the dealer company.

![Company's Email Domain](images/company-s-email-domain.png){width=5.03in}

- **Company's Email Domain**:

  - Optional field, used to manage the dealer\'s **business email domains**.
  
  - Decide whether to use company email domains for this dealer (default: **On**).
  
  - When **On**, register **1--20** domains in **SLD.TLD** format (e.g. canada.ca, max 30 characters) and set **one default**.
  
  - Registered domains are listed; the **default domain** is used in Business Email select boxes for dealer employees.
  
  - When domain usage is turned **Off**, existing domain data is retained and restored when turned back On.

- **Phone number**:

  - Optional field.
  
  - Contact number of the dealer.
  
  - Country code options: 1 (USA/Canada) and 82 (South Korea) are available.

- **Founding date:**

  - Optional field.
  
  - Founding date of the dealer company.

- **Website**:

  - Optional field.
  
  - Official website URL of the dealer.

![Dealer Basic Information2](images/dealer-basic-information2.png){width=6.26in}

**Location**:

  - Optional field.
  
  - Address information of the dealer.
  
  - The address is entered by **searching on Google Maps**.
  
  - Click **\[Search on map\]** to search for the desired address.

![Location popup1](images/location-popup1.png){width=4.99in}

![Location popup2](images/location-popup2.png){width=4.99in}

 - The corresponding location is displayed on Google Maps.
  
  - Select the appropriate address from the search results and save it.
  
  - If additional address details are needed, a popup window will appear where extra information can be entered and saved.
  
  - The entered information is reflected on the screen and can still be edited via the input fields even after it is saved.

- **Zone / District**

  - Optional field.
  
  - Select the Zone and District to which the dealer belongs.
  
  - A District can only be selected after selecting a Zone, as Districts are subordinate to Zones.
  
  - It is also possible to select only a Zone without assigning a District.

- **Dealer Distribution Group**

  - Optional field.
  
  - Select the Dealer Distribution Group(s) the dealer belongs to.
  
  - Multiple groups can be selected.

![Dealer Basic Information3](images/dealer-basic-information3.png){width=6.26in}

- **Holding company**
  
  - Optional field.
  
  - Select the holding company the dealer is affiliated with.
  
  - Only one holding company can be selected.

  - **Dealer management type**
  
  - Required field.
  
  - Select the management type of the dealer.
  
  - Only one of the following two options can be selected:
  
  - Official dealer
  
  - Associate dealer

- **Dealer type**

  - Required field.
  
  - Indicates the type of dealer.
  
  - This field becomes available only after selecting a Dealer management type.
  
  - The options shown in this field will vary depending on the selected management type:

- If **Official dealer** is selected:

  - **Main**

  - **Sub**

  - **Satellite**

- If **Associate dealer** is selected:

  - **Authorized Reseller**

  - **Authorized Service Partner**

- **Status**

  - Indicates the **current status** of the dealer.

  - The status affects service accessibility for users within the dealer organization.

  - **Active**: The dealer is active. Dealer users **can** access and use services.

  - **Inactive**: The dealer is inactive. Dealer users **cannot** use services.

**Action Buttons**

- **\[cancel\]**: Discards all entered information and resets the screen.

- **\[Save Draft\]**: Temporarily saves the information entered so far.

- **\[Next\]**: Moves to the next input screen.

- **Business information**

![Creating Dealer - Business Information](images/creating-dealer-business-information.png){width=6.26in}

- If the dealer management type field has a value on the main dealer screen, the Business Type field in the business information section becomes enabled for selection.

- When you select a Business Type, the remaining required fields will be displayed.

- A minimum of 1 and a maximum of 2 business entries can be added.

- Click the \[add business\] button to add a second set of business information fields.

- If two business entries have already been added, the \[add business\] button will no longer be visible.

- In the creation screen, the second business entry can be deleted.

- However, once the dealer has been created, business information can no longer be deleted.

![Dealer Business Information](images/dealer-business-information.png){width=6.26in}

- **Business type**

- Select one of the following business types:

  - **General/Retail**

  - **After Service**

  - **Agency** *(only available when Dealer management type is "Official dealer" and Dealer type is "Main")*

  - When creating two business entries:

    - If one entry is set as **General/Retail**, the other **cannot** be set as **Agency**.

    - A value already selected in another business entry **cannot be selected again**.

- **Vehicle type**

  - Required

  - Select one or more applicable vehicle types:

      - Passenger
      
      - Commercial

- **Product type**

  - Required

  - **Select one or more product categories:**

    - Finished Vehicles
    
    - Semi-finished
    
    - CPO
    
    - EV

- **EV Certification Status**

  - Required

  - Select the EV certification status:

    - Certificated
    
    - Not Certificated

- **Other Operating Brand**

  - Optional

  - Select other brands currently operated by the dealer. Multiple selections allowed.

- **Business Start Date**

  - Required
  
  - Enter the business operation start date

- **Business End Date**
  
  - Required
  
  - Enter the business operation end date

- **Action Buttons**

  - **\[cancel\]:** clears all input fields
  
  - **\[previous\]:** returns to the previous step without saving current inputs
  
  - **\[Save Draft\]**: Temporarily saves the information entered so far.
  
  - **\[Next\]**: Proceeds to the next input screen.

- **Facility information**

• This is the third step of the dealer creation process\
• Enter information about the assets owned or managed by the dealer

![Creating Dealer - Facility Information entry screen](images/creating-dealer-facility-information-entry-screen.png){width=6.26in}

- The remaining input fields will be displayed only after selecting values for both the Facility Purpose and Facility Type fields.

![Facility Information](images/facility-information.png){width=5.35in}

• Click \[add facility\] at the top to add a new asset\
• Each asset is registered through the "Register New Facility" form

![Dealer Facility Information1](images/dealer-facility-information1.png){width=6.26in}

- **Facility purpose**

  - required
  
  - Select the intended purpose of the facility
  
  - Options are:
  
    - Common Assets
  
    - Sales Assets
  
    - Service Assets

- **Facility type**

  - Required
  
  - Select the facility type
  
  - The next field, facility space type, appears based on this selection

  - Options include:

    - Training Center (no additional options provided)

    - Workshop

- Facility space type (for Customer Lounge, Gate reception, Repair Shop)

  - Required

  - A facility space type field will be generated

  - Select one value for each of the following categories: Customer Lounge, Gate reception, and Repair Shop

    - Standalone
    
    - Solid-wall
    
    - Multi-brand
    
    - None

    - Showroom

- Facility space type (for showroom)

  - Required

  - A facility space type field will be generated

  - Select one value for each of the following categories: Showroom

    - Standalone
    
    - Solid-wall
    
    - Multi-brand
    
    - None

![Dealer Facility Information2](images/dealer-facility-information2.png){width=6.26in}

- **Facility name**

  - Required
  
  - Enter the name of the asset
  
  - Both English and French fields must be filled
  
  - Maximum 20 characters per language

- **Ownership status**

  - required
  
  - Select the ownership type of the asset
  
  - Options are:
  
    - Owned
  
    - Leased

![Dealer Facility Information4](images/dealer-facility-information4.png){width=6.26in}

- **Location**

  - Optional

  - Register the address information of the facility

  - Click \[search on map\] to look up the address using Google Maps

    - Select the appropriate result from the map and save it

    - If there are additional address details, enter them in the popup window

    - The entered address will appear on screen and can be edited directly afterward

- **Facility size**

    - Optional

    - Enter the size of the facility

- **Vehicle type**

    - Optional

    - Select one or more types of vehicles managed at the facility

    - Options are: Passenger, Commercial

- **Opening time**

    - Optional

    - Select the opening time of the facility

- **Closing time**

    - Optional

    - Select the closing time of the facility

- **Photo**

  - Optional
  
  - Upload images of the facility
  
  - Up to 10 images can be uploaded
  
  - Drag and drop images or click the upload area to select files

- **Action Buttons**

  - \[cancel\] clears all entered data
  
  - \[previous\] returns to the previous step
  
  - **\[Save Draft\]**: Temporarily saves the information entered so far.
  
  - **\[Next\]**: Proceeds to the next input screen.

- **Dealer principal information**

- This is the final step of the dealer creation process

- Enter information about the dealer principal of the new dealer


![Creating Dealer - Dealer Principal](images/creating-dealer-dealer-principal-2.png){width=6.27in}


- On this screen, only the essential information for dealer employees, dealer principal is entered. Account creation for accessing Dealers is not performed on this screen.

- Although an account is not created, the employee information is saved.



![Dealer Principal Information](images/dealer-principal-information.png){width=4.2in}




- **Photo**

  - Required.

  - Upload a photo of the dealer principal. Supported formats: JPEG (JPG) or PNG, up to 20MB in size.


- **Name**

  - Required
  
  - First name: Maximum 20 characters
  
  - Last name: Maximum 20 characters

- **Language**

  - Required

  - Select the preferred language for the dealer principal

  - Determines the language shown on login screens and email communications

  - English is selected by default. Options are English and French

- **Business Phone**

  - Required

  - Enter the dealer **principal's work phone number**

  - Select a country code from 1 or 82 (default is 1)

- **Business Email**

  - Required notification email address for the dealer principal.

  - If **Company's Email Domain is enabled** in Dealer Basic Information:
  
    - Business Email is entered as **local-part + domain select box**.
  
    - The **default domain** is preselected. If no default is set, the **first registered domain** is preselected.
  

  - If **Company's Email Domain is disabled**:
  
    - Business Email is provided as a **free-text email field**.
  
    - Email format is validated and up to **50 characters** can be entered.
  
  - When toggling Company's Email Domain usage **during dealer creation**:
  
    - If an existing email contains @ and the local-part length is **20 characters or less**, the local-part is preserved and the domain is reset to the **default** (or first registered) domain.
  
    - If the existing local-part length is **greater than 20 characters**, the local-part is cleared.

![](images/dealer-creation-screen-img-2.png){width=6.26in}



- **Kia Start date**

  - Required

  - Automatically filled with the current date when the dealer principal's employee information is first entered.

- **Year of CEO Enrollment**

  - Required

  - The year the CEO began working at this dealership. This field is to be entered by the Dealer Principal only.

- **Dealer Principal\'s Job Title (not a field on the screen)**

  - Users registered as dealer principals are automatically assigned the job title \'Dealer principal\'.

![Dealer creation consent](images/dealer-creation-consent.png){width=6.26in}

- **Dealer Creation Consent Items**

  - As the final step to create a dealer, consent must be given to register dealer information in HMG Partner.

- **Action Buttons**

  - \[cancel\] clears all entered data
  
  - \[Save Draft\] Saves the currently entered items.
  
  - \[Previous\] returns to the previous screen
  
  - \[Create\] finalizes and creates both the dealer and the dealer principal account

- **Dealer Information Creation Process**

- **When dealer creation fails**

  - If all required information is not entered when creating a dealer: A popup will appear, notifying you of the missing required information and indicating which step is missing the data.

    - **\[Save Draft\]:** Temporarily saves the information entered so far.

    - **\[Review Fields\]:** Returns to the first screen with missing required information. On that screen, any required fields will be highlighted in red.

 ![](images/dealer-creation-screen-img-3.png){width=4.16in align=center}



- **When dealer creation succeeds**



![Dealer Registration Notice](images/dealer-registration-notice-2.png){width=4.2in align=center}


- Once the **dealer creation** is complete, a confirmation message will be displayed, prompting you to proceed with the creation of the **Dealer Principal's HMG Partner ID**.

- Dealer employees must have an **HMG Partner ID** to access the **Dealers** service.

  - Therefore, if immediate access is required after dealer creation, an account should be created right away.

- **\[Maybe Later\]**: Completes the creation of the **dealer** and the **Dealer Principal's information**.

  - The dealer information will be saved and can be viewed in the **Dealer List** screen.

  - The Dealer Principal's information will also be registered under **Dealer Employee Information**.

- \[Create ID\]**: Navigates to the** Dealer Employee Management **screen to create the Dealer Principal's** HMG Partner ID**.**

  - information and Dealer Principal's information have already been successfully saved. Even after navigating to another screen, both the dealer information and Dealer Principal's information have already been successfully saved.
