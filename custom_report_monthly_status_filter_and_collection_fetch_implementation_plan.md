# Swati CRM – Custom Reports: 3 Core Templates (Daily/Monthly/Yearly), Filter Modal, Live DB Collection Fetch, Dual Action Icons & Access Control Implementation Plan (Updated)

> **CRITICAL DIRECTIVE**: **DO NOT IMPLEMENT YET**. This document is an updated implementation plan for user review and approval only. No code or database modifications are performed during this step.

---

## 1. Executive Summary & Root Requirements

### 1.1. Targeted Route
- **Route**: `http://localhost:3000/admin/reports/custom`
- **Frontend Page**: [`src/pages/admin/reports/CustomReportsPage.jsx`](src/pages/admin/reports/CustomReportsPage.jsx)
- **Styling**: [`src/pages/admin/reports/CustomReportsPage.css`](src/pages/admin/reports/CustomReportsPage.css)

### 1.2. Key Requirements Requested by the User
1. **Access Permissions & Authorization**:
   - Explicitly grant access to view, filter, run, and export these reports to:
     - **Keval V Shah**
     - **Samir Sheth**
     - **Samir Jha**
     - System Admins & Super Admins.
2. **3 Fixed Core Templates (Daily, Monthly, Yearly)**:
   - Provide three fixed primary status report templates:
     1. **Daily Status** (defaults to Daily / Today period)
     2. **Monthly Status** (defaults to Custom Date Range / Monthly period e.g. `01-10-2026` to `23-10-2026`)
     3. **Yearly Status** (defaults to Yearly / Annual period)
   - **Dual Action Icons for Every Template**: Every template card will feature **BOTH** action icons directly on the card header:
     - **View Icon** (`<FaEye />`): Opens the interactive Structured Report View modal with live data from the database collection.
     - **Excel Icon** (`<FaFileExcel />`): Instantly exports the filtered report data directly to an Excel `.xlsx` spreadsheet.
3. **Filter Icon Placement & Modal**:
   - Add a dedicated Filter icon button (`<FaFilter /> Filter`) on the top bar **before** the "Add Report Template" button.
   - Clicking Filter opens the Configuration Modal featuring:
     - **Report Name**: Input/Select (defaults to `"Monthly Status"`, with `"Daily Status"` & `"Yearly Status"` options).
     - **Visibility**: Dropdown defaulting to `"All"` (`All`, `Public`, `Private`).
     - **Period**: Dropdown defaulting to `"Custom Date Range"` (with presets: `Today`, `Yesterday`, `This Week`, `This Month`, `This Year`, `Custom Date Range`).
     - **Start Date**: Date input (e.g. `01-10-2026` / `2026-10-01`).
     - **End Date**: Date input (e.g. `23-10-2026` / `2026-10-23`).
     - **Count By Callout**: Informational banner: `"Report will be generated with all Account details selected below."`
     - **Owner**: Dropdown populated from database (e.g. `All Owners`, `Atish Shah`, `Keval V Shah`, etc.).
     - **Select Status**: Dropdown supporting exact selection from the 14 stages:
       - `All`
       - `New`
       - `Follow-up`
       - `Technical offer`
       - `Quotation sent`
       - `Quote Revision`
       - `Convert to PO`
       - `Oder Lost` (with `Order Lost` support)
       - `Converted`
       - `Rejected`
       - `contracted`
       - `Closed`
       - `priority 1`
       - `priority 2`
4. **Live MongoDB Collection Fetching**:
   - Queries the MongoDB `leads` (Accounts) collection.
   - Filters live records dynamically based on:
     - Date Range (`accountDate` or `createdAt` between `Start Date` and `End Date`).
     - Selected Owner (`accountOwner`, `ownerName`, `assignedTo`, `raw.accountOwner`).
     - Selected Status (exact match against `accountStatus`, `stage`, and aliases).
5. **Structured Report View**:
   - Displays a clean data table with KPI metrics:
     - Summary count & active filter chips.
     - Columns: `#`, `Account No`, `Account Name`, `Contact Person`, `Phone`, `Email`, `Status`, `Owner`, `Date`, `City / Location`.
     - Action buttons: Excel Export, CSV Export, Print, Close.
