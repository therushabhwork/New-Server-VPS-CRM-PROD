import React, { useState } from 'react'
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
import { FiSend } from 'react-icons/fi'

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

export default function QuickActionsCard({
  account = {},
  form = {},
  onQuickAction,
  onSubmitRemark,
  isSubmittingRemark = false,
  onRefresh,
}) {
  const [remarkText, setRemarkText] = useState('')

  const handleRemarkSubmit = async (e) => {
    if (e) e.preventDefault()
    const trimmed = remarkText.trim()
    if (!trimmed || isSubmittingRemark) return
    if (typeof onSubmitRemark === 'function') {
      const success = await onSubmitRemark(trimmed)
      if (success) {
        setRemarkText('')
      }
    }
  }

  const assignedDate = account.assignedAt || account.updatedAt || account.createdAt || ''
  const assignedOwner = account.accountOwnerDisplay || form.accountOwner || account.accountOwner || 'You'

  return (
    <div className="ad-card">
      <div className="ad-card-header">
        <h3 className="ad-card-title">
          <FaBolt className="ad-card-title-icon" />
          <span>Quick Actions</span>
        </h3>
      </div>

      {/* Border-Only Action Buttons */}
      <div className="ad-quick-actions-btns">
        <button
          type="button"
          className="ad-action-pill-btn"
          onClick={() => onQuickAction('email')}
          title="Send Email"
        >
          <FaEnvelope style={{ fontSize: '0.78rem', color: '#2563eb' }} />
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
          <FaRegSun style={{ fontSize: '0.75rem', color: '#475569' }} />
          <span>Status</span>
        </button>

        <button
          type="button"
          className="ad-action-pill-btn"
          onClick={() => onQuickAction('add-document')}
          title="Add Document"
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

      {/* Inline Remark Box */}
      <form className="ad-inline-remark-box" onSubmit={handleRemarkSubmit}>
        <input
          type="text"
          className="ad-inline-remark-input"
          placeholder="Add remark here..."
          value={remarkText}
          onChange={(e) => setRemarkText(e.target.value)}
          disabled={isSubmittingRemark}
        />
        <button
          type="submit"
          className="ad-inline-remark-submit"
          disabled={!remarkText.trim() || isSubmittingRemark}
          title="Submit Remark"
        >
          <FiSend />
        </button>
      </form>

      {/* Assignment Notification Banner */}
      <div className="ad-assignment-banner">
        <div className="ad-assignment-info">
          <FaBell className="ad-assignment-bell" />
          <div className="ad-assignment-text">
            <span className="ad-assignment-header">
              {formatAssignmentDateTime(assignedDate)} | {assignedOwner}
            </span>
            <span className="ad-assignment-sub">
              Account has been assigned to you.
            </span>
          </div>
        </div>

        <div className="ad-assignment-actions">
          <button
            type="button"
            className="ad-assignment-btn"
            onClick={() => onQuickAction('acknowledge')}
            title="Mark Reviewed / Acknowledge"
          >
            <FaCheck />
          </button>
          <button
            type="button"
            className="ad-assignment-btn"
            onClick={() => onQuickAction('add-reminder')}
            title="Create Task / Reminder"
          >
            <FaPlus />
          </button>
          <button
            type="button"
            className="ad-assignment-btn"
            onClick={onRefresh}
            title="Refresh Account Data from MongoDB"
          >
            <FaSyncAlt />
          </button>
        </div>
      </div>
    </div>
  )
}
