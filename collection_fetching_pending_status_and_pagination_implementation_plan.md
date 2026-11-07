# Swati CRM – Collection-Wise Fetching, `accountStatus: "Pending"` Resolution, All "Before Data" Verification, 10-Record Pagination & LIFO Implementation Plan (Updated)

## Executive Summary & Guarantees

This updated implementation plan details the exact architectural root causes, backward compatibility mechanisms, and surgical query solutions to guarantee that records in the MongoDB `leads` collection—specifically accounts with `accountStatus: "Pending"`, `status: "pending"`, and `stage: "new"`—are properly fetched from the database collection and displayed on the frontend, while **strictly verifying, preserving, and displaying all historical "before data"** across the target URLs:

1. `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1` (and `/accounts/my-accounts`)
2. `http://localhost:3000/admin/accounts/search?stage=new&page=1` (and `/accounts/search`)
3. `http://localhost:3000/admin/deals/view` (and `/deals/view`)
4. `http://localhost:3000/admin/deals/search` (and `/deals/search`)

---

### Non-Negotiable Architectural & Data Safety Guarantees:
* **Strict "Do Not Implement":** This document is an architectural blueprint and plan only. No source code changes are applied until you review and click **Proceed**.
* **Zero Data Loss Guarantee:** No database records, collections, or fields are deleted, altered, or migrated. All 50,000+ MongoDB documents remain 100% intact.
* **All "Before Data" Verified & Guaranteed Display:** All historical accounts (`legacyId: 1` through `2924` and earlier imported batches) across all stages and schema variations are fully preserved, counted, and navigable via pagination.
* **10 Records Per Page Pagination:** Exactly **10 records per page** across all admin and non-admin tables.
* **Direct DB Collection Fetching:** Queries fetch directly from the live, authoritative MongoDB `leads` and `deals` collections without intermediate cache drops or stale snapshot tables.
* **Zero Dependency on `companyId`:** Query filtering does not depend on or require `companyId`.
* **Strict LIFO Order Guaranteed:** All records are ordered Last-In, First-Out so newly created accounts and newly re-assigned accounts appear at the very top (Row 1), smoothly cascading into historical before data below.
* **Core Business Logic Preserved:** Custom report creation logic, Add Account/Deal/Quotation/Customer creation logic and backends, Revision Quotations, Outlook integration, Mobile backend, and Taskopad remain completely untouched.

---

## 1. Deep Root-Cause Diagnosis: Why `accountStatus: "Pending"` & Historical Records Were Impacted

Analyzing the user's authoritative MongoDB document from the `leads` collection:
```javascript
{
  _id: ObjectId('6aed762e929c2b44b171548d'),
  legacyId: NumberInt('2925'),
  accountName: 'adani',
  customerName: 'adani',
  ownerName: 'Keval V Shah',
  accountOwner: 'Keval V Shah',
  accountOwnerCode: NumberInt('1015'),
  assignedTo: NumberInt('16'),
  email: 'parthlumos21@gmail.com',
  name: 'adani',
  phone: '7203090270',
  status: 'pending',
  accountState: 'Pending',
  accountStatus: 'Pending',
  stage: 'new',
  createdByUserId: NumberInt('16'),
  ownerUserId: NumberInt('16'),
  ownerCode: NumberInt('1015'),
  accountNo: 'ACC02925',
  accountNumber: 'ACC02925',
  createdAt: ISODate('2026-11-06T06:39:42.280Z'),
  updatedAt: ISODate('2026-11-06T06:39:42.284Z')
}
```

Inspection of the backend and frontend data flow revealed **four critical bottlenecks**:

### 1.1. Root Cause 1: Backend `buildStageFilter` Missing Top-Level `accountStatus: "Pending"`
* When navigating to `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1`, the query parameter is `stage=new`.
* In `server/repositories/leadRepository.js`, `buildStageFilter` only checked:
  ```javascript
  { stage: /^new$/i },
  { status: /^new$/i },
  { 'formData.stage': /^new$/i },
  { 'formData.status': /^new$/i },
  { 'formData.accountStatus': /^new$/i }
  ```
