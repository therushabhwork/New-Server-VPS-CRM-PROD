import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
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
import AccountsBoardPagination from '../../../components/admin/accounts/AccountsBoardPagination'
import '../AdminPanel.css'
import './EmailSchedulerPage.css'

const ITEMS_PER_PAGE = 10

const formatReportType = (type) => {
  if (!type) return 'Report'
  const mapping = {
    ACCOUNT: 'Account',
    SALES_PERFORMANCE: 'Sales Performance',
    CUSTOM_REPORT: 'Custom Report',
    account: 'Account',
    sales_performance: 'Sales Performance',
  }
  if (mapping[type]) return mapping[type]
  return String(type)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

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
  const [currentPage, setCurrentPage] = useState(1)

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

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

  const totalItems = filteredSchedules.length
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalItems)
  const paginatedSchedules = filteredSchedules.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

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



      {/* Main Table Card (.ap-card-box) */}
      <div className="ap-card-box">
        {/* Section Header & Count */}
        <div className="es-header-title">
          <FaEnvelope style={{ color: '#dc2626', fontSize: '1rem' }} />
          <span>Report Schedules</span>
          {schedules.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ({filteredSchedules.length} of {schedules.length})
            </span>
          )}
        </div>

        {/* Compact Controls Row (Search, Filter, Refresh, Create) */}
        <div className="es-controls-row">
          <div className="es-search-wrap">
            <FaSearch className="es-search-icon" />
            <input
              type="text"
              className="es-search-input"
              placeholder="Search schedules, reports, recipients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="es-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="button"
            className="es-btn-refresh"
            onClick={loadData}
            title="Refresh List"
            disabled={loading}
          >
            <FaSyncAlt className={loading ? 'fa-spin' : ''} style={{ fontSize: '0.75rem' }} />
          </button>

          <button
            type="button"
            className="es-btn-create"
            onClick={() => navigate('/admin/email-scheduler/new')}
          >
            <FaPlus style={{ fontSize: '0.7rem' }} />
            <span>Create Schedule</span>
          </button>
        </div>

        {/* Compact Report Cards List */}
        {loading && schedules.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading schedules...
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No scheduled reports found matching your criteria. Click <strong>Create Schedule</strong> above to set one up.
          </div>
        ) : (
          <>
            <div className="es-report-list">
              {paginatedSchedules.map((schedule, idx) => {
                const isActionBusy = actionLoadingId === schedule._id
                const isWeekly = schedule.schedule?.frequency === 'weekly_7_days'
                const rawType = schedule.reportConfig?.entityType || schedule.reportConfig?.dataSource || 'report'
                const formattedType = formatReportType(rawType)

                return (
                  <div key={schedule._id} className="es-report-card">
                    {/* Row 1 — Report Identity */}
                    <div className="es-row-identity">
                      <div className="es-identity-left">
                        <span className="es-report-num">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</span>
                        <span className="es-report-name">{schedule.name}</span>
                        <span className="es-sep-dot">•</span>
                        <span className="es-source-report">{schedule.reportConfig?.reportName || 'Report'}</span>
                        <span className="es-sep-dot">•</span>
                        <span className="es-report-type-plain">{formattedType}</span>
                      </div>
                      <div>
                        {schedule.isEnabled ? (
                          <span className="es-status-pill es-status-pill--active">
                            <FaCheckCircle style={{ fontSize: '9px' }} /> Active
                          </span>
                        ) : (
                          <span className="es-status-pill es-status-pill--paused">
                            <FaPause style={{ fontSize: '8px' }} /> Paused
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 2 — Schedule & Recipient Info */}
                    <div className="es-row-meta">
                      <span className="es-meta-item">
                        <FaClock className="es-meta-icon" />
                        <span>{isWeekly ? 'Weekly' : 'Daily'} @ {schedule.schedule?.time || '18:00'} IST</span>
                      </span>
                      <span className="es-sep-dot">•</span>
                      <span className="es-meta-item">
                        <span>Next: {schedule.isEnabled ? formatIST(schedule.schedule?.nextRunAt) : 'Paused'}</span>
                      </span>
                      <span className="es-sep-dot">•</span>
                      <span className="es-meta-item">
                        <FaEnvelope className="es-meta-icon" />
                        <span>{schedule.recipient?.email || '-'}</span>
                      </span>
                      {schedule.recipient?.additionalEmails?.length > 0 && (
                        <span className="es-cc-tag">
                          +{schedule.recipient.additionalEmails.length} CC
                        </span>
                      )}
                    </div>

                    {/* Row 3 — Creator & Action Buttons */}
                    <div className="es-row-actions">
                      <div className="es-creator-text">
                        Created by: {schedule.creatorName || schedule.creatorEmail || 'Admin'}
                      </div>
                      <div className="es-action-group">
                        <button
                          type="button"
                          className="es-btn-equal es-btn-pause-resume"
                          onClick={() => handleToggleActive(schedule)}
                          disabled={isActionBusy}
                          title={schedule.isEnabled ? 'Pause schedule' : 'Resume schedule'}
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
                          className="es-btn-equal es-btn-run-now"
                          onClick={() => handleRunNow(schedule)}
                          disabled={isActionBusy}
                          title="Run Now (Generate & Send Report Immediately)"
                        >
                          <FaPlay style={{ fontSize: '9px' }} />
                          <span>Run Now</span>
                        </button>

                        <button
                          type="button"
                          className="es-btn-icon-sq"
                          onClick={() => setSelectedScheduleForHistory(schedule)}
                          title="View Delivery History"
                        >
                          <FaHistory />
                        </button>

                        <button
                          type="button"
                          className="es-btn-icon-sq es-btn-icon-sq--delete"
                          onClick={() => handleDelete(schedule)}
                          disabled={isActionBusy}
                          title="Delete Schedule"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalItems > 0 && (
              <AccountsBoardPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageStart={pageStart}
                pageEnd={pageEnd}
                totalItems={totalItems}
                onPageChange={(page) => setCurrentPage(page)}
              />
            )}
          </>
        )}
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
