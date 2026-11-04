# Implementation Plan: Account Re-Assignment Reminder Creation & UI Parity

## 1. Executive Summary
This implementation plan defines the solution for **Changes-2: Reminder creation for Re-Assign Account**, fulfilling all requirements specified by the user:
- On Admin URLs:
  - `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1&accountId=5333`
  - `http://localhost:3000/admin/accounts/search?stage=new&page=1&accountId=5333`
- On Non-Admin URLs:
  - `http://localhost:3000/accounts/my-accounts?stage=new&page=1&accountId=5333`
  - `http://localhost:3000/accounts/search?stage=new&page=1&accountId=5333`
- When clicking the **Re-Assign Account** button, the re-assignment form fields, labels, layout, chip selectors, time slots, description textarea, and reminder creation options/sizes must match the **exact design and behavior** of the reference Re-Assign Deal interface:
  - Admin Reference: [CRMActionPage.jsx](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/crm-actions/CRMActionPage.jsx) (`/admin/crm-actions/re-assign-deal?module=deal&dealId=4364&returnTo=%2Fadmin%2Fdeals%2Fview`)
  - Non-Admin Reference: (`/crm-actions/re-assign-deal?module=deal&dealId=4367&returnTo=%2Fdeals%2Fview`)
- When a reminder is enabled during account re-assignment, it will be saved into the **MongoDB `reminders` collection** tagged specifically for the account.
- **Strict Isolation**: Account-wise reminder creation and backend handling will be maintained in dedicated, isolated files with reusable and lightweight UI components.
- **Zero-Touch Guarantee**: The existing Deal-wise reminder creation and Deal re-assignment logic (`CRMActionPage.jsx`) will remain **completely untouched**.

---

## 2. Current State vs. Target State

### Current State
- When clicking **Re-Assign Account** from the account drawer or table, [AccountActionModal.jsx](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/accounts/AccountActionModal.jsx) opens a minimal modal containing only a single `<select>` dropdown titled `Account Owner`.
- There is no field for `Description`, no checkbox to `Add a reminder to new Account Owner?`, no date chips (`Today`, `Tomorrow`, `Next 7 Days`, `Other`), no time chips (`09:00 AM` to `05:00 PM`, `Other`), and no message textarea.
- Consequently, no reminder document is created in the MongoDB `reminders` collection when an account is re-assigned.

### Target State
- When clicking **Re-Assign Account**, the user is presented with the **exact same form fields, labels, chip selectors, and CSS dimensions** as seen in the Deal Re-Assign page:
  1. **Title / Header**: `Re-Assign Account` with a close button (`×` / `<FaTimes />`).
  2. **Account Name / Reference Row**: `Account Name: <strong>{account.customerName || account.name}</strong>` styled with `.crm-action-reassign-deal-name`.
  3. **Owner & Description Panel**:
     - Label: `New Account Owner` with select dropdown containing available users.
     - Label: `Description` with a 3-row textarea (`placeholder="Enter re-assignment description..."`).
  4. **Reminder Checkbox Toggle**:
     - Checkbox: `Add a reminder to new Account Owner?`.
  5. **Reminder Sub-Panel** (conditionally visible when checkbox is checked):
     - **Timing Radio Row**: `Now` vs `Different Time`.
     - **When Different Time is selected**:
       - `Date:` Chip selector group with 5 day chips (`Today`, date presets) + `Other` (revealing an HTML5 `<input type="date">`).
       - `Time:` Chip selector group with 9 business time slots (`09:00 AM`, `10:00 AM`, `11:00 AM`, `12:00 PM`, `01:00 PM`, `02:00 PM`, `03:00 PM`, `04:00 PM`, `05:00 PM`) + `Other` (revealing an HTML5 `<input type="time">`).
     - **Reminder Message Textarea**:
       - Textarea with default value: `"Account has been assigned to you"`.
  6. **Footer Action Buttons**:
     - `Close` button (outline style with `<FaTimes />`).
     - `Save` button (primary green `#8dc667` with `<FaSave />`).