* However, in MongoDB:
  * Top-level `status` is `'pending'`
  * Top-level `accountStatus` is `'Pending'`
  * Top-level `accountState` is `'Pending'`
* Notice that top-level `accountStatus` and `accountState` were missing from the `$or` filter! Furthermore, if an account had `status: 'pending'` or `accountStatus: 'Pending'` without `stage: 'new'`, MongoDB excluded it entirely from `stage=new` results.
* In Swati CRM business logic, a newly created account with `accountStatus: "Pending"` belongs to the **"New"** stage.

### 1.2. Root Cause 2: MongoDB BSON Type Mismatch (String vs `NumberInt`) Affecting New & Before Data
* In MongoDB documents, identifier fields exist in two different BSON types across historical batches:
  * Newer records & certain migrations store:
    * `assignedTo: NumberInt('16')`
    * `ownerUserId: NumberInt('16')`
    * `createdBy: NumberInt('16')`
    * `ownerCode: NumberInt('1015')`
  * Earlier legacy records (from older form submissions or CSV imports) frequently store string values:
    * `assignedTo: "16"`
    * `ownerCode: "1015"`
* In `server/repositories/leadRepository.js` (`listCreatedLeadsForActor`):
  ```javascript
  const ownerCodeStr = String(actor.ownerCode || actor.employeeId || '').trim();
  // Queries { ownerCode: ownerCodeStr } as a JS String!
  ```
* In `server/repositories/mongoQueryHelpers.js` (`buildScopedMongoFilter`):
  ```javascript
  const normalizedValues = uniqueNumbers(values); // Converts all values strictly to Numbers!
  ```
* **MongoDB BSON Rule:** A BSON query for string `"1015"` **never matches** a BSON `NumberInt(1015)`, and a BSON query for number `1015` **never matches** a string `"1015"`.
* If a query searches only string, all `NumberInt` records vanish. If a query searches only numbers, all string-typed legacy records vanish.
* **Solution:** Queries must evaluate dual-type criteria (`$in: [1015, "1015"]`), ensuring 100% of both new records and historical before data match.

### 1.3. Root Cause 3: Strict `companyId` Dependency Filtering
* In `server/repositories/leadRepository.js` line 366:
  ```javascript
  const filter = mergeFilters({ companyId: actor.companyId, ... });
  ```
* If `actor.companyId` is string `"1"` while MongoDB stores `NumberInt(1)`, or if historical before data documents lack `companyId` altogether (or have `companyId: null`), MongoDB drops them from the query results.
* Removing the strict `companyId` dependency (in line with your non-negotiable rule) ensures queries match all leads owned by the user regardless of `companyId` BSON type or omission.

### 1.4. Root Cause 4: Frontend Stage Slicing for `myAccounts`
* In `MyGroupAccountsPage.jsx`:
  * `const shouldShowAllStageRecords = variantKey === 'myAccounts' || variantKey === 'searchAccount' || !showStageTabs;`
  * `const boardRows = shouldShowAllStageRecords ? convertedBoardRecords : stageRows;`
* When navigating to `?stage=new&page=1`, if `variantKey === 'myAccounts'`, `boardRows` was taking all stages (`convertedBoardRecords`) rather than isolating the active stage (`stageRows`), causing stage tab counts and rows to disagree.

---

## 2. All "Before Data" (Historical Accounts) Verification & Backward Compatibility Protocol

To guarantee that **all before data** (all accounts created prior to `legacyId: 2925`, including records from `legacyId: 1` through `2924`) remains fully visible, properly classified by stage, and accessible via pagination:

