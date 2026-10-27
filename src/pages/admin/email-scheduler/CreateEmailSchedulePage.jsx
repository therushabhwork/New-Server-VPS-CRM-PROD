import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaClock,
  FaEnvelope,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaPlus,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaTimes,
} from 'react-icons/fa'
import { scheduledReportApi } from '../../../services/scheduledReportApi'
import '../AdminPanel.css'

export default function CreateEmailSchedulePage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [reportSearchTerm, setReportSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Current logged in user for 'self' recipient
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch (_) {
      return {}
    }
  }, [])

  const [form, setForm] = useState({
    name: '',
    selectedReportId: '',
    frequency: 'daily',
    time: '18:00',
    dateRangeType: 'last_7_days',
    recipientType: 'self',
    customEmail: '',
    additionalEmails: '',
    isEnabled: true,
  })

  useEffect(() => {
    let isMounted = true
    setLoadingReports(true)
    setError(null)

    scheduledReportApi.getAvailableReports()
      .then((data) => {
        if (!isMounted) return
        setReports(data || [])
        if (data && data.length > 0) {
          setForm((prev) => ({
            ...prev,
            selectedReportId: prev.selectedReportId || data[0].id,
            name: prev.name || `${data[0].reportName} Automated Delivery`,
          }))
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load report list')
      })
      .finally(() => {
        if (isMounted) setLoadingReports(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleReportChange = (reportId) => {
    const found = reports.find((r) => r.id === reportId)
    setForm((prev) => ({
      ...prev,
      selectedReportId: reportId,
      name: found ? `${found.reportName} Automated Delivery` : prev.name,
      dateRangeType: found?.dateRangeType || prev.dateRangeType,
    }))
  }

  const filteredReports = useMemo(() => {
    if (!reportSearchTerm.trim()) return reports
    const term = reportSearchTerm.toLowerCase().trim()
    return reports.filter((r) => {
      const name = String(r.reportName || '').toLowerCase()
      const entity = String(r.entityType || r.dataSource || '').toLowerCase()
      const desc = String(r.description || '').toLowerCase()
      return name.includes(term) || entity.includes(term) || desc.includes(term)
    })
  }, [reports, reportSearchTerm])

  const selectedReport = useMemo(() => {
    return reports.find((r) => r.id === form.selectedReportId)
  }, [reports, form.selectedReportId])

  const selectReportItem = (reportId) => {
    handleReportChange(reportId)
    setDropdownOpen(false)
    setReportSearchTerm('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Please provide a name for this schedule')
      return
    }

    const selectedReport = reports.find((r) => r.id === form.selectedReportId)
    if (!selectedReport) {
      setError('Please select a valid report to schedule')
      return
    }

    const recipientEmail = form.recipientType === 'self'
      ? (currentUser?.email || '')
      : form.customEmail.trim()

    if (!recipientEmail || !recipientEmail.includes('@')) {
      setError('A valid recipient email address is required')
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      reportConfig: {
        sourceType: selectedReport.sourceType,
        templateId: selectedReport.id,
        reportName: selectedReport.reportName,
        dataSource: selectedReport.dataSource,
        entityType: selectedReport.entityType || selectedReport.dataSource,
        selectedFields: selectedReport.selectedFields || [],
        displayFields: selectedReport.displayFields || selectedReport.selectedFields || [],
        filters: selectedReport.filters || [],
        accountOwner: selectedReport.accountOwner || 'all',
        userGroups: selectedReport.userGroups || selectedReport.selectedUserGroups || [],
        selectedUserGroups: selectedReport.selectedUserGroups || selectedReport.userGroups || [],
        userGroupMembers: selectedReport.userGroupMembers || [],
        recordDateFrom: selectedReport.recordDateFrom || '',
        recordDateTo: selectedReport.recordDateTo || '',
        dateRangeType: form.dateRangeType,
      },
      schedule: {
        frequency: form.frequency,
        time: form.time,
        timezone: 'Asia/Kolkata',
      },
      recipient: {
        type: form.recipientType,
        email: recipientEmail,
        additionalEmails: form.additionalEmails
          ? form.additionalEmails.split(',').map((email) => email.trim()).filter(Boolean)
          : [],
      },
      isEnabled: form.isEnabled,
    }

    try {
      await scheduledReportApi.createSchedule(payload)
      navigate('/admin/email-scheduler', {
        state: {
          successMessage: `Schedule "${form.name.trim()}" created successfully!`,
        },
      })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to create schedule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ap-home-layout" style={{ maxWidth: '980px', margin: '0 auto', padding: '1rem' }}>
      {/* Row 1: Back Button (Icon Only, appears first on top) */}
      <div style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className="ap-header-item-btn"
          onClick={() => navigate('/admin/email-scheduler')}
          title="Back to Schedules"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.25rem',
            height: '2.25rem',
            padding: 0,
            borderRadius: '8px',
          }}
        >
          <FaArrowLeft style={{ fontSize: '0.85rem' }} />
        </button>
      </div>

      {/* Row 2: Title and Subtitle underneath the Back icon button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="ap-welcome-heading" style={{ fontSize: '1.45rem', margin: 0, fontWeight: 700 }}>
          Create Email Report Schedule
        </h1>
        <p className="ap-welcome-sub" style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Configure recurring automated report generation and Outlook delivery.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="ap-error-banner" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaExclamationCircle />
          <span>{error}</span>
        </div>
      )}

      {/* Main Enterprise Form Card */}
      <div className="ap-card-box">
        <form onSubmit={handleSubmit}>
          {/* Section 1: Report & Schedule Identity */}
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
            <h2 className="ap-card-head-title" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
              <FaFileAlt className="ap-card-head-icon" />
              <span>Report Configuration</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Schedule Name */}
              <div className="ap-form-group">
                <label className="ap-form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                  Schedule Name *
                </label>
                <input
                  type="text"
                  className="ap-input"
                  placeholder="e.g. Daily Executive Deals Report"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              {/* Report Source Selector */}
              <div className="ap-form-group">
                <label className="ap-form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                  Select Report to Schedule *
                </label>
                {loadingReports ? (
                  <div style={{ padding: '8px', color: 'var(--text-secondary)' }}>Loading reports...</div>
                ) : (
                  <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="ap-input"
                      onClick={() => setDropdownOpen((prev) => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        padding: '8px 12px',
                        backgroundColor: '#fff',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedReport ? (
                          <>
                            <span>{selectedReport.reportName}</span>
                            <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              {(selectedReport.entityType || selectedReport.dataSource || 'REPORT').toUpperCase()}
                            </span>
                          </>
                        ) : (
                          '-- Select Report to Schedule --'
                        )}
                      </span>
                      {dropdownOpen ? (
                        <FaChevronUp style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '8px', flexShrink: 0 }} />
                      ) : (
                        <FaChevronDown style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '8px', flexShrink: 0 }} />
                      )}
                    </button>

                    {dropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          zIndex: 1000,
                          backgroundColor: '#fff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          maxHeight: '340px',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Search Bar Input */}
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc' }}>
                          <FaSearch style={{ color: '#94a3b8', fontSize: '0.85rem', flexShrink: 0 }} />
                          <input
                            type="text"
                            placeholder="Search reports by name or module..."
                            value={reportSearchTerm}
                            onChange={(e) => setReportSearchTerm(e.target.value)}
                            autoFocus
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: '0.85rem',
                              color: '#1e293b',
                            }}
                          />
                          {reportSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setReportSearchTerm('')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.85rem', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                            >
                              <FaTimes />
                            </button>
                          )}
                        </div>

                        {/* List of Report Options */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                          {filteredReports.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                              No reports found matching "{reportSearchTerm}"
                            </div>
                          ) : (
                            <>
                              {/* System Reports */}
                              {filteredReports.some((r) => r.sourceType === 'system_report') && (
                                <div>
                                  <div style={{ padding: '6px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f8fafc' }}>
                                    System Reports
                                  </div>
                                  {filteredReports.filter((r) => r.sourceType === 'system_report').map((r) => {
                                    const isSelected = r.id === form.selectedReportId
                                    return (
                                      <div
                                        key={r.id}
                                        onClick={() => selectReportItem(r.id)}
                                        style={{
                                          padding: '8px 12px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          backgroundColor: isSelected ? '#fee2e2' : 'transparent',
                                          color: isSelected ? '#c60016' : '#1e293b',
                                          fontWeight: isSelected ? 700 : 500,
                                          fontSize: '0.85rem',
                                          transition: 'background-color 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? '#fee2e2' : 'transparent'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                          {isSelected && <FaCheckCircle style={{ color: '#c60016', fontSize: '0.8rem', flexShrink: 0 }} />}
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reportName}</span>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                                          {(r.entityType || r.dataSource || 'REPORT').toUpperCase()}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Custom Templates */}
                              {filteredReports.some((r) => r.sourceType === 'reporttemplate') && (
                                <div>
                                  <div style={{ padding: '6px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f8fafc', marginTop: '4px' }}>
                                    Custom Templates (From /admin/reports/custom)
                                  </div>
                                  {filteredReports.filter((r) => r.sourceType === 'reporttemplate').map((r) => {
                                    const isSelected = r.id === form.selectedReportId
                                    return (
                                      <div
                                        key={r.id}
                                        onClick={() => selectReportItem(r.id)}
                                        style={{
                                          padding: '8px 12px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          backgroundColor: isSelected ? '#fee2e2' : 'transparent',
                                          color: isSelected ? '#c60016' : '#1e293b',
                                          fontWeight: isSelected ? 700 : 500,
                                          fontSize: '0.85rem',
                                          transition: 'background-color 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? '#fee2e2' : 'transparent'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                          {isSelected && <FaCheckCircle style={{ color: '#c60016', fontSize: '0.8rem', flexShrink: 0 }} />}
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reportName}</span>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                                          {(r.entityType || r.dataSource || 'REPORT').toUpperCase()}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Saved Reports */}
                              {filteredReports.some((r) => r.sourceType === 'saved_report') && (
                                <div>
                                  <div style={{ padding: '6px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f8fafc', marginTop: '4px' }}>
                                    Saved Reports (From /admin/reports/custom)
                                  </div>
                                  {filteredReports.filter((r) => r.sourceType === 'saved_report').map((r) => {
                                    const isSelected = r.id === form.selectedReportId
                                    return (
                                      <div
                                        key={r.id}
                                        onClick={() => selectReportItem(r.id)}
                                        style={{
                                          padding: '8px 12px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          backgroundColor: isSelected ? '#fee2e2' : 'transparent',
                                          color: isSelected ? '#c60016' : '#1e293b',
                                          fontWeight: isSelected ? 700 : 500,
                                          fontSize: '0.85rem',
                                          transition: 'background-color 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? '#fee2e2' : 'transparent'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                          {isSelected && <FaCheckCircle style={{ color: '#c60016', fontSize: '0.8rem', flexShrink: 0 }} />}
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reportName}</span>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                                          {(r.entityType || r.dataSource || 'REPORT').toUpperCase()}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Frequency, Time & Scope */}
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
            <h2 className="ap-card-head-title" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
              <FaClock className="ap-card-head-icon" />
              <span>Cadence & Date Scope</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {/* Frequency */}
              <div className="ap-form-group">
                <label className="ap-form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaCalendarAlt style={{ opacity: 0.7 }} />
                  Frequency *
                </label>
                <select
                  className="ap-select"
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  <option value="daily">Daily (Every Day)</option>
                  <option value="weekly_7_days">Every 7 Days (Weekly)</option>
                </select>
              </div>

              {/* Execution Time (IST) */}
              <div className="ap-form-group">
                <label className="ap-form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaClock style={{ opacity: 0.7 }} />
                  Execution Time (IST) *
                </label>
                <input
                  type="time"
                  className="ap-input"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  required
                />
              </div>

              {/* Date Scope */}
              <div className="ap-form-group">
                <label className="ap-form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                  Data Date Window *
                </label>
                <select
                  className="ap-select"
                  value={form.dateRangeType}
                  onChange={(e) => setForm({ ...form, dateRangeType: e.target.value })}
                >
                  <option value="today">Today Only (00:00 to 23:59)</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="this_month">Current Month to Date</option>
                  <option value="previous_month">Previous Full Month</option>
                  <option value="all_time">All Time (No date restrictions)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Delivery & Recipient Settings */}
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
            <h2 className="ap-card-head-title" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
              <FaEnvelope className="ap-card-head-icon" />
              <span>Recipient Configuration</span>
            </h2>

            {/* Recipient Mode Radio */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                <input
                  type="radio"
                  name="recipientType"
                  checked={form.recipientType === 'self'}
                  onChange={() => setForm({ ...form, recipientType: 'self' })}
                />
                <span>Self ({currentUser?.email || 'Connected Outlook User'})</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                <input
                  type="radio"
                  name="recipientType"
                  checked={form.recipientType === 'custom'}
                  onChange={() => setForm({ ...form, recipientType: 'custom' })}
                />
                <span>Custom Email Address</span>
              </label>
            </div>

            {form.recipientType === 'custom' && (
              <div className="ap-form-group" style={{ marginBottom: '16px' }}>
                <label className="ap-form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                  Target Recipient Email *
                </label>
                <input
                  type="email"
                  className="ap-input"
                  placeholder="recipient@example.com"
                  value={form.customEmail}
                  onChange={(e) => setForm({ ...form, customEmail: e.target.value })}
                  required
                />
              </div>
            )}

            {/* Additional CC Emails */}
            <div className="ap-form-group">
              <label className="ap-form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                Additional CC Emails (Optional, comma-separated)
              </label>
              <input
                type="text"
                className="ap-input"
                placeholder="manager@example.com, audit@example.com"
                value={form.additionalEmails}
                onChange={(e) => setForm({ ...form, additionalEmails: e.target.value })}
              />
            </div>
          </div>

          {/* Section 4: Activation Status Guard */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={{ marginTop: '3px' }}
                checked={form.isEnabled}
                onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
              />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827' }}>
                  Activate Schedule Immediately
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  When enabled, this report will automatically trigger and deliver on schedule. You can pause or resume anytime from the dashboard.
                </p>
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className="ap-header-item-btn"
              onClick={() => navigate('/admin/email-scheduler')}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ap-tab-add"
              disabled={submitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <FaPlus />
              <span>{submitting ? 'Creating Schedule...' : 'Save & Activate Schedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
