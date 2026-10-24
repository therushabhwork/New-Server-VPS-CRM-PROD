import React, { useEffect, useState } from 'react'
import { FaExclamationTriangle, FaHourglassHalf, FaSignOutAlt, FaCheckCircle } from 'react-icons/fa'
import './SessionExpiryModal.css'

export const SessionExpiryModal = ({
  isOpen = false,
  remainingSeconds = 300,
  message = '',
  autoLogoutOnZero = false,
  onContinue,
  onLogout,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds)

  useEffect(() => {
    setSecondsLeft(remainingSeconds)
  }, [remainingSeconds])

  useEffect(() => {
    if (!isOpen) return undefined

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          if (autoLogoutOnZero && onLogout) {
            onLogout('inactivity_timeout')
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, autoLogoutOnZero, onLogout])

  if (!isOpen) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`

  return (
    <div className="crm-session-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="session-warning-title">
      <div className="crm-session-modal-card">
        <div className="crm-session-warning-pill">
          <FaHourglassHalf />
          <span>SESSION EXPIRY WARNING</span>
        </div>

        <h2 id="session-warning-title" className="crm-session-title">
          Are you still working?
        </h2>

        <p className="crm-session-subtitle">
          {message || 'You have been inactive. For your security, your CRM session will automatically end in:'}
        </p>

        <div className="crm-session-timer-display" aria-live="polite">
          {formattedTime}
        </div>
        <div className="crm-session-timer-label">Minutes : Seconds</div>

        <p className="crm-session-prompt">
          Click <strong>Continue</strong> to keep your session active, or <strong>Log Out</strong> to safely exit.
        </p>

        <div className="crm-session-actions-row">
          <button
            type="button"
            className="crm-session-btn-back"
            onClick={() => onLogout && onLogout('manual_logout')}
          >
            <FaSignOutAlt style={{ marginRight: '6px' }} />
            Back (Log Out)
          </button>

          <button
            type="button"
            className="crm-session-btn-continue"
            onClick={onContinue}
          >
            <FaCheckCircle style={{ marginRight: '6px' }} />
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionExpiryModal
