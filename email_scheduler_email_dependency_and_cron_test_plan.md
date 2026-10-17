# Updated Implementation Plan: Email-Based User Resolution, Exact Time Storage & Cron Testing

> [!IMPORTANT]
> **Zero `companyId` Dependency**: This updated plan completely removes any reliance on `companyId` across all Scheduled Reports components. User identity, ownership, and administrative privileges are resolved strictly via the MongoDB `users` collection by matching the user's `email`.

---

## 1. Problem Diagnosis & Architectural Update

### A. Root Cause of Schedule Invisibility & Removal of `companyId`
- **Prior Issue**: `server/controllers/scheduledReportController.js` filtered schedules using `query.companyId = req.user.companyId`. Because `companyId` type differed (string `"1"` vs number `1` vs null), saved schedules did not show up in the table.
- **New Email-Based Architecture**:
  - Completely drop `companyId` filtering.
  - When a user accesses `/admin/email-scheduler`:
    1. Extract user email from `req.user.email`.
    2. Look up the user record directly in MongoDB `users` collection using their email:
       ```js
       const dbUser = await User.findOne({
         email: { $regex: new RegExp(`^${userEmail.trim()}$`, 'i') }
       }).lean()
       ```
    3. If `dbUser.role === 'admin'` or `dbUser.role === 'super_admin'`, return all schedules in the system.
    4. If a standard user, return schedules created by or assigned to that user's email (`creatorEmail` or `recipient.email` or `recipient.additionalEmails`).
  - When running background cron jobs in `server/jobs/reportScheduler.js`:
    - The cron runs without an HTTP request.
    - It resolves the sending actor by looking up the schedule's `creatorEmail` in the MongoDB `users` collection.
    - If `creatorEmail` is not found, it falls back to an active admin user from the MongoDB `users` collection.

### B. Displaying & Storing Exact Execution Time & Date Scope in MongoDB
- **The Confusion**:
  - **`reportConfig.dateRangeType`** (e.g. `"today"`): Determines **which CRM data records** are queried (records created today from 00:00:00 to 23:59:59 IST).
  - **`schedule.time`** (e.g. `"10:10"`): The exact **time of day** when the automated cron runs.
  - **`schedule.nextRunAt`**: The exact upcoming execution timestamp in UTC (representing IST time).
- **The Fix in MongoDB**:
  - In `ScheduledReport`:
    - Save explicit `schedule.timeFormatted`: `"10:10 AM IST"`.
    - Save `reportConfig.dateScopeLabel`: `"Today Only (00:00 to 23:59 IST)"`.
  - In `ReportDeliveryLog` (`reportdelivery_logs` collection):
    - Add explicit schema fields:
      - `scheduledTime`: e.g. `"10:10 AM IST"`
      - `dateRangeType`: e.g. `"today"`
      - `dateRangeFrom`: Date (start of today)
      - `dateRangeTo`: Date (end of today)
      - `nextScheduledRunAt`: Date (next scheduled trigger)
    - Now whenever you inspect `reportdelivery_logs` in MongoDB Compass or CLI, the exact execution time and the date scope are stored directly in every record!

### C. Enhanced Corporate UI Table with Action Buttons
- Top bar of the table maintains all controls: Search, Status Filter, Refresh, and `+ Create Schedule`.
- Table columns:
  1. **Schedule Name & Creator**: Shows schedule name and creator email from `users` collection.
  2. **Data Scope**: Clear badge for `"Today Only (00:00 - 23:59)"` with source context (`Deals`, `Accounts`, etc.).
  3. **Cadence & Execution Time**: Clear text: `Daily at 10:10 AM IST`.
  4. **Next Execution**: Date and time formatted in IST (e.g. `17 Oct 2026, 10:10 AM`).
  5. **Recipient**: Recipient email and CC count.
  6. **Status**: Corporate Active / Inactive badge.
  7. **Actions Column**:
     - **Activate / Deactivate Button**: Corporate button with `<FaPlay>` / `<FaPause>` and clear label.
     - **Run Now Button**: Instant execution trigger button with `<FaPlay>`.
     - **Delivery History Button**: Modal opener with `<FaHistory>`.
     - **Delete Button**: Prominent corporate button with `<FaTrashAlt /> <span>Delete</span>` in danger accent.

---

## 2. Detailed Technical Changes

### Step 1: Update MongoDB Schemas
#### 1. [server/models/ScheduledReport.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/models/ScheduledReport.js)
- Ensure `creatorEmail` is indexed for fast email lookups.
- Add `schedule.timeFormatted` (`String`) and `reportConfig.dateScopeLabel` (`String`).
- Remove any required constraint on `companyId`.

#### 2. [server/models/ReportDeliveryLog.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/models/ReportDeliveryLog.js)
- Add explicit fields:
  ```js
  scheduledTime: { type: String, default: '' },        // e.g. "10:10 AM IST"
  dateRangeType: { type: String, default: 'today' },   // e.g. "today"
  dateRangeFrom: { type: Date, default: null },        // 00:00:00 IST
  dateRangeTo: { type: Date, default: null },          // 23:59:59 IST
  nextScheduledRunAt: { type: Date, default: null },   // Next run timestamp
  ```

