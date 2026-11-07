# Swati CRM – Direct `accountStatus` Collection Display, "Not Quoted" & "Pending" Fidelity, 10-Record Pagination & LIFO Implementation Plan (Updated)

## Executive Summary & Guarantees

This updated implementation plan addresses the exact requirement that the table's **Account Status** column must pick directly from the authoritative MongoDB `leads` collection document:
* When the database collection stores `accountStatus: "Pending"`, the table column displays **"Pending"**.
* When the database collection stores `accountStatus: "Not Quoted"`, the table column displays **"Not Quoted"**.
* When the database collection status is blank or null, the table column displays **"-"** (null/blank).
* Deal-level statuses must **never** overwrite or mutate the account's own `accountStatus`.

This guarantee applies across all four target URLs:
1. `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1` (and `/accounts/my-accounts`)
2. `http://localhost:3000/admin/accounts/search?stage=new&page=1` (and `/accounts/search`)
3. `http://localhost:3000/admin/deals/view` (and `/deals/view`)
4. `http://localhost:3000/admin/deals/search` (and `/deals/search`)

---

### Non-Negotiable Architectural & Data Safety Guarantees:
* **Strict "Do Not Implement":** This document is an architectural blueprint and plan only. No source code changes are applied until you review and click **Proceed**.
* **Zero Data Loss Guarantee:** No database records, collections, or fields are deleted, altered, or migrated. All 50,000+ MongoDB documents remain 100% intact.
* **100% Database Collection Field Fidelity:** The table column directly displays the value of `accountStatus` from the MongoDB document (`row.accountStatus`, `row.formData.accountStatus`, `row.raw.accountStatus`). No deal status or synthetic fallback will overwrite it.
* **10 Records Per Page Pagination:** Exactly **10 records per page** across all admin and non-admin tables.
* **Direct DB Collection Fetching:** Live queries fetch directly from the authoritative MongoDB `leads` and `deals` collections.
* **Zero Dependency on `companyId`:** Query filtering does not depend on or require `companyId`.
* **Strict LIFO Order Guaranteed:** All records are ordered Last-In, First-Out so newly created accounts and newly re-assigned accounts appear at the very top (Row 1).
* **Core Business Logic Preserved:** Custom report creation logic, Add Account/Deal/Quotation/Customer creation logic and backends, Revision Quotations, Outlook integration, Mobile backend, and Taskopad remain completely untouched.

---

## 1. Deep Root-Cause Diagnosis: Why `accountStatus` Was Not Displaying Its True Database Value

Inspecting the user's authoritative MongoDB document from the `leads` collection:
```javascript
{
  _id: ObjectId('6aed762e929c2b44b171548d'),
  legacyId: NumberInt('2925'),
  accountName: 'adani',
  customerName: 'adani',
  ownerName: 'Keval V Shah',
  accountOwner: 'Keval V Shah',
  status: 'pending',
  accountState: 'Pending',
  accountStatus: 'Pending',        // <--- Authoritative DB collection field
  stage: 'new',
  formData: {
    accountStatus: 'Pending',      // <--- Authoritative DB form data field
    status: 'pending',
    accountState: 'Pending',
    stage: 'new'
  }
}
```

Three distinct architectural factors were interfering with the direct display of `accountStatus`:

### 1.1. Deal-Side Status Overwrite in `MyGroupAccountsPage.jsx`
* In `src/pages/admin/accounts/MyGroupAccountsPage.jsx` lines 185–216, the component ran a `deals.find(...)` lookup against the accounts row.
* If any deal had `status: 'not_quoted'`, line 215 forcefully overwrote the account row:
  ```javascript
  ...(isRowNotQuoted ? { status: 'Not Quoted', accountStatus: 'Not Quoted' } : {})
  ```
* This meant even though the account document in the `leads` collection had `accountStatus: "Pending"` or null, the deal search forcefully stamped `"Not Quoted"` onto the row.

### 1.2. Status Transformation in `formatAccountStatusDisplay`
* In `src/features/adminAccounts/config/accountBoardColumns.js`:
  ```javascript
  if (lower === 'new' || lower === 'pending') return 'New'
  ```