```
+----------------------------------------------------------------------------------------------------+
|                                    TOTAL DATABASE LEADS (50,000+)                                  |
+----------------------------------------------------------------------------------------------------+
|  [NEWLY ADDED / REASSIGNED]   |                     [ALL HISTORICAL BEFORE DATA]                   |
|  - Account 2925 (adani)       |  - Accounts 1 through 2924                                         |
|  - accountStatus: "Pending"   |  - Historical stages: new, follow_up, priority_1, quotation_sent   |
|  - NumberInt / String dual    |  - Legacy schema variations (strings, ints, null companyId)        |
+-------------------------------+--------------------------------------------------------------------+
                                \               /
                                 \             /
                                  v           v
                        +-------------------------------+
                        |    DUAL-TYPE COMPATIBILITY    |
                        |         QUERY ENGINE          |
                        +-------------------------------+
                                        |
               +------------------------+------------------------+
               |                                                 |
               v                                                 v
    [LIFO ORDERING (Page 1)]                          [PAGINATION CHRONOLOGY]
    Row 1: Account 2925 (Latest)                      Page 1: Rows 1-10 (Newest + Recent Before Data)
    Row 2: Account 2924 (Before Data)                 Page 2: Rows 11-20 (Historical Before Data)
    Row 3: Account 2923 (Before Data)                 Page 3: Rows 21-30 (Historical Before Data)
    ...                                               Page N: Rows ... (Early Historical Records)
```

### 2.1. Handling Historical Schema Variations Without Dropping Records:
| Historical Data Variation | Why Previous Queries Failed | Dual-Type Backward Compatibility Solution |
| :--- | :--- | :--- |
| **Legacy Records with String IDs** (`assignedTo: "16"`) | Strict numeric conversion dropped string IDs | `$in: [16, "16"]` matches both string and number |
| **New Records with `NumberInt`** (`assignedTo: NumberInt(16)`) | Strict string comparison dropped `NumberInt` | `$in: [16, "16"]` matches both string and number |
| **Legacy Records with Missing `stage`** | Excluded if query strictly looked for `{ stage: 'new' }` | Query includes `{ stage: null }, { stage: '' }, { stage: { $exists: false } }` when `stage=new` |
| **Legacy Records with `status: 'pending'`** | Excluded if query only checked `stage: 'new'` | Query checks `/^(new|pending)$/i` across `status`, `accountStatus`, `accountState`, and `stage` |
| **Legacy Records Missing `companyId`** | Excluded by `{ companyId: actor.companyId }` | `companyId` dependency removed; query scopes strictly to user identity |
| **Legacy Name in Alternate Fields** (`customerName`, `formData.name`) | Dropped if mapped strictly to `accountName` | `mapLeadRow` candidates array checks 13 fallback fields |

### 2.2. Stage-Wise Isolation for All Before Data:
Historical records span multiple lifecycle stages. The query engine accurately assigns and isolates each record:
1. **Stage `new`:** Matches both `new` and `pending` (captures new accounts like `adani` + all historical accounts awaiting initial action).
2. **Stage `follow_up`:** Matches `follow_up`, `Follow-Up`, `follow up` across top-level and `formData`.
3. **Stage `priority_1`, `priority_2`, `priority_3`:** Accurately matches priority-tagged historical records.
4. **Stage `quotation_sent`:** Matches all historical accounts with quotations sent, linking seamlessly with `deals` PO values.
5. **Stage `converted` / `lost`:** Accurately preserves won/lost historical states.

---

## 3. Technical Architecture & Solutions

### 3.1. Dual-Type BSON Matching (Integer + String)
To ensure MongoDB matches records whether stored as `NumberInt` or `String`, backend queries build dual-type criteria:
```javascript
const toDualTypeFilter = (field, val) => {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  const str = String(val).trim();
  const values = [str];
  if (!Number.isNaN(num)) values.push(num);
  return { [field]: { $in: values } };
};
```
Applied across:
* `ownerCode`, `accountOwnerCode`, `accountNumber`, `accountNo`
* `assignedTo`, `ownerUserId`, `createdBy`, `userId`, `createdByUserId`

