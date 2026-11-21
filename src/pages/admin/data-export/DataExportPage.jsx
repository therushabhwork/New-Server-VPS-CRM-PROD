import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  FaFileExport,
  FaFileExcel,
  FaFilePdf,
  FaFileCsv,
  FaUsers,
  FaBuilding,
  FaHandshake,
  FaUserTie,
  FaFileInvoiceDollar,
  FaShieldAlt,
  FaDownload,
  FaUndo,
  FaRedo,
  FaLock,
  FaCalendarAlt,
} from 'react-icons/fa'
import { useAuth } from '../../../context/AuthContext'
import apiClient from '../../../services/apiClient'
import './DataExportPage.css'

export const isAuthorizedForDataExport = (user) => {
  if (!user) return false
  const candidates = [
    user.name,
    user.username,
    user.email,
  ].map((v) => String(v || '').trim().toLowerCase())

  return candidates.some((val) =>
    val === 'keval v shah' ||
    val === 'keval v. shah' ||
    val === 'kevalvshah' ||
    val.startsWith('keval@') ||
    val === 'samir sheth' ||
    val === 'samir-sheth' ||
    val.startsWith('samirsheth@') ||
    val === 'parth crm support' ||
    val === 'parth-crm-support' ||
    val.startsWith('parth@') ||
    val === 'rushabh crm support' ||
    val === 'rushabh-crm-support' ||
    val.startsWith('rushabh@')
  )
}

const MODULES_DEF = [
  { key: 'accounts', label: 'Accounts', icon: FaBuilding },
  { key: 'deals', label: 'Deals', icon: FaHandshake },
  { key: 'customers', label: 'Customers', icon: FaUserTie },
  { key: 'quotations', label: 'Quotations', icon: FaFileInvoiceDollar },
]

