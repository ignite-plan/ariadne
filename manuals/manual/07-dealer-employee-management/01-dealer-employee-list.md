---
title: Dealer employee List
routes: []
sources: []
i18nPrefix: []
refreshedFrom:
  - page: "196834759"
    version: 10
  - page: "537137854"
    version: 2
---

## Dealer employee List

- This is a screen where you can view dealer employee information.

- **Clicking \[create new\]** at the top will take you to a screen to create new employee information.

  

![Employee List](images/employee-list.png){width=4.2in}



- You can view the dealer employee list according to employee conditions.

![Employee List - Search Filter](images/employee-list-search-filter.png){width=6.79in}

- The filters are arranged in the order of user information, then dealer information.

- **Text search:** You can search by partial match. Select the search criterion in the select box next to the search field. The default is **User Name**, and the options are **User Name**, **HMG Partner ID**, and **User No.**

- **Status:** Select one status of the user account. All statuses are selected by default.

  - **Active:** Account activated status

  - **Inactive:** Account deactivated status

- **Job title:** Select the job titles assigned to the users. You can select more than one. The list contains all jobs created in Job management, and the placeholder is "Select". Selecting nothing is the same as selecting all. Select **None** to find employees who have no job.

- **Dealer:** Select one or more dealers. Each option is displayed as "dealer name|dealer no", and the placeholder is "Select". Options are sorted by dealer status first (active, Forecasted Appointment, under terminated, inactive, terminated, applicant, rejected applicant) and then alphabetically (a-z).

- **Zone/District:** Search by the Zone/District of the employee's dealership. The Zone list starts with **Unassigned**, followed by the created Zones in order. The District is disabled until a Zone is selected. A selected Zone appears as a chip with its name and an x button, and a selected District appears as "Zone name > District name" (for example, Gyeonggi>Suwon).

- When you type a keyword in a multi-select box, the items that partially match are displayed. Selecting an item selects only that value.

- Conditions are combined with OR within a column and with AND between columns.

- Clicking the **\[search\]** button displays the results of the set conditions. If there are no results, only the message "No results found. Try different search terms or filters." is displayed.

- Clicking the **\[reset\] icon** button clears all filters and resets the list.

<!-- -->

- The dealer employee list is sorted by updated date, with the most recent first. It shows only employees who belong to a dealership and are not in draft status. Account deletion is not provided. The list provides the following information:

  - **User No.:** A unique user number generated sequentially from 1 by the Dealers system.

  - If designated as the dealer principal of the dealership, a dealer principal icon is displayed in the list.\
    ![](images/dealer-employee-list-img-2.png){width=0.28in}

  - **ID:** The user\'s ID. If it has not been created, "-" is displayed.

  - **Name:** Provides first name and last name combined

  - **Job title:** The user\'s permission

  - **Dealer no:** The dealer number of the dealership the employee belongs to.

  - **Dealer name:** The dealer name, displayed in the user's language.

  - **Zone/District:** The Zone/District of the dealership. If none is set, "Unassigned" is displayed.

  - **Updated by:** The user ID of the person who last created or modified the account.

  - **Updated date:** The date when the user\'s account was created or modified, displayed as "MM(alphabet) DD-YYYY". The time zone is fixed as EST.

  - **Status:** The status of the account

  - **Detail:** Clicking the magnifier icon opens the View Dealer Employee screen of that user.

  - An employee with multiple dealerships appears as one row for each dealership.

- By default, 20 items are displayed per page. You can change it to 20, 30, 40, or 50 items. If there are more results than the page size, pagination is displayed.

<!-- TODO: 확인 필요 - 기획서 요약에는 Detail 돋보기로 조회 화면에 진입한다고만 되어 있고, 기존 매뉴얼의 'Partner ID 또는 이름 클릭으로 상세 조회'가 유지되는지 알 수 없음 (STG 로그인 세션 만료로 화면 확인 불가) -->
<!-- TODO: 확인 필요 - 이미지(dealer-employee-list-img-1, employee-list-search-filter)는 Zone/District, Dealer 필터 추가 등 새 구성이 반영되지 않았을 수 있음 (STG 세션 만료로 재캡처 못함) -->
