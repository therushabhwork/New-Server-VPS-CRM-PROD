# Swati CRM – Custom Reports: Popup Modal UI, Alignment, Dynamic DB Fetch & Excel Export Plan (Updated)

> [!IMPORTANT]
> **Plan Mode Only**: This updated plan incorporates your feedback:
> 1. **Permanently remove the "Count By" callout box** from the Filter Modal.
> 2. **Ensure 100% dynamic live MongoDB collection querying** for both **Export Excel** and **View Report** so that the downloaded `.xlsx` and on-screen table reflect the exact real-time database records filtered by the chosen date range, owner, and status.
> 3. **DO NOT IMPLEMENT YET** — strictly awaiting your review and approval.

---

## 1. Executive Summary & Change Specification

### Changes Requested by User:
1. **Remove "Count By" Box**: The notice box *"Report will be generated with all Account details selected below"* is removed entirely, resulting in a cleaner, more compact, and professional modal layout.
2. **Dynamic Live DB Fetch for Excel & Structured View**:
   - Clicking **`Export Excel`** executes a live query to the MongoDB collection (`/leads` API with context accounts fallback), applies the exact filter parameters (Start Date, End Date, Owner, and Status), formats the data into proper columns (`#`, `Account No`, `Account Name`, `Contact Person`, `Phone`, `Email`, `Status`, `Owner`, `Account Date`, `City`), and instantly downloads the dynamically generated `.xlsx` workbook.
   - Clicking **`View Report`** executes the exact same live query and populates the `<StructuredReportModal>` with real-time KPI counts, filter chips, client-side table search, and export options.
3. **Perfect Grid Symmetry & React Portal (`document.body`)**:
   - Modals mount via `createPortal(..., document.body)` so they are never clipped or misaligned by parent layouts or `zoom: 0.8`.
   - Balanced, symmetrical 2-column layout where `Start Date` and `End Date` sit side-by-side on the same row.

---

## 2. Updated Modal Layout & Field Flow

With the **"Count By" box removed**, the Filter Modal is now streamlined into 4 clean rows:

```
+-----------------------------------------------------------------------------------------+
| [FaFilter] Custom Report Filter                                                     [×] |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  Report Name                                     Visibility                             |
|  [ Monthly Status                           ▼ ]  [ All                             ▼ ]  |
|                                                                                         |
|  Period                                          Owner                                  |
|  [ Custom Date Range                        ▼ ]  [ Atish Shah                      ▼ ]  |
|                                                                                         |
|  Start Date                                      End Date                               |
|  [ 01-10-2026                                 ]  [ 23-10-2026                        ]  |
|                                                                                         |
|  Select Status (Full Width)                                                             |
|  [ All                                                                              ▼ ] |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
|  [⟲ Reset]                         [Close]  [Export Excel (.xlsx)]  [View Report]       |
+-----------------------------------------------------------------------------------------+
```

### Form Fields Breakdown:
| Row | Left Column (Col 1) | Right Column (Col 2) | Notes |
| :--- | :--- | :--- | :--- |
| **Row 1** | `Report Name` (`Monthly Status` default, `Daily Status`, `Yearly Status`) | `Visibility` (`All` default, `Public`, `Private`) | Clean high-level report scoping |
| **Row 2** | `Period` (`Custom Date Range` default, `Today`, `Yesterday`, `This Week`, etc.) | `Owner` (`Atish Shah` default, `All Owners`, and dynamic list from DB) | Core filtering criteria |
| **Row 3** | `Start Date` (Initialized to `01-10-2026` / `2026-10-01`) | `End Date` (Initialized to `23-10-2026` / `2026-10-23`) | **Side-by-side date range pairing** |
| **Row 4** | `Select Status` (Spans both columns, full-width dropdown) | All 14 stages: `All`, `New`, `Follow-up`, `Technical offer`, `Quotation sent`, `Quote Revision`, `Convert to PO`, `Oder Lost`, `Converted`, `Rejected`, `contracted`, `Closed`, `priority 1`, `priority 2` |

---

## 3. Dynamic Database Fetch & Dynamic Excel Generation Architecture

```
User selects filters in Modal
(e.g., Monthly Status | Atish Shah | 01-10-2026 to 23-10-2026 | Status: Quotation sent)
                               │
                               ▼
        Live API Fetch: apiClient.get('/leads', { limit: 100000 })
                               │
                               ▼
               Dynamic Filter Engine (In-Memory)
  1. Date Range: timestamp between Start 00:00:00 & End 23:59:59
  2. Owner: record.accountOwner === 'Atish Shah'
  3. Status: record.status matches 'Quotation sent'
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     [Export Excel]                         [View Report]
            │                                     │
            ▼                                     ▼
  exportExcelWorkbook()                  <StructuredReportModal>
  - Filename: monthly-status-            - Real-time Total Records Badge
    atish-shah-2026-10-23.xlsx           - Active Filter Chips
  - Formatted Header & Column Widths     - Instant Live Data Table
  - Downloads directly to user           - Export CSV / Excel / Print
```

### Dynamic Excel Output Columns:
1. **`#` (Serial No)**: Sequential integer `1, 2, 3...`
2. **`Account No`**: `clientAccountNumber` or `accountNumber`
3. **`Account Name`**: Company / Account name
4. **`Contact Person`**: Name of primary contact
5. **`Phone`**: Primary telephone / mobile
6. **`Email`**: Primary contact email
7. **`Status`**: Current stage / status
8. **`Owner`**: Account owner (`Atish Shah`, etc.)
9. **`Account Date`**: Formatted `DD/MM/YYYY`
10. **`City`**: Location / city

---

## 4. Implementation Steps (To Be Performed Upon Approval)

### Step 1: Remove "Count By" Notice Box & Update Grid in `CustomReportsPage.jsx`
- Open `src/pages/admin/reports/CustomReportsPage.jsx`.
- In `<CustomReportFilterModal>`:
  - Delete lines 893–900 (`<div className="cr-filter-count-box">...</div>`).
  - Arrange fields in the exact 4-row layout:
    - Row 1: `Report Name`, `Visibility`
    - Row 2: `Period`, `Owner`
    - Row 3: `Start Date`, `End Date`
    - Row 4: `Select Status` (`className="cr-filter-field cr-filter-field--full"`)
  - Wrap both `<CustomReportFilterModal>` and `<StructuredReportModal>` inside `createPortal(..., document.body)`.

### Step 2: Ensure 100% Dynamic Collection Querying in `runFilterQuery`
- Verify that `fetchLiveLeads()` queries `apiClient.get('/leads', { params: { limit: 100000 } })` so it never relies on stale cached data.
- Ensure `handleApplyFilterExport` passes the dynamic filtered rows directly to `exportExcelWorkbook` with dynamic title:
  ```javascript
  const filename = `${slugify(filterState.reportName || 'report')}-${slugify(filterState.owner || 'all')}-${new Date().toISOString().slice(0, 10)}.xlsx`
  const title = `${filterState.reportName} — ${filterState.owner} (${filterState.period === 'Custom Date Range' ? `${filterState.startDate} to ${filterState.endDate}` : filterState.period})`
  ```

### Step 3: Update Modal Styles in `CustomReportsPage.css`
- Remove `.cr-filter-count-box` and `.cr-filter-count-icon` CSS rules.
- Set `.cr-filter-modal`:
  - `max-width: 620px;`
  - `border-radius: 12px;`
  - `box-shadow: 0 25px 60px rgba(0, 0, 0, 0.22);`
- Ensure `.cr-filter-grid` has `gap: 1.1rem 1.25rem;` for clean vertical rhythm.
- Set `.cr-filter-field input, .cr-filter-field select`:
  - `height: 2.35rem;`
  - `border: 1px solid #cbd5e1;`
  - Focus ring with brand red `#c60016`: `box-shadow: 0 0 0 3px rgba(198, 0, 22, 0.12);`
- Set `.cr-filter-modal-footer`:
  - Reset button on the left.
  - Close, Export Excel, View Report on the right.

---

## 5. Non-Regression & Preservation Guarantees

In accordance with all user instructions:
- **Zero changes to custom report creation logic**: `CustomReportBuilderPage.jsx` and `/reports/templates` backend remain 100% untouched.
- **Zero changes to Add Account, Add Deal, Add Quotation, Add Customer**: All creation and detail backends remain untouched.
- **Zero changes to backend services**: `ownerCode`, Outlook, Taskopad, Mobile, and Automatic Deal Convert Status remain 100% untouched.
- **Compiled verification**: Production build will be verified with `npm run build` with 0 errors.
