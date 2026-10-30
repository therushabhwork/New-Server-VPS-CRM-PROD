import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FiCheck,
  FiChevronDown,
  FiEdit3,
  FiFilter,
  FiGrid,
  FiLayers,
  FiList,
  FiRefreshCw,
  FiSettings,
  FiUpload,
  FiUserCheck,
} from 'react-icons/fi'
import { FaFileExcel, FaSpinner } from 'react-icons/fa'
import * as XLSX from 'xlsx'
import { useClickOutside } from '../../../hooks'
import { useAuth } from '../../../context/AuthContext'
import { getCrmOwnerCode } from '../../../features/users/crmUserDirectory'
import { leadApi } from '../../../services/leadApi'
import { dealApi } from '../../../services/dealApi'
import { exportAllAccountsAndDealsWorkbook } from '../../../utils/exportAllLeadsAndDeals'
import Modal from '../../../components/common/Modal'
import Button from '../../../components/common/Button'
import './AccountBoardHeaderActions.css'

const SHOW_BULK_ACTIONS = false

const AccountBoardHeaderActions = ({
  view,
  currentStageRows,
  allRows,
  activeStageLabel,
  visibleColumns,
  allColumns,
  onApplyVisibleColumns,
  showFilters,
  onToggleFilters,
  onRefresh,
  filterButtonTitle,
  refreshButtonTitle = 'Refresh',
  sourceStageOptions = [],
  visibleSourceStageKeys = [],
  onApplyVisibleSourceStages,
  selectedRows = [],
  onBulkAddRemark,
  onBulkReAssign,
  onBulkValidationError,
}) => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isMyAccountsView =
    view?.key === 'myAccounts' ||
    view?.queryValue === 'my-accounts' ||
    (typeof window !== 'undefined' && window.location.pathname.includes('/my-accounts'))
  const actions = view.titlebarActions || {}
  const [openMenu, setOpenMenu] = useState(null)
  const [pendingColumnKeys, setPendingColumnKeys] = useState(() => visibleColumns.map((column) => column.key))
  const [pendingSourceKeys, setPendingSourceKeys] = useState(() => visibleSourceStageKeys)
  const [bulkMenuPosition, setBulkMenuPosition] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false)
  const [importPreviewAccounts, setImportPreviewAccounts] = useState([])
  const [importExcelHeaders, setImportExcelHeaders] = useState([])
  const [importPreviewFilter, setImportPreviewFilter] = useState('all')
  const [pendingImportPayloads, setPendingImportPayloads] = useState([])
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  const handleExportAllCollections = async () => {
    if (isExportingExcel) return
    setIsExportingExcel(true)
    try {
      await exportAllAccountsAndDealsWorkbook({ primary: 'accounts' })
    } catch (error) {
      console.error('Failed to export leads & deals workbook:', error)
      alert('Failed to export data: ' + (error?.message || 'Unknown error'))
    } finally {
      setIsExportingExcel(false)
    }
  }
  const fileInputRef = useRef(null)
  const bulkTriggerRef = useRef(null)
  const closeMenu = useCallback(() => {
    setOpenMenu(null)
    setBulkMenuPosition(null)
  }, [])
  const menuRef = useClickOutside(closeMenu)

  useEffect(() => {
    setPendingColumnKeys(visibleColumns.map((column) => column.key))
  }, [visibleColumns])

  useEffect(() => {
    setPendingSourceKeys(visibleSourceStageKeys)
  }, [visibleSourceStageKeys])

  const selectedCount = selectedRows.length
  const activeMenuRef = openMenu ? menuRef : null
  const moreMenuOptions = useMemo(() => ([
    {
      key: 'toggle-filters',
      label: showFilters ? 'Hide Filters' : 'Show Filters',
      onClick: () => {
        onToggleFilters()
        closeMenu()
      },
    },
    {
      key: 'show-all-columns',
      label: 'Show All Columns',
      onClick: () => {
        onApplyVisibleColumns(allColumns.map((column) => column.key))
        closeMenu()
      },
    },
  ]), [allColumns, closeMenu, onApplyVisibleColumns, onToggleFilters, showFilters])

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleImportFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsImporting(true)
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const raw2DRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      let headerRowIndex = -1
      for (let i = 0; i < Math.min(raw2DRows.length, 15); i++) {
        const rowStr = (raw2DRows[i] || []).join(' ').toLowerCase()
        if (
          rowStr.includes('account name') ||
          rowStr.includes('project name') ||
          rowStr.includes('added date') ||
          rowStr.includes('account date') ||
          rowStr.includes('account category') ||
          rowStr.includes('contact person')
        ) {
          headerRowIndex = i
          break
        }
      }

      let validRows = []
      let detectedHeaders = []
      if (headerRowIndex !== -1) {
        const headers = (raw2DRows[headerRowIndex] || []).map((h) => String(h || '').trim())
        detectedHeaders = headers.filter(Boolean)
        for (let i = headerRowIndex + 1; i < raw2DRows.length; i++) {
          const rowArr = raw2DRows[i]
          if (!rowArr || rowArr.length === 0) continue
          const rowObj = {}
          headers.forEach((h, colIdx) => {
            if (h) rowObj[h] = rowArr[colIdx]
          })
          const rowText = Object.values(rowObj).join(' ')
          if (/Generated on:/i.test(rowText) || /Report Filter/i.test(rowText) || /Page \d+/i.test(rowText)) continue
          if (Object.values(rowObj).some((val) => String(val || '').trim() !== '')) {
            validRows.push(rowObj)
          }
        }
      } else {
        const rawObjects = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        if (rawObjects.length > 0) {
          detectedHeaders = Object.keys(rawObjects[0] || {}).filter((k) => !k.startsWith('__EMPTY'))
        }
        validRows = rawObjects.filter((row) => {
          if (!row || typeof row !== 'object') return false
          const rowText = Object.values(row).join(' ')
          if (/Generated on:/i.test(rowText) || /Report Filter/i.test(rowText)) return false
          return Object.values(row).some((val) => String(val || '').trim() !== '')
        })
      }

      if (validRows.length === 0) {
        alert('No valid rows found in the selected file.')
        setIsImporting(false)
        return
      }

      const normKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '')

      // Dynamic logged-in user and ownerCode resolution
      const loggedInUserName = user?.name || user?.username || 'Jay Pandya'
      const loggedInOwnerCode = String(user?.ownerCode || getCrmOwnerCode(loggedInUserName) || '1004').trim()
      const loggedInUserId = user?.id || null

      let existingLeads = []
      try {
        existingLeads = await leadApi.getLeads()
      } catch (fetchErr) {
        console.warn('Could not fetch existing leads prior to import cleanup:', fetchErr)
      }

      const seenBatchKeys = new Set()
      const previewRows = []
      const payloadsToImport = []
      for (const row of validRows) {
        const getVal = (...keys) => {
          const rowKeys = Object.keys(row || {})
          for (const k of keys) {
            const kNorm = normKey(k)
            const matchKey = rowKeys.find((rk) => normKey(rk) === kNorm)
            if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
              const val = String(row[matchKey]).trim()
              if (val !== '' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') return val
            }
          }
          return ''
        }

        const sanitizeEmail = (val) => {
          if (!val) return undefined
          const cleaned = String(val).trim()
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : undefined
        }

        const isCodePatternStr = (str) => typeof str === 'string' && /^[A-Z]{2,4}\d{4,8}$/i.test(str.trim())

        const parseExcelDateValue = (rawDate) => {
          if (!rawDate) return undefined
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            return rawDate.toISOString()
          }
          const str = String(rawDate).trim()
          if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return undefined

          if (/^\d{5}$/.test(str) || (typeof rawDate === 'number' && rawDate > 30000 && rawDate < 60000)) {
            const num = Number(rawDate)
            const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000))
            if (!isNaN(jsDate.getTime())) return jsDate.toISOString()
          }

          // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (with optional time)
          const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
          if (dmyMatch) {
            const [, day, month, year, h = 0, m = 0, s = 0] = dmyMatch
            const jsDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s)))
            if (!isNaN(jsDate.getTime())) return jsDate.toISOString()
          }

          // YYYY-MM-DD or YYYY/MM/DD (with optional time)
          const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
          if (ymdMatch) {
            const [, year, month, day, h = 0, m = 0, s = 0] = ymdMatch
            const jsDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s)))
            if (!isNaN(jsDate.getTime())) return jsDate.toISOString()
          }

          const parsed = new Date(str)
          return Number.isNaN(parsed.getTime()) ? str : parsed.toISOString()
        }

        const rawAccNameCandidate = getVal('Account Name', 'AccountName', 'Customer Name', 'customerName', 'Company Name', 'companyName', 'Company', 'company', 'Client Name', 'clientName', 'Name', 'name', 'Account')
        const accountName = isCodePatternStr(rawAccNameCandidate) ? '' : rawAccNameCandidate

        const rawDateInput = getVal('Deal Date', 'dealDate', 'Deal_Date', 'deal_date', 'Added Date', 'addedDate', 'AddedDate', 'Added_Date', 'Account Date', 'accountDate', 'Date', 'date', 'Created Date')
        const accountDate = parseExcelDateValue(rawDateInput) || rawDateInput || undefined
        const accountCategory = getVal('Account Category', 'AccountCategory', 'Category', 'accountCategory')
        const contactPerson = getVal('Contact Person', 'ContactPerson', 'Contact', 'contactPerson')
        const phone = getVal('Phone', 'phone', 'Mobile', 'mobile', 'Contact Mobile')
        const email = sanitizeEmail(getVal('Email', 'email', 'Contact Email'))
        const alternatePhone = getVal('Alternate Phone', 'alternatePhone')
        const alternateEmail = sanitizeEmail(getVal('Alternate Email', 'alternateEmail'))
        const customerType = getVal('Customer Type', 'customerType')
        const projectName = getVal('Project Name', 'ProjectName', 'Project', 'project', 'company')
        const productCategory = getVal('Product Category', 'productCategory')
        const state = getVal('State', 'state')
        const location = getVal('Location', 'location', 'City', 'city')
        const industryType = getVal('Industry type', 'Industry Type', 'IndustryType', 'Industry', 'industry')
        const jobNo = getVal('Job No', 'JobNo', 'Job No.', 'Customer Ref. No.', 'Customer Ref No', 'CustomerRefNo')
        const customerRefNo = jobNo || getVal('Customer Ref. No.', 'Customer Ref No', 'CustomerRefNo')
        const consultantName = getVal('Consultant Name', 'consultantName')
        const poValue = getVal('PO Value', 'poValue', 'POValue')
        const userGroup = getVal('User Group', 'userGroup', 'UserGroup')

        const fallbackRowName = Object.values(row)
          .map((v) => String(v || '').trim())
          .find((val) => val.length > 1 && !isCodePatternStr(val) && !/^\d+$/.test(val) && !/Report Filter/i.test(val)) || ''

        const displayName = (
          (accountName && !isCodePatternStr(accountName) ? accountName : null) ||
          (projectName && !isCodePatternStr(projectName) ? projectName : null) ||
          (customerRefNo && !isCodePatternStr(customerRefNo) ? customerRefNo : null) ||
          (fallbackRowName ? fallbackRowName : null) ||
          ''
        )
        if (!displayName) continue
        if (/Report Filter/i.test(displayName) || /Report Filter/i.test(accountName)) continue

        const matchingLead = existingLeads.find((lead) => {
          if (!lead) return false
          if (customerRefNo && (lead.customerRefNo === customerRefNo || lead.formData?.customerRefNo === customerRefNo)) return true
          if (displayName && (lead.name === displayName || lead.customerName === displayName || lead.accountName === displayName)) return true
          return false
        })

        const rowKey = (customerRefNo ? `ref:${customerRefNo.toLowerCase()}` : '') || (displayName ? `name:${displayName.toLowerCase()}` : '')
        const isDuplicate = Boolean(matchingLead || (rowKey && seenBatchKeys.has(rowKey)))
        if (rowKey) seenBatchKeys.add(rowKey)

        const payload = {
          name: displayName,
          accountName: displayName,
          customerName: displayName,
          accountNumber: loggedInOwnerCode,
          accountNo: loggedInOwnerCode,
          account_no: loggedInOwnerCode,
          ownerCode: loggedInOwnerCode,
          accountOwnerCode: loggedInOwnerCode,
          accountOwner: loggedInUserName,
          ownerName: loggedInUserName,
          createdBy: loggedInUserId,
          ownerUserId: loggedInUserId,
          assignedTo: loggedInUserId,
          customerRefNo: customerRefNo || undefined,
          jobNo: jobNo || undefined,
          accountDate: accountDate || undefined,
          addedDate: accountDate || undefined,
          dealDate: accountDate || undefined,
          createdAt: accountDate || undefined,
          accountCategory: accountCategory || undefined,
          contactPerson: contactPerson || undefined,
          phone: phone || undefined,
          mobile: phone || undefined,
          email: email || undefined,
          alternatePhone: alternatePhone || undefined,
          alternateEmail: alternateEmail || undefined,
          customerType: customerType || undefined,
          projectName: projectName || undefined,
          company: projectName || undefined,
          productCategory: productCategory || undefined,
          state: state || undefined,
          location: location || undefined,
          industryType: industryType || undefined,
          consultantName: consultantName || undefined,
          poValue: poValue || undefined,
          userGroup: userGroup || undefined,
          status: 'pending',
          isExcelImport: true,
          isDuplicate,
          formData: {
            'Account Name': displayName,
            'Account Date': accountDate,
            'Added Date': accountDate,
            'Deal Date': accountDate,
            'Account Category': accountCategory,
            'Account Owner': loggedInUserName,
            'Contact Person': contactPerson,
            'Phone': phone,
            'Email': email,
            'Alternate Phone': alternatePhone,
            'Alternate Email': alternateEmail,
            'Customer Type': customerType,
            'Project Name': projectName,
            'Product Category': productCategory,
            'State': state,
            'Location': location,
            'Industry type': industryType,
            'Customer Ref. No.': customerRefNo,
            'Job No': jobNo,
            'Consultant Name': consultantName,
            'PO Value': poValue,
            'User Group': userGroup,
            accountName: displayName,
            accountDate,
            addedDate: accountDate,
            dealDate: accountDate,
            accountCategory,
            accountOwner: loggedInUserName,
            ownerCode: loggedInOwnerCode,
            accountOwnerCode: loggedInOwnerCode,
            contactPerson,
            phone,
            email,
            alternatePhone,
            alternateEmail,
            customerType,
            projectName,
            productCategory,
            state,
            location,
            industryType,
            customerRefNo,
            jobNo,
            consultantName,
            poValue,
            userGroup,
            accountNo: loggedInOwnerCode,
            accountNumber: loggedInOwnerCode,
          },
        }

        payloadsToImport.push({
          ...payload,
          targetCollection: 'accounts',
        })

        previewRows.push({
          ...payload,
          _rawRow: { ...row },
          isDuplicate,
          status: isDuplicate ? 'duplicate' : 'new',
          statusMessage: isDuplicate
            ? (matchingLead ? 'Matches existing database record' : 'Duplicate in file')
            : 'Ready to import',
        })
      }

      setImportExcelHeaders(detectedHeaders.length > 0 ? detectedHeaders : ['Account Name', 'Project Name', 'Phone', 'Email', 'Job No'])
      setImportPreviewAccounts(previewRows)
      setPendingImportPayloads(payloadsToImport)
      setImportPreviewFilter('all')
      setIsImportPreviewOpen(true)
    } catch (err) {
      console.error('Error reading import file:', err)
      alert('Error parsing import file. Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConfirmImportAccounts = async () => {
    if (!pendingImportPayloads || pendingImportPayloads.length === 0) return
    setIsImporting(true)
    try {
      const res = await dealApi.importDeals(pendingImportPayloads)
      const dataObj = res?.data || res || {}
      const insertedCount = dataObj.insertedCount ?? dataObj.count ?? res?.count ?? pendingImportPayloads.length
      const duplicateCount = dataObj.duplicateCount ?? 0

      setIsImportPreviewOpen(false)
      setImportPreviewAccounts([])
      setPendingImportPayloads([])

      if (onRefresh) {
        await onRefresh()
      }

      if (duplicateCount > 0) {
        alert(`Import completed successfully!\n• ${insertedCount} account records stored in MongoDB.\n• ${duplicateCount} duplicate records were identified and added.`)
      } else {
        alert(`Import completed successfully! ${insertedCount} account records stored in MongoDB.`)
      }
    } catch (bulkErr) {
      console.error('Failed import in AccountBoardHeaderActions:', bulkErr)
      alert(`Import failed: ${bulkErr?.message || 'Unknown error'}`)
    } finally {
      setIsImporting(false)
    }
  }

  const togglePendingKey = (currentKeys, key) => (
    currentKeys.includes(key)
      ? currentKeys.filter((entry) => entry !== key)
      : [...currentKeys, key]
  )

  const handleBulkClick = () => {
    setOpenMenu((currentValue) => {
      if (currentValue === 'bulk') {
        setBulkMenuPosition(null)
        return null
      }

      const triggerElement = bulkTriggerRef.current
      if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect()
        const viewportPadding = 12
        const menuWidth = 320
        const menuHeight = 150
        const left = Math.min(
          Math.max(viewportPadding, rect.right - menuWidth),
          window.innerWidth - menuWidth - viewportPadding
        )
        const spaceBelow = window.innerHeight - rect.bottom
        const top = spaceBelow >= menuHeight + viewportPadding
          ? rect.bottom + 4
          : Math.max(viewportPadding, rect.top - menuHeight - 4)
        setBulkMenuPosition({ top, left, width: menuWidth })
      }

      return 'bulk'
    })
  }

  const bulkDisabled = selectedCount === 0

  const handleBulkItemClick = (action) => {
    if (bulkDisabled) return
    closeMenu()
    action?.()
  }

  return (
    <div className="account-board-header-actions" ref={activeMenuRef}>
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
        onChange={handleImportFileSelect}
      />

      {SHOW_BULK_ACTIONS && actions.showBulk ? (
        <div className="account-board-header-menu-wrap">
          <button
            ref={bulkTriggerRef}
            type="button"
            className="account-board-header-btn account-board-header-btn-bulk"
            onClick={handleBulkClick}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'bulk'}
          >
            <span className="account-board-header-btn-label">
              <FiLayers />
              <span>Bulk Actions{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
            </span>
            <FiChevronDown className={`account-board-header-btn-caret${openMenu === 'bulk' ? ' account-board-header-btn-caret-open' : ''}`} />
          </button>

          {openMenu === 'bulk' && bulkMenuPosition ? createPortal(
            (
              <div
                className="account-board-header-menu account-board-header-menu-wide account-board-header-bulk-menu account-board-header-bulk-menu-portal"
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                style={{
                  position: 'fixed',
                  top: `${bulkMenuPosition.top}px`,
                  left: `${bulkMenuPosition.left}px`,
                  right: 'auto',
                  width: `${bulkMenuPosition.width}px`,
                  zIndex: 2147483600,
                }}
              >
                <button
                  type="button"
                  className="account-board-header-menu-item account-board-header-bulk-item"
                  onClick={() => handleBulkItemClick(onBulkAddRemark)}
                  disabled={bulkDisabled}
                >
                  <FiEdit3 className="account-board-header-bulk-item-icon" />
                  <span className="account-board-header-bulk-item-label">Add Remark</span>
                </button>
                <button
                  type="button"
                  className="account-board-header-menu-item account-board-header-bulk-item"
                  onClick={() => handleBulkItemClick(onBulkReAssign)}
                  disabled={bulkDisabled}
                >
                  <FiUserCheck className="account-board-header-bulk-item-icon" />
                  <span className="account-board-header-bulk-item-label">Re-Assign</span>
                </button>
              </div>
            ),
            document.body
          ) : null}
        </div>
      ) : null}

      {isAdmin && !isMyAccountsView ? (
        <button
          type="button"
          className="account-board-header-icon-btn account-board-header-icon-btn-excel"
          title="Export All Leads & Deals to Excel"
          aria-label="Export All Leads & Deals to Excel"
          disabled={isExportingExcel}
          onClick={handleExportAllCollections}
        >
          {isExportingExcel ? (
            <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <FaFileExcel />
          )}
        </button>
      ) : null}

      <button
        type="button"
        className="account-board-header-btn account-board-header-icon-btn-green"
        title="Import accounts (.xlsx, .xls, .csv)"
        aria-label="Import accounts"
        disabled={isImporting}
        onClick={handleImportClick}
        style={{ padding: '0 0.6rem', fontSize: '0.82rem', fontWeight: 600, height: '2.2rem' }}
      >
        <FiUpload />
        <span>{isImporting ? 'Importing...' : 'Import'}</span>
      </button>

      {actions.showColumnsIcon ? (
        <div className="account-board-header-menu-wrap">
          <button
            type="button"
            className="account-board-header-icon-btn account-board-header-icon-btn-blue"
            title="List/View"
            aria-label="List/View"
            onClick={() => setOpenMenu((currentValue) => currentValue === 'columns' ? null : 'columns')}
          >
            <FiList />
          </button>

          {openMenu === 'columns' ? (
            <div className="account-board-header-menu">
              {allColumns.map((column) => {
                const isChecked = pendingColumnKeys.includes(column.key)

                return (
                  <button
                    key={column.key}
                    type="button"
                    className={`account-board-header-check-item${isChecked ? ' account-board-header-check-item-active' : ''}`}
                    onClick={() => setPendingColumnKeys((currentValue) => togglePendingKey(currentValue, column.key))}
                  >
                    <span className={`account-board-header-check-box ${isChecked ? 'account-board-header-check-box-active' : ''}`}>
                      {isChecked ? <FiCheck /> : null}
                    </span>
                    <span>{column.label}</span>
                  </button>
                )
              })}

              <button
                type="button"
                className="account-board-header-load-btn"
                onClick={() => {
                  onApplyVisibleColumns(pendingColumnKeys.length > 0 ? pendingColumnKeys : allColumns.map((column) => column.key))
                  closeMenu()
                }}
              >
                Load <FiChevronDown className="account-board-header-load-icon" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {actions.showFilterIcon ? (
        <button
          type="button"
          className="account-board-header-icon-btn account-board-header-icon-btn-filter"
          title={filterButtonTitle || (showFilters ? 'Hide Filters' : 'Show Filters')}
          aria-label={filterButtonTitle || (showFilters ? 'Hide Filters' : 'Show Filters')}
          onClick={onToggleFilters}
        >
          <FiFilter />
        </button>
      ) : null}

      {actions.showRefreshIcon ? (
        <button
          type="button"
          className="account-board-header-icon-btn account-board-header-icon-btn-refresh"
          title={refreshButtonTitle}
          aria-label={refreshButtonTitle}
          onClick={onRefresh}
        >
          <FiRefreshCw />
        </button>
      ) : null}

      <button
        type="button"
        className="account-board-header-icon-btn account-board-header-icon-btn-import"
        title="Import Accounts Excel"
        aria-label="Import Accounts Excel"
        onClick={handleImportClick}
        disabled={isImporting}
      >
        <FiUpload />
      </button>

      {actions.showLoadMenu ? (
        <div className="account-board-header-menu-wrap">
          <button
            type="button"
            className="account-board-header-icon-btn account-board-header-icon-btn-cyan account-board-header-icon-btn-with-caret"
            title="Column/Grid"
            aria-label="Column/Grid"
            onClick={() => setOpenMenu((currentValue) => currentValue === 'load' ? null : 'load')}
          >
            <span className="account-board-header-icon-btn-shell">
              <FiGrid />
              <FiChevronDown className={`account-board-header-inline-caret${openMenu === 'load' ? ' account-board-header-inline-caret-open' : ''}`} />
            </span>
          </button>

          {openMenu === 'load' ? (
            <div className="account-board-header-menu account-board-header-menu-source">
              {sourceStageOptions.map((stage) => {
                const isChecked = pendingSourceKeys.includes(stage.key)

                return (
                  <button
                    key={stage.key}
                    type="button"
                    className={`account-board-header-check-item${isChecked ? ' account-board-header-check-item-active' : ''}`}
                    onClick={() => setPendingSourceKeys((currentValue) => togglePendingKey(currentValue, stage.key))}
                  >
                    <span className={`account-board-header-check-box ${isChecked ? 'account-board-header-check-box-active' : ''}`}>
                      {isChecked ? <FiCheck /> : null}
                    </span>
                    <span>{stage.label}</span>
                  </button>
                )
              })}

              <button
                type="button"
                className="account-board-header-load-btn"
                onClick={() => {
                  onApplyVisibleSourceStages?.(pendingSourceKeys.length > 0 ? pendingSourceKeys : sourceStageOptions.map((stage) => stage.key))
                  closeMenu()
                }}
              >
                Load <FiChevronDown className="account-board-header-load-icon" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {actions.showMoreMenu ? (
        <div className="account-board-header-menu-wrap">
          <button
            type="button"
            className="account-board-header-icon-btn account-board-header-icon-btn-blue"
            title="More"
            onClick={() => setOpenMenu((currentValue) => currentValue === 'more' ? null : 'more')}
          >
            <FiChevronDown />
          </button>

          {openMenu === 'more' ? (
            <div className="account-board-header-menu">
              {moreMenuOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="account-board-header-menu-item"
                  onClick={option.onClick}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        onChange={handleImportFileSelect}
        style={{ display: 'none' }}
      />

      {isImportPreviewOpen ? (
        <Modal
          isOpen={isImportPreviewOpen}
          onClose={() => setIsImportPreviewOpen(false)}
          size="xlarge"
          showClose={true}
          title={`Import Accounts Preview (${importPreviewAccounts.length} Records)`}
        >
          <div style={{ padding: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
                <span style={{ background: '#ebf8ff', color: '#2b6cb0', padding: '4px 10px', borderRadius: '4px', border: '1px solid #bee3f8' }}>
                  Total: {importPreviewAccounts.length}
                </span>
                <span style={{ background: '#f0fff4', color: '#276749', padding: '4px 10px', borderRadius: '4px', border: '1px solid #c6f6d5' }}>
                  New: {importPreviewAccounts.filter((r) => !r.isDuplicate).length}
                </span>
                <span style={{ background: '#fffaf0', color: '#c05621', padding: '4px 10px', borderRadius: '4px', border: '1px solid #feebc8' }}>
                  Duplicates: {importPreviewAccounts.filter((r) => r.isDuplicate).length}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0',
                    cursor: 'pointer',
                    background: importPreviewFilter === 'all' ? '#3182ce' : '#edf2f7',
                    color: importPreviewFilter === 'all' ? '#fff' : '#4a5568',
                    fontWeight: importPreviewFilter === 'all' ? 600 : 400
                  }}
                  onClick={() => setImportPreviewFilter('all')}
                >
                  All ({importPreviewAccounts.length})
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0',
                    cursor: 'pointer',
                    background: importPreviewFilter === 'new' ? '#38a169' : '#edf2f7',
                    color: importPreviewFilter === 'new' ? '#fff' : '#4a5568',
                    fontWeight: importPreviewFilter === 'new' ? 600 : 400
                  }}
                  onClick={() => setImportPreviewFilter('new')}
                >
                  New ({importPreviewAccounts.filter((r) => !r.isDuplicate).length})
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e0',
                    cursor: 'pointer',
                    background: importPreviewFilter === 'duplicate' ? '#dd6b20' : '#edf2f7',
                    color: importPreviewFilter === 'duplicate' ? '#fff' : '#4a5568',
                    fontWeight: importPreviewFilter === 'duplicate' ? 600 : 400
                  }}
                  onClick={() => setImportPreviewFilter('duplicate')}
                >
                  Duplicates ({importPreviewAccounts.filter((r) => r.isDuplicate).length})
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', maxHeight: '52vh' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Duplicate Status</th>
                    {(importExcelHeaders || []).map((header) => (
                      <th key={header} style={{ padding: '8px 12px', textAlign: 'left' }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreviewAccounts
                    .filter((row) => {
                      if (importPreviewFilter === 'new') return !row.isDuplicate
                      if (importPreviewFilter === 'duplicate') return row.isDuplicate
                      return true
                    })
                    .map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #edf2f7',
                          background: row.isDuplicate ? '#fffaf0' : 'inherit'
                        }}
                      >
                        <td style={{ padding: '8px 12px' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: row.isDuplicate ? '#feebc8' : '#c6f6d5',
                              color: row.isDuplicate ? '#c05621' : '#22543d'
                            }}
                            title={row.statusMessage}
                          >
                            {row.isDuplicate ? '⚠ Duplicate' : '✓ New'}
                          </span>
                        </td>
                        {(importExcelHeaders || []).map((header) => (
                          <td key={header} style={{ padding: '8px 12px' }}>
                            {String(row._rawRow?.[header] ?? row[header] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#718096' }}>
                * All records (including duplicates) will be imported into MongoDB.
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button type="button" variant="outline" onClick={() => setIsImportPreviewOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={isImporting || pendingImportPayloads.length === 0}
                  onClick={handleConfirmImportAccounts}
                >
                  {isImporting ? 'Importing...' : `Confirm & Import (${pendingImportPayloads.length} Accounts)`}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

export default AccountBoardHeaderActions