- On Save:
  - Updates the account's owner, history, `accountDate`, `lastReassignedAt`, and creates the system activity remark (`Changes-1`).
  - If reminder was enabled, creates a reminder document in MongoDB `reminders` collection with `relatedEntityType: 'account'`, `accountId: account.id`, and `dealId: null`.

---

## 3. Architecture & File Isolation Strategy

To satisfy the user constraint:
> *"Note: Make sure creates the isolated files for account wise reminder creation and their backend and reusable code and lightweight ui code. Must not change and must not touch the Deal wise reminder creation..."*

We organize the implementation into dedicated, isolated files:

```
[Frontend Isolated Module]
  ├── src/features/adminAccounts/components/AccountReassignReminderForm.jsx  (Isolated UI component mirroring Deal Re-Assign)
  ├── src/features/adminAccounts/components/AccountReassignReminderForm.css  (Isolated CSS matching CRMActionPage.css sizes)
  └── src/features/adminAccounts/services/accountReminderApi.js              (Isolated frontend API client for account reminders)

[Backend Isolated Module]
  ├── server/services/accountReminderService.js                               (Isolated service ensuring account-level payload contracts)
  └── server/routes/accountReminderRoutes.js (or controller method)          (Isolated backend endpoint or clean helper)

[Integration Hooks]
  ├── src/pages/admin/accounts/AccountActionModal.jsx                       (Mounts AccountReassignReminderForm for modal drawer action)
  └── src/pages/admin/accounts/AccountActionPlaceholderPage.jsx             (Mounts AccountReassignReminderForm for standalone route)
```

---

## 4. Detailed Component Design & Specifications

### 4.1. Isolated Frontend Component: `AccountReassignReminderForm.jsx`
- **Location**: `src/features/adminAccounts/components/AccountReassignReminderForm.jsx`
- **Props**:
  - `account`: The account object being re-assigned.
  - `ownerOptions`: List of active CRM users/owners.
  - `onSaveSuccess`: Callback triggered after successful re-assignment and reminder creation.
  - `onClose`: Callback to dismiss the form / close the modal.
- **Form State**:
  ```javascript
  const [newOwnerId, setNewOwnerId] = useState('')
  const [description, setDescription] = useState('')
  const [addReminder, setAddReminder] = useState(true) // Checked by default, matching CRMActionPage
  const [reminderTiming, setReminderTiming] = useState('Different Time') // 'Now' | 'Different Time'
  const [reminderDatePreset, setReminderDatePreset] = useState(getTodayKey())
  const [customDate, setCustomDate] = useState('')
  const [reminderTimeSlot, setReminderTimeSlot] = useState('09:00')
  const [customTime, setCustomTime] = useState('')
  const [message, setMessage] = useState('Account has been assigned to you')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  ```
- **Date Presets Calculation**:
  - Exactly as in `CRMActionPage.jsx`: generates 5 dynamic day chips (`addDays(0)` to `addDays(4)`) using `formatReassignDateLabel(value)`.
  - Additional chip: `Other`.
- **Time Presets**:
  - 9 standard slots: `09:00 AM`, `10:00 AM`, `11:00 AM`, `12:00 PM`, `01:00 PM`, `02:00 PM`, `03:00 PM`, `04:00 PM`, `05:00 PM`.
  - Additional chip: `Other`.
- **Validation**:
  - `newOwnerId` is required.
  - If `addReminder` is true and `reminderTiming === 'Different Time'`:
    - If `reminderDatePreset === 'Other'`, `customDate` is mandatory.
    - If `reminderTimeSlot === 'Other'`, `customTime` is mandatory.

