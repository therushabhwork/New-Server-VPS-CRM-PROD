import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FaBuilding,
  FaCalendarAlt,
  FaCheck,
  FaClock,
  FaExternalLinkAlt,
  FaHandshake,
  FaInfoCircle,
  FaRedo,
  FaShieldAlt,
  FaTimes,
  FaUser,
  FaUserCheck,
} from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import './ActiveReminderActionModal.css'

const getDateKey = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDueBucket = (value) => {
  const valueKey = getDateKey(value)
  if (!valueKey) return 'Scheduled'
  const todayKey = getDateKey(new Date())
  if (valueKey === todayKey) return 'Today'
  if (valueKey < todayKey) return 'Pending'
  return 'Scheduled'
}

const ActiveReminderActionModal = ({
  isOpen,
  onClose,
  reminder,
  currentUser,
  isAdmin = false,
  allReminders = [],
  onActivateInPlace,
  onCloseInPlace,
  onRescheduleInPlace,
}) => {
  const navigate = useNavigate()
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [showRescheduleInput, setShowRescheduleInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const ownerName = reminder?.ownerName || reminder?.assignedUserName || reminder?.userName || 'Unassigned'
  const currentUserName = currentUser?.name || currentUser?.username || ''
  const currentUserId = currentUser?.id || currentUser?._id || ''

  const isDirectOwner = Boolean(
    (reminder?.userId && String(reminder.userId) === String(currentUserId))
    || (ownerName && currentUserName && ownerName.trim().toLowerCase() === currentUserName.trim().toLowerCase())
  )
  const canActivate = isDirectOwner || isAdmin

  const sourceLabel = String(reminder?.sourceLabel || reminder?.sourceType || 'REMINDER').toUpperCase()
  const sourceNumber = reminder?.sourceNumber || reminder?.sourceId || ''
  const dueBucket = getDueBucket(reminder?.reminderDate)

  // Calculate owner's active workload (must be called unconditionally before early return)
  const ownerStats = useMemo(() => {
    if (!ownerName || ownerName === 'Unassigned') {
      return { today: 0, pending: 0, scheduled: 0, total: 0 }
    }
    const normalizedTarget = ownerName.trim().toLowerCase()
    const targetReminders = (allReminders || []).filter((r) => {
      const rOwner = (r.ownerName || r.assignedUserName || r.userName || '').trim().toLowerCase()
      return rOwner === normalizedTarget && ['active', 'activated'].includes(String(r.status || '').toLowerCase())
    })

    const todayKey = getDateKey(new Date())
    let today = 0
    let pending = 0
    let scheduled = 0

    targetReminders.forEach((r) => {
      const rKey = getDateKey(r.reminderDate)
      if (rKey === todayKey) today += 1
      else if (rKey && rKey < todayKey) pending += 1
      else scheduled += 1
    })

    return { today, pending, scheduled, total: targetReminders.length }
  }, [allReminders, ownerName])

  if (!isOpen || !reminder) return null

  const isAlreadyActivated = String(reminder?.status || '').toLowerCase() === 'activated'
  const isAlreadyOnActivePage = typeof window !== 'undefined' && window.location.pathname.includes('/reminders/active')
  const baseActiveUrl = isAdmin ? '/admin/reminders/active' : '/reminders/active'

  const buildTargetUrl = (owner, reminderId) => {
    const params = new URLSearchParams()
    if (owner && owner !== 'Unassigned') params.set('owner', owner)
    if (reminderId) params.set('reminderId', reminderId)
    return `${baseActiveUrl}${params.toString() ? `?${params.toString()}` : ''}`
  }

  const handleOpenInNewTab = (event) => {
    event?.stopPropagation()
    const targetUrl = buildTargetUrl(ownerName, reminder?.id || reminder?.sourceId)
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDirectJump = (event) => {
    event?.stopPropagation()
    onClose()
    const targetUrl = buildTargetUrl(ownerName, reminder?.id || reminder?.sourceId)
    navigate(targetUrl, {
      state: {
        selectedOwner: ownerName !== 'Unassigned' ? ownerName : undefined,
        reminderId: reminder.id || reminder.sourceId,
      },
    })
  }

  const handleConfirmActivate = async () => {
    if (!canActivate || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (onActivateInPlace) {
        await onActivateInPlace(reminder)
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmClose = async () => {
    if (!canActivate || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (onCloseInPlace) {
        await onCloseInPlace(reminder)
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmReschedule = async () => {
    if (!rescheduleDate || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (onRescheduleInPlace) {
        await onRescheduleInPlace(reminder, rescheduleDate)
      }
      setShowRescheduleInput(false)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const ownerInitials = ownerName
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

  const modalContent = (
    <div className="aram-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="aram-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="aram-header">
          <div className="aram-header-left">
            <span className={`aram-source-pill aram-source-pill--${sourceLabel.toLowerCase()}`}>
              {sourceLabel} {sourceNumber ? `#${sourceNumber}` : ''}
            </span>
            <h2 className="aram-title" title={reminder.name || reminder.title || 'Reminder Inspection'}>
              {reminder.name || reminder.title || 'Reminder Inspection'}
            </h2>
          </div>
          <button type="button" className="aram-close-btn" onClick={onClose} aria-label="Close modal">
            <FaTimes />
          </button>
        </div>

        {/* Modal Body */}
        <div className="aram-body">
          {/* Compact Owner & Access Row */}
          <div className="aram-owner-compact-strip">
            <div className="aram-owner-left">
              <div className="aram-owner-avatar-sm">{ownerInitials}</div>
              <div className="aram-owner-text">
                <span className="aram-owner-role-lbl">Assigned Owner</span>
                <span className="aram-owner-name-val">{ownerName}</span>
              </div>
            </div>
            <div className="aram-owner-badge-right">
              {isDirectOwner ? (
                <span className="aram-perm-chip aram-perm-chip--owner" title="You are the assigned owner">
                  <FaUserCheck size={11} /> You Can Activate
                </span>
              ) : isAdmin ? (
                <span className="aram-perm-chip aram-perm-chip--admin" title="Admin access: you can activate on behalf of owner">
                  <FaShieldAlt size={11} /> Administrator
                </span>
              ) : (
                <span className="aram-perm-chip aram-perm-chip--readonly" title="Assigned to another member">
                  <FaInfoCircle size={11} /> View Only
                </span>
              )}
            </div>
          </div>

          {/* Core Info 2-Column Grid */}
          <div className="aram-details-card">
            <div className="aram-grid-2">
              <div className="aram-field">
                <span className="aram-field-label">Scheduled Date & Time</span>
                <div className="aram-field-value aram-date-row">
                  <FaCalendarAlt className="aram-field-icon" />
                  <strong>{reminder.reminderDateDisplay || reminder.reminderDate || 'Today'}</strong>
                  {reminder.reminderTime && reminder.reminderTime !== '-' && (
                    <span className="aram-time-tag">
                      <FaClock size={10} /> {reminder.reminderTime}
                    </span>
                  )}
                  <span className={`aram-due-pill aram-due-pill--${dueBucket.toLowerCase()}`}>
                    {dueBucket}
                  </span>
                </div>
              </div>

              <div className="aram-field">
                <span className="aram-field-label">Current Status</span>
                <div className="aram-field-value">
                  <span className={`aram-status-chip aram-status-chip--${String(reminder.status || 'active').toLowerCase()}`}>
                    {String(reminder.status || 'active').toUpperCase()}
                  </span>
                  {reminder.reminderMode && reminder.reminderMode !== '-' && (
                    <span className="aram-mode-tag">Mode: {reminder.reminderMode}</span>
                  )}
                </div>
              </div>

              {reminder.customerName && reminder.customerName !== '-' && (
                <div className="aram-field aram-field--full">
                  <span className="aram-field-label">Customer / Company</span>
                  <div className="aram-field-value">
                    <FaBuilding className="aram-field-icon" />
                    <span>{reminder.customerName}</span>
                  </div>
                </div>
              )}

              <div className="aram-field aram-field--full">
                <span className="aram-field-label">Reminder Note / Message</span>
                <div className="aram-note-box">
                  {reminder.note && reminder.note !== '-' ? reminder.note : reminder.message || 'No additional note provided.'}
                </div>
              </div>
            </div>
          </div>

          {/* Inline Reschedule Drawer */}
          {showRescheduleInput && (
            <div className="aram-reschedule-box">
              <label htmlFor="aram-reschedule-date" className="aram-reschedule-label">
                Select New Reminder Date:
              </label>
              <div className="aram-reschedule-controls">
                <input
                  id="aram-reschedule-date"
                  type="date"
                  className="aram-date-input"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={getDateKey(new Date())}
                />
                <button
                  type="button"
                  className="aram-btn aram-btn--green"
                  onClick={handleConfirmReschedule}
                  disabled={!rescheduleDate || isSubmitting}
                >
                  Save Date
                </button>
                <button
                  type="button"
                  className="aram-btn aram-btn--outline"
                  onClick={() => setShowRescheduleInput(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="aram-footer">
          <button
            type="button"
            className="aram-btn aram-btn--outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <div className="aram-footer-right">
            {canActivate && (
              <>
                <button
                  type="button"
                  className="aram-btn aram-btn--amber"
                  onClick={() => setShowRescheduleInput((prev) => !prev)}
                  disabled={isSubmitting}
                  title="Reschedule reminder date"
                >
                  <FaRedo size={11} /> Reschedule
                </button>

                <button
                  type="button"
                  className="aram-btn aram-btn--outline-gray"
                  onClick={handleConfirmClose}
                  disabled={isSubmitting}
                  title="Mark reminder as closed"
                >
                  <FaCheck size={11} /> Close Reminder
                </button>

                {!isAlreadyActivated ? (
                  <button
                    type="button"
                    className="aram-btn aram-btn--green"
                    onClick={handleConfirmActivate}
                    disabled={isSubmitting}
                    title="Activate reminder in-place"
                  >
                    <FaCheck size={11} /> {isSubmitting ? 'Activating...' : 'Activate Now'}
                  </button>
                ) : (
                  <span className="aram-already-activated-chip" title="This reminder is already active">
                    <FaCheck size={11} /> Already Activated
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}

export default ActiveReminderActionModal
