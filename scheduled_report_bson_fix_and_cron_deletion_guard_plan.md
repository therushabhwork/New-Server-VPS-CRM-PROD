# Implementation Plan: Fix BSONError on createdBy & Ensure Immediate Cron Deletion / Graph API Halting

---

## 1. Problem Analysis & Root Causes

### 1.1. BSONError on `createdBy` Value `"16"`
- **Error Encountered**:
  ```text
  ScheduledReport validation failed: createdBy: Cast to ObjectId failed for value "16" (type number) at path "createdBy" because of "BSONError"
  ```
- **Root Cause**:
  - In this CRM platform, users have numerical or string-based legacy IDs (e.g. `16` for user ID 16).
  - In `server/models/ScheduledReport.js`, the schema defined:
    ```javascript
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    }
    ```
  - When `req.user.id` (`16` or `"16"`) is assigned, Mongoose attempts to cast it into a 24-character hexadecimal BSON ObjectId, which fails with a `BSONError`.
  - In all other models across this repository (e.g., `Report.js`, `mongoModels.js`), `createdBy` is stored as `Schema.Types.Mixed` or `String`.

### 1.2. Deletion Lifecycle: Instantly Stop Cron & Halt Graph API Calls
- **User Requirement**:
  *"Make sure when I Activate and after that When i delete it can deletes the cron and stop calling the graph api to run automatically."*
- **Mechanism**:
  - The scheduler operates as a dynamic, database-driven cron engine (`server/jobs/reportScheduler.js`) that polls MongoDB every minute:
    ```javascript
    ScheduledReport.find({
      isEnabled: true,
      status: 'active',
      'schedule.nextRunAt': { $lte: now }
    })
    ```
  - When a schedule is **Deleted** (`DELETE /api/scheduled-reports/:id`), the document is permanently removed from the collection, preventing any future tick from ever matching or executing it.
  - To prevent race conditions (e.g. deletion occurring while a minute tick is currently running in memory), a **Pre-Send In-Flight Guard** will check existence and active state immediately before invoking Microsoft Graph:
    ```javascript
    const scheduleStillExists = await ScheduledReport.findById(scheduleId, { isEnabled: 1, status: 1 }).lean();
    if (!scheduleStillExists || !scheduleStillExists.isEnabled || scheduleStillExists.status !== 'active') {
      console.log(`[ScheduledReport] Schedule ${scheduleId} was deleted or deactivated; immediately halting execution and blocking Graph API call.`);
      return { skipped: true, reason: 'schedule_deleted_or_deactivated' };
    }
    ```

---

## 2. Step-by-Step Implementation Strategy

### Step 2.1: Update `ScheduledReport` Model Schema
**Target File**: `server/models/ScheduledReport.js`
- Change `createdBy` definition from `mongoose.Schema.Types.ObjectId` to `mongoose.Schema.Types.Mixed`:
  ```javascript
  createdBy: {
    type: mongoose.Schema.Types.Mixed, // Supports numeric legacyId (16), string ("16"), or ObjectId
    default: null,
  },
  ```
- Update `ReportDeliveryLog.js` schema for `scheduleId`:
  ```javascript
  scheduleId: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true,
  },
  ```

### Step 2.2: Update Controller Assignment
**Target File**: `server/controllers/scheduledReportController.js`
- In `createSchedule`:
  ```javascript
  const currentUserId = req.user?.id || req.user?._id || req.user?.legacyId || null
  ```
  Store `createdBy: currentUserId ? String(currentUserId) : null`.
- In `deleteSchedule`:
  - Atomically remove the schedule:
    ```javascript
    await ScheduledReport.findByIdAndDelete(req.params.id)
    await ReportDeliveryLog.deleteMany({ scheduleId: req.params.id })
    ```
  - Any pending in-memory ticks will be intercepted by the Pre-Send Guard.

