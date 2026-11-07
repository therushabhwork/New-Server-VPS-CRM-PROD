# Swati CRM – Multi-Route UI & Data Fixes Implementation Plan

> **CRITICAL DIRECTIVE**: **DO NOT IMPLEMENT YET**. This document is an implementation plan for user review and approval only. No production or codebase modifications are performed during this step.

---

## 1. Executive Summary & Problem Scope

This implementation plan addresses six key requirements identified across admin and non-admin routes in Swati CRM:

1. **Add Accounts Spacing & Sizing Optimization (`http://localhost:3000/admin/accounts/new`)**:
   - Section cards, grid column gaps, and vertical margins currently create an unbalanced spacing profile across widescreen and laptop displays.
   - **Resolution**: Refine `.add-account-landscape-page`, `.add-account-landscape-form`, `.add-account-mockup-columns`, and card spacing in [`AddAccountWizard.css`](src/pages/accounts/AddAccountWizard.css) and [`AddAccountWizard.jsx`](src/pages/accounts/AddAccountWizard.jsx) to establish proportional rhythm, standard max-width, balanced gaps, and unified padding.

2. **Reassign Account Dynamic Owner Name Update (`http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1&accountId=2922`)**:
   - Reassigning an account saves to database but the owner name fails to update reliably in table rows, drawer headers, and snapshot strips because the frontend payload in [`AccountReassignReminderForm.jsx`](src/features/adminAccounts/components/AccountReassignReminderForm.jsx) omits `accountOwner`, `ownerName`, and `assignedTo`, causing backend [`server/services/leadService.js`](server/services/leadService.js) to fall back to `existingLead?.accountOwner`.
   - **Resolution**: Include full dual-schema owner attributes (`accountOwner`, `ownerName`, `accountOwnerName`, `owner`, `assignedTo`, `ownerUserId`, `ownerCode`, `accountOwnerCode`) in the reassign payload and guarantee immediate frontend reactive state sync across table, drawer, and headers for all admin and non-admin users.

3. **Remove Filter Icon from Accounts Tables (`http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1` & `http://localhost:3000/admin/accounts/search?stage=new&page=1`)**:
   - The filter icon button in the table action header is redundant and confusing for both admin and non-admin users on both My Accounts and Search Account boards.
   - **Resolution**: Set `showFilterIcon: false` in [`src/features/adminAccounts/config/accountBoardViews.js`](src/features/adminAccounts/config/accountBoardViews.js) for `myAccounts` and `searchAccount`, ensuring [`AccountBoardHeaderActions.jsx`](src/components/admin/accounts/AccountBoardHeaderActions.jsx) does not render it.

4. **Deal Dropdown Display & Positioning Fix (`http://localhost:3000/admin/deals/search` & `http://localhost:3000/admin/deals/view/3018`)**:
   - Dropdown menus on `/admin/deals/search` (row/card actions) and `/admin/deals/view/3018` (header actions menu) fail to display properly when clicked due to z-index clipping, id mismatch (`_id` vs `id`), and pointer-down race conditions.
   - **Resolution**: Unify deal ID matching (`rawDeal?.id || rawDeal?._id || row?.id || row?._id`), ensure robust viewport coordinates in [`Deals.jsx`](src/pages/deals/Deals.jsx) with `createPortal`, and elevate `.c-deal-actions-dropdown` with higher z-index and click-outside protection in [`DealHeader.jsx`](src/pages/admin/deals/components/DealHeader.jsx) and [`AdminDealDetailPage.css`](src/pages/admin/deals/AdminDealDetailPage.css).

5. **Remove "Manage Account" Action Button (`http://localhost:3000/admin/accounts/search?stage=new&page=1&accountId=2919`)**:
   - The "Manage Account" option in the account action dropdown/drawer is unwanted.
   - **Resolution**: Remove the `manage-account` configuration from [`src/features/adminAccounts/config/accountActions.js`](src/features/adminAccounts/config/accountActions.js) (`actionConfig` and `userAccountActionKeys`), removing it universally for all admin and non-admin users.

6. **Pure White Theme & Background Removal (`1 (2).png`)**:
   - Maintain pure `#ffffff` card/page backgrounds with high-contrast text (`#0f172a` / `#1e293b`), corporate red accents (`#c60016`), and crisp light borders (`#e2e8f0`).

---

## 2. Inviolable Scope Guardrails (Strict Do-Not-Touch Rules)

The following core modules and logic paths remain strictly untouched:
- **Custom Report Creation Logic**: Must NOT touch and must NOT change the entire custom report creation logic without User groups selection with their custom date filtering.
- **Add Account Mechanism & Backend**: Must NOT touch the core Add Account creation mechanism and `ownerCode` backend logic.
- **Add Deals Logic & Deal Details Backend**: Must NOT touch Deal creation, Add Deal logic, and Deal details backend.
- **Add Quotations Logic & Revision Quotations**: Must NOT touch Quotation creation, deal quotation mechanism, account quotation mechanism, or revision quotations for accounts and deals.
- **Add Customers Logic & Backend**: Must NOT touch customer creation logic and its backend.
- **Mobile Backend & Outlook Integration**: Must NOT touch mobile backend routes and Outlook calendar/email synchronization.
- **Automatic Deal Convert Status & Taskopad**: Must NOT touch automatic deal convert status by Save settings or Taskopad tasks mechanism.
- **LIFO & Collection-Wise Fetching**: All MongoDB collection-level fetching, 10 records per page, and strict LIFO ordering implemented in prior turns are 100% preserved.

---

## 3. Detailed Component-by-Component Implementation Steps

### Step 1: Add Accounts Layout Spacing & Sizing Optimization
- **File**: [`src/pages/accounts/AddAccountWizard.css`](src/pages/accounts/AddAccountWizard.css)
- **Target Areas**:
  - `.add-account-landscape-page`: Set balanced top/bottom padding `clamp(1rem, 2vw, 1.75rem)` and horizontal padding `clamp(1rem, 2.5vw, 2.5rem)`.
  - `.add-account-landscape-form`: Standardize `max-width: 1440px` (or fluid `100%` up to `1520px`) with consistent vertical gap `1.25rem`.
  - `.add-account-mockup-columns`: Adjust grid gap from `2.5rem` to a calibrated `1.75rem` - `2rem`, preventing excessive empty space between form columns.
  - `.add-account-landscape-section`: Set padding to `1.25rem 1.5rem`, ensuring sections maintain consistent internal breathing room without vertical bloating.
  - `.add-account-landscape-footer`: Refine spacing and button positioning for seamless flow.

### Step 2: Account Reassignment Owner Name Dynamic Update
- **Files**:
  - [`src/features/adminAccounts/components/AccountReassignReminderForm.jsx`](src/features/adminAccounts/components/AccountReassignReminderForm.jsx)
  - [`server/services/leadService.js`](server/services/leadService.js)
- **Changes**:
  1. In `AccountReassignReminderForm.jsx`, enrich the `updates` payload:
     ```javascript
     const updates = {
       accountOwner: newOwnerName,
       ownerName: newOwnerName,
       accountOwnerName: newOwnerName,
       owner: newOwnerName,
       assignedTo: selectedOwner?.id || null,
       ownerUserId: selectedOwner?.id || null,
       assignedUserId: selectedOwner?.id || null,
       ownerId: selectedOwner?.id || null,
       ownerCode: selectedOwner?.ownerCode || '',
       accountOwnerCode: selectedOwner?.ownerCode || '',
       company: selectedOwner?.company || selectedOwner?.companyName || account.accountCategory || '',
       accountDate: reassignTimestamp,
       lastReassignedAt: reassignTimestamp,
       updatedAt: reassignTimestamp,
       latestRemark: reassignMessage,
       ownershipHistory: [
         ...(Array.isArray(account.ownershipHistory) ? account.ownershipHistory : (Array.isArray(account.raw?.ownershipHistory) ? account.raw.ownershipHistory : [])),
         newOwnershipEntry,
       ],
     }
     ```
  2. In `server/services/leadService.js` (around line 170-185), ensure `sanitizedPayload.accountOwner` and `sanitizedPayload.ownerName` take precedence over `existingLead?.accountOwner` during update, so the newly assigned owner is stored permanently.
  3. In `AccountReassignReminderForm.jsx`, ensure that when `updateAccount(account.id, updates)` resolves successfully, local state and parent contexts immediately reflect the new owner name on the table row, drawer header, and snapshot card without requiring a hard page refresh.

### Step 3: Remove Filter Icon from Accounts Tables
- **File**: [`src/features/adminAccounts/config/accountBoardViews.js`](src/features/adminAccounts/config/accountBoardViews.js)
- **Changes**:
  - In `myAccounts` view configuration:
    ```javascript
    titlebarActions: {
      showHelp: false,
      showBulk: true,
      showExportIcon: true,
      showFilterIcon: false, // Changed from true to false
    },
    ```
  - In `searchAccount` view configuration:
    ```javascript
    titlebarActions: {
      showBulk: true,
      showFilterIcon: false, // Changed from true to false
    },
    ```
  - Verifying [`AccountBoardHeaderActions.jsx`](src/components/admin/accounts/AccountBoardHeaderActions.jsx) suppresses rendering the filter icon button when `actions.showFilterIcon` is falsy for both admin and non-admin users.

### Step 4: Fix Deal Dropdowns on Search & Deal Detail Pages
- **Files**:
  - [`src/pages/deals/Deals.jsx`](src/pages/deals/Deals.jsx)
  - [`src/pages/admin/deals/components/DealHeader.jsx`](src/pages/admin/deals/components/DealHeader.jsx)
  - [`src/pages/admin/deals/AdminDealDetailPage.css`](src/pages/admin/deals/AdminDealDetailPage.css)
- **Changes**:
  1. **`/admin/deals/search` (Table Action Dropdown)**:
     - In `handleToggleDealMenu`: Support robust dual-identifier matching:
       ```javascript
       const dealId = String(row?.rawDeal?.id || row?.rawDeal?._id || row?.id || row?._id || '')
       ```
     - In `renderInlineDealActionMenu`: Compare `openBoardActionMenuDealId` against `String(activeDeal?.id || activeDeal?._id || activeDeal?.dealId || '')`.
     - In `Deals.css`: Ensure `.deals-crm-row-action-menu-portal` retains `z-index: 2147483600` and `pointer-events: auto`.
     - In pointer-down handler: Prevent race condition where clicking the trigger button closes and immediately re-closes the portal menu.
  2. **`/admin/deals/view/3018` (Deal Header Actions Dropdown)**:
     - In `AdminDealDetailPage.css`: Increase `.c-deal-actions-dropdown` `z-index` to `1050` and add `box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 4px 10px -2px rgba(0, 0, 0, 0.1);`.
     - In `DealHeader.jsx`: Ensure the `actionsMenuRef` pointer-down event properly distinguishes the trigger button and menu items so the menu displays reliably when clicked.

### Step 5: Remove "Manage Account" Action Button
- **File**: [`src/features/adminAccounts/config/accountActions.js`](src/features/adminAccounts/config/accountActions.js)
- **Changes**:
  - Remove the `manage-account` object from `actionConfig`.
  - Remove `'manage-account'` string from `userAccountActionKeys`.
  - Result: The "Manage Account" option will disappear completely from row action menus, drawer menus, and search table dropdowns for all admin and non-admin users.

### Step 6: White Theme & High-Contrast Typography
- **Files**:
  - [`src/styles/index.css`](src/styles/index.css)
  - Layout & Page CSS
- **Changes**:
  - Ensure pure `#ffffff` page backgrounds with dark high-contrast typography (`#0f172a` / `#1e293b`), corporate red `#c60016` highlights, and light `#e2e8f0` borders as shown in `1 (2).png`.

---

## 4. Verification & Testing Checklist

| Step | Verification Check | Expected Result |
| :--- | :--- | :--- |
| 1 | Visit `http://localhost:3000/admin/accounts/new` | Page spacing, column gap, card padding, and form controls are balanced and proportionate. |
| 2 | Open `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1&accountId=2922` and perform Re-Assign | Owner name dynamically changes on table row, drawer header, and snapshot card for both admin and non-admin users. |
| 3 | Visit `http://localhost:3000/admin/accounts/my-accounts?stage=new&page=1` & `http://localhost:3000/admin/accounts/search?stage=new&page=1` | Filter icon is completely removed from the titlebar for all admin and non-admin users. |
| 4 | Visit `http://localhost:3000/admin/deals/search` and click Deal No. / actions button | Dropdown opens cleanly at trigger location without clipping or disappearing. |
| 5 | Visit `http://localhost:3000/admin/deals/view/3018` and click "Actions" | Header actions menu opens properly with all action items visible and clickable. |
| 6 | Visit `http://localhost:3000/admin/accounts/search?stage=new&page=1&accountId=2919` | "Manage Account" is removed from the action dropdown/menu for all users. |
| 7 | Full UI Visual Inspection | Pure `#ffffff` theme with high-contrast text and `#c60016` brand red accents is intact. |
| 8 | Production Build Verification | `npm run build` succeeds with 0 lint and syntax errors. |

