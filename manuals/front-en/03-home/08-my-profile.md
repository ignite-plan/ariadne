---
title: My Profile
routes: []
sources: []
i18nPrefix: []
---

## My Profile

- This screen shows your personal profile and the business information registered for the dealership you are logged in to. You can edit your personal information here.

- To open it, click the **Account** icon in the GNB and select **My Profile**.

<!-- TODO: 확인 필요 - STG의 Account 패널이 로딩 상태에서 넘어가지 않아 My Profile 진입 메뉴명과 URL을 확인하지 못함. 기획서([202606output][Phase3][FO] Profile 화면)는 "GNB의 이름 옆 화살표 선택 > My profile 선택"으로 기술 -->

<!-- TODO: STG 로그인 후 캡처 필요 (My Profile 조회 화면) -->

**View Mode**

- The screen title is **My Profile**.

- If you are a multi-dealership user, the information is shown for the dealership you are currently logged in to.

- The summary card on the left shows:

  - **Photo**: Your registered photo. If no photo is registered, a default thumbnail is shown.

  - **Name**: Your name in the order First Name, Last Name.

  - **Account Email**: Your registered account email.

  - **Dealer principal badge**: Shown only if you are a dealer principal.

- Click **\[Edit\]** to switch to edit mode.

**My Profile**

- This area shows your personal information.

- **Partner ID**: Your account ID. If no Partner ID exists, "-" is shown.

  <!-- TODO: 확인 필요 - 기획서(Mobile Web Profile 화면)에는 "Partner ID → ID" 문구 변경이 기재됨. 실제 화면 표기 확인 필요 -->

- **Personal Phone**: Your personal phone number.

- **Language**: Your language setting.

- **Age**: Calculated from your date of birth as a full age. If no date of birth is registered, "-" is shown.

**Business Profile**

- This area shows your business information registered by the dealership administrator. You cannot edit it.

- **Dealership**: The dealership you are currently logged in to.

- **Business Email**: The business email registered for the current dealership.

- **Business Phone**: The business phone number registered for the current dealership.

<!-- TODO: 확인 필요 - 최신 기획서에는 Company Overview / Dealer Principal Information 영역의 유지 여부가 명시되지 않음. 기존 GNB 섹션에는 해당 영역이 기술되어 있음 -->

**Edit Mode**

- Click **\[Edit\]** on the view screen to open **Edit My Profile**.

<!-- TODO: STG 로그인 후 캡처 필요 (Edit My Profile 화면) -->

- **Photo**: Your profile photo.

  - Optional.

  - Supported formats: JPEG (JPG) or PNG, up to 20MB.

  - Click the photo area to upload an image file.

  - If a photo is already registered, click the x button to delete it.

  - If the format is not supported or the file is larger than 20MB, a popup shows "Supported image formats: JPEG (JPG) or PNG, up to 20MB in size." Click **\[OK\]** to close it.

- **First Name**: Your first name.

  - Required.

  - Maximum 20 characters. You cannot enter more.

  - Help text: "Max 20 characters".

- **Last Name**: Your last name.

  - Required.

  - Maximum 20 characters. You cannot enter more.

  - Help text: "Max 20 characters".

- **Partner ID**: Read-only.

- **Account Email**: The email used to manage your account.

  - Required.

  - Maximum 50 characters.

  - The email format is checked as you type. If the format is invalid, "Please enter a valid email" is shown below the field.

  - Help text: "This email is used to manage the account, including password reset requests."

- **Personal Phone**: Your personal phone number.

  - Optional.

  - Select a country code, +1 or +82. +1 is selected by default.

  - Up to 15 digits in the text field. Only numbers and "-" are allowed.

- **Language**: Your language.

  - Required.

  - Select English or French.

  - After you save a language change, the new language becomes your default.

  <!-- TODO: 확인 필요 - 기획서(Mobile Web)에는 단일 언어를 지원하는 딜러사는 언어 옵션을 숨긴다고 기재됨. FO(Web) 적용 여부 확인 필요 -->

- **Date of Birth**: Your date of birth.

  - Optional.

  - Placeholder: MM-DD-YYYY.

  - Click the field to open a date picker.

- **Business Profile**: Read-only. The guide text "This information is registered by your dealership administrator." is shown.

**Save and Cancel**

- Click **\[Save\]** to save your changes.

  - The button is enabled only when you have made a change.

  - If a required field is empty, "Please fill in this field" is shown.

  - After saving, your information is updated and shown on the screen.

  - Changes to Account Email, name (First Name, Last Name), and Language are also passed to HMG Partner ID.

  - A notification email about the change is sent to your Account Email. If you changed your Account Email, it is sent to the new address. The email lists only the titles of the changed items, not the details.

  - If saving fails, a "Service Unavailable" popup shows "The server is temporarily unable to handle your request. Please try again later." Click **\[Confirm\]** to close it. You stay on the edit screen.

- Click **\[Cancel\]** to cancel editing.

  - If you have entered values, a confirmation popup shows "This will delete all entered content. Are you sure you want to proceed?"

  - Click **\[Cancel\]** in the popup to close it and stay on the edit screen.

  - Click **\[Discard\]** to delete all entered values and return to the view screen.

  <!-- TODO: 확인 필요 - 값을 변경하지 않고 [Cancel]을 눌렀을 때의 동작 (기획서 Phase3 FO에는 입력값이 있는 경우만 기술. Mobile Web 상세에는 즉시 조회 모드 복귀로 기술) -->

**Change History**

- When you change your profile, the change is logged. The history is not shown on the Front Office. It is available in the change log of employee management in the Back Office. Photo changes are not logged.

- Changes made on mobile are handled the same way.

<!-- TODO: 기획서(202606output Phase3 FO Profile 화면)의 "오픈 버전 (스펙 아웃 예정)" 항목은 조회 전용이라고 기술하고, 같은 문서의 "개인 프로필 조회 및 수정" 항목은 수정 가능으로 기술함. 본 섹션은 수정 가능 항목 기준으로 작성 -->