### Step 2: Update Controller to Use MongoDB `users` Collection by Email
#### [server/controllers/scheduledReportController.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/controllers/scheduledReportController.js)
- Import `getMongoModel` to get `User` from MongoDB `users` collection.
- In `getSchedules`:
  1. Retrieve user's email: `const userEmail = req.user?.email || ''`.
  2. Query MongoDB:
     ```js
     const User = getMongoModel('users')
     const dbUser = await User.findOne({
       email: { $regex: new RegExp(`^${userEmail.trim()}$`, 'i') }
     }).lean()
     ```
  3. Determine privilege:
     - If `dbUser?.role === 'admin'` or `dbUser?.role === 'super_admin'` or `req.user?.role === 'admin'`:
       Query is `{}` (fetch all schedules!).
     - Else:
       Query schedules where `creatorEmail` matches userEmail or `recipient.email` matches userEmail.
  4. **Zero `companyId` references**.
- In `createSchedule`:
  - Store `creatorEmail: userEmail`.
  - Store `schedule.timeFormatted`: formatted string (e.g. `10:10 AM IST`).
  - Calculate `nextRunAt` for IST.

### Step 3: Update Execution Service to Resolve Sender by Email
#### [server/services/scheduledReportService.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/services/scheduledReportService.js)
- When resolving sender/actor for Outlook email delivery:
  ```js
  let actor = options.actor
  if (!actor && schedule.creatorEmail) {
    actor = await User.findOne({
      email: { $regex: new RegExp(`^${schedule.creatorEmail.trim()}$`, 'i') }
    }).lean()
  }
  if (!actor) {
    actor = await User.findOne({ role: 'admin' }).lean()
  }
  ```
- In `ReportDeliveryLog.create`:
  - Pass `scheduledTime: schedule.schedule.time ? `${schedule.schedule.time} IST` : ''`
  - Pass `dateRangeType: schedule.reportConfig?.dateRangeType || 'today'`
  - Pass `dateRangeFrom: fromDate`, `dateRangeTo: toDate`
  - Pass `nextScheduledRunAt: nextRunAt`

### Step 4: Frontend Table & Form Updates
#### [src/pages/admin/email-scheduler/EmailSchedulerPage.jsx](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/admin/email-scheduler/EmailSchedulerPage.jsx)
- Display explicit columns:
  - Schedule Name & Creator (showing creator email from MongoDB `users`).
  - Scope: `Today (00:00 - 23:59)`
  - Cadence: `Daily at 10:10 AM IST`
  - Next Run: Formatted in IST
  - Status: Active / Inactive
  - Actions:
    - **Activate / Deactivate** button
    - **Run Now** button
    - **History** button
    - **Delete** button with danger accent (`<FaTrashAlt /> Delete`)
- Ensure error banners display helpful feedback if any request fails.

---

## 3. How to Test the Cron Job (Step-by-Step)

### Method 1: Automated Background Cron Test (Real-Time Test)
1. Note the current local time on your computer (e.g., if current time is `10:18 AM`).
2. Navigate to `http://localhost:3000/admin/email-scheduler/new`.
3. In the schedule form:
   - **Schedule Name**: `Test 10:20 AM Report`
   - **Select Report**: Choose `Deal Report` (or any other source).
   - **Frequency**: `Daily (Every Day)`.
   - **Execution Time (IST)**: Set the time to **2 minutes ahead** of current time (e.g. `10:20`).
   - **Data Date Window**: Select **Today Only (00:00 to 23:59)**.
   - **Recipient Email**: Your email.
   - Check **Activate Schedule Immediately**.
4. Click **Save & Activate Schedule**.
5. You are redirected to `http://localhost:3000/admin/email-scheduler`. The new schedule appears immediately with **Next Run: Today at 10:20 AM IST**.
6. When your system clock reaches `10:20 AM`:
   - The background cron in `server/jobs/reportScheduler.js` (which runs every 60 seconds) detects that `'schedule.nextRunAt' <= now`.
   - It acquires an atomic lock, looks up the user in MongoDB `users` by email, generates the Excel report for today's data, and sends the email via Outlook.
   - The server terminal logs:
     ```
     [ReportScheduler] Triggering scheduled execution for "Test 10:20 AM Report"...
     [ReportScheduler] Completed execution for "Test 10:20 AM Report".
     ```
   - Check your inbox: The email arrives with the Excel attachment.
   - Refresh the page: Status shows `Last run: Just now`, and `Next Run` automatically advances to tomorrow at 10:20 AM IST.
   - In MongoDB, `reportdelivery_logs` contains the new document with `scheduledTime: "10:20 IST"` and `dateRangeType: "today"`.

### Method 2: Instant "Run Now" Test (Without Waiting)
1. On `http://localhost:3000/admin/email-scheduler`, find any schedule in the table.
2. In the **Actions** column, click the **"Run Now"** button.
3. Confirm the confirmation prompt.
4. The system immediately executes the report pipeline for "Today", sends the email via Outlook, and logs the execution.
5. Click the **History** button to view the delivery log immediately.

---

## 4. Protected Areas & Zero-Regression Safeguards
The following areas are strictly **NOT** touched or altered:
- Add Account mechanism & ownerCode backend
- Add Deals logic & Deal details backend
- Deal convert status & Converted Deals logic
- Add Quotations logic, revision quotations, and Quotation numbering
- Add Customers logic & customer creation
- Tasks mechanism, Taskpad, and Add Reminders form/popup
- Mobile backend
- Outlook Graph core authentication & Graph mechanisms
- Monitoring theme tokens (`/admin/monitoring` styles strictly preserved with no hardcoded CSS colors)
