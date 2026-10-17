import React, { useState, useEffect } from 'react'
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaDownload, FaSyncAlt } from 'react-icons/fa'
import { scheduledReportApi } from '../../../services/scheduledReportApi'

export default function ScheduleDeliveryHistoryModal({ isOpen, onClose, schedule }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchHistory = () => {
    if (!schedule?._id) return
    setLoading(true)
    setError(null)
    scheduledReportApi.getDeliveryHistory(schedule._id)
      .then((data) => {
        setLogs(data || [])
      })
      .catch((err) => {
        setError(err.message || 'Failed to load delivery history')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    if (isOpen && schedule?._id) {
      fetchHistory()
    }
  }, [isOpen, schedule?._id])

  if (!isOpen) return null

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

  return (
    <div className="ap-modal-overlay">
      <div className="ap-modal" style={{ maxWidth: '800px', width: '100%' }}>
        <div className="ap-modal-header">
          <div>
            <h2 className="ap-card-title" style={{ margin: 0 }}>
              Delivery History: {schedule?.name}
            </h2>
            <p className="ap-card-subtitle" style={{ margin: '4px 0 0 0' }}>
              Execution records and email dispatch logs for this schedule
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="ap-header-item-btn"
              onClick={fetchHistory}
              title="Refresh Logs"
            >
              <FaSyncAlt />
            </button>
            <button
              type="button"
              className="ap-header-item-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="ap-modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
          {error && (
            <div className="ap-error-banner" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading delivery logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No deliveries recorded yet. Use <strong>Run Now</strong> to trigger an immediate delivery.
            </div>
          ) : (
            <div className="table-container" style={{ margin: 0, boxShadow: 'none' }}>
              <table className="ap-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Executed At</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Records</th>
                    <th>Recipient</th>
                    <th>Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div>{formatIST(log.executedAt)}</div>
                        {log.scheduledTime && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Target: {log.scheduledTime}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                          {log.executionType === 'manual_run_now' ? 'Manual (Run Now)' : 'Scheduled'}
                        </span>
                        {log.dateRangeType && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Scope: {log.dateRangeType}
                          </div>
                        )}
                      </td>
                      <td>
                        {log.status === 'sent' ? (
                          <span className="ap-badge ap-badge--success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <FaCheckCircle style={{ fontSize: '10px' }} /> Sent
                          </span>
                        ) : (
                          <span className="ap-badge ap-badge--danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={log.errorMessage || 'Failed'}>
                            <FaExclamationTriangle style={{ fontSize: '10px' }} /> Failed
                          </span>
                        )}
                      </td>
                      <td>{log.recordCount ?? 0}</td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.recipientEmail}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {log.attachmentName || '-'}
                        {log.attachmentSizeKB > 0 && ` (${log.attachmentSizeKB} KB)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ap-modal-footer">
          <button type="button" className="ap-btn ap-btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