### 4.2. Styling & Visual Consistency: `AccountReassignReminderForm.css`
- Directly utilizes or replicates the exact CSS declarations from [CRMActionPage.css](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/crm-actions/CRMActionPage.css):
  - `.crm-action-reassign-form`: `width: min(600px, calc(100vw - 2rem))`, `border: 3px solid var(--border-subtle)`, `background: var(--surface-card)`.
  - `.crm-action-reassign-title-row`: `min-height: 3rem`, `padding: 0.65rem 1rem`, `background: var(--surface-app)`.
  - `.crm-action-reassign-deal-name`: `padding: 1rem 0.6rem 0.7rem`, `font-size: 1rem`.
  - `.crm-action-reassign-owner-panel`: `padding: 0.85rem 1rem`, `border-radius: 0.3rem`, `background: var(--surface-muted)`.
  - `.crm-action-reassign-check`: checkbox row with `accent-color: var(--text-primary)`.
  - `.crm-action-reassign-reminder-panel`: `padding: 0.85rem 1rem`.
  - `.crm-action-reassign-radio-row`: radio button layout with `0.85rem` font size.
  - `.crm-action-reassign-chip-group`: chip flex wrap with `.crm-action-reassign-chip` pill buttons and green gradient active state (`#8dc667 0%, #79b75b 100%`).
  - `.crm-action-reassign-message`: textarea with `min-height: 4.35rem`.
  - `.crm-action-reassign-footer`: flex end button row with `min-height: 2.4rem` action buttons.

---

## 5. Backend Reminder Service & MongoDB Schema Isolation

### 5.1. MongoDB `reminders` Collection Document Contract
When a reminder is created via Account Re-Assignment, the document inserted into the `reminders` collection will have the following contract:

```json
{
  "_id": "ObjectId(...)",
  "legacyId": 10452,
  "title": "Reassigned Account Follow-Up: Acme Corporation",
  "message": "Account has been assigned to you",
  "remindAt": "2026-11-05T09:00:00",
  "status": "scheduled",
  "reminderDate": "2026-11-05",
  "reminderTime": "09:00",
  "reminderMode": "Ownership Follow Up",
  "assignedTo": "16",
  "createdBy": "1",
  "relatedEntityType": "account",
  "relatedEntityId": "5333",
  "accountId": "5333",
  "dealId": null,
  "companyId": 1,
  "recurrence": "none",
  "data": {
    "accountName": "Acme Corporation",
    "accountNumber": "ACC-5333",
    "reassignedBy": "Keval V Shah",
    "reassignedTo": "Jay Pandya",
    "description": "Urgent lead follow up"
  },
  "createdAt": "2026-11-04T11:45:00.000Z",
  "updatedAt": "2026-11-04T11:45:00.000Z"
}
```

### 5.2. Isolation Guarantee
- `dealId` is strictly `null` (or omitted), guaranteeing that deal reminder queries (`{ dealId: { $ne: null } }` or `{ relatedEntityType: 'deal' }`) are never affected.
- `relatedEntityType: 'account'` guarantees account-specific scoping.
- Deal Re-Assign in `CRMActionPage.jsx` continues to use its existing `relatedEntityType: 'deal'` payload unchanged.

### 5.3. Isolated Backend Service: `server/services/accountReminderService.js`
- Provides an isolated helper/service to validate and construct account reminders:
  ```javascript
  const reminderService = require('./reminderService')
  
  const createAccountReminder = async (accountPayload, actor) => {
    const payload = {
      title: accountPayload.title || `Reassigned Account Follow-Up: ${accountPayload.accountName || 'Account'}`,
      message: accountPayload.message || 'Account has been assigned to you',
      remindAt: accountPayload.remindAt,
      reminderDate: accountPayload.reminderDate,
      reminderTime: accountPayload.reminderTime,
      reminderMode: 'Ownership Follow Up',
      status: 'scheduled',
      assignedTo: String(accountPayload.assignedTo || actor.id),
      createdBy: String(actor.id),
      relatedEntityType: 'account',
      relatedEntityId: String(accountPayload.accountId),
      accountId: String(accountPayload.accountId),
      dealId: null,
      data: {
        accountName: accountPayload.accountName,
        accountNumber: accountPayload.accountNumber,
        description: accountPayload.description,
      },
    }
    return reminderService.create(payload, actor)
  }
  ```

