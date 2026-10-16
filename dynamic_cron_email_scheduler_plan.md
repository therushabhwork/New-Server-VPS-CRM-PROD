# Implementation Plan: Dynamic Cron Email Report Scheduler & Sidebar Reorganization

---

## 1. Executive Summary & Core Objectives

1. **Dynamic Database-Driven Cron Scheduler**:
   - Provide an automated reporting engine that sends CRM reports via **Microsoft Graph / Connected Outlook Mail** on a configurable schedule:
     - **Daily** at a specific local time (IST).
     - **Every 7 Days** (weekly from activation date/time) at a specific local time (IST).
   - Ensure the scheduler is fully **database-driven** with frontend **Activate / Deactivate** controls:
     - **Active (`isEnabled: true`)**: Eligible for automatic cron execution and Outlook email dispatch.
     - **Inactive (`isEnabled: false`)**: Immediately suspended. Deactivation prevents future email sends even if the scheduled time arrives.
   - Support **Run Now** (manual test run without altering recurring schedule state), **View Delivery History**, **Edit**, and **Delete**.

2. **Integration with Custom Reports Ecosystem**:
   - Seamlessly populate report choices from all **three sources** present on `http://localhost:3000/reports/custom`:
     1. **MongoDB `reporttemplates` Collection**: User/Admin-created custom templates fetched via `GET /api/reports/templates`.
     2. **MongoDB `reports` Collection**: Saved / previously generated report instances fetched via `GET /api/reports`.
     3. **Built-in System Report Templates**: Pre-configured defaults (`Account Report`, `Deal Report`, `Customer Daily Status`, `Remark Update`) plus browser `localStorage` templates.
   - When a schedule is created, store the exact report configuration (data source, selected columns, custom filter operators, user group scoping, and owner filters).
   - On scheduled execution, query live MongoDB collections (`leads`, `deals`, `customers`, `quotations`), filter by date range, generate the `.xlsx` workbook in memory on the server, attach it, and dispatch via Microsoft Graph.

3. **UI/UX Design Parity with `http://localhost:3000/admin/monitoring` (Zero Hardcoding)**:
   - **All colors, tokens, and themes strictly derived from `/admin/monitoring`** (`AdminPanel.css`):
     - **KPI Cards**: Exact markup, classes, and micro-wave styling from `/admin/monitoring` (`.ap-kpi-card`, `.ap-kpi-icon-wrap`, `.ap-kpi-main`, `.ap-kpi-val-row`, `.ap-kpi-value`, `.ap-kpi-title`, and `.ap-kpi-wave`).
     - **Containers & Shells**: Use `.ap-dashboard-card`, `.ap-card-header`, `.ap-card-title`, and `.ap-card-body`.
     - **Tables**: Use `.ap-table` matching `/admin/monitoring` with crimson header row, zebra row hover, and subtle borders.
     - **Buttons**: `.ap-header-item-btn` and `.ap-btn--primary` with brand maroon gradient.
     - **Theme Tokens**: All styling relies strictly on CSS classes and theme variables (`var(--surface-card)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--border-subtle)`). **No hardcoded inline color hexes or pixel styles.**

4. **Sidebar Navigation Reorganization**:
   - Move the standalone **Email Templates** item into a newly created parent accordion group: **`Email Settings`** (styled identically to `Accounts`, `Deals`, `Tasks`, `Reminders`).
   - Inside **`Email Settings`**, provide two dedicated sublinks:
     - **`Email Templates`** (`/admin/email-templates`): Retaining 100% of current backend, UI, and logic untouched.
     - **`Email Scheduler`** (`/admin/email-scheduler` and alias `/reports/scheduled-emails`): Management dashboard for dynamic cron schedules.

---

