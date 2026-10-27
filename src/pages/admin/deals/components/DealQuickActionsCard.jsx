import React from 'react'
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

export default function DealQuickActionsCard({
  deal = {},
  reminders = [],
  onQuickAction,
  onRefresh,
  onActivateReminder,
  onCloseReminder,
}) {
  const assignedDate = deal.dealDate || deal.createdAt || ''
  const assignedOwner = deal.dealOwner || deal.addedBy || 'You'

  const banners = Array.isArray(reminders) && reminders.length > 0
    ? reminders.map((r) => ({
        id: r.id || r._id,
        date: r.reminderDate || r.dueDate || r.createdAt,
        owner: r.ownerName || r.assignedTo || assignedOwner,
        message: r.title || r.message || r.content || r.note || 'Follow up required',
        reminder: r,
      }))
    : [
        {
          id: 'default-assigned',
          date: assignedDate,
          owner: assignedOwner,
          message: 'Deal has been assigned to you.',
          reminder: null,
        },
      ]

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
        <div className="ad-quick-actions-btns">
          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('email')}
            title="Send Email"
          >
            <FaEnvelope style={{ fontSize: '0.78rem', color: '#c60016' }} />
            <span>Email</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('callLog')}
            title="Add Call Log"
          >
            <FaPhoneAlt style={{ fontSize: '0.75rem', color: '#2563eb' }} />
            <span>Call Log</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('whatsapp')}
            title="Send WhatsApp Message"
          >
            <FaWhatsapp style={{ fontSize: '0.82rem', color: '#16a34a' }} />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('add-note-remarks')}
            title="Add Note/Remark"
          >
            <FaCommentDots style={{ fontSize: '0.8rem', color: '#7c3aed' }} />
            <span>Add Remark</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('add-reminder')}
            title="Schedule Reminder"
          >
            <FaBell style={{ fontSize: '0.75rem', color: '#d97706' }} />
            <span>Reminder</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('change-status')}
            title="Change Status"
          >
            <FaRegSun style={{ fontSize: '0.75rem', color: '#c60016' }} />
            <span>Status</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('add-document')}
            title="Upload Quotation / Document"
          >
            <FaFileAlt style={{ fontSize: '0.75rem', color: '#0284c7' }} />
            <span>Document</span>
          </button>

          <button
            type="button"
            className="ad-action-pill-btn"
            onClick={() => onQuickAction('converted-deal')}
            title="Convert to PO"
          >
            <FaExchangeAlt style={{ fontSize: '0.75rem', color: '#059669' }} />
            <span>Convert to PO</span>
          </button>
        </div>

        {/* Reminders / Assignment Notification Banners */}
        <div className="ad-assignment-banners-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {banners.map((item) => (
            <div key={item.id} className="ad-assignment-banner">
              <div className="ad-assignment-info">
                <FaBell className="ad-assignment-bell" />
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
                  className="ad-assignment-btn"
                  onClick={() => {
                    if (item.reminder && typeof onActivateReminder === 'function') {
                      onActivateReminder(item.reminder)
                    } else {
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
                  onClick={() => {
                    if (item.reminder && typeof onCloseReminder === 'function') {
                      onCloseReminder(item.reminder)
                    } else if (typeof onRefresh === 'function') {
                      onRefresh()
                    }
                  }}
                  title={item.reminder ? 'Close Reminder' : 'Refresh Data'}
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