export default function DataExportPage() {
  const { user } = useAuth()
  const canAccess = useMemo(() => isAuthorizedForDataExport(user), [user])

  const [availableOwners, setAvailableOwners] = useState([])
  const [loadingOwners, setLoadingOwners] = useState(false)

  // Filters State
  const [selectedOwner, setSelectedOwner] = useState('all')
  const [selectedModules, setSelectedModules] = useState(['accounts', 'deals', 'customers', 'quotations'])
  const [datePreset, setDatePreset] = useState('all_time')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportFormat, setExportFormat] = useState('xlsx')

  // Preview & Export States
  const [preview, setPreview] = useState({
    accounts: 0,
    deals: 0,
    customers: 0,
    quotations: 0,
    total: 0,
    dealValue: 0,
    quotationValue: 0,
  })
  const [ownerSummary, setOwnerSummary] = useState([])
  const [ownerSearch, setOwnerSearch] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 1. Fetch available owners
  useEffect(() => {
    if (!canAccess) return
    let isMounted = true
    setLoadingOwners(true)

    apiClient
      .get('/data-export/owners')
      .then((res) => {
        const payloadData = res?.data !== undefined ? res.data : res
        const list = Array.isArray(payloadData)
          ? payloadData
          : (Array.isArray(payloadData?.data) ? payloadData.data : (Array.isArray(res?.data) ? res.data : []))
        if (isMounted && list.length > 0) {
          setAvailableOwners(list)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch owners for data export:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingOwners(false)
      })

    return () => {
      isMounted = false
    }
  }, [canAccess])

  // Helper to resolve preset dates
  const resolveDateRange = useCallback(() => {
    if (datePreset === 'all_time') return { from: null, to: null }
    if (datePreset === 'custom') return { from: startDate || null, to: endDate || null }

    const now = new Date()
    const fmt = (d) => d.toISOString().slice(0, 10)

    if (datePreset === 'today') {
      const todayStr = fmt(now)
      return { from: todayStr, to: todayStr }
    }
    if (datePreset === 'last_7_days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { from: fmt(past), to: fmt(now) }
    }
    if (datePreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: fmt(first), to: fmt(now) }
    }
    if (datePreset === 'previous_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(first), to: fmt(last) }
    }

    return { from: null, to: null }
  }, [datePreset, startDate, endDate])

  // 2. Fetch live preview counts
  const fetchPreview = useCallback((retryCount = 0) => {
    if (!canAccess) return
    setLoadingPreview(true)
    setErrorMsg('')

    const dateRange = resolveDateRange()
    const payload = {
      owners: selectedOwner,
      modules: selectedModules,
      dateRange,
    }

    apiClient
      .post('/data-export/preview', payload)
      .then((res) => {
        const data = res?.counts ? res : (res?.data || res)
        if (data && (data.counts || data.success)) {
          const counts = data.counts || {}
          const values = data.values || {}
          setPreview({
            accounts: counts.accounts || 0,
            deals: counts.deals || 0,
            customers: counts.customers || 0,
            quotations: counts.quotations || 0,
            total: counts.total || 0,
            dealValue: values.dealValue || 0,
            quotationValue: values.quotationValue || 0,
          })
          setOwnerSummary(data.ownerSummary || [])
          setErrorMsg('')
        }
      })
      .catch((err) => {
        if (retryCount === 0) {
          setTimeout(() => {
            fetchPreview(1)
          }, 800)
          return
        }
        console.error('Failed to fetch export preview:', err)
        setErrorMsg('Failed to calculate preview counts. Please verify backend connection.')
      })
      .finally(() => {
        setLoadingPreview(false)
      })
  }, [canAccess, selectedOwner, selectedModules, resolveDateRange])

  // Debounced auto-preview
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview()
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchPreview])

  // Toggle Module Selection
  const handleToggleModule = (key) => {
    setSelectedModules((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev // Keep at least one
        return prev.filter((m) => m !== key)
      }
      return [...prev, key]
    })
  }

  // Handle Export Download
  const handleExportDownload = async () => {
    if (!canAccess || exporting) return
    setExporting(true)
    setErrorMsg('')

    try {
      const dateRange = resolveDateRange()
      const payload = {
        owners: selectedOwner,
        modules: selectedModules,
        dateRange,
        format: exportFormat,
      }

      const response = await apiClient.post('/data-export/download', payload, {
        responseType: 'blob',
      })

      // Extract filename from header or build fallback
      let filename = `CRM_Data_Export_${new Date().toISOString().slice(0, 10)}.${exportFormat}`
      const disposition = response?.headers?.['content-disposition'] || response?.headers?.['Content-Disposition']
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) filename = match[1]
      }

      // Handle both raw Blob (from apiClient response.data unwrapping) and response wrapper
      const rawData = response instanceof Blob ? response : (response?.data instanceof Blob ? response.data : (response?.data || response))
      const blob = rawData instanceof Blob ? rawData : new Blob([rawData], {
        type: exportFormat === 'pdf'
          ? 'application/pdf'
          : (exportFormat === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export download failed:', err)
      setErrorMsg('Failed to download export. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // Handle Reset Filters
  const handleResetFilters = () => {
    setSelectedOwner('all')
    setSelectedModules(['accounts', 'deals', 'customers', 'quotations'])
    setDatePreset('all_time')
    setStartDate('')
    setEndDate('')
    setExportFormat('xlsx')
    setOwnerSearch('')
  }

  // Unauthorized view guard
  if (!canAccess) {
    return (
      <div className="cde-page-container">
        <div className="cde-card cde-access-denied">
          <FaLock className="cde-access-icon" />
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
            Access Restricted
          </h2>
          <p style={{ color: '#64748b', maxWidth: '420px', margin: 0, fontSize: '14px' }}>
            The Centralized CRM Data Export module is strictly restricted to designated administrative controllers. Please contact Keval V Shah, Samir Sheth, Parth, or Rushabh for authorization.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cde-page-container">
      {/* Header */}
      <header className="cde-header">
        <div className="cde-header-left">
          <FaFileExport className="cde-header-icon" />
          <div>
            <h1 className="cde-header-title">Centralized CRM Data Export</h1>
            <p className="cde-header-subtitle">
              Universal multi-module data extraction across All Owners and Individual Owners with zero historical record loss.
            </p>
          </div>
        </div>
        <div className="cde-badge-auth">
          <FaShieldAlt /> Authorized Controller: {user?.name || user?.username}
        </div>
      </header>

      {errorMsg && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
          {errorMsg}
        </div>
      )}

      {/* Main Grid */}
      <div className="cde-grid">
        {/* Left Column: Configuration Controls */}
        <div className="cde-config-column">
          {/* Section 1: Owner Selection */}
          <div className="cde-card">
            <div className="cde-card-header">
              <h3 className="cde-card-title"><FaUsers /> 1. Owner Selection</h3>
              {selectedOwner !== 'all' && (
                <button
                  type="button"
                  className="cde-text-btn"
                  onClick={() => setSelectedOwner('all')}
                  title="Switch to All Owners"
                >
                  Show All Owners
                </button>
              )}
            </div>
            <div className="cde-card-body">
              <div className="cde-form-group">
                <label className="cde-label" htmlFor="cde-owner-select">Target Owner Scope</label>
                <select
                  id="cde-owner-select"
                  className="cde-select"
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  disabled={loadingOwners}
                >
                  <option value="all">🌟 All Owners (Consolidated Across Entire CRM)</option>
                  <optgroup label="Individual Owners">
                    {availableOwners.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <small style={{ color: '#64748b', fontSize: '11px' }}>
                    Includes active and historical sales representatives with automatic legacy code and alias resolution.
                  </small>
                  {selectedOwner !== 'all' && (
                    <button
                      type="button"
                      className="cde-clear-owner-btn"
                      onClick={() => setSelectedOwner('all')}
                    >
                      ✕ Reset to All Owners
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Module Selection */}
          <div className="cde-card">
            <div className="cde-card-header">
              <h3 className="cde-card-title"><FaBuilding /> 2. Module Selection</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="cde-text-btn"
                  onClick={() => setSelectedModules(['accounts', 'deals', 'customers', 'quotations'])}
                >
                  Select All
                </button>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <button
                  type="button"
                  className="cde-text-btn"
                  onClick={() => setSelectedModules(['accounts'])}
                >
                  Accounts Only
                </button>
              </div>
            </div>
            <div className="cde-card-body">
              <div className="cde-modules-grid">
                {MODULES_DEF.map(({ key, label, icon: Icon }) => {
                  const isActive = selectedModules.includes(key)
                  const count = preview[key] || 0
                  return (
                    <div
                      key={key}
                      className={`cde-module-checkbox-card ${isActive ? 'active' : ''}`}
                      onClick={() => handleToggleModule(key)}
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <Icon className="cde-module-icon" />
                      <span>{label}</span>
                      <span className="cde-module-count-badge">
                        {loadingPreview ? '...' : count.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Date Range */}
          <div className="cde-card">
            <div className="cde-card-header">
              <h3 className="cde-card-title"><FaCalendarAlt /> 3. Date Range</h3>
            </div>
            <div className="cde-card-body">
              <div className="cde-form-group">
                <label className="cde-label" htmlFor="cde-date-preset">Date Range Preset</label>
                <select
                  id="cde-date-preset"
                  className="cde-select"
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                >
                  <option value="all_time">All Time (Export Full Historical Archive)</option>
                  <option value="today">Today</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="this_month">This Month</option>
                  <option value="previous_month">Previous Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {datePreset === 'custom' && (
                <div className="cde-dates-row cde-form-group">
                  <div>
                    <label className="cde-label" htmlFor="cde-start-date">From Date</label>
                    <input
                      id="cde-start-date"
                      type="date"
                      className="cde-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="cde-label" htmlFor="cde-end-date">To Date</label>
                    <input
                      id="cde-end-date"
                      type="date"
                      className="cde-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Export Format */}
          <div className="cde-card">
            <div className="cde-card-header">
              <h3 className="cde-card-title"><FaFileExcel /> 4. Export Format</h3>
            </div>
            <div className="cde-card-body">
              <div className="cde-formats-row">
                <div
                  className={`cde-format-pill ${exportFormat === 'xlsx' ? 'active' : ''}`}
                  onClick={() => setExportFormat('xlsx')}
                >
                  <FaFileExcel style={{ fontSize: '16px' }} />
                  <span>Excel Workbook (.xlsx)</span>
                </div>
                <div
                  className={`cde-format-pill ${exportFormat === 'pdf' ? 'active' : ''}`}
                  onClick={() => setExportFormat('pdf')}
                >
                  <FaFilePdf style={{ fontSize: '16px' }} />
                  <span>PDF Document (.pdf)</span>
                </div>
              </div>
              <small style={{ display: 'block', marginTop: '8px', color: '#64748b', fontSize: '11px' }}>
                {exportFormat === 'xlsx'
                  ? 'Generates an industrial multi-tab workbook with top metadata header banners, auto-adjusted column widths, and separate sheets for Accounts, Deals, Customers, Quotations, and an Owner Summary sheet.'
                  : 'Generates a formatted landscape PDF document with corporate branding, owner metadata, and auto-paginated data tables.'}
              </small>
            </div>
          </div>
        </div>

        {/* Right Column: Live Matching Preview & Action Trigger */}
        <div className="cde-preview-column">
          <div className="cde-card" style={{ position: 'sticky', top: '20px' }}>
            <div className="cde-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="cde-card-title">Live Export Preview</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {loadingPreview && <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>Calculating...</span>}
                <button
                  type="button"
                  onClick={() => fetchPreview(0)}
                  disabled={loadingPreview}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Recalculate preview counts"
                >
                  <FaRedo style={{ fontSize: '10px' }} /> Refresh
                </button>
              </div>
            </div>
            <div className="cde-card-body">
              <div className="cde-preview-metric-list">
                {selectedModules.includes('accounts') && (
                  <div className="cde-preview-item">
                    <span className="cde-preview-label"><FaBuilding style={{ color: '#0284c7' }} /> Accounts</span>
                    <span className="cde-preview-val">{preview.accounts.toLocaleString()}</span>
                  </div>
                )}
                {selectedModules.includes('deals') && (
                  <div className="cde-preview-item">
                    <span className="cde-preview-label"><FaHandshake style={{ color: '#16a34a' }} /> Deals</span>
                    <span className="cde-preview-val">{preview.deals.toLocaleString()}</span>
                  </div>
                )}
                {selectedModules.includes('customers') && (
                  <div className="cde-preview-item">
                    <span className="cde-preview-label"><FaUserTie style={{ color: '#d97706' }} /> Customers</span>
                    <span className="cde-preview-val">{preview.customers.toLocaleString()}</span>
                  </div>
                )}
                {selectedModules.includes('quotations') && (
                  <div className="cde-preview-item">
                    <span className="cde-preview-label"><FaFileInvoiceDollar style={{ color: '#7c3aed' }} /> Quotations</span>
                    <span className="cde-preview-val">{preview.quotations.toLocaleString()}</span>
                  </div>
                )}

                <div className="cde-preview-total-row">
                  <span className="cde-preview-total-label">Total Records</span>
                  <span className="cde-preview-total-val">{preview.total.toLocaleString()}</span>
                </div>
              </div>

              {preview.deals > 0 && (
                <div style={{ marginTop: '12px', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Deal Value:</span>
                  <strong style={{ color: '#16a34a' }}>₹{preview.dealValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
              )}

              {preview.quotations > 0 && (
                <div style={{ marginTop: '6px', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Quotation Value:</span>
                  <strong style={{ color: '#7c3aed' }}>₹{preview.quotationValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
              )}

              {/* Workbook Structure Guide */}
              {exportFormat === 'xlsx' && (
                <div className="cde-sheets-preview-box">
                  <div className="cde-sheets-preview-title">
                    <FaFileExcel style={{ color: '#16a34a' }} /> Workbook Sheets Included:
                  </div>
                  <div className="cde-sheets-tags">
                    {selectedModules.includes('accounts') && <span className="cde-sheet-tag">1. Accounts</span>}
                    {selectedModules.includes('deals') && <span className="cde-sheet-tag">2. Deals</span>}
                    {selectedModules.includes('customers') && <span className="cde-sheet-tag">3. Customers</span>}
                    {selectedModules.includes('quotations') && <span className="cde-sheet-tag">4. Quotations</span>}
                    <span className="cde-sheet-tag summary">★ Owner Summary</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <button
                type="button"
                className="cde-btn-export"
                onClick={handleExportDownload}
                disabled={exporting || preview.total === 0}
              >
                <FaDownload />
                <span>{exporting ? 'Generating Workbook...' : `Export ${preview.total.toLocaleString()} Records`}</span>
              </button>

              <button
                type="button"
                className="cde-btn-reset"
                onClick={handleResetFilters}
                disabled={exporting}
              >
                <FaUndo style={{ marginRight: '6px' }} /> Reset All Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Owner Summary Breakdown Table (Exact Excel Parity) */}
      {ownerSummary.length > 0 && (
        <div className="cde-summary-section">
          <div className="cde-summary-header">
            <div className="cde-summary-title-group">
              <h3 className="cde-card-title"><FaUsers /> Owner Records &amp; Pipeline Breakdown</h3>
              <span className="cde-badge-count">{ownerSummary.filter(r => r['Owner Name'] !== 'GRAND TOTAL').length} Owners</span>
            </div>
            <div className="cde-summary-search-box">
              <input
                type="text"
                placeholder="Search owner..."
                className="cde-input"
                style={{ padding: '5px 12px', fontSize: '12px', width: '220px' }}
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
              />
            </div>
          </div>

          {selectedOwner !== 'all' && (
            <div className="cde-filtered-owner-banner">
              <span>
                🎯 Active Filter: Showing records strictly owned by <strong>{selectedOwner}</strong>.
              </span>
              <button
                type="button"
                className="cde-text-btn"
                onClick={() => setSelectedOwner('all')}
                style={{ color: '#1e40af', textDecoration: 'underline' }}
              >
                Reset to All Owners
              </button>
            </div>
          )}

          <div className="cde-table-wrapper">
            <table className="cde-summary-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Owner Name (Click to filter)</th>
                  <th style={{ textAlign: 'center' }}>Owner Code</th>
                  <th style={{ textAlign: 'center' }}>Total Records</th>
                  <th style={{ textAlign: 'center' }}>Accounts</th>
                  <th style={{ textAlign: 'center' }}>Deals</th>
                  <th style={{ textAlign: 'right' }}>Total Deal Value</th>
                  <th style={{ textAlign: 'center' }}>Customers</th>
                  <th style={{ textAlign: 'center' }}>Quotations</th>
                  <th style={{ textAlign: 'right' }}>Total Quotation Value</th>
                </tr>
              </thead>
              <tbody>
                {ownerSummary
                  .filter((row) => {
                    if (!ownerSearch.trim()) return true
                    if (row['Owner Name'] === 'GRAND TOTAL') return true
                    return (
                      String(row['Owner Name'] || '').toLowerCase().includes(ownerSearch.toLowerCase()) ||
                      String(row['Owner Code'] || '').toLowerCase().includes(ownerSearch.toLowerCase())
                    )
                  })
                  .map((row, idx) => {
                    const isGrandTotal = row['Owner Name'] === 'GRAND TOTAL'
                    const isSelected = selectedOwner !== 'all' && row['Owner Name'] === selectedOwner
                    return (
                      <tr
                        key={idx}
                        className={`${isGrandTotal ? 'cde-grand-total-row' : 'clickable-row'} ${isSelected ? 'selected-owner-row' : ''}`}
                        onClick={() => {
                          if (!isGrandTotal) {
                            setSelectedOwner(row['Owner Name'])
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }
                        }}
                        title={!isGrandTotal ? `Click to filter export by ${row['Owner Name']}` : ''}
                      >
                        <td style={{ fontWeight: isGrandTotal ? 700 : 500 }}>
                          {row['Owner Name']}
                          {!isGrandTotal && isSelected && (
                            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>
                              ● Filtered
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                          {row['Owner Code'] || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`cde-total-records-badge ${isGrandTotal ? 'grand' : ''}`}>
                            {Number(row['Total Records'] || 0).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{Number(row['Total Accounts'] || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}>{Number(row['Total Deals'] || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: isGrandTotal ? 700 : 600 }}>
                          ₹{row['Total Deal Value (₹)']}
                        </td>
                        <td style={{ textAlign: 'center' }}>{Number(row['Total Customers'] || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}>{Number(row['Total Quotations'] || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: isGrandTotal ? 700 : 600 }}>
                          ₹{row['Total Quotation Value (₹)']}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
