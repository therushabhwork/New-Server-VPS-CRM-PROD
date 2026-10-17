# Updated Implementation Plan: Report Schedules Visibility, Drop Obsolete Collection & Resolve Outlook Connection

> [!IMPORTANT]
> **Outlook Mechanism Preserved**: The core Outlook backend and Microsoft Graph mechanisms remain completely untouched. The `AppError: Connect Outlook before sending email` is resolved in `scheduledReportService.js` by passing the connected global/shared Outlook actor (`id: 'shared'`, which is already authenticated and connected in MongoDB `microsoft_tokens` via `/admin/settings`) whenever the cron worker executes.

---

## 1. Problem Diagnosis & Root Causes

### A. The "Connect Outlook before sending email" Error in Background Cron
- **The Error Log**:
  ```
  [ReportScheduler] Triggering scheduled execution for "Swati-2 Report Automated Delivery" (6ad3007ad5f1a79506b15196)...
  [ScheduledReport] Error sending email for schedule 6ad3007ad5f1a79506b15196: AppError: Connect Outlook before sending email.
  ```
- **Root Cause**:
  1. The background cron runs without an active user HTTP request.
  2. In `server/services/scheduledReportService.js`, the actor was queried from MongoDB `users` collection:
     ```js
     actor = await User.findOne({ email: schedule.creatorEmail }).lean()
     ```
  3. In MongoDB `users` collection, documents have `_id: ObjectId(...)` but **no `id` property**.
  4. When `integrationService.sendOutlookEmail(actor, ...)` ran:
     `integrationService.getOutlookStatus(actor)` checked `actor.id`, which was `undefined`.
  5. Furthermore, individual users do not have dedicated Outlook OAuth tokens; the system's connected Outlook is stored as the **organization-wide shared connection** (`userId: 'shared'` with email `sales2@swatiswitchgears.com` in `/admin/settings`).
  6. **Solution**: In `scheduledReportService.js`, when preparing the actor for email dispatch, ensure:
     ```js
     const status = await integrationService.getOutlookStatus(actor)
     if (!status.connected) {
       // Seamlessly use the connected organization Outlook connection from /admin/settings
       actor = { ...actor, id: 'shared', role: 'admin' }
     }
     ```
     This utilizes the existing, connected Microsoft Graph token (`userId: 'shared'`) without modifying any Outlook backend logic.

---

### B. Why Schedules Are Not Visible in the Report Schedules Table
- **Root Cause**: A double data-unwrap bug in `src/services/scheduledReportApi.js`.
  1. `apiClient.interceptors.response` already unwraps Axios responses to `response.data`:
     ```js
     apiClient.interceptors.response.use((response) => response.data, ...)
     ```
     So `await apiClient.get('/scheduled-reports')` returns the backend payload `{ success: true, data: [...schedules], kpis: {...} }`.
  2. In `scheduledReportApi.getSchedules()`:
     ```js
     const body = response?.data ?? response // body becomes the array of schedules!
     return {
       schedules: Array.isArray(body?.data) ? body.data : [], // Checks [array].data -> UNDEFINED -> returns []!
       kpis: body?.kpis || {},
     }
     ```
  3. Because it attempted to read `.data` on the array itself, `Array.isArray(body?.data)` evaluated to `false`, discarding all schedules and returning an empty list (`[]`).
  4. The same unwrap bug affected `getDeliveryHistory()` (`Array.isArray(body?.data)`).
- **Solution**: Normalize response handling in `src/services/scheduledReportApi.js` to correctly accept `response.data` or `response`.

---

### C. Obsolete MongoDB Collection Cleanup
- MongoDB currently contains two schedule collections:
  - `scheduledreports` (4 active live schedules used by Mongoose).
  - `scheduled_reports` (3 obsolete legacy test records).
- **Solution**: Execute a one-time drop of the obsolete `scheduled_reports` collection (and empty `report_delivery_logs`) from MongoDB so only `scheduledreports` and `reportdeliverylogs` remain.

---

## 2. Step-by-Step Implementation Plan

### Step 1: Drop Obsolete `scheduled_reports` Collection in MongoDB
- Execute a safe cleanup script:
  ```js
  await mongoose.connection.collection('scheduled_reports').drop()
  ```
