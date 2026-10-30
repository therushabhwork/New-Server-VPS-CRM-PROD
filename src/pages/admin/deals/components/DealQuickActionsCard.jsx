import React, { useEffect, useState, useMemo } from 'react'
import { getCachedAccountOwnerOptions, loadAccountOwnerOptions, getAccountOwnerOptionLabel } from '../../../../features/adminAccounts/utils/accountOwnerOptions'
import { getCrmOwnerDisplay } from '../../../../features/users/crmUserDirectory'
import {
  FaBolt,
  FaEnvelope,
  FaPhoneAlt,
  FaWhatsapp,
  FaCommentDots,
  FaBell,
  FaSyncAlt,
  FaCheck,
  FaPlus,
  FaRegSun,
  FaFileAlt,
  FaExchangeAlt,
} from 'react-icons/fa'

const formatAssignmentDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${day}-${month}-${year} ${time}`
}

const resolveOwnerName = (val) => {
  if (!val) return 'You'
  const str = String(val).trim()
  try {
    const cachedOptions = getCachedAccountOwnerOptions() || []
    const found = cachedOptions.find((u) =>
      String(u.id) === str ||
      String(u._id) === str ||
      String(u.value) === str ||
      String(u.ownerCode) === str ||
      String(u.username || '').toLowerCase() === str.toLowerCase() ||
      String(u.name || '').toLowerCase() === str.toLowerCase()
    )
    if (found) {
      return getAccountOwnerOptionLabel(found) || found.name || found.username
    }
  } catch (err) {}
  const display = getCrmOwnerDisplay(val)
  if (display && display !== val) return display
  return val
}

export default function DealQuickActionsCard({
  deal = {},
  reminders = [],
  onQuickAction,
  onRefresh,
  onActivateReminder,
  onCloseReminder,
}) {
  const [localReviewedIds, setLocalReviewedIds] = useState({})
  useEffect(() => {
    loadAccountOwnerOptions().catch(() => {})
  }, [])
  const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
  const iconColor = !isAdmin ? '#c60016' : '#ffffff'
  const assignedDate = deal.dealDate || deal.createdAt || ''
  const assignedOwner = resolveOwnerName(deal.dealOwner || deal.ownerName || deal.addedBy || 'You')

  const banners = useMemo(() => {
    if (!Array.isArray(reminders) || reminders.length === 0) {
      return [
        {
          id: 'default-assigned',
          date: assignedDate,
          owner: assignedOwner,
          message: 'Deal has been assigned to you.',
          reminder: null,
        },
      ]
    }
    const seen = new Set()
    const list = []
    for (const r of reminders) {
      const rid = String(r.id || r._id || r.legacyId || '')
      if (rid && seen.has(rid)) continue
      if (rid) seen.add(rid)
      list.push({
        id: rid || `rem-${list.length}`,
        date: r.reminderDate || r.dueDate || r.createdAt,
        owner: resolveOwnerName(r.ownerName || r.assignedTo || assignedOwner),
        message: r.title || r.message || r.content || r.note || 'Follow up required',
        reminder: r,
      })
    }
    return list.length > 0 ? list : [
      {
        id: 'default-assigned',
        date: assignedDate,
        owner: assignedOwner,
        message: 'Deal has been assigned to you.',
        reminder: null,
      },
    ]
  }, [reminders, assignedDate, assignedOwner])

  return (
    <div className="c-deal-card ad-card">
      <div className="c-deal-card-header ad-card-header">
        <h3 className="c-deal-card-title ad-card-title">
          <span className="c-deal-card-icon">
            <FaBolt />
          </span>
          <span>Quick Actions</span>
        </h3>
      </div>

      <div className="c-deal-card-content">
        {/* Border-Only Action Buttons */}
        <div className={`ad-quick-actions-btns ${!isAdmin ? 'deal-quick-actions--non-admin' : ''}`}>
          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('email')}
            title="Send Email"
          >
            <FaEnvelope style={{ fontSize: '0.78rem', color: iconColor }} />
            <span>Email</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('callLog')}
            title="Add Call Log"
          >
            <FaPhoneAlt style={{ fontSize: '0.75rem', color: iconColor }} />
            <span>Call Log</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            style={{ display: 'none' }} aria-hidden="true" tabIndex={-1}
            title="Send WhatsApp Message"
          >
            <FaWhatsapp style={{ fontSize: '0.82rem', color: iconColor }} />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('add-note-remarks')}
            title="Add Note/Remark"
          >
            <FaCommentDots style={{ fontSize: '0.8rem', color: iconColor }} />
            <span>Add Remark</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('add-reminder')}
            title="Schedule Reminder"
          >
            <FaBell style={{ fontSize: '0.75rem', color: iconColor }} />
            <span>Reminder</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('change-status')}
            title="Change Status"
          >
            <FaRegSun style={{ fontSize: '0.75rem', color: iconColor }} />
            <span>Status</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('add-document')}
            title="Upload Quotation / Document"
          >
            <FaFileAlt style={{ fontSize: '0.75rem', color: iconColor }} />
            <span>Document</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('converted-deal')}
            title="Convert to PO"
          >
            <FaExchangeAlt style={{ fontSize: '0.75rem', color: iconColor }} />
            <span>Convert to PO</span>
          </button>
        </div>

        {/* Reminders / Assignment Notification Banners */}
        <div className="ad-assignment-banners-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {banners.map((item) => (
            <div key={item.id} className="ad-assignment-banner">
              <div className="ad-assignment-info">
                <FaBell className={`ad-assignment-bell ${(Boolean(localReviewedIds[item.id] || deal.isReviewed || deal.data?.isReviewed || item.reminder?.isActivated || item.reminder?.status === 'activated')) ? 'ad-assignment-bell--reviewed' : ''}`} style={(Boolean(localReviewedIds[item.id] || deal.isReviewed || deal.data?.isReviewed || item.reminder?.isActivated || item.reminder?.status === 'activated')) ? { color: '#16a34a' } : {}} />
                <div className="ad-assignment-text">
                  <span className="ad-assignment-header">
                    {formatAssignmentDateTime(item.date)} | {item.owner}
                  </span>
                  <span className="ad-assignment-sub" title={item.message}>
                    {item.message}
                  </span>
                </div>
              </div>

              <div className="ad-assignment-actions">
                <button
                  type="button"
                  className={`ad-assignment-btn ${(localReviewedIds[item.id] || deal.isReviewed || deal.data?.isReviewed || item.reminder?.isActivated || item.reminder?.status === 'activated') ? 'ad-assignment-btn--reviewed' : ''}`}
                  style={(localReviewedIds[item.id] || deal.isReviewed || deal.data?.isReviewed || item.reminder?.isActivated || item.reminder?.status === 'activated') ? { background: '#16a34a', color: '#ffffff', borderColor: '#16a34a' } : {}}
                  onClick={() => {
                    setLocalReviewedIds((prev) => ({ ...prev, [item.id]: true }))
                    if (item.reminder && typeof onActivateReminder === 'function') {
                      onActivateReminder(item.reminder)
                    } else if (typeof onQuickAction === 'function') {
                      onQuickAction('acknowledge', item.reminder)
                    }
                  }}
                  title={item.reminder ? 'Activate Reminder' : 'Mark Reviewed / Acknowledge'}
                >
                  <FaCheck />
                </button>
                <button
                  type="button"
                  className="ad-assignment-btn"
                  onClick={() => onQuickAction('add-reminder', item.reminder)}
                  title="Create Task / Reschedule Reminder"
                >
                  <FaPlus />
                </button>
                <button
                  type="button"
                  className="ad-assignment-btn"
                  hidden={true}
                  aria-hidden="true"
                  style={{ display: 'none' }}
                >
                  <FaSyncAlt />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