## 2. Complete Architecture & Workflow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND WORKFLOW                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
  1. User navigates to Sidebar -> Email Settings -> Email Scheduler (/admin/email-scheduler)
  2. UI displays KPI Cards with exact /admin/monitoring styles (.ap-kpi-card with SVG wave)
  3. Clicks "+ Create Schedule" -> Opens CreateEmailScheduleModal (.ap-modal)
  4. Selects Report from 3 Sources:
     ├── MongoDB reporttemplates (Custom User/Admin Templates)
     ├── MongoDB reports (Saved / Generated Reports)
     └── Built-in System Reports (Account, Deal, Customer Daily Status, Remark Update)
  5. Configures Frequency (Daily | Every 7 Days), Time (IST), Date Range, and Recipient
  6. Clicks Save -> Persisted to MongoDB `scheduled_reports` collection
  7. User toggles [Activate] / [Deactivate] at any time via .ap-header-item-btn

┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND CRON SCHEDULER ENGINE                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
  1. Recurring Minute Tick (node-cron checks MongoDB every minute)
  2. Identifies due jobs: { isEnabled: true, status: 'active', 'schedule.nextRunAt': <= now }
  3. Atomically claims job with lock to prevent duplicate sends
  4. Double-checks `isEnabled === true` right before execution
  5. Queries live MongoDB collections:
     ├── 'leads' collection (Accounts)
     ├── 'deals' collection (Deals)
     ├── 'customers' collection (Customers)
     └── 'quotations' collection (Quotations)
  6. Applies saved template columns, filters, user groups, and owner scoping
  7. Builds .xlsx workbook buffer in server memory (via xlsx engine)
  8. Re-verifies activation status guard immediately before network dispatch
  9. Sends email with .xlsx attachment using Microsoft Graph / Outlook integration
 10. Records outcome in `report_delivery_logs` and advances `nextRunAt`
```

---

## 3. UI/UX Design System Specifications (`/admin/monitoring` Parity)

To strictly enforce the requirement: **"Every ui color and themes are based on http://localhost:3000/admin/monitoring and must not hardcode anything in for ui designs and theme"**, the new components will directly import and utilize `src/pages/admin/AdminPanel.css` and its established design tokens.

### 3.1. KPI Summary Cards
Built with the exact structure used on `/admin/monitoring` and `/admin/tasks`:
```jsx
<div className="ap-kpi-card">
  <div className="ap-kpi-icon-wrap">
    {kpi.icon}
  </div>
  <div className="ap-kpi-main">
    <div className="ap-kpi-val-row">
      <span className="ap-kpi-value">{kpi.value}</span>
    </div>
    <div className="ap-kpi-title">{kpi.label}</div>
  </div>
  <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0,25 Q30,10 60,20 T100,5 L100,30 L0,30 Z" fill="rgba(198, 0, 22, 0.08)" />
  </svg>
