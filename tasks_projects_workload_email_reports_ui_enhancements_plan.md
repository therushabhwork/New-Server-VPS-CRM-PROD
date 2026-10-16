# Implementation Plan: Tasks, Projects, Workload, Email Templates & Custom Reports UI Enhancements

---

## 1. Executive Summary & Problem Analysis

### User Requirements
1. **Changes-1 (`http://localhost:3000/admin/tasks`)**:
   - All 6 Level-1 KPI cards on the Admin Tasks overview dashboard must have the exact same design and structure as the KPI cards on `http://localhost:3000/admin/monitoring`.
   - Must feature the left-aligned `#c60016` icon container (`.ap-kpi-icon-wrap`), large `2.2rem` bold stat numbers, title underneath, and the bottom-right decorative SVG wave graphic (`.ap-kpi-wave`).

2. **Changes-2 (`http://localhost:3000/admin/tasks/projects` & `http://localhost:3000/tasks/projects`)**:
   - The **Project Manager** section must appear immediately after the **`PRJ-1`** project header section and directly before the **`Overall Progress`** progress bar section.
   - This must apply to both Admin users (`/admin/tasks/projects`) and Non-admin users (`/tasks/projects`).

3. **Changes-3 (`http://localhost:3000/admin/tasks/my-work` & `http://localhost:3000/tasks/my-work`)**:
   - When navigation tabs are not selected (inactive), their FontAwesome/SVG icons must be light gray (`#64748b` / `rgb(100, 116, 139)`) matching their text color.
   - Inactive tab icons are currently invisible (rendered white on a white background) due to overly broad global CSS selectors. The CSS must ensure inactive tab icons are automatically visible across both admin and non-admin workspaces.

4. **Changes-4 (`http://localhost:3000/admin/tasks/workload`)**:
   - The **User Directory** sidebar height must equal the height of the main dashboard analytics section and remain responsive across laptop and desktop screens.
   - The user directory sidebar is currently shorter than the main analytics sections; apply the specified responsive dimensions (`minHeight: 950px`, `maxHeight: calc(120vh - 175px)`, `height: calc(120vh - 175px)`).

5. **Changes-5 (`http://localhost:3000/admin/email-templates`)**:
   - When typing into the HTML Body editor area, the raw HTML tag code preview (`<textarea className="email-template-generated-html" ... />`) must be hidden from the frontend view only.
   - Must **not** change or touch backend HTML generation, template persistence, or email dispatching logic.

6. **Changes-6 (`http://localhost:3000/admin/reports/custom` & `http://localhost:3000/reports/custom`)**:
   - Remove the **"Need Help?"** button situated to the right of the **"Add Report Template"** dropdown.
   - This must apply to both Admin users (`/admin/reports/custom`) and Non-admin users (`/reports/custom`).

---

## 2. Target Files & Complete Code Changes

---

### Change-1: Synchronize KPI Cards on `/admin/tasks` to Match `/admin/monitoring`

**Target File**: [`src/pages/tasks/AdminTaskDashboard.jsx`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/tasks/AdminTaskDashboard.jsx)  
**Supporting Stylesheet**: [`src/pages/admin/AdminPanel.css`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/admin/AdminPanel.css)

#### A. CSS Import Addition
```javascript
// At top of src/pages/tasks/AdminTaskDashboard.jsx
import { TaskWorkspaceLayout } from './components/common/TaskWorkspaceLayout'
import { TaskCardShell } from './components/common/TaskCardShell'
import { UserEmailBadge } from './components/common/UserEmailBadge'
import { TaskStatusBadge } from './components/common/TaskStatusBadge'
import workManagementService from '../../services/workManagementService'

// Import Monitoring styles to provide .ap-kpi-card, .ap-kpi-icon-wrap, .ap-kpi-main, .ap-kpi-wave
import '../admin/AdminPanel.css'
```

#### B. Before Code: Level-1 KPI Cards (Old Layout)
```jsx
      {/* LEVEL 1: ORGANIZATION KPI OVERVIEW - SINGLE ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          width: '100%',
        }}
      >
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            className="ap-dashboard-card"
            style={{
              padding: '1.1rem 0.85rem',
              minHeight: '115px',
              borderRadius: '16px',
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.45rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                {kpi.label}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: kpi.color, marginTop: '0.35rem' }}>
                {kpi.value}
              </div>
            </div>
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '12px',
                background: 'rgba(198, 0, 22, 0.06)',
                color: '#c60016',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                flexShrink: 0,
              }}
            >
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>
```

#### C. After Code: Level-1 KPI Cards (Exact Match to `/admin/monitoring`)
```jsx
      {/* LEVEL 1: ORGANIZATION KPI OVERVIEW - EXACT MATCH TO /admin/monitoring KPI CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          width: '100%',
        }}
      >
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            className="ap-kpi-card"
            style={{
              cursor: 'default',
            }}
          >
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
        ))}
      </div>
```

---

### Change-2: Reorder Project Manager Section on Project Portfolio

**Target File**: [`src/pages/tasks/ProjectsPortfolioPage.jsx`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/tasks/ProjectsPortfolioPage.jsx)  
*(Used for both `/admin/tasks/projects` and `/tasks/projects`)*

#### A. Before Code: Section Above Progress Bar
```jsx
                {proj.description && (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                    {proj.description}
                  </p>
                )}

                {/* Progress Bar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.76rem' }}>
                    <span style={{ color: '#64748b', fontWeight: '600' }}>Overall Progress</span>
                    <span style={{ fontWeight: '800', color: '#c60016' }}>{proj.progress}%</span>
                  </div>
```

#### B. After Code: Position Project Manager after PRJ-1 and before Overall Progress
```jsx
                {proj.description && (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                    {proj.description}
                  </p>
                )}

                {/* Project Manager Section - Positioned right after PRJ-1 and before Overall Progress */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                    Project Manager
                  </span>
                  <UserEmailBadge email={proj.projectManagerEmail} size="small" />
                </div>

                {/* Progress Bar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.76rem' }}>
                    <span style={{ color: '#64748b', fontWeight: '600' }}>Overall Progress</span>
                    <span style={{ fontWeight: '800', color: '#c60016' }}>{proj.progress}%</span>
                  </div>
```

#### C. Before Code: Bottom Card Footer
```jsx
                {/* Footer Meta: Project Manager & Due Date */}
                <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Project Manager</span>
                    <UserEmailBadge email={proj.projectManagerEmail} size="small" />
                  </div>
                  {proj.endDate && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Target Due</span>
                      <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#1e293b' }}>
                        {new Date(proj.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>
```

#### D. After Code: Bottom Card Footer (Clean Target Due Date)
```jsx
                {/* Footer Meta: Due Date */}
                {proj.endDate && (
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Target Due</span>
                      <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#1e293b' }}>
                        {new Date(proj.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                )}
```

---

### Change-3: Inactive Tab Icon Visibility & Color Fix on `/admin/tasks/my-work` & `/tasks/my-work`

**Target Files**:
1. [`src/pages/admin/AdminPanel.css`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/admin/AdminPanel.css)  
2. [`src/pages/tasks/Tasks.css`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/tasks/Tasks.css)

#### A. AdminPanel.css: Refine white-icon rule to active tabs only
**Before (`src/pages/admin/AdminPanel.css` lines 3316–3334)**:
```css
.admin-panel :is(
  .ap-kpi-icon-wrap svg,
  .ap-integ-icon-box svg,
  .ap-todo-btn svg,
  .ap-stat-icon svg,
  .ap-quick-item svg,
  .ap-dashboard-card-title svg,
  .ap-mycrm-summary-title svg,
  .ap-card-icon svg,
  .ap-section-icon svg,
  .ap-integ-arrow svg,
  .ap-home-tab svg,
  .ap-tab svg,
  .ap-title-icon svg
) {
  color: #ffffff !important;
  fill: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}
```

**After (`src/pages/admin/AdminPanel.css`)**:
```css
.admin-panel :is(
  .ap-kpi-icon-wrap svg,
  .ap-integ-icon-box svg,
  .ap-todo-btn svg,
  .ap-stat-icon svg,
  .ap-quick-item svg,
  .ap-dashboard-card-title svg,
  .ap-mycrm-summary-title svg,
  .ap-card-icon svg,
  .ap-section-icon svg,
  .ap-integ-arrow svg,
  .ap-home-tab svg,
  .ap-tab--active svg,
  .ap-title-icon svg
) {
  color: #ffffff !important;
  fill: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}
```

#### B. Tasks.css: Add explicit visibility and light gray color rules
**Append to `src/pages/tasks/Tasks.css`**:
```css
/* ═══════════════════════════════════════════════════════════════════════════
   TOP NAVIGATION TABS: INACTIVE TAB FA ICONS VISIBILITY & LIGHT GRAY COLOR
   ═══════════════════════════════════════════════════════════════════════════ */
body #root :is(.layout--admin, .layout--user) .tasks-workspace-root .ap-tab:not(.ap-tab--active) {
  color: #475569 !important;
  background: #ffffff !important;
  opacity: 1 !important;
  visibility: visible !important;
}

body #root :is(.layout--admin, .layout--user) .tasks-workspace-root .ap-tab:not(.ap-tab--active) :is(span, svg, path, circle, rect, line, polyline, polygon) {
  color: rgb(100, 116, 139) !important;
  fill: currentColor !important;
  stroke: currentColor !important;
  -webkit-text-fill-color: rgb(100, 116, 139) !important;
  opacity: 1 !important;
  visibility: visible !important;
}

body #root :is(.layout--admin, .layout--user) .tasks-workspace-root .ap-tab.ap-tab--active {
  color: #c60016 !important;
  opacity: 1 !important;
  visibility: visible !important;
}

body #root :is(.layout--admin, .layout--user) .tasks-workspace-root .ap-tab.ap-tab--active :is(span, svg, path, circle, rect, line, polyline, polygon) {
  color: #c60016 !important;
  fill: currentColor !important;
  stroke: currentColor !important;
  -webkit-text-fill-color: #c60016 !important;
  opacity: 1 !important;
  visibility: visible !important;
}
```

---

### Change-4: Workload User Directory Height Alignment on `/admin/tasks/workload`

**Target Files**:
1. [`src/pages/tasks/TeamWorkloadPage.jsx`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/tasks/TeamWorkloadPage.jsx)  
2. [`src/pages/tasks/components/workload/WorkloadUserList.jsx`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/tasks/components/workload/WorkloadUserList.jsx)

#### A. TeamWorkloadPage.jsx: Adjust Sidebar Wrapper
**Before (`src/pages/tasks/TeamWorkloadPage.jsx` lines 305–318)**:
```jsx
        {/* PANEL 1: Left User Selection Sidebar (Sticky, capped height, internal scrollbar) */}
        {isAdmin && (
          <div
            style={{
              width: '280px',
              minWidth: '280px',
              position: 'sticky',
              top: '0.75rem',
              alignSelf: 'flex-start',
              height: 'calc(100vh - 175px)',
              maxHeight: 'calc(100vh - 175px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
```

**After (`src/pages/tasks/TeamWorkloadPage.jsx`)**:
```jsx
        {/* PANEL 1: Left User Selection Sidebar (Sticky, equal height as main dashboard sections) */}
        {isAdmin && (
          <div
            style={{
              width: '280px',
              minWidth: '280px',
              position: 'sticky',
              top: '0.75rem',
              alignSelf: 'stretch',
              height: 'calc(120vh - 175px)',
              maxHeight: 'calc(120vh - 175px)',
              minHeight: '950px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
```

#### B. WorkloadUserList.jsx: Adjust Internal Container
**Before (`src/pages/tasks/components/workload/WorkloadUserList.jsx` lines 54–69)**:
```jsx
    <div
      style={{
        width: '280px',
        minWidth: '280px',
        backgroundColor: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 175px)',
        maxHeight: 'calc(100vh - 175px)',
        minHeight: '520px',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden',
      }}
    >
```

**After (`src/pages/tasks/components/workload/WorkloadUserList.jsx`)**:
```jsx
    <div
      style={{
        width: '280px',
        minWidth: '280px',
        backgroundColor: 'rgb(255, 255, 255)',
        border: '1.5px solid rgb(226, 232, 240)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(120vh - 175px)',
        maxHeight: 'calc(120vh - 175px)',
        minHeight: '950px',
        boxShadow: 'rgba(0, 0, 0, 0.03) 0px 4px 18px',
        overflow: 'hidden',
      }}
    >
```

---

### Change-5: Hide HTML Tag Preview from Email Templates Frontend on `/admin/email-templates`

**Target Files**:
1. [`src/pages/admin/email-templates/EmailTemplatesPage.jsx`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/admin/email-templates/EmailTemplatesPage.jsx)  
2. [`src/pages/admin/email-templates/EmailTemplatesPage.css`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/admin/email-templates/EmailTemplatesPage.css)

#### A. EmailTemplatesPage.jsx: Remove Read-Only Textarea
**Before (`src/pages/admin/email-templates/EmailTemplatesPage.jsx` lines 383–394)**:
```jsx
            <div
              ref={editorRef}
              className="email-template-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={updateEditorBody}
              onBlur={updateEditorBody}
              onPaste={handleEditorPaste}
            />
            <textarea className="email-template-generated-html" rows={6} value={buildTemplateBodyHtml(form.bodyHtml)} readOnly />
          </div>
```

**After (`src/pages/admin/email-templates/EmailTemplatesPage.jsx`)**:
```jsx
            <div
              ref={editorRef}
              className="email-template-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={updateEditorBody}
              onBlur={updateEditorBody}
              onPaste={handleEditorPaste}
            />
          </div>
```

#### B. EmailTemplatesPage.css: Hide Class in CSS
**Before (`src/pages/admin/email-templates/EmailTemplatesPage.css` lines 116–123)**:
```css
.email-template-generated-html {
  min-height: 120px;
  font-family: Consolas, Monaco, monospace !important;
  font-size: .78rem !important;
  font-weight: 400;
  color: var(--text-secondary) !important;
  background: var(--surface-muted, #f8fafc) !important;
}
```

**After (`src/pages/admin/email-templates/EmailTemplatesPage.css`)**:
```css
.email-template-generated-html {
  display: none !important;
  min-height: 120px;
  font-family: Consolas, Monaco, monospace !important;
  font-size: .78rem !important;
  font-weight: 400;
  color: var(--text-secondary) !important;
  background: var(--surface-muted, #f8fafc) !important;
}
```

---

### Change-6: Remove "Need Help?" Button on Custom Reports (`/admin/reports/custom` & `/reports/custom`)

**Target File**: [`src/pages/admin/reports/CustomReportsPage.jsx`](file:///c:/Users/Lumos/Desktop/Server-New-Vps-CRM/src/pages/admin/reports/CustomReportsPage.jsx)  
*(Used for both `/admin/reports/custom` and `/reports/custom`)*

#### A. Before Code (Lines 1930–1945)
```jsx
      <header className="cr-list-topbar">
        <h1>Custom Reports</h1>
        <div className="cr-list-topbar-actions">
          <button type="button" className="cr-list-help">Need Help?</button>
          {canCreateReportTemplate && (
            <SplitDropdown
              label="Add Report Template"
              options={addTemplateOptions}
              isOpen={addOpen}
              buttonRef={addRef}
              onToggle={() => { setAddOpen((value) => !value) }}
              onSelect={handleAddTemplate}
            />
          )}
        </div>
      </header>
```

#### B. After Code: "Need Help?" Button Removed
```jsx
      <header className="cr-list-topbar">
        <h1>Custom Reports</h1>
        <div className="cr-list-topbar-actions">
          {canCreateReportTemplate && (
            <SplitDropdown
              label="Add Report Template"
              options={addTemplateOptions}
              isOpen={addOpen}
              buttonRef={addRef}
              onToggle={() => { setAddOpen((value) => !value) }}
              onSelect={handleAddTemplate}
            />
          )}
        </div>
      </header>
```

---

## 3. Strict Guardrails & Non-Regression Checklist

- **No Script Execution**: All modifications are performed directly on source files using targeted string replacements.
- **Zero Hardcoding**: All dynamic user roles, project IDs, styles, and data bindings remain fully dynamic.
- **Protected Areas Completely Untouched**:
  - **Add Account**: Account wizard, validation, ownerCode assignment, and MongoDB `leads`/`accounts` ingestion remain untouched.
  - **OwnerCode Logic**: Backend ownerCode resolution, assignment algorithms, and permission scoping remain untouched.
  - **Deals & Converted Deals**: Deal creation, deal status auto-convert via settings, manage deals, and dual ingestion remain untouched.
  - **Quotations**: Quotation manager, revisions, calculations, numbering, and quotation print templates remain untouched.
  - **Customers**: Customer search, creation, view, and manage mechanisms remain untouched.
  - **Reminders & Taskpad**: Add reminder forms, popup modals, and taskpad storage remain untouched.
  - **Integrations**: Mobile backend APIs, Outlook sync, and Microsoft Graph calls remain untouched.

---

## 4. Verification & Testing Steps

1. **Verify `/admin/tasks`**:
   - Confirm all 6 KPI cards visually mirror `/admin/monitoring` (red `#c60016` left icon wrap, large `2.2rem` bold numbers, title underneath, and wave SVG at bottom right).
2. **Verify `/admin/tasks/projects` & `/tasks/projects`**:
   - Inspect project cards as both Admin and Non-admin users. Confirm the Project Manager badge is positioned directly below `PRJ-1` and above the `Overall Progress` progress bar.
3. **Verify `/admin/tasks/my-work` & `/tasks/my-work`**:
   - Inspect unselected tabs (Projects, Workload, Approvals). Confirm tab icons are clearly visible in light gray (`#64748b` / `rgb(100, 116, 139)`) matching their text color, and active tab icons remain red (`#c60016`).
4. **Verify `/admin/tasks/workload`**:
   - Confirm the User Directory sidebar matches the height of the main dashboard analytics section across laptop and desktop displays.
5. **Verify `/admin/email-templates`**:
   - Type in the HTML Body editor. Confirm no raw HTML textarea tags appear beneath the editor, while form state and template previews remain functional.
6. **Verify `/admin/reports/custom` & `/reports/custom`**:
   - Confirm the "Need Help?" button is completely removed next to "Add Report Template" on both admin and non-admin routes.
7. **Frontend Build Validation**:
   - Run `npm run build` to verify zero compilation or bundling errors.