* When `accountStatus` was `"Pending"`, this line converted it to `"New"` instead of preserving the exact database string `"Pending"`.

### 1.3. Normalization Override in `normalizeAccountRecord.js`
* In `src/features/adminAccounts/adapters/normalizeAccountRecord.js` lines 163–171:
  `accountStatus` was being synthesized from `stageMeta.label` or status cascades rather than directly prioritizing the raw MongoDB document's `accountStatus`.

---

## 2. Technical Architecture & Solutions: Direct `accountStatus` Display

```
+------------------------------------------------------------------------------------+
|                       AUTHORITATIVE MONGODB LEADS COLLECTION                       |
|                                                                                    |
|   accountStatus: "Pending"    ===>   Picks directly from DB: "Pending"             |
|   accountStatus: "Not Quoted" ===>   Picks directly from DB: "Not Quoted"          |
|   accountStatus: null / ""    ===>   Picks directly from DB: "-" (Blank / Null)    |
+------------------------------------------------------------------------------------+
                                         |
                                         v
+------------------------------------------------------------------------------------+
|                               REPOSITORY LAYER                                     |
|   Preserves exact collection field:                                                |
|   accountStatus: row.accountStatus || mergedFormData.accountStatus || null         |
+------------------------------------------------------------------------------------+
                                         |
                                         v
+------------------------------------------------------------------------------------+
|                           FRONTEND TABLE PIPELINE                                  |
|   1. Remove Deal Mutation: Deals do NOT overwrite accountStatus.                   |
|   2. Direct Field Priority:                                                        |
|      resolvedStatus = row.accountStatus ?? raw.accountStatus ?? formData.status   |
|   3. Table Column Display:                                                         |
|      - "Pending"    ===> displays "Pending"                                        |
|      - "Not Quoted" ===> displays "Not Quoted"                                     |
|      - null / ""    ===> displays "-"                                              |
+------------------------------------------------------------------------------------+
```

### 2.1. Direct Collection Field Extraction
The Account Status column will resolve the value by directly inspecting the MongoDB document fields in priority order:
1. `row.accountStatus` (top-level DB field)
2. `row.formData?.accountStatus` (form data DB field)
3. `row.raw?.accountStatus` (raw MongoDB document field)
4. `row.raw?.formData?.accountStatus` (raw form data DB field)
5. `row.status` (fallback lifecycle status)

### 2.2. Strict Value Display Mapping:
* **If `accountStatus` is `"Pending"` (or `"pending"`):** Output **`"Pending"`** in the table column.
* **If `accountStatus` is `"Not Quoted"` (or `"not_quoted"`):** Output **`"Not Quoted"`** in the table column.
* **If `accountStatus` is `"Quotation Sent"`:** Output **`"Quotation Sent"`**.
* **If `accountStatus` is null, undefined, or empty string:** Output **`"-"`** (null/blank).
* **Deal decoupling:** Deals matching by name or account ID will supply PO Value only; they will **never** alter or overwrite `accountStatus`.

---

## 3. Direct DB Collection Fetching & Backward Compatibility Across Before Data

1. **Dual-Type Scope Matching:**
   - Queries in `leadRepository.js` and `dealRepository.js` use dual-type matching (`$in: [Number(val), String(val)]`) for `createdBy`, `assignedTo`, `ownerUserId`, `ownerCode`, and `accountOwnerCode`.
   - Ensures that all historical before data (legacy IDs 1 through 2924) stored as strings (`"16"`, `"1015"`) and new data stored as BSON `NumberInt` are fetched simultaneously without dropping records.
2. **Zero `companyId` Hard Dependency:**
   - Queries are scoped strictly to user identity, preventing historical records lacking `companyId` from being filtered out.
3. **Stage Tab Workflow Consistency:**
   - Accounts with `accountStatus: "Pending"` and `stage: "new"` are cleanly fetched into the **New** stage tab (`?stage=new&page=1`), where their Account Status column clearly displays `"Pending"`.

---

## 4. 10 Records Per Page Pagination Across New & Before Data