</div>
```
- **KPI Metrics**:
  1. **Total Schedules**: All created schedules.
  2. **Active Schedules**: Enabled recurring schedules (`isEnabled: true`).
  3. **Inactive Schedules**: Paused schedules (`isEnabled: false`).
  4. **Successful Runs**: Successfully sent report emails.
  5. **Failed Runs**: Errored executions (if any).
  6. **Next Due Execution**: Countdown or time of next upcoming report.

### 3.2. Data Table Design
- Uses `.ap-table` and `.table-container`:
  - **Header (`thead th`)**: Styled via AdminPanel CSS (`background: linear-gradient(...)`, bold white uppercase text, clean padding).
  - **Row Hover**: Soft interactive hover using `var(--surface-hover)` without static colors.
  - **Borders**: Subdued borders using `var(--border-subtle)`.
  - **Status Badges**:
    - **Active**: `.ap-badge.ap-badge--success` (green pill badge).
    - **Inactive**: `.ap-badge.ap-badge--neutral` (slate pill badge).
    - **Processing**: `.ap-badge.ap-badge--warning` (amber pill badge).

### 3.3. Buttons & Controls
- **Primary Buttons** (`+ Create Schedule`, `Save Schedule`): `.ap-btn.ap-btn--primary` with brand maroon gradient.
- **Secondary Buttons** (`Cancel`, `Run Now`): `.ap-btn.ap-btn--secondary`.
- **Action Buttons in Table** (`Activate`, `Deactivate`, `Refresh`): `.ap-header-item-btn`.
- **Search & Filter Inputs**: `.ap-input`, `.ap-select` styled with `var(--surface-card)` and `var(--border-subtle)`.

### 3.4. Modal Window Styling
- Uses `.ap-modal-overlay` and `.ap-modal` matching existing CRM admin modals:
  - Header: `.ap-modal-header` with title and close icon.
  - Body: `.ap-modal-body` with responsive form groups.
  - Footer: `.ap-modal-footer` with cancel and submit buttons.

---

## 4. Sidebar Reorganization Plan

### Target File: `src/components/layout/Sidebar.jsx`
- **Current State**:
  - `Email Templates` is rendered as a standalone link at lines 626–633:
    ```jsx
    <NavLink to="/admin/email-templates" className={...}>
      <span className="sb-link-icon"><FaEnvelope /></span>
      <span>Email Templates</span>
    </NavLink>
    ```
- **New Structure**:
  - Introduce `emailSettingsOpen` state.
  - Automatically expand when current URL matches `/admin/email-templates*` or `/admin/email-scheduler*`.
  - Replace the standalone link with an accordion `SidebarGroup`:
    ```jsx
    <SidebarGroup
      icon={<FaEnvelope />}
      label="Email Settings"
      isActive={isEmailSettingsRoute}
      isOpen={emailSettingsOpen && !isSidebarCollapsed}
      isCollapsed={isSidebarCollapsed}
      onToggle={() => setEmailSettingsOpen(!emailSettingsOpen)}
    >
      <SubLink to="/admin/email-templates" label="Email Templates" />
      <SubLink to="/admin/email-scheduler" label="Email Scheduler" />
    </SidebarGroup>
    ```
- **Preservation**: The entire `EmailTemplatesPage.jsx`, its routes, signature logic, and backend endpoints remain completely unchanged and untouched.

---

## 5. Report Sources & Configuration Mapping

When creating an automated schedule, the frontend modal pulls from all three report sources available in the CRM:

| Source | Collection / Origin | Retrieval Endpoint / Method | Attributes Captured |
|---|---|---|---|
| **Custom Templates** | MongoDB `reporttemplates` | `GET /api/reports/templates` | `templateId`, `reportName`, `entityType`, `selectedFields`, `filters`, `userGroups`, `accountOwner` |
| **Saved / Generated Reports** | MongoDB `reports` | `GET /api/reports` | `reportId`, `reportName`, `entityType`, `displayFields`, `filters`, `userGroups`, `accountOwner` |
| **Built-in System Templates** | Hardcoded Defaults + `localStorage` | `SYSTEM_REPORTS` in `CustomReportsPage` | Context (`account`, `deal`, `customer`, `remark`), default columns, default filters |

### Dynamic Date Range Resolver (Server-Side)
When the cron fires, it dynamically calculates the date window based on the schedule's `dateRangeType`:
- **`today`**: From `00:00:00` to `23:59:59` of the current day.
- **`last_7_days`**: From `now - 7 days (00:00:00)` to current timestamp.
- **`this_month`**: From 1st of the current month to current timestamp.
- **`previous_month`**: Entire preceding calendar month.
- **`all_time`**: No date boundaries applied.

---

## 6. MongoDB Data Schemas

### 6.1. `scheduled_reports` Collection
```javascript
{
  _id: ObjectId("..."),
  name: "Daily Executive Deals Summary",
  companyId: "...",
  createdBy: ObjectId("..."),
  creatorName: "Keval Shah",
  creatorEmail: "keval@swatiswitchgears.com",

  // Complete Report Definition from Source 1, 2, or 3
  reportConfig: {
    sourceType: "reporttemplate", // "reporttemplate" | "saved_report" | "system_report"
    templateId: "670f...",
    reportName: "Deal Report",
    dataSource: "deal",           // "account" | "deal" | "customer" | "quotation"
    selectedFields: ["dealNo", "dealName", "dealValue", "dealStatus", "ownerName", "addedOn"],
    filters: [
      { field: "dealStatus", operator: "!=", value: "Lost" }
    ],
    userGroups: ["Sales Team A"],
    accountOwner: "all",
    dateRangeType: "last_7_days"
  },

  schedule: {
    frequency: "daily",           // "daily" | "weekly_7_days"
    time: "18:00",                // 24-hour HH:mm format
    timezone: "Asia/Kolkata",
    activatedAt: ISODate("2026-10-17T08:30:00Z"),
    nextRunAt: ISODate("2026-10-17T12:30:00Z"), // 18:00 IST in UTC
    lastRunAt: null
  },

  recipient: {
    type: "self",                 // "self" (connected Outlook user) | "custom"
    email: "keval@swatiswitchgears.com"
  },

  isEnabled: true,                // true = Active; false = Inactive (Suspended)
  status: "active",               // "active" | "inactive" | "processing" | "failed"
  lastRunStatus: null,            // "success" | "failed"
  lastError: null,

  // Atomic Execution Lock
  lockedAt: null,
  lockWorkerId: null,

  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

### 6.2. `report_delivery_logs` Collection
```javascript
{
  _id: ObjectId("..."),
  scheduleId: ObjectId("..."),
  scheduleName: "Daily Executive Deals Summary",
  reportType: "deal",
  recipientEmail: "keval@swatiswitchgears.com",
  executedAt: ISODate(),
  recordCount: 48,
  attachmentName: "Daily_Executive_Deals_Summary_2026-10-17.xlsx",
  status: "sent",                 // "sent" | "failed"
  deliveryMethod: "outlook_graph",
  errorMessage: null,
  executionType: "scheduled"      // "scheduled" | "manual_run_now"
}
```

---

## 7. Backend API Specifications (`/api/scheduled-reports`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/scheduled-reports` | List schedules accessible to current user / company |
| `POST` | `/api/scheduled-reports` | Create schedule with initial `isEnabled` state |
| `GET` | `/api/scheduled-reports/:id` | Get single schedule details |
| `PUT` | `/api/scheduled-reports/:id` | Update schedule configuration & recalculate `nextRunAt` |
| `PATCH` | `/api/scheduled-reports/:id/activate` | Set `isEnabled: true`, `status: "active"`, calculate `nextRunAt` |
| `PATCH` | `/api/scheduled-reports/:id/deactivate` | Set `isEnabled: false`, `status: "inactive"`, cancel future cron runs |
| `POST` | `/api/scheduled-reports/:id/run-now` | Immediate one-time manual execution without affecting schedule |
| `GET` | `/api/scheduled-reports/:id/history` | Retrieve delivery execution logs |
| `DELETE` | `/api/scheduled-reports/:id` | Delete schedule and historical logs |

---

## 8. Server-Side Execution & Microsoft Graph Dispatch

### Scheduler Worker (`server/jobs/reportScheduler.js`)
1. **Minute Interval Check**: Runs every 60 seconds.
2. **Query Due Schedules**:
   ```javascript
   const due = await ScheduledReport.find({
     isEnabled: true,
     status: 'active',
     'schedule.nextRunAt': { $lte: new Date() },
     $or: [
       { lockedAt: null },
       { lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }
     ]
   })
   ```
3. **Atomic Claim**: Sets `lockedAt: new Date()` atomically.
4. **Pre-Execution Guard**: Re-reads `isEnabled`; if `false`, releases lock and aborts.
5. **Data Assembly**: Fetches live records from `leads`, `deals`, `customers`, or `quotations` based on the saved template configuration.
6. **Server-Side `.xlsx` Generation**:
   - Converts mapped rows into `.xlsx` binary buffer using `xlsx` library on the server.
7. **Final Guard Before Send**: Verifies schedule is still enabled before dispatching to external network.
8. **Microsoft Graph Send**:
   - Reuses `integrationService.sendOutlookEmail(actor, payload)`:
     ```javascript
     attachments: [{
       '@odata.type': '#microsoft.graph.fileAttachment',
       name: `${scheduleName}_${dateStamp}.xlsx`,
       contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       contentBytes: buffer.toString('base64')
     }]
     ```
9. **Log & Reschedule**:
   - Writes to `report_delivery_logs`.
   - Calculates next `nextRunAt`:
     - **Daily**: Tomorrow at configured IST time.
     - **Every 7 Days**: Exactly 7 days ahead at configured IST time.
   - Clears `lockedAt` and updates `lastRunAt`.

---

## 9. Protected Systems & Zero-Regression Guardrails

The following modules, logic, and configurations will remain **100% untouched and preserved**:
- **Add Account Mechanism & Wizard**: Step flows, validations, and storage remain untouched.
- **ownerCode Backend & Permissions**: Owner assignments, permissions, and directory mapping remain untouched.
- **Deals & Deal Details Backend**: Add deals, deal details, deal auto-convert settings, and converted deals remain untouched.
- **Quotations & Quotation Manager**: Add quotation, revision quotations, quotation numbering, and calculations remain untouched.
- **Customer Creation & Logic**: Customer search, creation, and records remain untouched.
- **Mobile Backend APIs**: All mobile endpoints remain untouched.
- **Tasks & Taskpad Mechanism**: Tasks workspace, Kanban, my-work, taskpad, and task reminders remain untouched.
- **Reminders Mechanism**: Add reminder forms and popup modals remain untouched.
- **Outlook Backend**: The core Microsoft Graph OAuth and message handling mechanisms remain untouched; the scheduler interacts with it purely as a consumer client.
- **Manual Web & Excel Export on `/reports/custom`**: The existing browser-based manual export continues to function exactly as it does today.
- **Zero Hardcoding**: All schedule times, frequencies, report configurations, recipients, and UI styles rely strictly on database records and `/admin/monitoring` CSS variables.

---

## 10. Verification & Test Plan

1. **Sidebar Navigation Test**:
   - Verify `Email Settings` appears in sidebar with `Email Templates` and `Email Scheduler` sublinks.
   - Verify existing `/admin/email-templates` works identically with all templates, signatures, and previews intact.
2. **UI Theme Parity Test**:
   - Verify KPI cards render with the exact `.ap-kpi-card` background, icon-wrap, typography, and `.ap-kpi-wave` background as `/admin/monitoring`.
   - Verify table and modals use `.ap-table` and `.ap-modal` without any hardcoded inline colors.
3. **Schedule Creation Test**:
   - Create a schedule selecting a Custom Report, a Saved Report, and a System Report.
   - Verify schedule appears in table with correct frequency, next run time in IST, and status.
4. **Activation & Deactivation Test**:
   - Click `Deactivate`: verify `isEnabled: false`, badge switches to `Inactive`, and scheduler ignores the job.
   - Click `Activate`: verify `isEnabled: true`, `nextRunAt` is recalculated, and badge switches to `Active`.
5. **Manual Run Now Test**:
   - Click `Run Now` on an inactive or active schedule: verify Excel file is generated, sent to Outlook, and recorded in History log without mutating the recurring schedule.
6. **Automated Cron Execution Test**:
   - Set a test schedule due in 1 minute: verify minute-tick claims the job, generates `.xlsx`, dispatches via Microsoft Graph, and advances `nextRunAt` by 1 day or 7 days.
7. **Build Integrity Verification**:
   - Run `npm run build` to confirm zero compilation or bundling errors.
