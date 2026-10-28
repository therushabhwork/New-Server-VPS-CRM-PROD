import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FaCheck,
  FaChevronDown,
  FaChevronRight,
  FaEye,
  FaFileExcel,
  FaPlus,
  FaRedo,
  FaSave,
  FaSearch,
  FaTimes,
  FaTrash,
} from 'react-icons/fa'
import {
  ACCOUNT_REPORT_AGGREGATE_OPTIONS,
  ACCOUNT_REPORT_CONTEXT_OPTIONS,
  ACCOUNT_REPORT_FIELD_CATEGORIES,
  ACCOUNT_REPORT_FIELD_OPTIONS,
  ACCOUNT_REPORT_FILTER_OPERATOR_OPTIONS,
  ACCOUNT_REPORT_GROUP_BY_OPTIONS,
  ACCOUNT_REPORT_ORDER_BY_OPTIONS,
  ACCOUNT_REPORT_VISIBILITY_OPTIONS,
} from '../../../features/adminReports/accountReportTemplateConfig'
import {
  DEAL_REPORT_FIELD_GROUPS,
  DEAL_REPORT_FIELD_OPTIONS,
} from '../../../features/adminReports/dealReportTemplateConfig'
import {
  QUOTATION_REPORT_FIELD_OPTIONS,
} from '../../../features/adminReports/quotationReportTemplateConfig'
import {
  CUSTOMER_REPORT_FIELD_CATEGORIES,
  CUSTOMER_REPORT_FIELD_OPTIONS,
} from '../../../features/adminReports/customerReportTemplateConfig'
import { useAuth } from '../../../context/AuthContext'
import { generateId, slugify } from '../../../utils/helpers'
import { exportExcelWorkbook } from '../../../utils/excelExport'
import apiClient from '../../../services/apiClient'
import { userApi } from '../../../services/userApi'
import { userGroupApi } from '../../../services/userGroupApi'
import { saveAdminReportTemplate } from '../../../features/adminReports/reportTemplateStorage'
import './AddAccountReportPage.css'

const buildFilterRow = () => ({
  id: generateId('FLT'),
  field: '',
  operator: 'equals',
  value: '',
})

const initialFormState = {
  entityType: 'Account',
  runtimePeriodEnabled: false,
  reportName: '',
  visibility: 'Visible to Me Only',
  description: 'Account Report Template',
  groupBy: '',
  orderBy: '',
  aggregate: '',
  filters: [buildFilterRow()],
  selectedFields: [],
  accountOwner: '',
  userGroups: [],
  userGroupMembers: [],
  dateFilterField: 'accountDate',
  recordDateFrom: '',
  recordDateTo: '',
}

const AddAccountReportPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const reportListPath = location.pathname.startsWith('/admin') ? '/admin/reports/custom' : '/reports/custom'
  const searchParams = new URLSearchParams(location.search)
  const templateIdParam = searchParams.get('id') || searchParams.get('templateId')
  const contextParam = searchParams.get('context')

  const [formState, setFormState] = useState(initialFormState)
  const [pageError, setPageError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [ownerOptions, setOwnerOptions] = useState([])
  const [availableUserGroups, setAvailableUserGroups] = useState([])
  const [selectedUserGroups, setSelectedUserGroups] = useState([])
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([])
  const [allDirectoryUsers, setAllDirectoryUsers] = useState([])
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false)
  const [groupSearchText, setGroupSearchText] = useState('')
  const groupDropdownRef = useRef(null)

  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false)
  const [ownerSearchText, setOwnerSearchText] = useState('')
  const ownerDropdownRef = useRef(null)

  // Drag and Drop & Field Builder State
  const [fieldSearchQuery, setFieldSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Load User Groups
  useEffect(() => {
    userGroupApi.listGroups()
      .then((res) => {
        const groups = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
        setAvailableUserGroups(groups)
      })
      .catch((err) => {
        console.error('Failed to load user groups:', err)
        setAvailableUserGroups([])
      })
  }, [])

  // Load Directory Users (Format to canonical Owner Names)
  useEffect(() => {
    userApi.listDirectory()
      .then((users) => {
        const mapped = (Array.isArray(users) ? users : [])
          .map((entry) => {
            const displayName = entry.name || entry.username || entry.ownerCode || entry.id
            return {
              value: displayName,
              label: displayName,
              name: displayName,
              email: entry.email || '',
              userId: entry.id || '',
              ownerCode: entry.ownerCode || '',
            }
          })
          .filter((entry) => entry.value)
        setAllDirectoryUsers(mapped)
        setOwnerOptions(mapped)
      })
      .catch(() => {
        setAllDirectoryUsers([])
        setOwnerOptions([])
      })
  }, [])

  // Sync Owner dropdown options when user groups change
  useEffect(() => {
    if (selectedUserGroups.length === 0) {
      setSelectedGroupMembers([])
      setOwnerOptions(allDirectoryUsers)
      return
    }

    let isCurrent = true
    userGroupApi.listMembersByGroupIds(selectedUserGroups)
      .then((res) => {
        if (!isCurrent) return
        const members = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
        setSelectedGroupMembers(members)

        const seen = new Set()
        const dynamicOwners = []
        members.forEach((m) => {
          const cleanName = (m.name || '').trim()
          if (!cleanName || seen.has(cleanName.toLowerCase())) return
          seen.add(cleanName.toLowerCase())

          dynamicOwners.push({
            value: cleanName,
            label: cleanName,
            name: cleanName,
            email: m.email || '',
            userId: m.userId,
            groupName: m.groupName,
          })
        })

        setOwnerOptions(dynamicOwners)

        setFormState((prev) => {
          if (prev.accountOwner && !dynamicOwners.some((o) => o.value === prev.accountOwner)) {
            return { ...prev, accountOwner: '' }
          }
          return prev
        })
      })
      .catch((err) => {
        console.error('Failed to load members for selected groups:', err)
        if (isCurrent) {
          setSelectedGroupMembers([])
          setOwnerOptions([])
        }
      })

    return () => {
      isCurrent = false
    }
  }, [selectedUserGroups, allDirectoryUsers])

  // Click outside listener for user group & owner dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target)) {
        setIsGroupDropdownOpen(false)
      }
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target)) {
        setIsOwnerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Context Param initialization
  useEffect(() => {
    if (templateIdParam) return // Handled in reopen loader

    if (contextParam === 'deal') {
      setFormState((prev) => ({ ...prev, entityType: 'Deal', dateFilterField: 'dealDate', description: 'Deal Report Template' }))
    } else if (contextParam === 'quotation') {
      setFormState((prev) => ({ ...prev, entityType: 'Quotation', dateFilterField: 'quotationDate', description: 'Quotation Report Template' }))
    } else if (contextParam === 'customer') {
      setFormState((prev) => ({ ...prev, entityType: 'Customer', dateFilterField: 'createdAt', description: 'Customer Report Template' }))
    } else {
      setFormState((prev) => ({ ...prev, entityType: 'Account', dateFilterField: 'accountDate', description: 'Account Report Template' }))
    }
  }, [contextParam, templateIdParam])

  // Reopen existing template if id parameter exists
  useEffect(() => {
    if (!templateIdParam) return

    apiClient.get(`/reports/templates/${encodeURIComponent(templateIdParam)}`)
      .then((res) => {
        const data = res?.data || {}
        setFormState((prev) => ({
          ...prev,
          entityType: data.entityType || 'Account',
          reportName: data.name || data.reportName || '',
          visibility: data.visibility || 'Visible to Me Only',
          description: data.description || '',
          groupBy: data.groupBy || '',
          orderBy: data.orderBy || '',
          aggregate: data.aggregate || '',
          accountOwner: data.accountOwner || data.owner || '',
          dateFilterField: data.dateFilterField || 'accountDate',
          recordDateFrom: data.recordDateFrom || '',
          recordDateTo: data.recordDateTo || '',
          selectedFields: Array.isArray(data.selectedFields) && data.selectedFields.length > 0
            ? data.selectedFields
            : (Array.isArray(data.displayFields) ? data.displayFields : []),
          filters: Array.isArray(data.filters) && data.filters.length > 0 ? data.filters : [buildFilterRow()],
        }))
        if (Array.isArray(data.userGroups) && data.userGroups.length > 0) {
          setSelectedUserGroups(data.userGroups)
        }
      })
      .catch((err) => {
        console.error('Failed to load existing report template:', err)
        setPageError('Could not load report template for editing.')
      })
  }, [templateIdParam])

  // Field definitions based on active entityType
  const currentFieldOptions = useMemo(() => {
    let opts = ACCOUNT_REPORT_FIELD_OPTIONS
    if (formState.entityType === 'Deal') opts = DEAL_REPORT_FIELD_OPTIONS
    else if (formState.entityType === 'Quotation') opts = QUOTATION_REPORT_FIELD_OPTIONS
    else if (formState.entityType === 'Customer') opts = CUSTOMER_REPORT_FIELD_OPTIONS
    // Frontend-only: exclude "Deal Name" field from Section C Field Builder
    return opts.filter((f) => f.label !== 'Deal Name' && f.key !== 'dealName')
  }, [formState.entityType])

  // Categorized Field Groups based on active context
  const currentFieldCategories = useMemo(() => {
    if (formState.entityType === 'Account') {
      return ACCOUNT_REPORT_FIELD_CATEGORIES.map((cat) => ({
        category: cat.category,
        fields: cat.keys
          .map((k) => currentFieldOptions.find((f) => f.key === k))
          .filter(Boolean),
      }))
    }
    if (formState.entityType === 'Deal') {
      return DEAL_REPORT_FIELD_GROUPS.map((grp) => ({
        category: grp.title,
        fields: grp.fields,
      }))
    }
    if (formState.entityType === 'Customer') {
      return CUSTOMER_REPORT_FIELD_CATEGORIES.map((cat) => ({
        category: cat.category,
        fields: cat.keys
          .map((k) => currentFieldOptions.find((f) => f.key === k))
          .filter(Boolean),
      }))
    }
    // Quotation default groupings
    const quoteCommon = QUOTATION_REPORT_FIELD_OPTIONS.slice(0, 15)
    const quoteRest = QUOTATION_REPORT_FIELD_OPTIONS.slice(15)
    return [
      { category: 'Quotation Core & Financials', fields: quoteCommon },
      { category: 'Other Quotation Attributes', fields: quoteRest },
    ]
  }, [formState.entityType, currentFieldOptions])

  // Normalization helper: resolves label to key or vice versa
  const getFieldDescriptor = (fieldIdentifier) => {
    const match = currentFieldOptions.find(
      (f) => f.key === fieldIdentifier || f.label === fieldIdentifier
    )
    return match || { key: fieldIdentifier, label: fieldIdentifier }
  }

  // Selected Field Objects (preserves explicit sequence)
  const selectedFieldObjects = useMemo(() => (
    formState.selectedFields.map((f) => getFieldDescriptor(f))
  ), [formState.selectedFields, currentFieldOptions])

  // Set of selected keys/labels for fast lookup
  const selectedFieldSet = useMemo(() => {
    const s = new Set()
    formState.selectedFields.forEach((f) => {
      const desc = getFieldDescriptor(f)
      s.add(desc.key)
      s.add(desc.label)
    })
    return s
  }, [formState.selectedFields, currentFieldOptions])



  // Add field to selected columns
  const handleAddField = (fieldObj) => {
    if (!fieldObj) return
    const key = fieldObj.key || fieldObj.label
    if (selectedFieldSet.has(key) || selectedFieldSet.has(fieldObj.label)) return

    setFormState((prev) => ({
      ...prev,
      selectedFields: [...prev.selectedFields, fieldObj.label],
    }))
  }

  // Remove field from selected columns
  const handleRemoveField = (fieldIdentifier) => {
    const desc = getFieldDescriptor(fieldIdentifier)
    setFormState((prev) => ({
      ...prev,
      selectedFields: prev.selectedFields.filter((f) => {
        const itemDesc = getFieldDescriptor(f)
        return itemDesc.key !== desc.key && itemDesc.label !== desc.label
      }),
    }))
  }

  // User Group Toggle
  const handleToggleUserGroup = (groupIdOrName) => {
    setSelectedUserGroups((prev) => {
      if (prev.includes(groupIdOrName)) {
        return prev.filter((g) => g !== groupIdOrName)
      }
      return [...prev, groupIdOrName]
    })
  }

  const handleRemoveUserGroup = (groupIdOrName, e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setSelectedUserGroups((prev) => prev.filter((g) => g !== groupIdOrName))
  }

  // Reset Filters
  const handleClearFilters = () => {
    setFormState((prev) => ({
      ...prev,
      accountOwner: '',
      dateFilterField: 'accountDate',
      recordDateFrom: '',
      recordDateTo: '',
      filters: [buildFilterRow()],
    }))
    setSelectedUserGroups([])
  }

  // Excel Export Handler (Fetches real date-filtered MongoDB records via unified report engine)
  const handleExportExcel = async () => {
    setPageError('')
    if (formState.selectedFields.length === 0) {
      setPageError('Select at least one field to export.')
      return
    }

    const reportTitle = formState.reportName.trim() || `${formState.entityType} Report`
    const selectedKeys = selectedFieldObjects.map((f) => f.key)
    const columns = selectedFieldObjects.map((f) => ({
      key: f.label,
      label: f.label,
      rawKey: f.key,
      width: Math.min(36, Math.max(14, f.label.length + 5)),
      formatter: (val, row) => {
        if (!row) return '-'
        const resolved = row[f.label] ?? (f.key ? row[f.key] : undefined) ?? val
        return (resolved !== undefined && resolved !== null && resolved !== '') ? String(resolved) : '-'
      },
    }))

    setIsExporting(true)
    try {
      const hasDateRange = Boolean(formState.recordDateFrom || formState.recordDateTo)
      const sanitizedFilters = formState.filters.filter(
        (f) => f.field && ((f.value !== undefined && f.value !== null && String(f.value).trim() !== '') || f.operator === 'is_empty' || f.operator === 'is_not_empty')
      )
      const payload = {
        template: {
          entityType: formState.entityType,
          reportName: reportTitle,
          accountOwner: formState.accountOwner || 'all',
          owner: formState.accountOwner || 'all',
          userGroups: selectedUserGroups,
          selectedUserGroups: selectedUserGroups,
          userGroupMembers: selectedGroupMembers,
          dateFilterField: formState.dateFilterField || (formState.entityType === 'Deal' ? 'dealDate' : formState.entityType === 'Quotation' ? 'quotationDate' : formState.entityType === 'Customer' ? 'createdAt' : 'accountDate'),
          recordDateFrom: formState.recordDateFrom || undefined,
          recordDateTo: formState.recordDateTo || undefined,
          selectedFields: selectedKeys,
          displayFields: selectedKeys,
          filters: sanitizedFilters,
        },
        dataSource: formState.entityType.toLowerCase(),
        reportContext: formState.entityType.toLowerCase(),
        selectedFields: selectedKeys,
        ownerFilter: formState.accountOwner || 'all',
        period: hasDateRange ? 'custom' : 'all',
        recordDateFrom: formState.recordDateFrom || undefined,
        recordDateTo: formState.recordDateTo || undefined,
        dateRange: {
          fromDate: formState.recordDateFrom || undefined,
          toDate: formState.recordDateTo || undefined,
        },
        quotesGeneratedRange: {
          generatedFrom: formState.generatedFrom || undefined,
          generatedTo: formState.generatedTo || undefined,
        },
        generatedFrom: formState.generatedFrom || undefined,
        generatedTo: formState.generatedTo || undefined,
        filters: sanitizedFilters,
        limit: 0,
      }
      const res = await apiClient.post('/reports/export-excel', payload)
      const exportPayload = (res && typeof res === 'object') ? res : {}

      let rawRecords = []
      if (Array.isArray(exportPayload.rows)) rawRecords = exportPayload.rows
      else if (Array.isArray(exportPayload.records)) rawRecords = exportPayload.records
      else if (Array.isArray(exportPayload.data)) rawRecords = exportPayload.data
      else if (Array.isArray(exportPayload)) rawRecords = exportPayload
      else if (exportPayload.row && typeof exportPayload.row === 'object') rawRecords = [exportPayload.row]
      else if (exportPayload.record && typeof exportPayload.record === 'object') rawRecords = [exportPayload.record]
      else if (exportPayload._id || exportPayload.id || exportPayload.accountNumber || exportPayload.dealNumber || exportPayload.quotationNumber) rawRecords = [exportPayload]

      const exportRows = rawRecords

      if (exportRows.length === 0) {
        setPageError('No matching records found to export for the selected date range and filters.')
        return
      }

      // Canonical deduplication ensuring 100% zero repeated rows
      // For deals, quotations, and customers, never deduplicate by Account No. because multiple records can share an account
      const currentEntity = String(formState.entityType || 'Account').trim().toLowerCase()
      const getCanonicalRecordKey = (row) => {
        if (currentEntity === 'deal') {
          const dealNo = String(row['Deal No.'] || row['Deal No'] || row.dealNumber || '').trim().toUpperCase()
          if (dealNo && dealNo !== '-' && dealNo !== 'UNDEFINED' && dealNo !== 'NULL') return `DEAL:${dealNo}`
          const id = String(row._id || row.id || '').trim()
          if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`
        } else if (currentEntity === 'quotation') {
          const qNo = String(row['Quotation No.'] || row['Quotation No'] || row.quotationNumber || row.quoteNumber || '').trim().toUpperCase()
          if (qNo && qNo !== '-' && qNo !== 'UNDEFINED' && qNo !== 'NULL') return `QUOTE:${qNo}`
          const id = String(row._id || row.id || '').trim()
          if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`
        } else if (currentEntity === 'customer') {
          const custNo = String(row['Customer No.'] || row['Customer No'] || row.customerNumber || '').trim().toUpperCase()
          if (custNo && custNo !== '-' && custNo !== 'UNDEFINED' && custNo !== 'NULL') return `CUST:${custNo}`
          const id = String(row._id || row.id || '').trim()
          if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`
        } else if (currentEntity === 'account') {
          const accNo = String(
            row['Account No.'] || row['Account No'] || row.accountNumber || row.accountNo || ''
          ).trim().toUpperCase()
          if (accNo && accNo !== '-' && accNo !== 'UNDEFINED' && accNo !== 'NULL') return `ACC:${accNo}`
          const id = String(row._id || row.id || '').trim()
          if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`
        } else {
          const dealNo = String(row['Deal No.'] || row['Deal No'] || row.dealNumber || '').trim().toUpperCase()
          if (dealNo && dealNo !== '-' && dealNo !== 'UNDEFINED' && dealNo !== 'NULL') return `DEAL:${dealNo}`
          const qNo = String(row['Quotation No.'] || row['Quotation No'] || row.quotationNumber || row.quoteNumber || '').trim().toUpperCase()
          if (qNo && qNo !== '-' && qNo !== 'UNDEFINED' && qNo !== 'NULL') return `QUOTE:${qNo}`
          const custNo = String(row['Customer No.'] || row['Customer No'] || row.customerNumber || '').trim().toUpperCase()
          if (custNo && custNo !== '-' && custNo !== 'UNDEFINED' && custNo !== 'NULL') return `CUST:${custNo}`
          const accNo = String(
            row['Account No.'] || row['Account No'] || row.accountNumber || row.accountNo || ''
          ).trim().toUpperCase()
          if (accNo && accNo !== '-' && accNo !== 'UNDEFINED' && accNo !== 'NULL') return `ACC:${accNo}`
          const id = String(row._id || row.id || '').trim()
          if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`
        }

        return JSON.stringify(row)
      }

      const seenRowKeys = new Set()
      const dedupedRows = []
      for (const row of exportRows) {
        const rowKey = getCanonicalRecordKey(row)
        if (!seenRowKeys.has(rowKey)) {
          seenRowKeys.add(rowKey)
          dedupedRows.push(row)
        }
      }

      // Group records by Owner if All Owners or multiple owners exist
      const entityLabel = formState.entityType || 'Account'
      const entityPlural = entityLabel === 'Customer' ? 'Customers' : entityLabel === 'Deal' ? 'Deals' : entityLabel === 'Quotation' ? 'Quotations' : 'Accounts'

      const ownerGroups = {}
      dedupedRows.forEach((row) => {
        const ownerName = String(
          row[`${entityLabel} Owner`] ||
          row['Account Owner'] || row.accountOwner ||
          row['Deal Owner'] || row.dealOwner ||
          row['Quotation Owner'] || row.quotationOwner ||
          row['Customer Owner'] || row.customerOwner ||
          row.ownerName || row.owner || formState.accountOwner || 'Unassigned'
        ).trim() || 'Unassigned'
        if (!ownerGroups[ownerName]) ownerGroups[ownerName] = []
        ownerGroups[ownerName].push(row)
      })

      const sortedOwnerNames = Object.keys(ownerGroups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      const isMultiOwner = sortedOwnerNames.length > 1 || !formState.accountOwner || formState.accountOwner === 'all'

      const finalExcelRows = []
      if (isMultiOwner && sortedOwnerNames.length > 1) {
        sortedOwnerNames.forEach((ownerName) => {
          const groupRows = ownerGroups[ownerName] || []
          const ownerHeaderRow = {}
          columns.forEach((c, idx) => {
            if (idx === 0) {
              ownerHeaderRow[c.key] = `▶ ${entityLabel} Owner: ${ownerName} (${groupRows.length} ${entityPlural})`
              ownerHeaderRow[c.label] = ownerHeaderRow[c.key]
            } else {
              ownerHeaderRow[c.key] = ''
              ownerHeaderRow[c.label] = ''
            }
          })
          finalExcelRows.push(ownerHeaderRow)
          groupRows.forEach(r => finalExcelRows.push(r))
        })
      } else {
        dedupedRows.forEach(r => finalExcelRows.push(r))
      }

      const totalOwnersText = isMultiOwner && sortedOwnerNames.length > 1 ? ` | Total Owners: ${sortedOwnerNames.length}` : ''
      exportExcelWorkbook({
        filename: `${slugify(reportTitle)}.xlsx`,
        title: reportTitle,
        subtitle: `Owner Scope: ${formState.accountOwner || 'All Owners'}${totalOwnersText} | Total Unique Records: ${dedupedRows.length} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
        sheetName: `${formState.entityType} Data`,
        columns,
        rows: finalExcelRows,
      })
    } catch (err) {
      console.error('Export error:', err)
      setPageError(err.response?.data?.error || err.message || 'Failed to export Excel report.')
    } finally {
      setIsExporting(false)
    }
  }

  // Submit Handler: Saves or Updates Template
  const handleSubmit = async (event) => {
    event.preventDefault()
    setPageError('')
    setSaveSuccess('')

    if (!formState.reportName.trim()) {
      setPageError('Report name is required. Please type a report name.')
      return
    }

    if (formState.selectedFields.length === 0) {
      setPageError('Select at least one report column.')
      return
    }

    const displayFieldKeys = selectedFieldObjects.map((f) => f.key)

    const cleanedFilters = formState.filters
      .map((filter) => ({
        ...filter,
        field: String(filter.field || '').trim(),
        operator: String(filter.operator || 'equals').trim(),
        value: String(filter.value || '').trim(),
      }))
      .filter((filter) => filter.field && (filter.value !== '' || filter.operator === 'is_empty' || filter.operator === 'is_not_empty'))

    const payload = {
      entityType: formState.entityType,
      name: formState.reportName.trim(),
      reportName: formState.reportName.trim(),
      description: formState.description.trim(),
      visibility: formState.visibility,
      runtimePeriodEnabled: formState.runtimePeriodEnabled,
      groupBy: formState.groupBy,
      orderBy: formState.orderBy,
      aggregate: formState.aggregate,
      owner: formState.accountOwner,
      accountOwner: formState.accountOwner,
      accountOwnerEmail: (
        selectedGroupMembers.find((m) => m.name === formState.accountOwner)?.email ||
        allDirectoryUsers.find((u) => u.name === formState.accountOwner || u.value === formState.accountOwner)?.email ||
        ''
      ),
      ownerEmail: (
        selectedGroupMembers.find((m) => m.name === formState.accountOwner)?.email ||
        allDirectoryUsers.find((u) => u.name === formState.accountOwner || u.value === formState.accountOwner)?.email ||
        ''
      ),
      userGroups: selectedUserGroups,
      selectedUserGroups: selectedUserGroups,
      userGroupMembers: selectedGroupMembers.map((m) => ({
        userId: m.userId,
        name: m.name,
        email: m.email,
        groupName: m.groupName,
        groupId: m.groupId,
      })),
      dateFilterField: formState.dateFilterField || (formState.entityType === 'Deal' ? 'dealDate' : formState.entityType === 'Quotation' ? 'quotationDate' : formState.entityType === 'Customer' ? 'createdAt' : 'accountDate'),
      recordDateFrom: formState.recordDateFrom,
      recordDateTo: formState.recordDateTo,
      filters: cleanedFilters,
      displayFields: displayFieldKeys,
      selectedFields: displayFieldKeys,
      layoutOrder: formState.selectedFields,
      createdBy: user?.name || user?.username || 'System Administrator',
      creatorName: user?.name || user?.username || 'System Administrator',
    }

    setIsSaving(true)
    try {
      if (templateIdParam) {
        await apiClient.put(`/reports/templates/${encodeURIComponent(templateIdParam)}`, payload)
      } else {
        await apiClient.post('/reports/templates', payload)
      }
      setSaveSuccess('Report template saved successfully!')
      setTimeout(() => {
        navigate(reportListPath)
      }, 800)
    } catch (error) {
      setPageError(error.response?.data?.error || error.message || 'Failed to save report template.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="account-report-builder-page">
      {/* Top Toolbar */}
      <div className="account-report-builder-topbar">
        <div className="account-report-builder-title-block">
          <h1>{templateIdParam ? 'Edit' : 'Add'} {formState.entityType} Report</h1>
          <span className="account-report-builder-badge">{formState.entityType}</span>
        </div>
        <div className="account-report-builder-topbar-actions">
          <button
            type="button"
            className="account-report-builder-btn account-report-builder-btn-cancel"
            onClick={() => navigate(reportListPath)}
          >
            <FaTimes /> Cancel
          </button>
          <button
            type="button"
            className="account-report-builder-btn"
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{ backgroundColor: '#107c41', color: '#fff', borderColor: '#107c41' }}
          >
            <FaFileExcel /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            type="submit"
            form="account-report-builder-form"
            className="account-report-builder-btn account-report-builder-btn-save"
            disabled={isSaving}
          >
            <FaSave /> {isSaving ? 'Saving...' : (templateIdParam ? 'Update' : 'Save Template')}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="account-report-builder-alert account-report-builder-alert-error">
          <FaTimes className="account-report-alert-icon" />
          <span>{pageError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="account-report-builder-alert account-report-builder-alert-success">
          <FaCheck className="account-report-alert-icon" />
          <span>{saveSuccess}</span>
        </div>
      )}

      <form id="account-report-builder-form" className="account-report-builder-form" onSubmit={handleSubmit}>
        {/* SECTION A: REPORT DETAILS */}
        <section className="account-report-builder-panel account-report-panel-meta">
          <div className="account-report-builder-section-heading">Section A — Report Details</div>
          <div className="account-report-builder-meta-grid">
            <div className="account-report-builder-field">
              <label>Report Context</label>
              <select
                value={formState.entityType.toLowerCase()}
                onChange={(event) => {
                  const val = event.target.value
                  const newEntity = val === 'deal' ? 'Deal' : val === 'quotation' ? 'Quotation' : val === 'customer' ? 'Customer' : 'Account'
                  const newDateField = newEntity === 'Deal' ? 'dealDate' : newEntity === 'Quotation' ? 'quotationDate' : newEntity === 'Customer' ? 'createdAt' : 'accountDate'
                  setFormState((prev) => ({
                    ...prev,
                    entityType: newEntity,
                    dateFilterField: newDateField,
                    selectedFields: [],
                    description: `${newEntity} Report Template`,
                  }))
                }}
              >
                {ACCOUNT_REPORT_CONTEXT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="account-report-builder-field">
              <label>Report Name <span className="account-report-required">*</span></label>
              <input
                type="text"
                value={formState.reportName}
                onChange={(event) => setFormState((prev) => ({ ...prev, reportName: event.target.value }))}
                placeholder="Enter Report Name"
                required
              />
            </div>

            <div className="account-report-builder-field">
              <label>Visibility</label>
              <select
                value={formState.visibility}
                onChange={(event) => setFormState((prev) => ({ ...prev, visibility: event.target.value }))}
              >
                {ACCOUNT_REPORT_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="account-report-builder-field" ref={groupDropdownRef}>
              <label>User Group</label>
              <div className="account-report-builder-multiselect-container">
                <div
                  className="account-report-builder-multiselect-trigger"
                  onClick={() => setIsGroupDropdownOpen((prev) => !prev)}
                >
                  <div className="account-report-builder-multiselect-chips">
                    {selectedUserGroups.length === 0 ? (
                      <span className="account-report-builder-placeholder">Select User Group(s)...</span>
                    ) : (
                      selectedUserGroups.map((g) => {
                        const grpObj = availableUserGroups.find((item) => item.groupName === g || item.id === g || item._id === g)
                        const displayName = grpObj?.groupName || g
                        return (
                          <span key={g} className="account-report-builder-chip">
                            {displayName}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveUserGroup(g, e)}
                              className="account-report-builder-chip-remove"
                              title={`Remove ${displayName}`}
                            >
                              &times;
                            </button>
                          </span>
                        )
                      })
                    )}
                  </div>
                  <span className="account-report-builder-caret">▾</span>
                </div>

                {isGroupDropdownOpen ? (
                  <div className="account-report-builder-multiselect-dropdown">
                    <div className="account-report-builder-dropdown-search">
                      <input
                        type="text"
                        placeholder="Search User Groups..."
                        value={groupSearchText}
                        onChange={(e) => setGroupSearchText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="account-report-builder-dropdown-options">
                      {availableUserGroups
                        .filter((g) => !groupSearchText.trim() || (g.groupName || g.name || '').toLowerCase().includes(groupSearchText.toLowerCase()))
                        .map((group) => {
                          const val = group.groupName || group.id || group._id
                          const isSelected = selectedUserGroups.includes(val) || selectedUserGroups.includes(group.id) || selectedUserGroups.includes(group._id)
                          return (
                            <label key={val} className="account-report-builder-option-item" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleUserGroup(val)}
                              />
                              <span>{group.groupName}</span>
                            </label>
                          )
                        })}
                      {availableUserGroups.length === 0 ? (
                        <div className="account-report-builder-no-options">No user groups available</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="account-report-builder-field account-report-builder-field-full">
              <label>Report Description</label>
              <textarea
                rows={2}
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Optional report description or purpose..."
              />
            </div>
          </div>
        </section>

        {/* SECTION B: REPORT FILTERS */}
        <section className="account-report-builder-panel account-report-panel-filters">
          <div className="account-report-builder-section-heading">Section B — Report Filters (Owner Name & Dates)</div>
          <div className="account-report-builder-filters-grid">
            <div className="account-report-builder-field" ref={ownerDropdownRef}>
              <label>Owner Name</label>
              <div className="account-report-builder-searchable-select">
                <div
                  className="account-report-builder-searchable-trigger"
                  onClick={() => setIsOwnerDropdownOpen((prev) => !prev)}
                >
                  <span className="account-report-builder-searchable-value">
                    {formState.accountOwner
                      ? (ownerOptions.find((o) => o.value === formState.accountOwner)?.label || formState.accountOwner)
                      : (selectedUserGroups.length > 0 ? 'All Group Members' : 'All Owners')}
                  </span>
                  <span className="account-report-builder-caret">▾</span>
                </div>

                {isOwnerDropdownOpen && (
                  <div className="account-report-builder-searchable-dropdown">
                    <div className="account-report-builder-dropdown-search">
                      <input
                        type="text"
                        placeholder="Search Owners..."
                        value={ownerSearchText}
                        onChange={(e) => setOwnerSearchText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                    <div className="account-report-builder-dropdown-options">
                      <div
                        className={`account-report-builder-searchable-option ${!formState.accountOwner ? 'is-selected' : ''}`}
                        onClick={() => {
                          setFormState((prev) => ({ ...prev, accountOwner: '' }))
                          setIsOwnerDropdownOpen(false)
                          setOwnerSearchText('')
                        }}
                      >
                        {selectedUserGroups.length > 0 ? 'All Group Members' : 'All Owners'}
                      </div>
                      {ownerOptions
                        .filter((opt) => !ownerSearchText.trim() || (opt.label || opt.name || opt.value || '').toLowerCase().includes(ownerSearchText.toLowerCase()))
                        .map((option) => (
                          <div
                            key={option.value}
                            className={`account-report-builder-searchable-option ${formState.accountOwner === option.value ? 'is-selected' : ''}`}
                            onClick={() => {
                              setFormState((prev) => ({ ...prev, accountOwner: option.value }))
                              setIsOwnerDropdownOpen(false)
                              setOwnerSearchText('')
                            }}
                          >
                            {option.label}
                          </div>
                        ))}
                      {ownerOptions.length > 0 && ownerOptions.filter((opt) => !ownerSearchText.trim() || (opt.label || opt.name || opt.value || '').toLowerCase().includes(ownerSearchText.toLowerCase())).length === 0 && (
                        <div className="account-report-builder-no-options">No owners found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="account-report-builder-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ margin: 0 }}>Record Date Range</label>
                {(formState.recordDateFrom || formState.recordDateTo) && (
                  <button
                    type="button"
                    style={{ fontSize: '11px', color: '#c60016', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    onClick={() => setFormState((prev) => ({ ...prev, recordDateFrom: '', recordDateTo: '' }))}
                  >
                    Clear (All Dates)
                  </button>
                )}
              </div>
              <div className="account-report-builder-date-range">
                <input
                  type="date"
                  value={formState.recordDateFrom}
                  onChange={(e) => setFormState((prev) => ({ ...prev, recordDateFrom: e.target.value }))}
                />
                <span>to</span>
                <input
                  type="date"
                  value={formState.recordDateTo}
                  onChange={(e) => setFormState((prev) => ({ ...prev, recordDateTo: e.target.value }))}
                />
              </div>
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                {!formState.recordDateFrom && !formState.recordDateTo
                  ? 'All Dates active (pulls all database records dynamically).'
                  : 'Date window selected.'}
              </small>
            </div>

            <div className="account-report-builder-field account-report-builder-filter-actions-field">
              <label>&nbsp;</label>
              <button
                type="button"
                className="account-report-builder-btn account-report-builder-btn-clear"
                onClick={handleClearFilters}
              >
                <FaRedo /> Reset Filters
              </button>
            </div>
          </div>
        </section>

        {/* SECTION C: FIELD BUILDER */}
        <section className="account-report-builder-panel account-report-panel-fields">
          <div className="account-report-builder-section-heading">
            <span>Section C — Field Builder</span>
            <span className="account-report-selected-count-badge">
              Selected: {selectedFieldObjects.length} columns
            </span>
          </div>

          <div className="account-report-builder-dnd-container">
            {/* Left Panel: Available Categorized Fields */}
            <div className="account-report-dnd-panel account-report-dnd-panel-available">
              <div className="account-report-dnd-panel-header">
                <h3>Available Fields</h3>
                <div className="account-report-field-search-box">
                  <FaSearch className="account-report-search-icon" />
                  <input
                    type="text"
                    value={fieldSearchQuery}
                    onChange={(e) => setFieldSearchQuery(e.target.value)}
                    placeholder="Search fields..."
                  />
                  {fieldSearchQuery && (
                    <button
                      type="button"
                      className="account-report-search-clear"
                      onClick={() => setFieldSearchQuery('')}
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              <div className="account-report-category-list account-report-available-flat-list">
                {currentFieldOptions
                  .filter((field) => {
                    if (field.label === 'Deal Name' || field.key === 'dealName') return false
                    if (!fieldSearchQuery.trim()) return true
                    return (
                      field.label.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
                      field.key.toLowerCase().includes(fieldSearchQuery.toLowerCase())
                    )
                  })
                  .map((field) => {
                    const isAlreadySelected = selectedFieldSet.has(field.key) || selectedFieldSet.has(field.label)
                    return (
                      <div
                        key={field.key}
                        className={`account-report-available-item ${isAlreadySelected ? 'account-report-item-selected' : ''}`}
                      >
                        <span className="account-report-item-name">{field.label}</span>
                        {isAlreadySelected ? (
                          <span className="account-report-item-added-badge"><FaCheck /> Added</span>
                        ) : (
                          <button
                            type="button"
                            className="account-report-item-add-btn"
                            onClick={() => handleAddField(field)}
                            title={`Add ${field.label}`}
                          >
                            <FaPlus />
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Right Panel: Selected & Ordered Columns */}
            <div className="account-report-dnd-panel account-report-dnd-panel-selected">
              <div className="account-report-dnd-panel-header">
                <h3>Selected Columns ({selectedFieldObjects.length})</h3>
              </div>

              <div className="account-report-selected-list">
                {selectedFieldObjects.length === 0 ? (
                  <div className="account-report-empty-selected">
                    <p>No fields selected yet.</p>
                    <span>Click the <strong>[ + ]</strong> button on any field to add it.</span>
                  </div>
                ) : (
                  selectedFieldObjects.map((field, index) => (
                    <div
                      key={`${field.key}-${index}`}
                      className="account-report-selected-item"
                    >
                      <span className="account-report-item-index">{index + 1}.</span>
                      <span className="account-report-selected-label">{field.label}</span>

                      <div className="account-report-item-controls">
                        <button
                          type="button"
                          className="account-report-remove-btn"
                          onClick={() => handleRemoveField(field.key)}
                          title="Remove field"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Actions Bar */}
        <div className="account-report-builder-bottom-actions">
          <button
            type="button"
            className="account-report-builder-btn account-report-builder-btn-cancel"
            onClick={() => navigate(reportListPath)}
          >
            <FaTimes /> Close
          </button>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className="account-report-builder-btn"
              onClick={handleExportExcel}
              disabled={isExporting}
              style={{ backgroundColor: '#107c41', color: '#fff', borderColor: '#107c41' }}
            >
              <FaFileExcel /> {isExporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="submit"
              className="account-report-builder-btn account-report-builder-btn-save"
              disabled={isSaving}
            >
              <FaSave /> {isSaving ? 'Saving...' : (templateIdParam ? 'Update' : 'Save Template')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddAccountReportPage
