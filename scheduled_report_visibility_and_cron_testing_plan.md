# Implementation Plan: Scheduled Reports Visibility, Exact Execution Time Storage & Cron Testing Guide

## Executive Summary
This plan addresses the two issues and testing requirements reported on `http://localhost:3000/admin/email-scheduler` and `http://localhost:3000/admin/email-scheduler/new`:
1. **Issue 1 (List Visibility & Action Buttons)**: Why schedules saved on `/admin/email-scheduler/new` did not appear in the table with Activate and Delete buttons, and fixing the query/role filtering in `server/controllers/scheduledReportController.js` so all administrator schedules reliably display.
2. **Issue 2 (Exact Execution Time & "Today" Date Window Storage in MongoDB)**: Ensuring both collections (`scheduledreports` and `reportdelivery_logs`) explicitly record and display the exact execution time (e.g., `10:10 AM IST`), the next execution date/time, and the data date window (`"today"`: 00:00:00 to 23:59:59 IST).
3. **Cron Job Live Testing Guide**: Explaining exactly how to test the automated cron job right now at a target time (e.g., 10:10 AM / 2 minutes ahead) or instantly via the "Run Now" button.

---

## 1. Root Cause Analysis

### A. Why Saved Schedules Did Not Appear in the Table
- In `server/controllers/scheduledReportController.js`, `getSchedules` applied:
  ```js
  const query = {}
  if (req.user?.companyId) {
    query.companyId = req.user.companyId
  }
  ```
- **Type Mismatch & Admin Scope**:
  - `ScheduledReport` schema had `companyId` typed as `String`, whereas `req.user.companyId` is stored as an integer (`1`) or string (`"1"`) or undefined.
  - In Admin/Super Admin sessions, restricting by strict `companyId` prevented administrators from viewing schedules created with null or mismatched company identifiers.
  - In other admin modules (like `reportRoutes.js`), administrators have global visibility over system and custom templates without restrictive company query filters.
- **Action Buttons in Table**:
  - The Delete button was an icon-only button (`<FaTrashAlt />`), while the user expects explicit, prominent **Activate/Deactivate** and **Delete** action buttons with clear corporate styling adhering to `/admin/monitoring`.

### B. Understanding Date Scope ("Today") vs. Execution Time ("10:10 AM")
There are two distinct concepts that must both be explicitly saved and documented in MongoDB:
1. **Data Date Window (`reportConfig.dateRangeType: "today"`)**:
   - This defines **which CRM records** are included in the Excel report.
   - For `"today"`, records created between `00:00:00` and `23:59:59` IST on the day of execution are extracted.
2. **Cadence & Execution Time (`schedule.time: "10:10"`, `schedule.nextRunAt`)**:
   - This defines **when the cron wakes up** and delivers the report via Outlook.
   - For daily at `10:10 AM IST`, `calculateNextRunAt` sets `nextRunAt` to the exact UTC timestamp corresponding to 10:10 AM IST (`04:40:00 UTC`).
   - If `10:10 AM` has already passed today when the schedule is created, `calculateNextRunAt` sets the time to **tomorrow at 10:10 AM IST**.
3. **Missing Fields in `reportdelivery_logs`**:
   - Currently, `reportdelivery_logs` only records `executedAt: Date` and `recordCount`.
   - It does **not** record `scheduledTime` (e.g., `"10:10 AM IST"`), `dateRangeType` (`"today"`), or `nextScheduledRunAt`. Therefore, when inspecting `reportdelivery_logs` in MongoDB Compass or CLI, the scheduled time was not visible.

---

## 2. Proposed Changes

### Component 1: Controller & Backend Query Scope
**File**: [server/controllers/scheduledReportController.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/controllers/scheduledReportController.js)
- Import `isPrivilegedRole` from `../security/accessScope`.
- In `getSchedules`:
  - For admin / privileged users, allow global visibility across company schedules, or support multi-format matching:
    ```js
    if (!isPrivilegedRole(req.user?.role) && req.user?.companyId) {
      query.$or = [
        { companyId: req.user.companyId },
        { companyId: String(req.user.companyId) },
        { createdBy: String(req.user.id) },
      ]
    }
    ```
  - Return formatted display helpers in schedule objects: `timeFormatted: "10:10 AM IST"`, `dateScopeLabel: "Today Only"`.

### Component 2: MongoDB Schemas Update
**Files**:
- [server/models/ScheduledReport.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/models/ScheduledReport.js)
  - Ensure `companyId` is `mongoose.Schema.Types.Mixed` to prevent casting bugs.
  - Store `schedule.timeFormatted` (e.g. `"10:10 AM IST"`) alongside `schedule.time: "10:10"`.
- [server/models/ReportDeliveryLog.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/models/ReportDeliveryLog.js)
  - Add explicit tracking fields:
    ```js
    scheduledTime: { type: String, default: '' },        // e.g. "10:10 AM IST"
    dateRangeType: { type: String, default: 'today' },   // e.g. "today"
    dateRangeFrom: { type: Date, default: null },        // Today 00:00:00 IST
    dateRangeTo: { type: Date, default: null },          // Today 23:59:59 IST
    nextScheduledRunAt: { type: Date, default: null },   // Next run timestamp
    ```

### Component 3: Execution Service Logging
**File**: [server/services/scheduledReportService.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/services/scheduledReportService.js)
- When `executeSchedule` runs:
  - Populate the new fields in `ReportDeliveryLog.create`:
    - `scheduledTime`: `${schedule.schedule.time} IST`
    - `dateRangeType`: `schedule.reportConfig?.dateRangeType || 'today'`
    - `dateRangeFrom`: `fromDate`
    - `dateRangeTo`: `toDate`
    - `nextScheduledRunAt`: `nextRunAt`
  - Ensure that whenever a report runs, MongoDB `reportdelivery_logs` contains the complete audit trail including the exact scheduled time and data scope.

### Component 4: Frontend Table & Action Buttons
**File**: [src/pages/admin/email-scheduler/EmailSchedulerPage.jsx](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/admin/email-scheduler/EmailSchedulerPage.jsx)
- **Top Bar Table Controls**: Maintain search, status filter, refresh, and `+ Create Schedule` on `.ap-card-head`.
- **Table Columns Clarity**:
  1. **Schedule Name & Creator**: Schedule name, creator name, email.
  2. **Data Scope**: Clear badge for `"Today Only (00:00 - 23:59)"`, `"Last 7 Days"`, etc., plus source entity (`Deals`, `Accounts`, `Customers`).
  3. **Cadence & Execution Time**: Display `Daily at 10:10 AM IST`.
  4. **Next Run (IST)**: Formatted date and time (e.g., `17 Oct 2026, 10:10 AM`).
  5. **Recipient**: Recipient email and CC count.
  6. **Status**: Active / Inactive badge.
  7. **Actions Column**:
     - **Activate / Deactivate** button: Green/neutral corporate button with `<FaPlay>` / `<FaPause>`.
     - **Run Now** button: Immediate trigger button with `<FaPlay>`.
     - **History** button: Opens log modal.
     - **Delete** button: Prominent corporate button with `<FaTrashAlt /> <span>Delete</span>` in danger accent.

---

## 3. How to Test the Cron Job

### Option A: Automatic Scheduled Execution (Real Cron Test)
1. Check your computer's current local time (e.g., `10:15 AM`).
2. Go to `http://localhost:3000/admin/email-scheduler/new`.
3. Fill in:
   - **Schedule Name**: e.g. `Test 10:18 AM Today Report`
   - **Select Report**: e.g. `Deal Report (deal)`
   - **Frequency**: `Daily (Every Day)`
   - **Execution Time (IST)**: Set time **2 to 3 minutes ahead** of current clock (e.g. `10:18`).
   - **Data Date Window**: Choose `Today Only (00:00 to 23:59)`.
   - **Recipient Email**: Your Outlook or test email.
   - Ensure **Activate Schedule Immediately** is checked.
4. Click **Save & Activate Schedule**.
5. You will be redirected to `http://localhost:3000/admin/email-scheduler`.
6. Notice the table row shows:
   - Next Run: `Today at 10:18 AM IST`.
   - Status: `Active`.
7. When the clock turns `10:18 AM`:
   - The background worker in `server/jobs/reportScheduler.js` (which ticks every 60 seconds) detects `'schedule.nextRunAt' <= now`.
   - The console logs:
     ```
     [ReportScheduler] Triggering scheduled execution for "Test 10:18 AM Today Report"...
     [ReportScheduler] Completed execution for "Test 10:18 AM Today Report".
     ```
   - The email is sent automatically via Microsoft Graph Outlook API with the `.xlsx` file attached.
   - In MongoDB, `reportdelivery_logs` records the delivery log with `scheduledTime: "10:18 IST"` and `dateRangeType: "today"`.
   - Refresh the page: Status shows `Last run: 10:18 AM`, and Next Run advances to `Tomorrow 10:18 AM`.

### Option B: Instant Test (Immediate Verification without Waiting)
1. On `http://localhost:3000/admin/email-scheduler`, locate any active or saved schedule in the table.
2. In the **Actions** column, click the **"Run Now"** button.
3. Confirm the prompt: *"Run [Schedule Name] right now and send the report via Outlook?"*.
4. The backend immediately queries today's records, compiles the Excel file, calls Outlook Graph API, sends the email, and logs the execution to `reportdelivery_logs`.
5. Click the **History** icon on the table row to view the live execution log with record counts, attachment size, and status.

---

## 4. Protected Areas & Zero Regression Guarantee
This plan touches **only**:
- `server/controllers/scheduledReportController.js`
- `server/models/ScheduledReport.js`
- `server/models/ReportDeliveryLog.js`
- `server/services/scheduledReportService.js`
- `src/pages/admin/email-scheduler/EmailSchedulerPage.jsx`

The following modules will **NOT** be modified:
- Add Account mechanism & ownerCode backend
- Add Deals logic & Deal details backend
- Deal convert status & Converted Deals logic
- Add Quotations logic, revision quotations, and Quotation numbering
- Add Customers logic & customer creation
- Tasks mechanism, Taskpad, and Add Reminders form/popup
- Mobile backend
- Outlook Graph core authentication & Graph mechanisms
- Monitoring theme tokens (`/admin/monitoring` styles strictly preserved with no hardcoded CSS colors)