| Layer | Component / File | Configuration |
| :--- | :--- | :--- |
| **Backend Lead Query** | `server/repositories/leadRepository.js` | `skip = (page - 1) * 10`, `limit = 10` |
| **Backend Deal Query** | `server/repositories/dealRepository.js` | `skip = (page - 1) * 10`, `limit = 10` |
| **Lead API Service** | `src/services/leadApi.js` | `limit = 10` |
| **Deal API Service** | `src/services/dealApi.js` | `limit = 10` |
| **Accounts Board UI** | `src/pages/admin/accounts/MyGroupAccountsPage.jsx` | `DEFAULT_ROWS_PER_PAGE = 10` $\rightarrow$ slices rows 1 to 10 |
| **Deals Table UI** | `src/pages/deals/Deals.jsx` | `ROWS_PER_PAGE = 10` $\rightarrow$ slices rows 1 to 10 |
| **Pagination Bar** | `AccountsBoardPagination.jsx` | Displays `Showing 1 to 10 of N accounts` |

---

## 5. Strict LIFO Ordering Execution

* **Frontend Sorting Comparator (`getRowSortTime` in `MyGroupAccountsPage.jsx`):**
  $$\text{sortTimestamp} = \max\Big(\text{reassignedDate}, \text{lastReassignedAt}, \text{reassignDate}, \text{updatedAt}, \text{createdAt}, \text{accountDate}\Big)$$
  - Newly created accounts have latest `createdAt` $\rightarrow$ placed at **Row 1 on Page 1**.
  - Newly reassigned accounts have latest `lastReassignedAt` $\rightarrow$ placed at **Row 1 on Page 1**.
  - Historical before data follows in exact reverse chronological order below.
* **Backend Database Query Sort:**
  `Lead.find(...).sort({ updatedAt: -1, createdAt: -1, legacyId: -1 })`.

---

## 6. Step-by-Step Implementation Plan

### Step 1: Remove Deal-Side Status Overwrite in `src/pages/admin/accounts/MyGroupAccountsPage.jsx`
* Remove lines 185–204 where `matchingDealForStatus` checked deal status and mutated `isRowNotQuoted`.
* Ensure `getAccountRowsWithRequiredFields` preserves the account's own database collection `accountStatus` without external mutation.

### Step 2: Update `formatAccountStatusDisplay` in `src/features/adminAccounts/config/accountBoardColumns.js`
* Update to directly prioritize the database `accountStatus`:
  - If null, undefined, or empty $\rightarrow$ return `"-"`.
  - If `"Pending"` or `"pending"` $\rightarrow$ return `"Pending"`.
  - If `"Not Quoted"` or `"not_quoted"` $\rightarrow$ return `"Not Quoted"`.
  - If other stages (`Quotation Sent`, `Priority 1`, etc.) $\rightarrow$ return their respective labels.

### Step 3: Update `normalizeAccountRecord.js`
* Ensure `normalizeAccountRecord` preserves `account.accountStatus` directly from the raw database document rather than synthesizing a fallback.

### Step 4: Verify 10 Records Per Page & Stage Isolation
* Verify `DEFAULT_ROWS_PER_PAGE = 10` in `MyGroupAccountsPage.jsx` and `ROWS_PER_PAGE = 10` in `Deals.jsx`.
* Confirm `?stage=new&page=1` isolates the New stage tab records with 10 records per page.

### Step 5: Verification & Production Build
* Run `npm run build` to verify clean compilation with 0 syntax or bundling errors.
* Validate all target URLs:
  - `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1`
  - `http://localhost:3000/admin/accounts/search?stage=new&page=1`
  - `http://localhost:3000/admin/deals/view`
  - `http://localhost:3000/admin/deals/search`
* Confirm:
  1. Accounts with `accountStatus: "Pending"` in MongoDB (like `adani`) display **"Pending"** under the Account Status column.
  2. Accounts with `accountStatus: "Not Quoted"` display **"Not Quoted"**.
  3. Accounts with blank/null status display **"-"**.
  4. All historical before data is preserved and accessible via 10-record pagination.

---

### Ready for Execution
When you are ready to apply these fixes, click the **Proceed** button in the review panel to execute the plan step-by-step.
