import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FaCalendarCheck,
  FaPlay,
  FaPause,
  FaHistory,
  FaTrash,
  FaTrashAlt,
  FaPlus,
  FaSyncAlt,
  FaEnvelope,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaSearch,
} from 'react-icons/fa'
import { scheduledReportApi } from '../../../services/scheduledReportApi'
import ScheduleDeliveryHistoryModal from './ScheduleDeliveryHistoryModal'
import '../AdminPanel.css'

export default function EmailSchedulerPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [schedules, setSchedules] = useState([])
  const [kpis, setKpis] = useState({
    totalSchedules: 0,
    activeSchedules: 0,
    inactiveSchedules: 0,
    totalSuccessfulRuns: 0,
    totalFailedRuns: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successBanner, setSuccessBanner] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // History modal state
  const [selectedScheduleForHistory, setSelectedScheduleForHistory] = useState(null)
  const [actionLoadingId, setActionLoadingId] = useState(null)

  const showSuccess = useCallback((msg) => {
    setSuccessBanner(msg)
    setTimeout(() => setSuccessBanner(null), 5000)
  }, [])

  // Check for success banner passed via navigation state (e.g. from create page)
  useEffect(() => {
    if (location.state?.successMessage) {
      showSuccess(location.state.successMessage)
      // Clear navigation state so it doesn't persist on page refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state, showSuccess])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await scheduledReportApi.getSchedules()
      setSchedules(result.schedules || [])
      if (result.kpis) {
        setKpis(result.kpis)
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load email schedules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleActive = async (schedule) => {
    setActionLoadingId(schedule._id)
    try {
      if (schedule.isEnabled) {
        await scheduledReportApi.deactivateSchedule(schedule._id)
        showSuccess(`Schedule "${schedule.name}" has been deactivated. Automatic emails suspended.`)
      } else {
        await scheduledReportApi.activateSchedule(schedule._id)
        showSuccess(`Schedule "${schedule.name}" is now active and will deliver on schedule.`)
      }
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to update schedule status')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRunNow = async (schedule) => {
    if (!window.confirm(`Run "${schedule.name}" right now and send the report via Outlook?`)) {
      return
    }

    setActionLoadingId(schedule._id)
    try {
      const res = await scheduledReportApi.runNow(schedule._id)
      showSuccess(res.message || 'Report generated and dispatched successfully!')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to execute report now')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (schedule) => {
    if (!window.confirm(`Are you sure you want to delete the schedule "${schedule.name}"? This action cannot be undone.`)) {
      return
    }

    setActionLoadingId(schedule._id)
    try {
      await scheduledReportApi.deleteSchedule(schedule._id)
      showSuccess(`Schedule "${schedule.name}" deleted.`)
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to delete schedule')
    } finally {
      setActionLoadingId(null)
    }
  }

  const formatIST = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredSchedules = schedules.filter((s) => {
    const matchesSearch = !searchTerm.trim() ||
      (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.reportConfig?.reportName && s.reportConfig.reportName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.recipient?.email && s.recipient.email.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && s.isEnabled) ||
      (statusFilter === 'inactive' && !s.isEnabled)

    return matchesSearch && matchesStatus
  })

  return (
    <div className="ap-home-layout" style={{ width: '100%' }}>
      {/* Page Header (Exact /admin/monitoring Corporate Block) */}
      <div className="ap-welcome-header-block">
        <span className="ap-welcome-subhead">System & Operations</span>
        <h1 className="ap-welcome-heading">Email Report Scheduler</h1>
        <p className="ap-welcome-sub">
          Schedule and automate recurring CRM reports sent directly via Outlook (Daily or Weekly)
        </p>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="ap-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaCheckCircle />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="ap-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaExclamationCircle />
          <span>{error}</span>
        </div>
      )}

      {/* LEVEL 1: ORGANIZATION KPI OVERVIEW - EXACT MATCH TO /admin/monitoring KPI CARDS */}
      <div className="ap-kpi-grid">
        {/* KPI 1: Total Schedules */}
        <div className="ap-kpi-card">
          <div className="ap-kpi-icon-wrap ap-kpi-icon--blue">
            <FaCalendarCheck />
          </div>
          <div className="ap-kpi-main">
            <div className="ap-kpi-val-row">
              <span className="ap-kpi-value">{kpis.totalSchedules ?? schedules.length}</span>
            </div>
            <div className="ap-kpi-title">Total Schedules</div>
          </div>
          <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0,25 Q30,10 60,20 T100,5 L100,30 L0,30 Z" fill="rgba(2, 132, 199, 0.08)" />
          </svg>
        </div>

        {/* KPI 2: Active Schedules */}
        <div className="ap-kpi-card">
          <div className="ap-kpi-icon-wrap ap-kpi-icon--green">
            <FaPlay />
          </div>
          <div className="ap-kpi-main">
            <div className="ap-kpi-val-row">
              <span className="ap-kpi-value">{kpis.activeSchedules ?? schedules.filter((s) => s.isEnabled).length}</span>
            </div>
            <div className="ap-kpi-title">Active Schedulers</div>
          </div>
          <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0,22 Q30,28 60,15 T100,10 L100,30 L0,30 Z" fill="rgba(22, 163, 74, 0.08)" />
          </svg>
        </div>

        {/* KPI 3: Inactive Schedules */}
        <div className="ap-kpi-card">
          <div className="ap-kpi-icon-wrap ap-kpi-icon--orange">
            <FaPause />
          </div>
          <div className="ap-kpi-main">
            <div className="ap-kpi-val-row">
              <span className="ap-kpi-value">{kpis.inactiveSchedules ?? schedules.filter((s) => !s.isEnabled).length}</span>
            </div>
            <div className="ap-kpi-title">Paused / Inactive</div>
          </div>
          <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0,25 Q30,12 60,22 T100,8 L100,30 L0,30 Z" fill="rgba(234, 88, 12, 0.08)" />
          </svg>
        </div>

        {/* KPI 4: Successful Deliveries */}
        <div className="ap-kpi-card">
          <div className="ap-kpi-icon-wrap ap-kpi-icon--red">
            <FaCheckCircle />
          </div>
          <div className="ap-kpi-main">
            <div className="ap-kpi-val-row">
              <span className="ap-kpi-value">{kpis.totalSuccessfulRuns ?? 0}</span>
            </div>
            <div className="ap-kpi-title">Emails Delivered</div>
          </div>
          <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0,25 Q30,10 60,20 T100,5 L100,30 L0,30 Z" fill="rgba(220, 38, 38, 0.08)" />
          </svg>
        </div>
      </div>

      {/* Main Table Card (.ap-card-box) */}
      <div className="ap-card-box">
        {/* Top Bar of the Table Card - Two-Tier Layout */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            marginBottom: '1rem',
            gap: '8px',
          }}
        >
          {/* Line 1: Section Title on Top Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaEnvelope style={{ color: '#dc2626', fontSize: '1rem' }} />
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Report Schedules
            </span>
          </div>

          {/* Line 2: Controls Right-Aligned Directly Below Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '6px',
              width: '100%',
              flexWrap: 'wrap',
            }}
          >
            {/* Compact Search Input */}
            <div style={{ position: 'relative', width: '145px' }}>
              <FaSearch
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.7rem',
                }}
              />
              <input
                type="text"
                className="ap-input"
                style={{
                  paddingLeft: '26px',
                  paddingRight: '6px',
                  height: '2rem',
                  width: '100%',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                }}
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Compact Status Filter Select */}
            <select
              className="ap-select"
              style={{
                height: '2rem',
                width: '95px',
                minWidth: '95px',
                fontSize: '0.72rem',
                padding: '0 6px',
                borderRadius: '6px',
              }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all" style={{ fontSize: '0.72rem' }}>All Statuses</option>
              <option value="active" style={{ fontSize: '0.72rem' }}>Active</option>
              <option value="inactive" style={{ fontSize: '0.72rem' }}>Inactive</option>
            </select>

            {/* Compact Refresh Icon Button */}
            <button
              type="button"
              className="ap-header-item-btn"
              onClick={loadData}
              title="Refresh List"
              disabled={loading}
              style={{
                width: '2rem',
                height: '2rem',
                minHeight: '2rem',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
              }}
            >
              <FaSyncAlt className={loading ? 'fa-spin' : ''} style={{ fontSize: '0.75rem' }} />
            </button>

            {/* Compact Create Schedule Button */}
            <button
              type="button"
              className="ap-tab-add"
              onClick={() => navigate('/admin/email-scheduler/new')}
              style={{
                height: '2rem',
                minHeight: '2rem',
                padding: '0 0.75rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <FaPlus style={{ fontSize: '0.7rem' }} />
              <span>Create Schedule</span>
            </button>
          </div>
        </div>

        {/* Schedules Table */}
        <div className="admin-accounts-board-table-wrap" style={{ margin: 0 }}>
          {loading && schedules.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading schedules...
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No scheduled reports found matching your criteria. Click <strong>Create Schedule</strong> above to set one up.
            </div>
          ) : (
            <table className="admin-accounts-board-table">
              <thead>
                <tr>
                  <th style={{ width: '44px', minWidth: '44px', textAlign: 'center' }}>No.</th>
                  <th style={{ minWidth: '170px', textAlign: 'center' }}>Schedule Name</th>
                  <th style={{ minWidth: '150px', textAlign: 'center' }}>Source Report</th>
                  <th style={{ minWidth: '120px', textAlign: 'center' }}>Cadence</th>
                  <th style={{ minWidth: '130px', textAlign: 'center' }}>Next Run (IST)</th>
                  <th style={{ minWidth: '160px', textAlign: 'center' }}>Recipient</th>
                  <th style={{ minWidth: '85px', textAlign: 'center' }}>Status</th>
                  <th style={{ minWidth: '170px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((schedule, idx) => {
                  const isActionBusy = actionLoadingId === schedule._id
                  const isWeekly = schedule.schedule?.frequency === 'weekly_7_days'
                  const entity = schedule.reportConfig?.entityType || schedule.reportConfig?.dataSource || 'report'

                  return (
                    <tr key={schedule._id} className="admin-accounts-board-row">
                      {/* No. */}
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {idx + 1}
                      </td>

                      {/* Name */}
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{schedule.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          By: {schedule.creatorName || schedule.creatorEmail || 'Admin'}
                        </div>
                      </td>

                      {/* Source Report */}
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {schedule.reportConfig?.reportName || 'Report'}
                          </span>
                          <span
                            className="ap-badge"
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              textTransform: 'uppercase',
                              background: 'rgba(47, 159, 211, 0.1)',
                              color: '#1c6f9c',
                              border: '1px solid rgba(47, 159, 211, 0.25)',
                              borderRadius: '4px',
                            }}
                          >
                            {entity}
                          </span>
                        </div>
                      </td>

                      {/* Cadence */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
                          <FaClock style={{ fontSize: '11px', opacity: 0.6 }} />
                          <span>{isWeekly ? 'Weekly' : 'Daily'} @ {schedule.schedule?.time || '18:00'} IST</span>
                        </div>
                      </td>

                      {/* Next Run */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {schedule.isEnabled ? (
                          <span style={{ fontWeight: 500 }}>{formatIST(schedule.schedule?.nextRunAt)}</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Paused
                          </span>
                        )}
                      </td>

                      {/* Recipient */}
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={schedule.recipient?.email}>
                          {schedule.recipient?.email || '-'}
                        </div>
                        {schedule.recipient?.additionalEmails?.length > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            +{schedule.recipient.additionalEmails.length} CC
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {schedule.isEnabled ? (
                          <span className="ap-badge ap-badge--success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px' }}>
                            <FaCheckCircle style={{ fontSize: '10px' }} /> Active
                          </span>
                        ) : (
                          <span className="ap-badge ap-badge--neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px' }}>
                            <FaPause style={{ fontSize: '10px' }} /> Paused
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className={`ap-header-item-btn ${schedule.isEnabled ? '' : 'ap-btn--active'}`}
                            onClick={() => handleToggleActive(schedule)}
                            disabled={isActionBusy}
                            title={schedule.isEnabled ? 'Deactivate this schedule' : 'Activate this schedule'}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              minHeight: 'auto',
                            }}
                          >
                            {schedule.isEnabled ? (
                              <>
                                <FaPause style={{ fontSize: '9px' }} />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <FaPlay style={{ fontSize: '9px' }} />
                                <span>Resume</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className="ap-header-item-btn"
                            onClick={() => handleRunNow(schedule)}
                            disabled={isActionBusy}
                            title="Run Now (Generate & Send Report Immediately)"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              minHeight: 'auto',
                            }}
                          >
                            <FaPlay style={{ fontSize: '9px' }} />
                            <span>Run Now</span>
                          </button>

                          <button
                            type="button"
                            className="ap-header-item-btn"
                            onClick={() => setSelectedScheduleForHistory(schedule)}
                            title="View Delivery History"
                            style={{ padding: '4px 7px', borderRadius: '6px', fontSize: '11px', minHeight: 'auto' }}
                          >
                            <FaHistory />
                          </button>

                          <button
                            type="button"
                            className="ap-header-item-btn"
                            onClick={() => handleDelete(schedule)}
                            disabled={isActionBusy}
                            title="Delete Schedule"
                            style={{
                              padding: '4px 7px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              minHeight: 'auto',
                              color: '#dc2626',
                              borderColor: 'rgba(220, 38, 38, 0.25)',
                              background: 'rgba(220, 38, 38, 0.05)',
                            }}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delivery History Modal */}
      <ScheduleDeliveryHistoryModal
        isOpen={Boolean(selectedScheduleForHistory)}
        onClose={() => setSelectedScheduleForHistory(null)}
        schedule={selectedScheduleForHistory}
      />
    </div>
  )
}