6. **Existing Custom Report Creation Untouched**:
   - The existing Custom Report Template Creation mechanism, builder, and backend (`/reports/templates`) remain 100% untouched.

---

## 2. Inviolable Scope Guardrails (Strict Do-Not-Touch Rules)

The following core modules and logic paths remain strictly untouched:
- **Custom Report Template Creation Logic & Backend**: Must NOT touch and must NOT change existing template creation logic without User groups selection with their custom date filtering.
- **Add Account Mechanism & Backend**: Must NOT touch Add Account creation mechanism and `ownerCode` backend logic.
- **Add Deals Logic & Deal Details Backend**: Must NOT touch Deal creation, Add Deal logic, and Deal details backend.
- **Add Quotations Logic & Revision Quotations**: Must NOT touch Quotation creation, deal quotation mechanism, account quotation mechanism, or revision quotations for accounts and deals.
- **Quotation Numbers & Old Quotation Backend**: Must NOT touch quotation number generation, quotation sequencing, or old quotation retrieval.
- **Add Customers Logic & Backend**: Must NOT touch customer creation logic and its backend.
- **Mobile Backend & Outlook Integration**: Must NOT touch mobile backend routes and Outlook calendar/email synchronization.
- **Automatic Deal Convert Status & Taskopad**: Must NOT touch automatic deal convert status by Save settings or Taskopad tasks mechanism.
- **Zero Data Loss Guarantee**: 10-record pagination, live MongoDB collection fetching, and strict LIFO ordering remain 100% intact.

---

## 3. Targeted Technical Architecture

### Step 1: User Authorization for Keval V Shah, Samir Sheth & Samir Jha
In [`src/pages/admin/reports/CustomReportsPage.jsx`](src/pages/admin/reports/CustomReportsPage.jsx):

Define a robust authorization helper granting full access to the specified users:
```javascript
export const isAuthorizedReportUser = (u) => {
  if (!u) return false
  if (u.role === 'admin' || u.role === 'super_admin') return true
  const name = String(u.name || '').toLowerCase()
  const email = String(u.email || '').toLowerCase()
  const username = String(u.username || '').toLowerCase()

  return (
    name.includes('keval') ||
    email.includes('keval') ||
    name.includes('samir sheth') ||
    name.includes('samir seth') ||
    email.includes('samirsheth') ||
    name.includes('samir jha') ||
    email.includes('samirjha') ||
    username.includes('keval') ||
    username.includes('samir')
  )
}
```

---

### Step 2: 3 Fixed Core Templates with Dual Action Icons (View & Excel)
In [`src/pages/admin/reports/CustomReportsPage.jsx`](src/pages/admin/reports/CustomReportsPage.jsx):

1. **Fixed Templates Definition**:
   ```javascript
   const FIXED_CORE_TEMPLATES = [
     {
       id: 'fixed-daily-status',
       reportName: 'Daily Status',
       title: 'Daily Status',
       period: 'Today',
       group: 'Status Reports',
       entityType: 'Accounts',
       visibility: 'All',
       dateFilterField: 'accountDate',
       description: 'Daily account status progress and updates.',
       isFixedTemplate: true,
     },
     {
       id: 'fixed-monthly-status',
       reportName: 'Monthly Status',
       title: 'Monthly Status',
       period: 'Custom Date Range',
       defaultStartDate: '2026-10-01',
       defaultEndDate: '2026-10-23',
       group: 'Status Reports',
       entityType: 'Accounts',
       visibility: 'All',
       dateFilterField: 'accountDate',
       description: 'Monthly account status distribution across stages and owners.',
       isFixedTemplate: true,
     },
     {
       id: 'fixed-yearly-status',
       reportName: 'Yearly Status',
       title: 'Yearly Status',
       period: 'This Year',
       group: 'Status Reports',
       entityType: 'Accounts',
       visibility: 'All',
       dateFilterField: 'accountDate',
       description: 'Annual account acquisition and stage transition summary.',
       isFixedTemplate: true,
     },
   ]
   ```

