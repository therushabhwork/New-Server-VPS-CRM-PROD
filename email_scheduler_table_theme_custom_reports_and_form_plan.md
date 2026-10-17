# Implementation Plan: Email Scheduler Table UI Theme, Custom Reports Full-Data Excel & Form Alignment

## Executive Summary

This plan addresses three specific improvements requested for the Email Report Scheduler system:
1. **Change 1 (Table UI & Theme Match)**: Transform the **Report Schedules** table on `http://localhost:3000/admin/email-scheduler` to match the exact aesthetic of `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1` (`.admin-accounts-board-table`), including the signature blue gradient table header (`linear-gradient(180deg, #2f9fd3 0%, #1c6f9c 100%)`), crisp borders, alternating row hover, a leading `No.` (`#`) column (1, 2, 3...), and streamlined/reduced cell text so all content fits comfortably without unnecessary wraps.
2. **Change 2 (Custom Reports & Full-Data Excel Generation)**: On `http://localhost:3000/admin/email-scheduler/new`, provide the exact list of custom reports present on `http://localhost:3000/admin/reports/custom` (`reporttemplates` and `reports` collections). Fix the root cause where only the "Project Name" column was exported to Excel by ensuring correct `entityType` resolution (`account`, `deal`, `customer`, `quotation`) and building a robust backend report generation layer that maps the exact display fields and filters, outputting identical columns and formatted records as `/admin/reports/custom`.
3. **Change 3 (Header Restructuring & Form Input Alignment)**: On `http://localhost:3000/admin/email-scheduler/new`, reposition the **Back to Schedules** button on the top bar with the title ("Create Email Report Schedule") and subtitle ("Configure recurring automated report generation and Outlook delivery") placed cleanly to its right, removing the redundant "Automation & Delivery" tag. Apply proper CSS styling (`box-sizing: border-box`, symmetrical padding, uniform height) to all input fields and dropdowns so typed text is strictly aligned on both left and right edges.

---

## Strict Protection Constraints (Zero Regression Guarantee)

The following areas will remain **100% untouched and unchanged**:
- **Add Account mechanism, ownerCode backend & logic**: Unchanged.
- **Add Deals logic & backend, Deal details backend, Converted Deals, and automatic convert status**: Unchanged.
- **Add Quotations logic & backend, Quotation numbers, and Revision Quotations**: Unchanged.
- **Add Customers logic & backend**: Unchanged.
- **Mobile backend**: Unchanged.
- **Tasks mechanism, Taskpad, and Add Reminders forms/popups**: Unchanged.
- **Outlook Graph backend core logic in `integrationService.js`**: Unchanged (the scheduler uses the existing `sendOutlookEmail` API).
- **No hardcoding**: All theme variables, styles, and field definitions remain modular.

---

## Detailed Step-by-Step Implementation Plan

### Part 1: Report Schedules Table Theme & UI Enhancement (`EmailSchedulerPage.jsx`)

#### 1.1 Match `.admin-accounts-board-table` Theme
- Wrap the table in a responsive scroll container `.admin-accounts-board-table-wrap` / `.admin-accounts-board-table-shell`.
- Apply `.admin-accounts-board-table` styles:
  - **Header (`<thead> <th>`)**:
    ```css
    background: linear-gradient(180deg, #2f9fd3 0%, #1c6f9c 100%) !important;
    color: #ffffff !important;
    font-size: 0.74rem !important;
    font-weight: 700 !important;
    padding: 0.55rem 0.65rem !important;
    text-align: center !important;
    border: 1px solid var(--border-subtle) !important;
    white-space: nowrap !important;
    ```
  - **Body Cells (`<tbody> <td>`)**:
    ```css
    padding: 0.45rem 0.55rem !important;
    border: 1px solid var(--border-subtle) !important;
    vertical-align: middle !important;
    font-size: 0.74rem !important;
    color: var(--text-primary) !important;
    background: var(--surface-card) !important;
    ```
  - **Row Hover**:
    ```css
    tr:hover td {
      background: var(--surface-muted) !important;
    }
    ```

#### 1.2 Add `No.` (`#`) Column
- Insert a leading column in `<thead>`:
  ```jsx
  <th style={{ width: '48px', minWidth: '48px', textAlign: 'center' }}>No.</th>
  ```
- Insert corresponding index cell in `<tbody>`:
  ```jsx
  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
    {index + 1}
  </td>
  ```

