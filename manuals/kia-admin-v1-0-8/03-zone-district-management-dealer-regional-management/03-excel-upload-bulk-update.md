---
title: Excel Upload (Bulk Update)
routes: []
sources: []
i18nPrefix: []
---

## Excel Upload (Bulk Update)

The Excel Upload (Bulk Update) function allows authorized users to bulk update dealer Zone/District assignments using the official Excel template.

The Upload / Bulk Update button is displayed only to users with write permission.

**How to Upload**

![Upload guide](images/upload-guide.png){width=5.36in}

Click Bulk Update to open the guide modal.

Click Template download and fill in the template.

Click Update and select the completed Excel file.

The system starts processing and shows a **Processing Upload** modal.

![Processing completed](images/processing-completed.png){width=3.84in}

After processing completes, a **Processing Completed** modal displays the result summary.

**File Requirements**

Allowed format: .xlsx only

Maximum size: 20MB

The system validates and reads only these columns from Sheet 1 (must exist in the same column order):

Dealer No.

New Zone Code

New District Code

Sheet 2 is optional (upload works even if Sheet 2 is missing).

**Processing Policy (Key Rules)**

Upload is processed **row-by-row**:

Valid rows are applied.

Invalid rows are skipped (no update for that row).

The uploaded file may contain **only some dealers** (it does not need to include all dealers in the system).

Upload can **only map to existing Zone/District codes** (cannot create or delete Zones/Districts).

**Asynchronous processing**:

Upload continues **even if the user navigates away** from the page.

While one user is uploading, **other users can still perform actions**.

If multiple uploads occur, **the most recently uploaded result is reflected**.

The system checks the following during upload:

**Template structure**: required columns and order must match the official template

**Required fields**: Dealer No / New Zone Code / New District Code must not be empty

**Code validity**: Zone/District codes must exist (including invalid non-numeric input)

**Hierarchy**: the District must be a valid child of the selected Zone

**Result, Error Report, and Log**

Successful rows

Successfully updated rows are saved internally with:

Timestamp, uploaded user ID, dealer no, zone/district code, file name

After upload, the **Updated Date** on the screen is updated to the upload completion time.

Updates are also reflected in **Dealer Management**, and its change history is recorded.

The uploaded file can be downloaded again from **Update Log**.

Failed rows (Error Report)

If any rows fail, the system generates an **Error Report Excel**:

File name: upload_error_list_yyyymmddhhmmss.xlsx (based on completion time, **EST**)

Contains failed **row number** and **failure reason (English)**

The error report can also be downloaded again from **Update Log**.

Log creation

![Updated Log](images/updated-log.png){width=5.56in}

A log entry is created **when processing starts**.

Regardless of success/failure, if processing started, it is stored in **Update Log**.