2. **Dual Action Icons on Template Cards**:
   In `ReportCard` component, ensure every template card displays **both** the View and Excel icons:
   ```jsx
   <div className="cr-list-actions">
     {/* 1. Direct Web View Icon */}
     <button
       type="button"
       title="View Structured Report"
       className="cr-settings-btn cr-eye-btn"
       onClick={() => handleOpenStructuredReport(report)}
     >
       <FaEye />
     </button>

     {/* 2. Direct Excel Export Icon */}
     <button
       type="button"
       title="Export to Excel (.xlsx)"
       className="cr-settings-btn cr-excel-btn"
       onClick={() => handleDirectExcelExport(report)}
     >
       <FaFileExcel />
     </button>

     {/* Settings dropdown for custom templates */}
     {isKevalOrAdmin && report.isCustom && (
       <button
         type="button"
         title="Settings"
         className="cr-settings-btn cr-cog-btn"
         onClick={() => setDropdownOpen(!dropdownOpen)}
       >
         <FaCog />
       </button>
     )}
   </div>
   ```

---

### Step 3: Top Bar Filter Icon Placement & Filter Modal
In [`src/pages/admin/reports/CustomReportsPage.jsx`](src/pages/admin/reports/CustomReportsPage.jsx):

1. **Header Layout**:
   Insert the Filter icon button immediately before the "Add Report Template" dropdown:
   ```jsx
   <div className="cr-list-topbar-actions">
     <button
       type="button"
       className="cr-list-filter-btn"
       onClick={() => setIsFilterModalOpen(true)}
       title="Filter Report"
     >
       <FaFilter className="cr-filter-icon" />
       <span>Filter</span>
     </button>

     {canCreateReportTemplate && (
       <SplitDropdown
         label="Add Report Template"
         options={addTemplateOptions}
         isOpen={addOpen}
         buttonRef={addRef}
         onToggle={() => setAddOpen((value) => !value)}
         onSelect={handleAddTemplate}
       />
     )}
   </div>
   ```

2. **Filter Configuration Dialog (`<CustomReportFilterModal>`)**:
   Rendered with exact requested controls:
   - **Report Name**: Dropdown/Input toggling between `Monthly Status`, `Daily Status`, and `Yearly Status`.
   - **Visibility**: `All`, `Public`, `Private`.
   - **Period**: `Custom Date Range`, `This Month`, `Today`, `This Year`, etc.
   - **Start Date & End Date**: Date inputs initialized to `01-10-2026` and `23-10-2026`.
   - **Count By Notice**:
     `<div className="cr-filter-notice"><FaInfoCircle /> Report will be generated with all Account details selected below.</div>`
   - **Owner**: Dynamic list of unique account owners (includes `All Owners`, `Atish Shah`, etc.).
   - **Select Status**: Full dropdown with the 14 requested options:
     `All`, `New`, `Follow-up`, `Technical offer`, `Quotation sent`, `Quote Revision`, `Convert to PO`, `Oder Lost`, `Converted`, `Rejected`, `contracted`, `Closed`, `priority 1`, `priority 2`.
   - **Modal Buttons**:
     - `Reset`
     - `Close`
     - `Export Excel` (instantly generates and downloads `.xlsx`)
     - `View Structured Report` (fetches DB data and opens structured table)

---

### Step 4: MongoDB Collection Fetching & Query Engine

1. **Direct Collection Query**:
   Fetch all records from `/leads` collection via `apiClient.get('/leads', { params: { limit: 100000 } })`.

