# Updated Implementation Plan: Organization Phone Dynamic User Mobile Lookup & Frontend-Only Removal of Client/Account No.

## 1. Overview & Objectives

This updated plan incorporates user guidance emphasizing that **all database collections and schemas remain 100% untouched and preserved**, with the removal of `Client/Account No.` applying **strictly to the frontend UI rendering**.

1. **Organization Phone Dynamic Population & Null/Blank Fallback**:
   - Default Organization Phone must be **null / blank** (`""`).
   - If the user/owner in the MongoDB `users` collection has a registered mobile number (`user.mobile`, `user.phone`, or `user.mobileNumber`), that number will be dynamically displayed.
   - If the user does not have a mobile number in `users` collection, it **must remain null/blank** (`""`).
   - All hardcoded fallback telephone numbers (e.g. `'9913536307'`, `'+91 265 4000 222'`) will be eliminated from frontend profile objects and document templates.

2. **Frontend-Only Removal of `Client/Account No.` (Zero DB Changes)**:
   - **Frontend UI Only**: Hide/remove the visual field and label from:
     - The Quotation Builder form modal in [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx) for both Admin and Users.
     - The Quotation Document view, Interactive Edit modal, and HTML Print/PDF templates in [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx).
   - **Database & Data Payloads 100% Preserved**:
     - Do **NOT** remove or alter `clientAccountNumber` from MongoDB `quotations` or `leads` collections.
     - Keep `clientAccountNumber` in JavaScript state objects and API payloads so data models, account linking, search, and backend storage continue functioning without any disruption.

---

## 2. Root Cause Analysis & Visual Scope

### A. Organization Phone Hardcoded Defaults
- [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx):
  - `PROFILE_OPTIONS` defines `organizationPhone: '9913536307'` (Swati) and `organizationPhone: '+91 265 4000 222'` (Lumos).
  - Form input fallback: `value={quotationForm.organizationPhone || activeProfile?.organizationPhone || ''}` overrides blank values with `'9913536307'`.
  - `buildQuotationFromExisting()` line 528 falls back to `resolvedProfile.organizationPhone`.
- [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx):
  - `SWATI_PROFILE_FALLBACK` (line 262) and `LUMOS_PROFILE_FALLBACK` (line 276) hardcode telephone strings.
  - `buildQuotationDocumentData()` line 892 falls back to `SWATI_PROFILE_FALLBACK.organizationPhone`.

