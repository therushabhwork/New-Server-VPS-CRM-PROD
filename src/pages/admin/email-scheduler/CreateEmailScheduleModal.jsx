import React, { useState, useEffect } from 'react'
import { FaTimes, FaCalendarAlt, FaClock, FaEnvelope, FaFileAlt } from 'react-icons/fa'
import { scheduledReportApi } from '../../../services/scheduledReportApi'

export default function CreateEmailScheduleModal({ isOpen, onClose, onCreated, currentUser }) {
  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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
    if (!isOpen) return

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
  }, [isOpen])

  if (!isOpen) return null

  const handleReportChange = (reportId) => {
    const found = reports.find((r) => r.id === reportId)
    setForm((prev) => ({
      ...prev,
      selectedReportId: reportId,
      name: found ? `${found.reportName} Automated Delivery` : prev.name,
      dateRangeType: found?.dateRangeType || prev.dateRangeType,
    }))
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
        selectedFields: selectedReport.selectedFields || [],
        filters: selectedReport.filters || [],
        accountOwner: selectedReport.accountOwner || 'all',
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
      onCreated()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to create schedule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ap-modal-overlay">
      <div className="ap-modal" style={{ maxWidth: '640px', width: '100%' }}>
        <div className="ap-modal-header">
          <div>
            <h2 className="ap-card-title" style={{ margin: 0 }}>Create Email Report Schedule</h2>
            <p className="ap-card-subtitle" style={{ margin: '4px 0 0 0' }}>
              Automatically generate and deliver CRM reports via Outlook on a recurring schedule
            </p>
          </div>
          <button type="button" className="ap-header-item-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ap-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {error && (
              <div className="ap-error-banner" style={{ marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {/* Schedule Name */}
            <div className="ap-form-group" style={{ marginBottom: '16px' }}>
              <label className="ap-form-label">Schedule Name *</label>
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
            <div className="ap-form-group" style={{ marginBottom: '16px' }}>
              <label className="ap-form-label">Select Report *</label>
              {loadingReports ? (
                <div style={{ padding: '8px', color: 'var(--text-secondary)' }}>Loading reports...</div>
              ) : (
                <select
                  className="ap-select"
                  value={form.selectedReportId}
                  onChange={(e) => handleReportChange(e.target.value)}
                  required
                >
                  <optgroup label="System Reports">
                    {reports.filter((r) => r.sourceType === 'system_report').map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.reportName} ({r.dataSource})
                      </option>
                    ))}
                  </optgroup>
                  {reports.some((r) => r.sourceType === 'reporttemplate') && (
                    <optgroup label="Custom Templates (reporttemplates)">
                      {reports.filter((r) => r.sourceType === 'reporttemplate').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.reportName} ({r.dataSource})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {reports.some((r) => r.sourceType === 'saved_report') && (
                    <optgroup label="Saved Reports (reports collection)">
                      {reports.filter((r) => r.sourceType === 'saved_report').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.reportName} ({r.dataSource})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>

            {/* Frequency & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="ap-form-group">
                <label className="ap-form-label">
                  <FaCalendarAlt style={{ marginRight: '6px', opacity: 0.7 }} />
                  Frequency *
                </label>
                <select
                  className="ap-select"
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly_7_days">Every 7 Days (Weekly)</option>
                </select>
              </div>

              <div className="ap-form-group">
                <label className="ap-form-label">
                  <FaClock style={{ marginRight: '6px', opacity: 0.7 }} />
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
            </div>

            {/* Date Range Type */}
            <div className="ap-form-group" style={{ marginBottom: '16px' }}>
              <label className="ap-form-label">
                <FaFileAlt style={{ marginRight: '6px', opacity: 0.7 }} />
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

            {/* Recipient Details */}
            <div className="ap-form-group" style={{ marginBottom: '16px' }}>
              <label className="ap-form-label">
                <FaEnvelope style={{ marginRight: '6px', opacity: 0.7 }} />
                Recipient Email *
              </label>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="recipientType"
                    checked={form.recipientType === 'self'}
                    onChange={() => setForm({ ...form, recipientType: 'self' })}
                  />
                  <span>Self ({currentUser?.email || 'Connected Outlook User'})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="recipientType"
                    checked={form.recipientType === 'custom'}
                    onChange={() => setForm({ ...form, recipientType: 'custom' })}
                  />
                  <span>Custom Email</span>
                </label>
              </div>

              {form.recipientType === 'custom' && (
                <input
                  type="email"
                  className="ap-input"
                  placeholder="recipient@example.com"
                  value={form.customEmail}
                  onChange={(e) => setForm({ ...form, customEmail: e.target.value })}
                  required
                />
              )}
            </div>

            {/* Additional CC Emails */}
            <div className="ap-form-group" style={{ marginBottom: '16px' }}>
              <label className="ap-form-label">Additional CC Emails (Comma Separated)</label>
              <input
                type="text"
                className="ap-input"
                placeholder="manager@example.com, audit@example.com"
                value={form.additionalEmails}
                onChange={(e) => setForm({ ...form, additionalEmails: e.target.value })}
              />
            </div>

            {/* Initial Status Toggle */}
            <div className="ap-form-group" style={{ marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                />
                <span style={{ fontWeight: 600 }}>Activate immediately upon creation</span>
              </label>
              <p style={{ margin: '4px 0 0 24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                When active, automatic emails are scheduled. You can pause or activate anytime from the list.
              </p>
            </div>
          </div>

          <div className="ap-modal-footer">
            <button
              type="button"
              className="ap-btn ap-btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ap-btn ap-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Save & Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
