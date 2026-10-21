import React, { useState, useEffect, useRef } from 'react'
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa'
import { FiEdit2, FiCheck, FiLoader } from 'react-icons/fi'

const formatHeaderDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day}-${month}-${year} ${time}`
}

export default function AccountProfileHeader({
  account = {},
  form = {},
  onAutoSave,
  canEdit = true,
}) {
  const accountName = form.accountName || account.name || account.accountName || 'Account Name'
  const contactPerson = form.contactPerson || account.contactPerson || ''
  const phone = form.mobile || account.mobile || account.phone || ''
  const email = form.email || account.email || form.contactEmail || account.contactEmail || ''
  const city = form.city || account.city || account.dealCity || form.dealCity || ''
  const owner = account.accountOwnerDisplay || form.accountOwner || account.accountOwner || '-'
  const source = form.accountSource || account.accountSource || account.source || 'E-MAIL'
  const updatedAt = account.updatedAt || account.createdAt || ''

  const statusRaw = String(form.status || account.status || account.stage || 'new').toLowerCase()
  const stateRaw = String(form.state || account.state || 'warm').toLowerCase()

  // State for inline editing header fields
  const [editingField, setEditingField] = useState(null) // 'accountName' | 'contactPerson' | 'mobile' | 'email' | 'city'
  const [fieldValue, setFieldValue] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current.select) inputRef.current.select()
    }
  }, [editingField])

  useEffect(() => {
    let timer
    if (saveStatus === 'saved') {
      timer = setTimeout(() => setSaveStatus('idle'), 1500)
    }
    return () => clearTimeout(timer)
  }, [saveStatus])

  const startEdit = (fieldKey, currentVal) => {
    if (!canEdit || saveStatus === 'saving') return
    setEditingField(fieldKey)
    setFieldValue(currentVal || '')
  }

  const handleAutoSaveCommit = async (fieldKey, originalVal) => {
    const valToSave = fieldValue
    setEditingField(null)

    const cleanOrig = String(originalVal || '').trim()
    const cleanNew = String(valToSave || '').trim()
    if (cleanOrig === cleanNew) return

    if (typeof onAutoSave === 'function') {
      setSaveStatus('saving')
      try {
        const success = await onAutoSave(fieldKey, valToSave)
        if (success !== false) {
          setSaveStatus('saved')
        } else {
          setSaveStatus('error')
        }
      } catch (err) {
        console.error('Header field auto-save error:', err)
        setSaveStatus('error')
      }
    }
  }

  const handleKeyDown = (e, fieldKey, origVal) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAutoSaveCommit(fieldKey, origVal)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingField(null)
    }
  }

  return (
    <section className="ad-profile-card">
      <div className="ad-profile-identity">
        {/* Account Name */}
        <div className="ad-profile-name-row">
          {editingField === 'accountName' ? (
            <input
              ref={inputRef}
              type="text"
              className="ad-inline-input"
              style={{ fontSize: '1.2rem', fontWeight: 700 }}
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              onBlur={() => handleAutoSaveCommit('accountName', accountName)}
              onKeyDown={(e) => handleKeyDown(e, 'accountName', accountName)}
            />
          ) : (
            <div className="ad-profile-editable-title">
              <h2 className="ad-profile-name">{accountName}</h2>
              {canEdit && (
                <button
                  type="button"
                  className="ad-field-edit-btn"
                  onClick={() => startEdit('accountName', accountName)}
                  title="Edit Account Name"
                >
                  <FiEdit2 />
                </button>
              )}
              {saveStatus === 'saving' && editingField === null && (
                <span className="ad-field-saving-indicator">
                  <FiLoader className="ad-spin" />
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="ad-field-saved-indicator">
                  <FiCheck /> Saved
                </span>
              )}
            </div>
          )}
        </div>

        {/* Contact Person */}
        <div className="ad-profile-contact-row-wrapper">
          {editingField === 'contactPerson' ? (
            <input
              ref={inputRef}
              type="text"
              className="ad-inline-input"
              style={{ maxWidth: '280px', marginTop: '4px' }}
              placeholder="Enter Contact Person"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              onBlur={() => handleAutoSaveCommit('contactPerson', contactPerson)}
              onKeyDown={(e) => handleKeyDown(e, 'contactPerson', contactPerson)}
            />
          ) : (
            <div className="ad-profile-editable-sub">
              {contactPerson ? (
                <span className="ad-profile-contact-person">{contactPerson}</span>
              ) : (
                <span className="ad-not-available">Contact Person: Not Available</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="ad-field-edit-btn"
                  onClick={() => startEdit('contactPerson', contactPerson)}
                  title="Edit Contact Person"
                >
                  <FiEdit2 />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Contact items: Phone, Email, Location */}
        <div className="ad-profile-contact-row">
          {/* Phone */}
          {editingField === 'mobile' ? (
            <input
              ref={inputRef}
              type="tel"
              className="ad-inline-input"
              style={{ maxWidth: '170px' }}
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              onBlur={() => handleAutoSaveCommit('mobile', phone)}
              onKeyDown={(e) => handleKeyDown(e, 'mobile', phone)}
            />
          ) : (
            <span className="ad-profile-contact-item-wrapper">
              {phone ? (
                <a href={`tel:${phone}`} className="ad-profile-contact-item">
                  <FaPhoneAlt style={{ fontSize: '0.72rem' }} />
                  <span>{phone}</span>
                </a>
              ) : (
                <span className="ad-not-available">Phone: Not Available</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="ad-field-edit-btn"
                  onClick={() => startEdit('mobile', phone)}
                  title="Edit Phone"
                >
                  <FiEdit2 />
                </button>
              )}
            </span>
          )}

          {/* Email */}
          {editingField === 'email' ? (
            <input
              ref={inputRef}
              type="email"
              className="ad-inline-input"
              style={{ maxWidth: '220px' }}
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              onBlur={() => handleAutoSaveCommit('email', email)}
              onKeyDown={(e) => handleKeyDown(e, 'email', email)}
            />
          ) : (
            <span className="ad-profile-contact-item-wrapper">
              {email ? (
                <a href={`mailto:${email}`} className="ad-profile-contact-item">
                  <FaEnvelope style={{ fontSize: '0.72rem' }} />
                  <span>{email}</span>
                </a>
              ) : (
                <span className="ad-not-available">Email: Not Available</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="ad-field-edit-btn"
                  onClick={() => startEdit('email', email)}
                  title="Edit Email"
                >
                  <FiEdit2 />
                </button>
              )}
            </span>
          )}

          {/* City / Location */}
          {editingField === 'city' ? (
            <input
              ref={inputRef}
              type="text"
              className="ad-inline-input"
              style={{ maxWidth: '150px' }}
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              onBlur={() => handleAutoSaveCommit('city', city)}
              onKeyDown={(e) => handleKeyDown(e, 'city', city)}
            />
          ) : (
            <span className="ad-profile-contact-item-wrapper">
              {city ? (
                <span className="ad-profile-contact-item">
                  <FaMapMarkerAlt style={{ fontSize: '0.72rem' }} />
                  <span>{city}</span>
                </span>
              ) : (
                <span className="ad-not-available">Location: Not Available</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="ad-field-edit-btn"
                  onClick={() => startEdit('city', city)}
                  title="Edit City / Location"
                >
                  <FiEdit2 />
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Profile Center Meta */}
      <div className="ad-profile-center">
        <div className="ad-status-badge-row">
          <span
            className={`ad-status-pill ${
              statusRaw.includes('new') ? 'ad-status-pill--new' : 'ad-status-pill--neutral'
            }`}
          >
            {statusRaw.replace(/_/g, ' ')}
          </span>
          <span
            className={`ad-status-pill ${
              stateRaw.includes('warm') || stateRaw.includes('progress')
                ? 'ad-status-pill--warm'
                : 'ad-status-pill--neutral'
            }`}
          >
            {stateRaw.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="ad-profile-meta-list">
          <div>
            Owner: <strong>{owner}</strong>
          </div>
          <div>
            Source: <strong>{source.toUpperCase()}</strong>
          </div>
          <div>
            Last Updated: <strong>{formatHeaderDateTime(updatedAt)}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}
