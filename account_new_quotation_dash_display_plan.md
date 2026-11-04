# Updated Implementation Plan: Project-Name Quotation Matching & Dash (`-`) Display on Newly Generated Accounts

> [!IMPORTANT]
> **PLAN ONLY — DO NOT IMPLEMENT**. Updated per your explicit instruction: **Do NOT pick by `companyName`**, **MUST pick by `projectName`** from the MongoDB `leads` collection. No code or database changes will be made until your approval.

---

## 1. Executive Summary & User Instruction Alignment

### Core Requirements
1. **Do NOT Pick by Company Name (`companyName`)**:
   - Quotations must **never** be matched or picked based on `companyName` (`qComp === aComp`).
   - In the past, matching by company name caused newly generated accounts to falsely inherit old quotations from historical projects of the same customer.
2. **MUST Pick by Project Name (`projectName`) from MongoDB `leads` Collection**:
   - Quotations legitimately belong to a project and must be matched by **`projectName`** (along with direct `dealId` / `accountId` links).
   - On each account / lead document in the MongoDB `leads` collection, the project name is resolved from:
     - `lead.projectName`
     - `lead.dealName`
     - `lead.formData.projectName`
     - `lead.formData['Project Name']`
   - On the quotation document in the MongoDB `quotations` collection, the project name is resolved from:
     - `quotation.projectName`
     - `quotation.title`
     - `quotation.data?.projectName`
     - `quotation.data?.quotationSubject`
     - `quotation.dealName`
3. **Dash (`-`) Sign Display on Newly Generated Accounts**:
   - On all 4 target routes:
     - `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1`
     - `http://localhost:3000/admin/accounts/search?stage=new&page=1`
     - `http://localhost:3000/accounts/my-accounts?stage=new&page=1`
     - `http://localhost:3000/accounts/search?stage=new&page=1`
   - When an account is **newly generated** (including via the tickmark **"Are your current account is existing customer?"**):
     - Because `companyName` is excluded, old quotations from previous projects of that customer are **not picked**.
     - Since no quotation exists yet for this new project, both **Quotation Number** and **Quotation Owner Name** display the **`-`** sign.
     - All historical quotation records in MongoDB collections remain stored safely in the database without any loss.
   - When a **new quotation is subsequently generated** for this new project:
     - The quotation matches this `projectName` (and `dealId` / `accountId`).
     - The table immediately updates to show the **newly generated Quotation Number** and **newly generated Quotation Owner Name**.
4. **Preserve User Portal Proper Way & Mirror into Admin**:
   - All existing user portal ownership logic (`isOwnedByCurrentUser`), filters, and permissions remain completely untouched and preserved.
   - The same clean `projectName`-based matching and `-` display rule is applied to Admin routes so both views function consistently and properly.

---

## 2. Technical Root Cause & Project-Name Matching Architecture

### 1. In `MyGroupAccountsPage.jsx`
Currently, `getQuotationScoreForAccount` includes:
```javascript
// CURRENT (FLAWED):
const qComp = normalizeMatchValue(quotation.companyName || ...)
const aComp = normalizeMatchValue(account.name || ...)
...
if (qComp && aComp && qComp === aComp) score += 10 // <-- CAUSES OLD QUOTATIONS TO BE PICKED
```
Because `score += 10` is awarded whenever company names match, any newly generated account for an existing customer inherits old quotations from other projects of that company.

### 2. The Solution: Strict `projectName` & Direct ID Matching
- **Remove `qComp === aComp` completely**: Company name matching is deleted from scoring.
- **Enforce `projectName` from MongoDB `leads` collection**:
  ```javascript
  // UPDATED (PROJECT-NAME BASED):
  const resolveLeadProjectName = (account = {}) => {
    const raw = account.raw || account.data || {}
    const formData = account.formData || raw.formData || {}
    const candidates = [
      account.projectName,
      account.dealName,
      formData.projectName,
      formData['Project Name'],
      formData.dealName,
      formData['Deal Name'],
      raw.projectName,
      raw.dealName,
      raw.formData?.projectName,
      raw.formData?.['Project Name'],
      raw.company,
    ]
    return normalizeMatchValue(candidates.find((val) => typeof val === 'string' && val.trim()))
  }

  const resolveQuotationProjectName = (quotation = {}) => {
    const data = quotation.data || {}
    const candidates = [
      quotation.projectName,
      quotation.title,
      quotation.dealName,
      data.projectName,
      data.quotationSubject,
      data.dealName,
    ]
    return normalizeMatchValue(candidates.find((val) => typeof val === 'string' && val.trim()))
  }
  ```
- **Scoring Rules**:
  - `qDealId && aDealId && qDealId === aDealId` -> **100 points** (Direct Deal link)
  - `qCustId && aCustId && qCustId === aCustId` -> **50 points** (Direct Account link)
  - `qProj && aProj && qProj === aProj` -> **40 points** (Strict Project Name link)
  - **Company name match** -> **0 points (NOT PICKED)**
- If a newly generated account has a new project name for which no quotation has been generated:
  - `score === 0`.
  - No old quotation is picked.
  - Quotation Number and Quotation Owner Name display **`-`**.