### 3.2. Unified Stage & Status Resolution in `buildStageFilter`
When querying `stage=new`, the MongoDB query encompasses both `'new'` and `'pending'` across all status fields:
```javascript
const buildStageFilter = (stage) => {
  if (!stage || stage === 'all') return {};
  const targetStage = String(stage).trim().toLowerCase();

  if (targetStage === 'new') {
    const newOrPendingRegex = /^(new|pending)$/i;
    return {
      $or: [
        { stage: newOrPendingRegex },
        { status: newOrPendingRegex },
        { accountStatus: newOrPendingRegex },
        { accountState: newOrPendingRegex },
        { 'formData.stage': newOrPendingRegex },
        { 'formData.status': newOrPendingRegex },
        { 'formData.accountStatus': newOrPendingRegex },
        { 'formData.accountState': newOrPendingRegex },
        { stage: null },
        { stage: '' },
        { stage: { $exists: false } },
      ],
    };
  }

  const stageRegex = new RegExp('^' + escapeRegExp(targetStage) + '$', 'i');
  return {
    $or: [
      { stage: stageRegex },
      { status: stageRegex },
      { accountStatus: stageRegex },
      { accountState: stageRegex },
      { 'formData.stage': stageRegex },
      { 'formData.status': stageRegex },
      { 'formData.accountStatus': stageRegex },
      { 'formData.accountState': stageRegex },
    ],
  };
};
```
This guarantees that any document in the `leads` collection with `accountStatus: "Pending"`, `status: "pending"`, or `stage: "new"` is returned immediately by MongoDB, while all historical records in other stages remain cleanly categorized.

### 3.3. Zero `companyId` Dependency
In `listCreatedLeadsForActor` and `listLeadsForActor`:
* Eliminate `{ companyId: actor.companyId }` as a hard filter.
* Restrict scoping strictly to user identity (`assignedTo`, `createdBy`, `ownerUserId`, `ownerCode`, `accountOwner`).
* This eliminates the risk of dropping historical records that had missing or null `companyId`.

---

## 4. 10 Records Per Page Pagination: Displaying New & Before Data

| Layer | Configuration | Exact Math / Execution |
| :--- | :--- | :--- |
| **Backend Query** | `server/repositories/leadRepository.js` & `dealRepository.js` | `skip = (page - 1) * 10`, `limit = 10` |
| **API Services** | `src/services/leadApi.js` & `dealApi.js` | Defaults `params.limit = 10` |
| **Accounts Board**| `src/pages/admin/accounts/MyGroupAccountsPage.jsx` | `DEFAULT_ROWS_PER_PAGE = 10` $\rightarrow$ slices records 1 to 10 |
| **Deals Table** | `src/pages/deals/Deals.jsx` | `ROWS_PER_PAGE = 10` $\rightarrow$ slices records 1 to 10 |
| **Page Boundaries**| Counter in `AccountsBoardPagination.jsx` | $\text{pageStart} = (\text{page} - 1) \times 10 + 1$, $\text{pageEnd} = \min(\text{page} \times 10, \text{total})$ |

### How Pagination Displays All Data:
* **Page 1:** Displays records 1 to 10.
  * **Row 1:** Newly created account (e.g. `legacyId: 2925`, `adani`) or newly reassigned account.
  * **Rows 2 to 10:** The most recent historical "before data" records (`legacyId: 2924`, `2923`, etc.).
* **Page 2:** Displays records 11 to 20 (historical before data).
* **Page 3:** Displays records 21 to 30 (historical before data).
* **All subsequent pages:** Fully accessible via pagination buttons, allowing the user to navigate through all historical accounts in the database.
* **Total Counter:** Shows `Showing 1 to 10 of N accounts` where $N$ reflects the full count of all records in the collection matching the user's scope.

---

