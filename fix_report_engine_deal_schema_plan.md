# Implementation Plan: Fix MissingSchemaError ("Deal") in Report Engine & Schedule Failure Rescheduling

---

## 1. Problem Analysis & Root Cause

### 1.1. MissingSchemaError for Model "Deal"
- **Terminal Error Output**:
  ```text
  [ReportScheduler] Triggering scheduled execution for "TEst Report" (6ad2190aca97ddfb05c5d6e5)...
  [ReportScheduler] Execution failed for schedule 6ad2190aca97ddfb05c5d6e5: MissingSchemaError: Schema hasn't been registered for model "Deal".
  Use mongoose.model(name, schema)
      at Mongoose.model (server/node_modules/mongoose/lib/mongoose.js:577:13)
      at getMongoModel (server/services/reportEngine.js:24:19)
      at executeReportPayload (server/services/reportEngine.js:81:17)
      at generateReportExcelBuffer (server/services/scheduledReportService.js:91:30)
  ```
- **Root Cause**:
  - In `server/services/reportEngine.js`, model resolution was defined as:
    ```javascript
    const MODEL_MAP = {
      account: 'Lead',
      lead: 'Lead',
      deal: 'Deal',
      customer: 'Customer',
      quotation: 'Quotation',
    };

    const getMongoModel = (entityType) => {
      const modelName = MODEL_MAP[entityType] || 'Lead';
      if (mongoose.models[modelName]) return mongoose.models[modelName];
      return mongoose.model(modelName); // Throws MissingSchemaError if 'Deal' hasn't been registered yet!
    };
    ```
  - In this CRM platform, collections and schemas are initialized dynamically with indexes and schemas via `server/models/mongoModels.js` using `getMongoModel(collectionName)`.
  - When the background scheduler ticks without prior HTTP requests touching `Deal`, `mongoose.models['Deal']` is not in Mongoose's internal registry, causing `mongoose.model('Deal')` to throw `MissingSchemaError`.

### 1.2. Schedule Failure Backoff & Rescheduling
- When `executeSchedule()` fails in `server/jobs/reportScheduler.js`, `schedule.nextRunAt` was not advanced to the next scheduled interval, causing the minute-tick runner to re-attempt the failing schedule every 60 seconds indefinitely.
- Advancing `schedule.nextRunAt` upon failure ensures it adheres to the configured schedule (Daily or Weekly) and prevents log spam.

---

## 2. Proposed Changes

### Step 2.1: Connect `reportEngine.js` to `mongoModels.js`
**Target File**: `server/services/reportEngine.js`
- Import `getMongoModel` from `../models/mongoModels`.
- Update `getMongoModel(entityType)` in `reportEngine.js` to map entity types to collection names and retrieve the schema-backed model:
  ```javascript
  const { getMongoModel: getDbModel } = require('../models/mongoModels');

  const COLLECTION_NAME_MAP = {
    account: 'leads',
    lead: 'leads',
    deal: 'deals',
    customer: 'customers',
    quotation: 'quotations',
    remark: 'leads',
  };

  const getMongoModel = (entityType) => {
    const colName = COLLECTION_NAME_MAP[entityType] || 'leads';
    return getDbModel(colName);
  };
  ```
- **Benefits**:
  - Automatically loads and registers schemas for `deals`, `leads`, `customers`, and `quotations`.
  - Fixes both the automated cron scheduler and the manual web reports (`/api/reports/preview` and `/api/reports/export-excel`).

### Step 2.2: Advance `nextRunAt` on Failure in `reportScheduler.js`
**Target File**: `server/jobs/reportScheduler.js`
- Import `calculateNextRunAt` from `../services/scheduledReportService`.
- In the `catch (execErr)` block:
  ```javascript
  const nextRunAt = calculateNextRunAt(
    schedule.schedule?.frequency || 'daily',
    schedule.schedule?.time || '18:00',
    new Date()
  );

  await ScheduledReport.findByIdAndUpdate(schedule._id, {
    $set: {
      lockedAt: null,
      lastRunStatus: 'failed',
      lastError: execErr.message || 'Execution failed',
      'schedule.nextRunAt': nextRunAt,
    },
    $inc: { failedRuns: 1, totalRuns: 1 },
  });
  ```

---

## 3. Protected Systems & Zero-Regression Guardrails

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

## 4. Verification & Testing Steps

1. **Schema Loading Verification**:
   - Run a test script in `server` executing `reportEngine.executeReportPayload({ dataSource: 'deal' })`.
   - Confirm it successfully resolves the `Deal` model and queries deals without `MissingSchemaError`.
2. **Scheduler Execution Verification**:
   - Run a scheduled test trigger for the active "TEst Report" schedule.
   - Confirm it builds the `.xlsx` buffer and dispatches via Outlook.
3. **Backend Health & Syntax**:
   - Run `node -c server/services/reportEngine.js server/jobs/reportScheduler.js` to ensure zero syntax errors.