#### 1.3 Reduce and Streamline Verbose Text
- **Schedule Name**: Display the schedule name clearly; move `Created by: ...` into a subtle tooltip or compact single-line subtext.
- **Source Report**: Display the report title with a small compact badge denoting its type (e.g. `Account`, `Deal`, `Custom`), omitting redundant text blocks like `Context: deal | Scope: today`.
- **Frequency & Time**: Render concisely in a single clean line: `Daily @ 18:00 IST` or `Weekly @ 18:00 IST`.
- **Next Run**: Render a single timestamp: `17/10/2026 18:00 IST` (or `Paused` if disabled).
- **Recipient**: Display recipient email cleanly with an ellipsis for long addresses and a compact badge for CC count.
- **Actions**: Keep buttons compact (`padding: 4px 8px`, `font-size: 11px`), with clear icon + text tooltips.

---

### Part 2: Custom Reports Integration & Full-Data Excel Generation

#### 2.1 Root Cause Analysis of "Only Project Name" in Excel
1. In MongoDB `reporttemplates` (e.g., "Swati-2 Report"), the document stores:
   - `entityType`: `"Account"`
   - `displayFields`: `['accountNumber', 'accountDate', 'name', 'accountOwner', 'projectName']`
2. In `scheduledReportApi.getAvailableReports()`, the mapping was:
   ```javascript
   dataSource: t.reportContext || t.dataSource || 'deal'
   ```
   Because `reportContext` and `dataSource` were not present on `reporttemplates` documents, it fell back to default `'deal'`.
3. The schedule was saved with `dataSource: 'deal'`.
4. During report execution, `executeReportPayload` checked `reportFieldDefinitions['deal']` against `['accountNumber', 'accountDate', 'name', 'accountOwner', 'projectName']`.
5. In `deal` field definitions, only `projectName` matched (the other keys were Account-specific keys).
6. Result: The Excel generator generated only one column: **Project Name**!

#### 2.2 Fix Report Discovery on `http://localhost:3000/admin/email-scheduler/new`
Update `scheduledReportApi.getAvailableReports()`:
- Load templates from `reportApi.getReportTemplates()` (`reporttemplates` collection) and `reportApi.getGeneratedReports()` (`reports` collection).
- Normalize entity type accurately:
  ```javascript
  const entityType = String(t.entityType || t.categoryKey || t.reportContext || 'account').toLowerCase()
  ```
- Normalize field list:
  ```javascript
  const selectedFields = (Array.isArray(t.displayFields) && t.displayFields.length > 0)
    ? t.displayFields
    : (Array.isArray(t.selectedFields) ? t.selectedFields : [])
  ```
- Normalize report name:
  ```javascript
  const reportName = t.reportName || t.name || t.title || 'Custom Report'
  ```
- Group reports inside the dropdown:
  - **Custom Templates (From /admin/reports/custom)**
  - **Generated Reports (From /admin/reports/custom)**
  - **System Standard Reports**
- Each dropdown option will clearly display: `<Report Name> (<Entity Type>)`.

#### 2.3 Implement Dedicated Custom Report Data Generation Layer in Backend
Create/enhance `server/services/customReportEngine.js` (called by `scheduledReportService.js`):
1. **Live Template Lookup**:
   When generating Excel for a schedule, retrieve the referenced template from MongoDB (`reporttemplates` or `reports`) to obtain the full, up-to-date configuration:
   - `entityType` (`account`, `deal`, `customer`, `quotation`)
   - `displayFields` / `selectedFields`
   - `filters`
   - `accountOwner`
2. **Collection Query**:
   Query the appropriate MongoDB collection:
   - `account` -> `leads` collection
   - `deal` -> `deals` collection
   - `customer` -> `customers` collection
   - `quotation` -> `quotations` collection
3. **Date Range Scoping**:
   Apply the scheduled date filter (`today`, `last_7_days`, `this_month`, `previous_month`, `all_time`) against the entity's primary date field:
   - Account: `accountDate` or `createdAt`
   - Deal: `dealDate` or `createdAt`
   - Customer: `createdAt` or `addedDate`
   - Quotation: `quotationDate` or `date` or `createdAt`
4. **Owner & Custom Filtering**:
   Apply owner scoping (if configured) and any custom filters matching the logic used in `/admin/reports/custom`.