2. **Precise Filtering Function**:
   ```javascript
   const fetchAndFilterReportData = async (criteria) => {
     const res = await apiClient.get('/leads', { params: { limit: 100000 } })
     const records = res?.data?.data || res?.data || []

     const fromDate = criteria.startDate ? new Date(`${criteria.startDate}T00:00:00`) : null
     const toDate = criteria.endDate ? new Date(`${criteria.endDate}T23:59:59`) : null
     const targetOwner = String(criteria.owner || 'all').trim().toLowerCase()
     const targetStatus = String(criteria.status || 'all').trim().toLowerCase().replace(/[\s_-]+/g, ' ')

     return records.filter((item) => {
       // 1. Date Range Filter
       if (fromDate || toDate) {
         const dateVal = item.accountDate || item.createdAt || item.updatedAt
         if (!dateVal) return false
         const d = new Date(dateVal)
         if (isNaN(d.getTime())) return false
         if (fromDate && d < fromDate) return false
         if (toDate && d > toDate) return false
       }

       // 2. Owner Filter
       if (targetOwner !== 'all') {
         const owners = [
           item.accountOwnerName,
           item.accountOwner,
           item.ownerName,
           item.owner,
           item.assignedTo,
           item.raw?.accountOwner,
         ].filter(Boolean).map((o) => String(o).trim().toLowerCase())

         if (!owners.some((o) => o === targetOwner || o.includes(targetOwner))) {
           return false
         }
       }

       // 3. Status Filter (Accurate match across 14 statuses)
       if (targetStatus !== 'all') {
         const statuses = [
           item.accountStatus,
           item.stage,
           item.status,
           item.raw?.accountStatus,
           item.raw?.stage,
         ].filter(Boolean).map((s) => String(s).trim().toLowerCase().replace(/[\s_-]+/g, ' '))

         const matches = statuses.some((s) => {
           if (targetStatus === 'oder lost' || targetStatus === 'order lost') {
             return s === 'oder lost' || s === 'order lost' || s === 'lost'
           }
           if (targetStatus === 'contracted') {
             return s === 'contracted' || s === 'contacted'
           }
           return s === targetStatus
         })
         if (!matches) return false
       }

       return true
     })
   }
   ```

---

### Step 5: Structured Report View & Excel Export Integration

1. **Structured Report View Modal (`<StructuredReportViewModal>`)**:
   - Header with Report Name, Date Range, Active Filters, and Total Count.
   - Action bar: **Export to Excel**, **Export to CSV**, **Print**, **Close**.
   - Responsive Data Table:
     - Columns: `#`, `Account No`, `Account Name`, `Contact Person`, `Phone`, `Email`, `Status Badge`, `Owner`, `Account Date`, `City`.

2. **Excel Export Engine**:
   - Formats columns matching standard account report specifications.
   - Sets filename dynamically: `${criteria.reportName}_${criteria.startDate}_to_${criteria.endDate}.xlsx`.
   - Includes summary header in exported file (Report Name, Selected Period, Filtered Owner, Filtered Status, Total Records).

---

### Step 6: Pure White & Solid Brand Red (`#c60016`) Styling
In [`src/pages/admin/reports/CustomReportsPage.css`](src/pages/admin/reports/CustomReportsPage.css):

- **Filter Button**:
  ```css
  .cr-list-filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.48rem 0.95rem;
    font-size: 0.82rem;
    font-weight: 700;
    border: 1px solid #c60016;
    background: #ffffff;
    color: #c60016;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .cr-list-filter-btn:hover {
    background: #c60016;
    color: #ffffff;
  }
  ```
- **Action Icons on Template Cards**:
  - `.cr-eye-btn`: Color `#0284c7`, hover background `#e0f2fe`.
  - `.cr-excel-btn`: Color `#16a34a`, hover background `#dcfce7`.
- **Structured Modal & Filter Modal**: Clean white cards, backdrop blur, brand red accents.

---

## 4. Verification & Testing Matrix

| Test Scenario | Verification Target | Expected Result |
| :--- | :--- | :--- |
| **Access Control** | Login as Keval V Shah, Samir Sheth, or Samir Jha | Full access granted to view, filter, generate, and export reports. |
| **Top Bar Header** | Filter Button | Filter button appears directly before the "Add Report Template" button. |
| **3 Core Templates** | Template Display | Daily Status, Monthly Status, and Yearly Status cards appear prominently under Status Reports. |
| **Dual Icons** | Card Action Icons | Both `<FaEye />` (View) and `<FaFileExcel />` (Excel) icons are present on each template card. |
| **Filter Dialog** | Configuration Fields | Displays Report Name, Visibility, Period, Start/End Date, Count By notice, Owner, and 14 Status options. |
| **Status Selection** | Any of 14 Statuses selected | Live MongoDB query filters accounts strictly by the chosen status (e.g. `Technical offer`, `Quotation sent`, `priority 1`, etc.). |
| **Structured View** | Click View Icon | Opens structured table with KPI banner, matching records, and clean column layout. |
| **Excel Export** | Click Excel Icon | Generates and downloads clean `.xlsx` workbook containing only the filtered records. |
| **Custom Templates** | Template Creation | Existing custom report creation mechanism and backend remain completely intact. |
| **Build Stability** | Build System | `npm run build` compiles with 0 syntax or lint errors. |