---

## 3. Zero-Touch Boundaries & Invariants

The following boundaries are **strictly preserved and will not be touched**:
- **Must NOT touch** custom reports creation logic or user groups custom date filtering.
- **Must NOT touch** Add Account mechanism, backend `ownerCode` and its logic.
- **Must NOT touch** Add Deals logic/backend, Deal details logic/backend.
- **Must NOT touch** Add Quotations logic/backend, Add Customers logic/backend.
- **Must NOT touch** mobile backend, Taskopad, Outlook backend, or graphs.
- **Must NOT touch** Automatic deal convert status by Save settings.
- **Must NOT touch** Tasks mechanism, Reminders form changes / popup modals, Converted deals tab view, or Revision quotation numbering ($R0 \to R1$).
- Historical quotation records in MongoDB collections remain untouched and fully preserved.

---

## 4. Step-by-Step Implementation Steps

### Step 1: Update `getQuotationScoreForAccount` in `MyGroupAccountsPage.jsx`
In [`src/pages/admin/accounts/MyGroupAccountsPage.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/accounts/MyGroupAccountsPage.jsx#L252-L276):
- Remove `qComp` / company name matching.
- Add `resolveLeadProjectName` to inspect project name fields from the MongoDB `leads` collection (`account.projectName`, `formData.projectName`, `dealName`, etc.).
- Add `resolveQuotationProjectName` to inspect project name fields from the MongoDB `quotations` collection (`quotation.projectName`, `quotation.title`, `data.projectName`, etc.).
- Calculate score based exclusively on:
  1. Exact Deal ID match: `+100`
  2. Exact Account ID match: `+50`
  3. Exact Project Name match: `+40`
- If none of these match, return `score = 0`.

---

### Step 2: Clear Inherited Quotation Strings in `enrichBoardDataWithQuotationFields`
In [`src/pages/admin/accounts/MyGroupAccountsPage.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/accounts/MyGroupAccountsPage.jsx#L277-L308):
- If `latestQuotation` matches:
  - `quotationNumber: resolvedNumber`
  - `quotationOwnerName: resolvedOwner`
- If **no legitimate quotation matches** the project / account:
  - Explicitly set `quotationNumber: ''` and `quotationOwnerName: ''`.
  - Clears any historical quotation strings pre-filled or carried over from the source customer.
  - The cell formatter in `accountBoardColumns.js` automatically renders the standard **`-`** sign.

---

### Step 3: Admin & User View Synchronization
In [`src/pages/admin/accounts/MyGroupAccountsPage.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/accounts/MyGroupAccountsPage.jsx):
- Ensure identical resolution across all 4 target URLs:
  - Admin: `/admin/accounts/my-accounts?stage=new` and `/admin/accounts/search?stage=new`
  - User: `/accounts/my-accounts?stage=new` and `/accounts/search?stage=new`
- Existing user ownership checks (`isOwnedByCurrentUser`), stage tabs, and non-admin column filters (`SEARCH_ACCOUNT_NON_ADMIN_COLUMN_KEYS`) remain 100% preserved.

---

### Step 4: Align Data Export Utility
In [`src/utils/exportAllLeadsAndDeals.js`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/utils/exportAllLeadsAndDeals.js#L60-L100):
- Remove company name matching and align with the identical `projectName` / ID matching logic so exported files reflect the exact same data shown on the screen.

---

## 5. Verification Matrix

| Route | Scenario | Matching Criteria | Expected Quotation No. | Expected Owner | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin My Accounts** (`/admin/accounts/my-accounts?stage=new`) | Newly generated account from existing customer | `projectName` has no quotation yet; `companyName` is ignored | `-` | `-` | Old quotation excluded |
| **Admin Search** (`/admin/accounts/search?stage=new`) | Newly generated account from existing customer | `projectName` has no quotation yet; `companyName` is ignored | `-` | `-` | Old quotation excluded |
| **User My Accounts** (`/accounts/my-accounts?stage=new`) | Newly generated account from existing customer | `projectName` has no quotation yet; `companyName` is ignored | `-` | `-` | Old quotation excluded |
| **User Search** (`/accounts/search?stage=new`) | Newly generated account from existing customer | `projectName` has no quotation yet; `companyName` is ignored | `-` | `-` | Old quotation excluded |
| **Any Route** | New quotation generated for this account / project | `projectName` matches newly generated quotation | Newly generated No. | Newly generated Owner | Active quotation shown |
| **Any Route** | Historical accounts that legitimately have quotations | `dealId`, `accountId`, or `projectName` matches | Existing quotation No. | Existing Owner | Historical integrity kept |
| **MongoDB Collections** | Quotations & Leads collections | No records deleted or altered | All data intact | All data intact | Zero data loss |

---

## 6. Safety & Deliverables
- Verify compilation with `npm run build` (0 errors).
- Clean, minimal diff strictly confined to `MyGroupAccountsPage.jsx` and `exportAllLeadsAndDeals.js`.
- All zero-touch boundaries strictly maintained.
