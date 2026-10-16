import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FaCalendarCheck,
  FaPlay,
  FaPause,
  FaHistory,
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
        {/* Top Bar of the Table Card (.ap-card-head) */}
        <div className="ap-card-head" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Left: Table Title & Icon */}
          <div className="ap-card-head-title">
            <FaEnvelope className="ap-card-head-icon" />
            <span>Report Schedules</span>
          </div>

          {/* Right: Search, Filter, Refresh, and Create Schedule Button */}
          <div className="ap-card-head-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '240px' }}>
              <FaSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="ap-input"
                style={{ paddingLeft: '32px', height: '2.35rem', width: '100%' }}
                placeholder="Search schedules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <select
              className="ap-select"
              style={{ height: '2.35rem', minWidth: '130px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              className="ap-header-item-btn"
              onClick={loadData}
              title="Refresh List"
              disabled={loading}
              style={{ minHeight: '2.35rem', padding: '0 0.75rem' }}
            >
              <FaSyncAlt className={loading ? 'fa-spin' : ''} />
            </button>

            {/* "+ Create Schedule" Button Placed on Table Top Bar */}
            <button
              type="button"
              className="ap-tab-add"
              onClick={() => navigate('/admin/email-scheduler/new')}
              style={{ minHeight: '2.35rem' }}
            >
              <FaPlus />
              <span>Create Schedule</span>
            </button>
          </div>
        </div>

        {/* Schedules Table */}
        <div className="table-container" style={{ margin: 0, boxShadow: 'none' }}>
          {loading && schedules.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading schedules...
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No scheduled reports found matching your criteria. Click <strong>Create Schedule</strong> above to set one up.
            </div>
          ) : (
            <table className="ap-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Schedule Name</th>
                  <th>Source Report</th>
                  <th>Frequency & Time</th>
                  <th>Next Run (IST)</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((schedule) => {
                  const isActionBusy = actionLoadingId === schedule._id
                  const isWeekly = schedule.schedule?.frequency === 'weekly_7_days'

                  return (
                    <tr key={schedule._id}>
                      {/* Name */}
                      <td>
                        <div style={{ fontWeight: 600 }}>{schedule.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Created by: {schedule.creatorName || schedule.creatorEmail || 'Admin'}
                        </div>
                      </td>

                      {/* Source Report */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 500 }}>
                            {schedule.reportConfig?.reportName || 'Report'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                          Context: {schedule.reportConfig?.dataSource || 'deal'} | Scope: {schedule.reportConfig?.dateRangeType || '7 days'}
                        </div>
                      </td>

                      {/* Frequency */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FaClock style={{ fontSize: '12px', opacity: 0.6 }} />
                          <span>{isWeekly ? 'Every 7 Days' : 'Daily'}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          At {schedule.schedule?.time || '18:00'} IST
                        </div>
                      </td>

                      {/* Next Run */}
                      <td>
                        {schedule.isEnabled ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{formatIST(schedule.schedule?.nextRunAt)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Last run: {formatIST(schedule.schedule?.lastRunAt)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Paused (Not scheduled)
                          </span>
                        )}
                      </td>

                      {/* Recipient */}
                      <td>
                        <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {schedule.recipient?.email || '-'}
                        </div>
                        {schedule.recipient?.additionalEmails?.length > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            +{schedule.recipient.additionalEmails.length} CC recipients
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {schedule.isEnabled ? (
                          <span className="ap-badge ap-badge--success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <FaCheckCircle style={{ fontSize: '10px' }} /> Active
                          </span>
                        ) : (
                          <span className="ap-badge ap-badge--neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <FaPause style={{ fontSize: '10px' }} /> Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {/* Activate / Deactivate Toggle Button */}
                          <button
                            type="button"
                            className={`ap-header-item-btn ${schedule.isEnabled ? '' : 'ap-btn--active'}`}
                            onClick={() => handleToggleActive(schedule)}
                            disabled={isActionBusy}
                            title={schedule.isEnabled ? 'Deactivate this schedule' : 'Activate this schedule'}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                            }}
                          >
                            {schedule.isEnabled ? (
                              <>
                                <FaPause style={{ fontSize: '10px' }} />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <FaPlay style={{ fontSize: '10px' }} />
                                <span>Activate</span>
                              </>
                            )}
                          </button>

                          {/* Run Now Button */}
                          <button
                            type="button"
                            className="ap-header-item-btn"
                            onClick={() => handleRunNow(schedule)}
                            disabled={isActionBusy}
                            title="Run Now (Generate & Send Report Immediately)"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                            }}
                          >
                            <FaPlay style={{ fontSize: '10px' }} />
                            <span>Run Now</span>
                          </button>

                          {/* Delivery History Modal */}
                          <button
                            type="button"
                            className="ap-header-item-btn"
                            onClick={() => setSelectedScheduleForHistory(schedule)}
                            title="View Delivery History"
                          >
                            <FaHistory />
                          </button>

                          {/* Delete Schedule */}
                          <button
                            type="button"
                            className="ap-header-item-btn"
                            onClick={() => handleDelete(schedule)}
                            disabled={isActionBusy}
                            title="Delete Schedule"
                          >
                            <FaTrashAlt />
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