### Step 2.3: Multi-Key User Resolution in Service
**Target File**: `server/services/scheduledReportService.js`
- When resolving the `actor` for Microsoft Graph delivery:
  ```javascript
  if (!actor && schedule.createdBy) {
    actor = await User.findOne({
      $or: [
        { _id: schedule.createdBy },
        { id: schedule.createdBy },
        { legacyId: schedule.createdBy },
        { email: schedule.creatorEmail },
      ],
    }).lean().catch(() => null)
  }
  ```

### Step 2.4: Pre-Send In-Flight Deletion Guard
**Target File**: `server/services/scheduledReportService.js`
- Right before calling `integrationService.sendOutlookEmail(actor, emailPayload)`:
  ```javascript
  // Pre-Send Deletion & Deactivation Guard
  const liveCheck = await ScheduledReport.findById(scheduleId, { isEnabled: 1, status: 1 }).lean()
  if (!liveCheck || !liveCheck.isEnabled || liveCheck.status !== 'active') {
    console.log(`[ScheduledReport] Schedule ${scheduleId} was deleted or deactivated before dispatch. Halting Microsoft Graph API call immediately.`)
    return { skipped: true, reason: 'schedule_deleted_or_deactivated' }
  }
  ```

---

## 3. Workflow Diagram: Deletion & Immediate Halting

```
User clicks [Delete] on Schedule
            │
            ▼
DELETE /api/scheduled-reports/:id
            │
            ├─► ScheduledReport.findByIdAndDelete(id) [Removed from MongoDB]
            └─► ReportDeliveryLog.deleteMany({ scheduleId: id })
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│ Next Minute Tick in reportScheduler.js:                       │
│ Query: { isEnabled: true, status: 'active', nextRunAt: <= now }│
│ Result: Document no longer exists in MongoDB!                │
│ -> 0 schedules matched -> NO Graph API calls executed!       │
└───────────────────────────────────────────────────────────────┘
            │
┌───────────────────────────────────────────────────────────────┐
│ In-Flight Millisecond Protection (If deleted mid-execution):  │
│ executeSchedule() queries live DB before send:                │
│ -> liveCheck === null                                         │
│ -> Logs: "Schedule was deleted. Halting Graph API call."      │
│ -> Aborts execution -> NO email sent!                         │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Protected Systems & Zero-Regression Guardrails

The following modules, logic, and configurations remain **100% untouched and preserved**:
- **Add Account Mechanism & Wizard**: Step flows, validations, and storage remain untouched.
- **ownerCode Backend & Permissions**: Owner assignments, permissions, and directory mapping remain untouched.
- **Deals & Deal Details Backend**: Add deals, deal details, deal auto-convert settings, and converted deals remain untouched.
- **Quotations & Quotation Manager**: Add quotation, revision quotations, quotation numbering, and calculations remain untouched.
- **Customer Creation & Logic**: Customer search, creation, and records remain untouched.
- **Mobile Backend APIs**: All mobile endpoints remain untouched.
- **Tasks & Taskpad Mechanism**: Tasks workspace, Kanban, my-work, taskpad, and task reminders remain untouched.
- **Reminders Mechanism**: Add reminder forms and popup modals remain untouched.
- **Outlook Backend**: Core Microsoft Graph OAuth and message handling mechanisms remain untouched.
- **Zero Hardcoding**: All schedule times, frequencies, report configurations, recipients, and UI styles rely strictly on database records and `/admin/monitoring` CSS variables.

---

## 5. Verification & Test Plan

1. **Schedule Creation Test**:
   - Navigate to `http://localhost:3000/admin/email-scheduler/new`.
   - Fill in name and select any report.
   - Click "Save & Activate Schedule".
   - Verify schedule creates successfully with user ID `16` without any `BSONError`.
2. **Immediate Deletion Test**:
   - On `http://localhost:3000/admin/email-scheduler`, click the Delete icon on the created schedule.
   - Confirm schedule disappears from list.
   - Inspect backend logs to verify that the minute-tick runner never picks up the deleted schedule.
3. **Deactivation Test**:
   - Create another schedule and click `Deactivate`.
   - Verify `isEnabled` is `false`, `nextRunAt` is set to `null`, and cron runner ignores it.
4. **Build & Syntax Verification**:
   - Run `npm run build` and `node -c` to verify zero errors.