- Verify that only `scheduledreports` remains active.

### Step 2: Fix Response Unwrapping in `src/services/scheduledReportApi.js`
**File**: [src/services/scheduledReportApi.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/services/scheduledReportApi.js)
- Update `getSchedules`:
  ```js
  getSchedules: async (params = {}) => {
    try {
      const response = await apiClient.get('/scheduled-reports', { params })
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.schedules)
            ? response.schedules
            : []
      const kpis = response?.kpis || response?.data?.kpis || {}
      return {
        schedules: list,
        kpis,
      }
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error)
      return { schedules: [], kpis: {} }
    }
  },
  ```
- Update `getDeliveryHistory`:
  ```js
  getDeliveryHistory: async (id) => {
    try {
      const response = await apiClient.get(`/scheduled-reports/${encodeURIComponent(id)}/history`)
      if (Array.isArray(response)) return response
      if (Array.isArray(response?.data)) return response.data
      return []
    } catch (error) {
      console.error('Failed to fetch delivery history:', error)
      return []
    }
  },
  ```
- Update `getSchedule`:
  ```js
  getSchedule: async (id) => {
    try {
      const response = await apiClient.get(`/scheduled-reports/${encodeURIComponent(id)}`)
      return response?.data || response || null
    } catch (error) {
      console.error('Failed to fetch schedule details:', error)
      return null
    }
  },
  ```

### Step 3: Fix Actor Outlook Resolution in `scheduledReportService.js`
**File**: [server/services/scheduledReportService.js](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/server/services/scheduledReportService.js)
- When resolving `actor` in `executeSchedule`:
  ```js
  // 1. Resolve user actor from MongoDB users collection by creatorEmail
  if (!actor && schedule.creatorEmail) {
    actor = await User.findOne({
      email: { $regex: new RegExp(`^${schedule.creatorEmail.trim()}$`, 'i') },
    }).lean().catch(() => null)
  }

  // 2. Normalize actor ID for Outlook integration compatibility
  if (actor) {
    actor = {
      ...actor,
      id: actor.id || (actor._id ? String(actor._id) : 'shared'),
    }
  } else {
    actor = { id: 'shared', role: 'admin', email: schedule.creatorEmail || 'admin' }
  }

  // 3. Fallback to connected organization Outlook if actor's personal token is not connected
  const outlookStatus = await integrationService.getOutlookStatus(actor)
  if (!outlookStatus.connected) {
    actor = {
      ...actor,
      id: 'shared',
      role: 'admin',
    }
  }
  ```
- This ensures `integrationService.sendOutlookEmail(actor, ...)` automatically connects to the authenticated shared Microsoft Graph token in MongoDB without modifying any Outlook backend internals.

### Step 4: Verification & Live Test
1. **Frontend Build Check**: Run `npm run build` to verify 0 errors.
2. **List Visibility Check**: Navigate to `http://localhost:3000/admin/email-scheduler` and confirm all 4 schedules appear in the Report Schedules table with:
   - Schedule Name & Creator
   - Data Scope (`Today Only (00:00 - 23:59 IST)`)
   - Cadence & Execution Time (`Daily at ... IST`)
   - Next Run in IST
   - Status: Active
   - Corporate action buttons: **Activate/Deactivate**, **Run Now**, **History**, **Delete**
3. **Outlook Email Delivery Test**: Click **Run Now** on any schedule row. Confirm that:
   - Microsoft Graph sendMail succeeds.
   - The email is delivered to the recipient with the Excel attachment.
   - The delivery log in MongoDB `reportdeliverylogs` records status `sent` with `scheduledTime` and `dateRangeType`.

---

## 3. Strict Protection & Zero-Regression Safeguards
- **Outlook Backend**: No changes to `integrationService.js` or Microsoft Graph token mechanisms.
- **Protected Business Modules**: Add Account, ownerCode logic, Add Deals, Deal details, Converted Deals, Add Quotations, Revision Quotations, Quotation numbering, Add Customers, Tasks, Taskpad, Reminders, and Mobile backend remain strictly untouched.
- **Design Integrity**: All UI colors and styling strictly use existing `/admin/monitoring` classes and CSS variables without hardcoded values.
