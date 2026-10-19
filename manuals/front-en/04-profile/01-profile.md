---
title: Profile
routes:
  - profile/me
sources: []
i18nPrefix: []
---

## Profile

- This screen shows the logged-in dealer employee's own profile information.

- Click **Profile** in the Account layer (GNB) to open this screen.

![Profile](images/profile-view.png){width=6.27in}


**Header**

- **Picture**: The employee's registered profile photo. If no photo is registered, a default thumbnail is shown.

- **Name**: First Name and Last Name of the employee.

- **Account Email**: The employee's registered account email.

- A dealer principal badge is shown next to the name if the employee is a dealer principal. 

- Click **\[Edit\]** to switch to the edit screen.

**My Profile**

- **ID**: The employee's Partner ID. Shown as "-" if not assigned. 

- **Personal Phone**: The employee's registered personal phone number. Shown as "-" if not registered.

- **Language**: The employee's default language.

- **Age**: Calculated from the registered Date of Birth. Shown as "-" if Date of Birth is not registered.

**Business Profile**

- This information is registered by the dealer administrator and is read-only here.

- **Dealership**: The dealer company the employee currently belongs to. For multi-dealership employees, this reflects the currently active dealer.

- **Business Email**: The business email registered for the employee at this dealer.

- **Business Phone**: The business phone number registered for the employee at this dealer.

**Edit My Profile**

- Click **\[Edit\]** to open the edit screen for personal profile information.



![Edit Profile](images/edit-profile.png){width=6.27in}



- **Picture**

  - Optional. Click the upload area to register a representative photo.

  - Supported formats: JPEG (JPG) or PNG, up to 20MB.

  - If the uploaded file does not meet the format/size requirement, a modal appears: "Supported image formats: JPEG (JPG) or PNG, up to 20MB in size." with an **\[OK\]** button.

- **First Name**: Required. Max 20 characters.

- **Last Name**: Required. Max 20 characters.

- **ID**: Read-only. Cannot be edited. 

- **Account Email**: Required. Max 50 characters. Used for account management, including password reset requests.

  - Validated in real time against email format. If the format is invalid, "Please enter a valid email" is shown inline.

- **Personal Phone**: Optional.

  - Country code: +1 or +82.

  - Up to 15 characters in the number field. Only digits and "-" are allowed.

- **Language**: Required. Select **English** or **French**.

  - If changed and saved, the newly selected language becomes the default and is applied on landing.

- **Date of Birth**: Optional. Placeholder "MM-DD-YYYY". Click to open a date picker.

- **Business Profile**: Read-only. Guide text: "This information is registered by your dealership administrator."

- Click **\[Save\]** to save the changes.

  - The button is enabled only when there is at least one change and all required fields pass validation.

  - If a required field is empty, "Please fill in this field" is shown.

  - On success, the updated information is reflected on screen and an email notification is sent to the employee's Account Email about the changed items. 

  - On failure, a modal appears: Title "Service Unavailable", text "The server is temporarily unable to handle your request. Please try again later.", button **\[Confirm\]**. The edit screen remains open.

- Click **\[Cancel\]** to stop editing.

  - If there are no changes, the screen returns to view mode immediately.

  - If there are changes, a confirmation modal appears: "This will delete all entered content. Are you sure you want to proceed?" with **\[Cancel\]** (stay on the edit screen) and **\[Discard\]** (discard changes and return to view mode).