---

## 6. Integration Points in Admin and User Views

### 6.1. `AccountActionModal.jsx`
In [src/pages/admin/accounts/AccountActionModal.jsx](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/accounts/AccountActionModal.jsx):
- When `actionKey === 're-assign-account'`, replace the simple single `<select>` with `<AccountReassignReminderForm />`.
- When rendered inside the modal, render the form cleanly with its full visual layout matching `CRMActionPage`.
- On submit:
  1. Executes account re-assignment (updating owner, `lastReassignedAt`, `accountDate`, and pushing the system update remark).
  2. If `addReminder` is checked, invokes `accountReminderApi.createAccountReminder(...)`.
  3. Displays success notification, calls `onSaved()`, and closes the modal.

### 6.2. `AccountActionPlaceholderPage.jsx`
In [src/pages/admin/accounts/AccountActionPlaceholderPage.jsx](file:///c:/Users/Lumos/Desktop/New-Server-VPS-CRM-PROD/src/pages/admin/accounts/AccountActionPlaceholderPage.jsx):
- When route is `/admin/accounts/actions/re-assign-account` or `/accounts/actions/re-assign-account`, render `<AccountReassignReminderForm />` with the selected account and return navigation.

---

## 7. Zero-Touch Constraints & Non-Regression Checklist

| Component / Subsystem | Status | Safety Guarantee |
| :--- | :--- | :--- |
| **Deal Re-Assign Form** (`CRMActionPage.jsx`) | **ZERO TOUCH** | Completely untouched; remains dedicated to `/admin/crm-actions/re-assign-deal` and `/crm-actions/re-assign-deal`. |
| **Deal Reminders** | **ZERO TOUCH** | Deal reminder logic and payload structure unchanged. |
| **Add Account / Add Deals / Add Quotations** | **ZERO TOUCH** | Untouched. |
| **Custom Reports & Date Filter Logic** | **ZERO TOUCH** | Untouched. |
| **Automatic Deal Convert Status** | **ZERO TOUCH** | Untouched. |
| **Mobile & Outlook Backends** | **ZERO TOUCH** | Untouched. |
| **Changes-1 Re-Assign System Updates** | **PRESERVED** | Preserves `Re-assign Account from {OldOwner} to {NewOwner}.` remark creation and table date sort elevation. |

---

## 8. Step-by-Step Implementation Sequence

1. **Step 1**: Create isolated backend service `server/services/accountReminderService.js` (and route `server/routes/accountReminderRoutes.js` if separate endpoint preferred, or utilize direct CRUD with account-scoped payload).
2. **Step 2**: Create isolated frontend service `src/features/adminAccounts/services/accountReminderApi.js`.
3. **Step 3**: Create isolated UI component `src/features/adminAccounts/components/AccountReassignReminderForm.jsx` and styling in `AccountReassignReminderForm.css` (mirroring `CRMActionPage.css` sizes, chips, and labels).
4. **Step 4**: Integrate `AccountReassignReminderForm` into `AccountActionModal.jsx` and `AccountActionPlaceholderPage.jsx` for both Admin and Non-Admin roles.
5. **Step 5**: Test and verify:
   - Form rendering on `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1&accountId=5333`.
   - Form rendering on `http://localhost:3000/admin/accounts/search?stage=new&page=1&accountId=5333`.
   - Form rendering on non-admin routes (`/accounts/my-accounts`, `/accounts/search`).
   - Reminder document created in MongoDB `reminders` collection with `relatedEntityType: 'account'`.
   - Re-Assign Deal page tested to confirm zero regression.
   - Run `npm run build` to verify clean build.