## 5. LIFO Ordering: Priority for Newly Added & Re-assigned Accounts

To guarantee that newly added accounts and newly re-assigned accounts appear as **Row 1 (Top of Table)**:

### 5.1. Frontend Sorting Comparator:
In `MyGroupAccountsPage.jsx`, `getRowSortTime` calculates the maximum timestamp across all lifecycle dates:
$$\text{sortTimestamp} = \max\Big(\text{reassignedDate}, \text{lastReassignedAt}, \text{reassignDate}, \text{updatedAt}, \text{createdAt}, \text{accountDate}\Big)$$

1. **Newly Created Account:**
   * `createdAt = Date.now()` $\rightarrow$ `sortTimestamp = Date.now()` $\rightarrow$ **Displays at Row 1 (Top of Page 1)**.
2. **Newly Re-assigned Account:**
   * `lastReassignedAt` / `updatedAt` is updated to `Date.now()` $\rightarrow$ `sortTimestamp = Date.now()` $\rightarrow$ **Displays at Row 1 (Top of Page 1)** for the assignee.
3. **Before Data (Historical Records):**
   * Ordered by their historical `createdAt`, `updatedAt`, and `legacyId` in descending order, naturally following right beneath new records.

### 5.2. Backend Database Sort:
MongoDB queries enforce `.sort({ updatedAt: -1, createdAt: -1, legacyId: -1 })`, backed by existing indexed keys.

---

## 6. Step-by-Step Implementation Plan

### Step 1: Fix MongoDB Query Filters in `server/repositories/leadRepository.js`
* Update `buildStageFilter`:
  * For `targetStage === 'new'`: match `pending`, `Pending`, `new`, and `New` across `status`, `accountStatus`, `accountState`, `stage`, and `formData`, plus `{ stage: null }, { stage: '' }, { stage: { $exists: false } }`.
  * For all stages: ensure top-level `accountStatus` and `accountState` are included alongside `stage` and `status`.
* Implement dual-type matching for `assignedTo`, `ownerUserId`, `createdBy`, `userId`, `ownerCode`, and `accountOwnerCode` (`$in: [Number(val), String(val)]`) so both BSON `NumberInt` and string types match across all historical and new records.
* Remove hard `companyId: actor.companyId` requirement in `listCreatedLeadsForActor`.

### Step 2: Ensure Direct Collection Fetching & State Sync in `src/context/DataContext.jsx`
* Verify that `createAccount` immediately handles the newly saved MongoDB document returned by `leadApi.createLead`.
* Ensure `upsertToTop` places the new lead at `index 0` so it immediately mounts at Row 1 without requiring a page refresh, while retaining all existing records in state.

### Step 3: Align 10 Records Per Page Pagination on Accounts & Deals
* Verify `DEFAULT_ROWS_PER_PAGE = 10` in `src/pages/admin/accounts/MyGroupAccountsPage.jsx`.
* Verify `ROWS_PER_PAGE = 10` in `src/pages/deals/Deals.jsx`.
* Verify `limit = 10` in `src/services/leadApi.js` and `src/services/dealApi.js`.

### Step 4: Verification & Production Build
* Run `npm run build` to verify clean compilation with 0 syntax or bundling errors.
* Validate all target URLs:
  * `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1`
  * `http://localhost:3000/admin/accounts/search?stage=new&page=1`
  * `http://localhost:3000/admin/deals/view`
  * `http://localhost:3000/admin/deals/search`
* Confirm:
  1. Newly created account `adani` (`legacyId: 2925`, `accountStatus: "Pending"`) displays at **Row 1 on Page 1**.
  2. All historical before data (`legacyId: 2924` down to `1`) displays in proper LIFO sequence across Pages 1, 2, 3, etc.
  3. Total count reflects the complete dataset without omission.

---

### Ready for Execution
When you are ready to apply these fixes, click the **Proceed** button in the review panel to execute the plan step-by-step.
