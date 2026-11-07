import React, { useMemo, useState } from 'react'
import { FaSave, FaTimes } from 'react-icons/fa'
import Button from '../../../components/common/Button'
import { useAuth } from '../../../context/AuthContext'
import { useData } from '../../../context/DataContext'
import { remarkApi } from '../../../services/remarkApi'
import { accountReminderApi } from '../services/accountReminderApi'
import { getAccountOwnerOptionLabel, filterAccountOwnerOptionsByVertical } from '../utils/accountOwnerOptions'
import './AccountReassignReminderForm.css'

const REASSIGN_TIME_OPTIONS = [
  { value: '09:00', label: '09:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '01:00 PM' },
  { value: '14:00', label: '02:00 PM' },
  { value: '15:00', label: '03:00 PM' },
  { value: '16:00', label: '04:00 PM' },
  { value: '17:00', label: '05:00 PM' },
]

const getTodayKey = () => new Date().toISOString().slice(0, 10)
const getCurrentTimeKey = () => {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const addDays = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const formatReassignDateLabel = (value) => {
  if (!value) return ''
  const parsedDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).toUpperCase()
}

const AccountReassignReminderForm = ({
  account = {},
  ownerOptions = [],
  onClose,
  onSaved,
}) => {
  const { user } = useAuth()
  const { updateAccount, addNotification } = useData()

  const [newOwnerId, setNewOwnerId] = useState('')
  const [description, setDescription] = useState('')
  const [addReminder, setAddReminder] = useState(true)
  const [reminderTiming, setReminderTiming] = useState('Different Time')
  const [reminderDatePreset, setReminderDatePreset] = useState(getTodayKey())
  const [customDate, setCustomDate] = useState('')
  const [reminderTimeSlot, setReminderTimeSlot] = useState('09:00')
  const [customTime, setCustomTime] = useState('')
  const [message, setMessage] = useState('Account has been assigned to you')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  const availableOwners = useMemo(() => {
    return filterAccountOwnerOptionsByVertical(ownerOptions, account.accountCategory)
  }, [ownerOptions, account.accountCategory])

  const reassignDateOptions = useMemo(() => (
    Array.from({ length: 5 }, (_, index) => {
      const value = addDays(index)
      return { value, label: formatReassignDateLabel(value) }
    })
  ), [])

  const resolveOwnerDisplayName = (rawOwner, ownerId) => {
    if (!rawOwner && !ownerId) return 'User'
    const match = availableOwners.find((u) => (
      (ownerId && String(u.id) === String(ownerId)) ||
      (rawOwner && String(u.name || '').trim().toLowerCase() === String(rawOwner).trim().toLowerCase())
    ))
    return match?.ownerDisplayName || match?.name || rawOwner || 'User'
  }

  const getReminderDate = () => {
    if (reminderTiming === 'Now') return getTodayKey()
    if (reminderDatePreset === 'Other') return customDate
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(reminderDatePreset))) return reminderDatePreset
    return getTodayKey()
  }

  const getReminderTime = () => {
    if (reminderTiming === 'Now') return getCurrentTimeKey()
    if (reminderTimeSlot === 'Other') return customTime || '09:00'
    return reminderTimeSlot || '09:00'
  }

  const handleSubmit = async (event) => {
    if (event) event.preventDefault()
    const nextErrors = {}

    if (!newOwnerId) {
      nextErrors.newOwnerId = 'New Account Owner is required.'
    }

    const needsDifferentTime = addReminder && reminderTiming === 'Different Time'
    if (needsDifferentTime && reminderDatePreset === 'Other' && !customDate) {
      nextErrors.customDate = 'Custom reminder date is required.'
    }
    if (needsDifferentTime && reminderTimeSlot === 'Other' && !customTime) {
      nextErrors.customTime = 'Custom reminder time is required.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)

    try {
      const selectedOwner = availableOwners.find((entry) => String(entry.id) === String(newOwnerId) || entry.name === newOwnerId)
      const oldOwnerName = resolveOwnerDisplayName(
        account.ownerDisplayName || account.ownerName || account.accountOwner || account.assignedUserName,
        account.ownerId || account.assignedUserId || account.raw?.ownerId || account.raw?.assignedUserId
      )
      const newOwnerName = resolveOwnerDisplayName(selectedOwner?.ownerDisplayName || selectedOwner?.name || newOwnerId, selectedOwner?.id)
      const reassignMessage = `Re-assign Account from ${oldOwnerName} to ${newOwnerName}.`
      const reassignTimestamp = new Date().toISOString()

      const newOwnershipEntry = {
        id: `reassign-${Date.now()}`,
        title: 'Account Reassigned',
        content: reassignMessage,
        fromOwner: oldOwnerName,
        toOwner: newOwnerName,
        changedAt: reassignTimestamp,
        changedBy: user?.name || user?.username || 'System',
        author: user?.name || user?.username || 'System',
        createdAt: reassignTimestamp,
      }

      const updates = {
        accountOwner: newOwnerName,
        ownerName: newOwnerName,
        accountOwnerName: newOwnerName,
        owner: selectedOwner?.name || newOwnerName,
        assignedTo: selectedOwner?.id || null,
        ownerUserId: selectedOwner?.id || null,
        assignedUserId: selectedOwner?.id || account.raw?.assignedUserId || null,
        ownerId: selectedOwner?.id || null,
        ownerCode: selectedOwner?.ownerCode || '',
        accountOwnerCode: selectedOwner?.ownerCode || '',
        company: selectedOwner?.company || selectedOwner?.companyName || account.accountCategory || '',
        accountDate: reassignTimestamp,
        lastReassignedAt: reassignTimestamp,
        updatedAt: reassignTimestamp,
        latestRemark: reassignMessage,
        ownershipHistory: [
          ...(Array.isArray(account.ownershipHistory) ? account.ownershipHistory : (Array.isArray(account.raw?.ownershipHistory) ? account.raw.ownershipHistory : [])),
          newOwnershipEntry,
        ],
      }

      if (typeof updateAccount === 'function') {
        await updateAccount(account.id, updates)
      }

      // Add system update remark
      try {
        const createRemarkFn = remarkApi.createRemark || remarkApi.addRemark
        if (typeof createRemarkFn === 'function') {
          await createRemarkFn({
            accountId: account.raw?.id || account.id,
            relatedEntityId: account.raw?.id || account.id,
            relatedEntityType: 'account',
            content: reassignMessage,
            category: 'system',
            type: 'system',
            title: 'Account Reassigned',
            author: user?.name || 'System',
          })
        }
      } catch (err) {
        console.warn('Failed to save reassign remark:', err)
      }

      // Add description note if provided
      if (description) {
        try {
          const createRemarkFn = remarkApi.createRemark || remarkApi.addRemark
          if (typeof createRemarkFn === 'function') {
            await createRemarkFn({
              accountId: account.raw?.id || account.id,
              relatedEntityId: account.raw?.id || account.id,
              relatedEntityType: 'account',
              title: 'Re-assign Note',
              remark: description,
              content: description,
              type: 'note',
              category: 'note',
              author: user?.name || 'Admin',
            })
          }
        } catch (err) {
          console.warn('Failed to save reassign note:', err)
        }
      }

      // Create isolated Account Reminder if checkbox enabled
      if (addReminder) {
        const reminderDate = getReminderDate()
        const reminderTime = getReminderTime()
        const remindAt = `${reminderDate}T${String(reminderTime).padEnd(5, ':00')}:00`

        await accountReminderApi.createAccountReminder({
          accountId: account.raw?.id || account.id,
          accountName: account.name || account.customerName || '',
          accountNumber: account.accountNumber || account.accountNo || '',
          title: `Reassigned Account Follow-Up: ${account.name || account.customerName || 'Account'}`,
          message: message || 'Account has been assigned to you',
          remindAt,
          reminderDate,
          reminderTime,
          assignedTo: selectedOwner?.id || '',
          description,
        }).catch((err) => {
          console.warn('Failed to create account reminder:', err)
        })
      }

      if (typeof addNotification === 'function') {
        addNotification('success', 'Account Re-assigned', `${reassignMessage}${addReminder ? ' Reminder scheduled.' : ''}`)
      }

      if (typeof onSaved === 'function') {
        onSaved(updates)
      }
      if (typeof onClose === 'function') {
        onClose()
      }
    } catch (err) {
      console.error('Error re-assigning account:', err)
      setErrors({ record: err.response?.data?.message || err.message || 'Unable to re-assign account.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const accountDisplayLabel = account.name || account.customerName || account.companyName || account.label || '-'

  return (
    <form className="crm-action-reassign-form account-reassign-form" onSubmit={handleSubmit}>
      <div className="crm-action-reassign-title-row account-reassign-title-row">
        <h2>Re-Assign Account</h2>
        <button type="button" onClick={onClose} aria-label="Close re-assign account">
          <FaTimes />
        </button>
      </div>

      {errors.record ? (
        <div className="crm-action-message crm-action-message-error" style={{ color: '#dc2626', padding: '0.5rem 1rem' }}>
          {errors.record}
        </div>
      ) : null}

      <div className="crm-action-reassign-deal-name account-reassign-deal-name">
        Account Name: <strong>{accountDisplayLabel}</strong>
      </div>

      <section className="crm-action-reassign-owner-panel account-reassign-owner-panel">
        <label>
          <span>New Account Owner</span>
          <select
            value={newOwnerId}
            onChange={(event) => {
              setNewOwnerId(event.target.value)
              if (errors.newOwnerId) setErrors({ ...errors, newOwnerId: null })
            }}
            className={errors.newOwnerId ? 'crm-action-input-error' : ''}
          >
            <option value="">Select</option>
            {availableOwners.map((entry) => (
              <option key={entry.id} value={String(entry.id)}>
                {getAccountOwnerOptionLabel(entry)}
              </option>
            ))}
          </select>
        </label>
        {errors.newOwnerId ? <small className="crm-action-error-text">{errors.newOwnerId}</small> : null}

        <label style={{ marginTop: '0.85rem' }}>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Enter re-assignment description..."
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>
      </section>

      <label className="crm-action-reassign-check account-reassign-check">
        <input
          type="checkbox"
          checked={addReminder}
          onChange={(event) => setAddReminder(event.target.checked)}
        />
        <span>Add a reminder to new Account Owner?</span>
      </label>

      {addReminder ? (
        <section className="crm-action-reassign-reminder-panel account-reassign-reminder-panel">
          <div className="crm-action-reassign-radio-row account-reassign-radio-row">
            {['Now', 'Different Time'].map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="accountReassignReminderTiming"
                  value={option}
                  checked={reminderTiming === option}
                  onChange={(event) => setReminderTiming(event.target.value)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          {reminderTiming === 'Different Time' ? (
            <>
              <div className="crm-action-reassign-chip-row account-reassign-chip-row">
                <span className="crm-action-reassign-chip-label account-reassign-chip-label">Date:</span>
                <div className="crm-action-reassign-chip-group account-reassign-chip-group">
                  {reassignDateOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`crm-action-reassign-chip account-reassign-chip${reminderDatePreset === option.value ? ' crm-action-reassign-chip-active account-reassign-chip-active' : ''}`}
                      onClick={() => setReminderDatePreset(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`crm-action-reassign-chip crm-action-reassign-chip-other account-reassign-chip account-reassign-chip-other${reminderDatePreset === 'Other' ? ' crm-action-reassign-chip-active account-reassign-chip-active' : ''}`}
                    onClick={() => setReminderDatePreset('Other')}
                  >
                    Other
                  </button>
                </div>
              </div>
              {reminderDatePreset === 'Other' ? (
                <label className="crm-action-reassign-custom account-reassign-custom">
                  <span>Other Date</span>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(event) => {
                      setCustomDate(event.target.value)
                      if (errors.customDate) setErrors({ ...errors, customDate: null })
                    }}
                  />
                  {errors.customDate ? <small className="crm-action-error-text">{errors.customDate}</small> : null}
                </label>
              ) : null}

              <div className="crm-action-reassign-chip-row account-reassign-chip-row">
                <span className="crm-action-reassign-chip-label account-reassign-chip-label">Time:</span>
                <div className="crm-action-reassign-chip-group account-reassign-chip-group">
                  {REASSIGN_TIME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`crm-action-reassign-chip account-reassign-chip${reminderTimeSlot === option.value ? ' crm-action-reassign-chip-active account-reassign-chip-active' : ''}`}
                      onClick={() => setReminderTimeSlot(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`crm-action-reassign-chip crm-action-reassign-chip-other account-reassign-chip account-reassign-chip-other${reminderTimeSlot === 'Other' ? ' crm-action-reassign-chip-active account-reassign-chip-active' : ''}`}
                    onClick={() => setReminderTimeSlot('Other')}
                  >
                    Other
                  </button>
                </div>
              </div>
              {reminderTimeSlot === 'Other' ? (
                <label className="crm-action-reassign-custom account-reassign-custom">
                  <span>Other Time</span>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(event) => {
                      setCustomTime(event.target.value)
                      if (errors.customTime) setErrors({ ...errors, customTime: null })
                    }}
                  />
                  {errors.customTime ? <small className="crm-action-error-text">{errors.customTime}</small> : null}
                </label>
              ) : null}
            </>
          ) : null}

          <textarea
            className="crm-action-reassign-message account-reassign-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </section>
      ) : null}

      <div className="crm-action-reassign-footer account-reassign-footer">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          <FaTimes /> Close
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <FaSave /> {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

export default AccountReassignReminderForm