5. **Exact Field Resolution & Header Mapping**:
   Map all fields using the exact dictionary matching `CustomReportsPage.jsx`:
   - `accountNumber` / `accountNo` -> `Account No.`
   - `accountDate` / `date` -> `Account Date`
   - `name` / `customerName` / `accountName` -> `Account Name`
   - `accountOwner` / `owner` -> `Account Owner`
   - `status` / `accountStatus` -> `Account Status`
   - `accountCategory` / `category` -> `Account Category`
   - `accountSource` / `source` -> `Account Source`
   - `contactPerson` -> `Contact Person`
   - `phone` / `mobile` -> `Phone`
   - `email` -> `Email`
   - `projectName` / `project` -> `Project Name`
   - `location` / `city` -> `Location`
   - `poValue` -> `PO Value`
   - `jobNo` -> `Job No`
   - `dealNumber` -> `Deal No.`
   - `dealName` -> `Deal Name`
   - `dealValue` -> `Deal Value`
   - `customerNumber` -> `Customer No.`
   - `quotationNo` -> `Quotation No.`
   - `grandTotal` -> `Grand Total`
6. **Excel Generation**:
   Populate the `.xlsx` sheet with every requested column and formatted cell value.
   Result: The generated Excel file matches the exact layout, columns, and data seen on `http://localhost:3000/admin/reports/custom`.

---

### Part 3: Form Layout & Input Alignment (`CreateEmailSchedulePage.jsx`)

#### 3.1 Header Restructuring
- Remove the text `<span className="ap-welcome-subhead">Automation & Delivery</span>`.
- Layout the top bar as a horizontal flex row:
  ```jsx
  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
    <button
      type="button"
      className="ap-header-item-btn"
      onClick={() => navigate('/admin/email-scheduler')}
      title="Back to Schedules"
    >
      <FaArrowLeft />
      <span>Back to Schedules</span>
    </button>
    <div>
      <h1 className="ap-welcome-heading" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>
        Create Email Report Schedule
      </h1>
      <p className="ap-welcome-sub" style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Configure recurring automated report generation and Outlook delivery
      </p>
    </div>
  </div>
  ```

#### 3.2 Form Field Internal and External Alignment
Fix the styling for all form controls:
```css
.ap-input,
.ap-select {
  box-sizing: border-box;
  width: 100%;
  height: 2.6rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.85rem;
  line-height: 1.4;
  border: 1px solid var(--border-subtle, #d1d5db);
  border-radius: 8px;
  background: var(--surface-card, #ffffff);
  color: var(--text-primary, #111827);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ap-input:focus,
.ap-select:focus {
  border-color: #2f9fd3;
  box-shadow: 0 0 0 2px rgba(47, 159, 211, 0.18);
}
```
- Ensure every `.ap-form-group` has uniform margins and consistent label alignment so typed text starts at the exact same left offset and does not bump against the right edge.

---

## Verification & Validation Plan

1. **Table Theme Validation (`/admin/email-scheduler`)**:
   - Compare side-by-side with `/admin/accounts/my-accounts?stage=new&page=1`.
   - Verify table header gradient (`#2f9fd3` to `#1c6f9c`), white bold font, clean border separators.
   - Verify `No.` column numbering (`1, 2, 3...`).
   - Verify row hover highlight.
   - Verify all schedule names, reports, cadences, and recipients fit compactly.
2. **Custom Reports Dropdown Validation (`/admin/email-scheduler/new`)**:
   - Verify that all custom report templates from `/admin/reports/custom` appear in the dropdown.
   - Confirm selection sets the accurate `entityType` (`Account`, `Deal`, `Customer`, etc.) and display fields.
3. **Excel Content Validation**:
   - Create a schedule for "Swati-2 Report" (or another custom account/deal report).
   - Trigger execution via "Run Now".
   - Inspect generated Excel buffer / email attachment:
     - Verify all columns (`Account No.`, `Account Date`, `Account Name`, `Account Owner`, `Project Name`, etc.) are present.
     - Verify data rows are fully populated with exact values matching the web report.
4. **Form Header & Input Alignment Validation (`/admin/email-scheduler/new`)**:
   - Confirm "Automation & Delivery" text is completely removed.
   - Confirm Back button is on the top bar with title and subtitle neatly placed to its right.
   - Confirm typing into all text fields shows clean, symmetrical padding and left/right margin alignment.
5. **Build and Non-Regression Testing**:
   - Run `npm run build` to confirm 0 compilation errors.
   - Confirm all protected modules (Accounts, Deals, Quotations, Customers, Tasks, Mobile) remain 100% untouched.