### B. Visible Frontend-Only Locations of Client/Account No.
- **Quotation Builder Form Modal** ([`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx#L3620-L3623)):
  ```jsx
  <label className="quotation-builder-field">
    <span>Client/Account No.</span>
    <input value={quotationForm.clientAccountNumber || ''} readOnly />
  </label>
  ```
- **Quotation Print & PDF Layout** ([`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx#L1479)):
  ```html
  <div class="field-row"><strong>Client Account No.</strong><span>${escapeHtml(displayValue(doc.clientAccountNumber))}</span></div>
  ```
- **Quotation Viewer & Edit Modal** ([`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx#L1839)):
  ```jsx
  <div className="aqp-doc__field-row"><strong>Client Account No.</strong>{editValue('clientAccountNumber', displayValue(documentData.clientAccountNumber))}</div>
  ```
- **Simple Card Body** ([`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx#L2252-L2255)):
  ```jsx
  <div className="aqp-simple-row">
    <span className="aqp-simple-label">Account No</span>
    <span className="aqp-simple-val">{editValue('clientAccountNumber', displayValue(documentData.clientAccountNumber))}</span>
  </div>
  ```

---

## 3. Detailed Technical Solutions

### Part 1: Organization Phone Dynamic User Mobile Lookup & Null/Blank Fallback

1. **Profile Definitions**:
   - In [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx#L97): Change `organizationPhone` across `PROFILE_OPTIONS` from `'9913536307'` and `'+91 265 4000 222'` to `''`.
   - In [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx#L262): Change `organizationPhone` in `SWATI_PROFILE_FALLBACK` and `LUMOS_PROFILE_FALLBACK` to `''`.

2. **Dynamic Population from MongoDB `users` collection**:
   - When creating a quotation in [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx#L1881):
     ```javascript
     const userMobile = user?.mobile || user?.phone || user?.mobileNumber || user?.quotationOwnerMobileNumber || ''
     ...
     organizationPhone: userMobile || '',
     ```
     If the logged-in user or quotation owner has a mobile number in MongoDB `users` collection, it will show. If not, it defaults to `''` (null/blank).
   - In Quotation Builder form input (line 3835):
     ```jsx
     value={quotationForm.organizationPhone || ''}
     ```
     (Eliminate `|| activeProfile?.organizationPhone`).
   - In `buildQuotationFromExisting` (line 528):
     ```javascript
     organizationPhone: quotation.organizationPhone || quotation.data?.organizationPhone || '',
     ```

3. **Admin & Shared Document Builder (`quotationShared.jsx`)**:
   - In `buildQuotationDocumentData` (lines 886–892):
     ```javascript
     const userPhone = (
       matchingUser?.mobile ||
       matchingUser?.phone ||
       matchingUser?.mobileNumber ||
       matchingUser?.quotationOwnerMobileNumber ||
       currentUser?.mobile ||
       currentUser?.phone ||
       currentUser?.mobileNumber ||
       ''
     )
     const organizationPhone = (rawOrgPhone !== undefined && rawOrgPhone !== null && String(rawOrgPhone).trim() !== '')
       ? String(rawOrgPhone).trim()
       : (userPhone || '')
     ```
     Zero fallback to hardcoded phone numbers. If neither saved quote phone nor user mobile exists, `organizationPhone` is strictly `''`.
   - In header contact bar (lines 1472, 1571, 1831, 1978):
     When `doc.organizationPhone` is blank, render clean contact text without dangling pipes:
     ```javascript
     const contactParts = [
       doc.organizationEmail ? `Email: ${doc.organizationEmail}` : null,
       doc.organizationPhone ? `Phone: ${doc.organizationPhone}` : null,
       doc.organizationGstin ? `GSTIN: ${doc.organizationGstin}` : null,
     ].filter(Boolean).join(' | ')
     ```

---

## 4. Affected Files & Proposed Modifications

| File | Section | Nature of Change |
| :--- | :--- | :--- |
| [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx) | `PROFILE_OPTIONS` (lines 90–135) | Change `organizationPhone` to `''` (no hardcoding). |
| [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx) | `buildQuotationFromExisting` (line 528) | Set phone to existing quote phone or `''`. |
| [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx) | `createQuotationForm` (line 1881) | Read `user.mobile`/`user.phone` from users collection; fallback to `''`. |
| [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx) | Quotation Details Grid (lines 3620–3623) | **Remove UI field** `Client/Account No.` (Frontend only). |
| [`src/pages/quotations/Quotations.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/quotations/Quotations.jsx) | Builder Input Value (line 3835) | Remove `|| activeProfile?.organizationPhone` fallback. |
| [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx) | Profile Fallbacks (lines 262, 276) | Change fallback `organizationPhone` to `''`. |
| [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx) | `buildQuotationDocumentData` (lines 886–892) | Dynamic user mobile lookup from users collection or `''`. |
| [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx) | HTML Print Template (line 1479) | **Remove UI row** `Client Account No.` (Frontend only). |
| [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx) | AQP Document Modal (line 1839) | **Remove UI row** `Client Account No.` (Frontend only). |
| [`src/pages/admin/quotations/quotationShared.jsx`](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/quotations/quotationShared.jsx) | Simple Card Body (lines 2252–2255) | **Remove UI row** `Account No` (Frontend only). |

---

## 5. Strict Zero-Touch Guarantees

- **Database Integrity**: Zero changes to MongoDB database collections (`quotations`, `leads`, `accounts`, `customers`, `users`). Existing data, IDs, and account numbers remain intact.
- **Backend Quotation Logic**: `quotationNumberService.js`, Indian Financial Year logic, sequence counters, and `ownerCode` lookup remain untouched.
- **Custom Report Engine**: Report creation, user group selection, and custom date filtering remain untouched.
- **Add Account / Deal / Customer Mechanisms**: Form logic, backend endpoints, and storage logic remain untouched.
- **Automatic Deal Convert**: Save settings and status transitions remain untouched.
- **Tasks & Reminders**: Modals, popups, and task management remain untouched.
- **Revision Quotations**: $R0 \to R1 \to R2$ lifecycle remains untouched.
- **Mobile & Outlook Backends**: All communication and sync services remain untouched.

---

## 6. Verification Steps (Post-Approval)

1. **Verify Organization Phone Behavior**:
   - For user with mobile number in MongoDB `users` collection: verify Organization Phone automatically displays that mobile number.
   - For user with no mobile number (or blank): verify Organization Phone displays blank/null (`""`) without falling back to `'9913536307'`.
2. **Verify Frontend-Only Removal of Client/Account No.**:
   - Verify that the Quotation Builder form does not show `Client/Account No.`.
   - Verify that Quotation Preview/Print and Quotation Manager modals do not show `Client Account No.`.
   - Verify that the database record retains its `clientAccountNumber` field and links cleanly to the selected account.
3. **Build Verification**:
   - Run `npm run build` to ensure 0 compilation errors across all modules.
