import React, { useState, useEffect, useRef } from 'react'
import {
  FaCalendarAlt,
  FaTag,
  FaInfoCircle,
  FaFlag,
  FaFileInvoice,
  FaClock,
  FaUserPlus,
} from 'react-icons/fa'
import { FiEdit2, FiCheck, FiLoader } from 'react-icons/fi'
import { ACCOUNT_CATEGORY_OPTIONS } from '../../../../../features/accounts/config/accountDropdownOptions'

const formatDateDisplay = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

const calculateAgeing = (startDate) => {
  if (!startDate) return ''
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return ''
  const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays >= 0 ? `${diffDays} days` : '0 days'
}

export default function AccountSnapshotStrip({
  account = {},
  form = {},
  onAutoSave,
  canEdit = true,
}) {
  const accountDate = form.accountDate || account.accountDate || account.createdAt || ''
  const category = form.accountCategory || account.accountCategory || account.category || ''
  const status = form.status || account.status || account.stage || ''
  const state = form.state || account.state || ''
  const gstin = form.gstin || account.gstin || ''
  const ageing = calculateAgeing(accountDate)
  const addedBy = form.addedBy || account.addedByDisplay || account.addedBy || account.ownerName || ''

  const [editingField, setEditingField] = useState(null) // 'accountCategory' | 'gstin'
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

  const startEdit = (fieldKey, val) => {
    if (!canEdit || saveStatus === 'saving') return
    setEditingField(fieldKey)
    setFieldValue(val || '')
  }

  const handleCommit = async (fieldKey, origVal, forcedVal) => {
    const valToSave = forcedVal !== undefined ? forcedVal : fieldValue
    setEditingField(null)

    const cleanOrig = String(origVal || '').trim()
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
        console.error('Snapshot auto-save error:', err)
        setSaveStatus('error')
      }
    }
  }

  const handleKeyDown = (e, fieldKey, origVal) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCommit(fieldKey, origVal)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingField(null)
    }
  }

  const snapshotItems = [
    {
      id: 'accountDate',
      label: 'Account Date',
      icon: FaCalendarAlt,
      value: formatDateDisplay(accountDate),
    },
    {
      id: 'accountCategory',
      label: 'Category',
      icon: FaTag,
      value: category,
      editable: true,
      type: 'select',
      options: ACCOUNT_CATEGORY_OPTIONS,
    },
    {
      id: 'status',
      label: 'Status',
      icon: FaInfoCircle,
      value: status,
      isPill: true,
      pillType: 'new',
    },
    {
      id: 'state',
      label: 'State',
      icon: FaFlag,
      value: state,
      isPill: true,
      pillType: 'warm',
    },
    {
      id: 'gstin',
      label: 'GSTIN',
      icon: FaFileInvoice,
      value: gstin,
      editable: true,
      type: 'text',
    },
    {
      id: 'ageing',
      label: 'Ageing',
      icon: FaClock,
      value: ageing,
    },
    {
      id: 'addedBy',
      label: 'Added By',
      icon: FaUserPlus,
      value: addedBy,
    },
  ]

  return (
    <section className="ad-snapshot-strip">
      {snapshotItems.map((item) => {
        const Icon = item.icon
        const isThisEditing = editingField === item.id

        return (
          <div key={item.id} className="ad-snapshot-item">
            <div className="ad-snapshot-label-row">
              <Icon style={{ fontSize: '0.68rem', color: 'var(--color-primary, #c60016)' }} />
              <span>{item.label}</span>
              {item.editable && canEdit && !isThisEditing && (
                <button
                  type="button"
                  className="ad-field-edit-btn"
                  onClick={() => startEdit(item.id, item.value)}
                  title={`Edit ${item.label}`}
                >
                  <FiEdit2 />
                </button>
              )}
              {isThisEditing && saveStatus === 'saving' && (
                <span className="ad-field-saving-indicator">
                  <FiLoader className="ad-spin" />
                </span>
              )}
            </div>

            {isThisEditing ? (
              <div className="ad-inline-edit-wrapper" style={{ marginTop: '2px' }}>
                {item.type === 'select' ? (
                  <select
                    ref={inputRef}
                    className="ad-inline-input ad-inline-select"
                    style={{ fontSize: '0.78rem', padding: '2px 4px' }}
                    value={fieldValue}
                    onChange={(e) => {
                      const val = e.target.value
                      setFieldValue(val)
                      handleCommit(item.id, item.value, val)
                    }}
                    onBlur={() => handleCommit(item.id, item.value)}
                    onKeyDown={(e) => handleKeyDown(e, item.id, item.value)}
                  >
                    <option value="">-- Select --</option>
                    {(item.options || []).map((opt) => {
                      const optVal = typeof opt === 'object' ? opt.value : opt
                      const optLabel = typeof opt === 'object' ? opt.label : opt
                      return (
                        <option key={optVal} value={optVal}>
                          {optLabel}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    className="ad-inline-input"
                    style={{ fontSize: '0.78rem', padding: '2px 4px' }}
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    onBlur={() => handleCommit(item.id, item.value)}
                    onKeyDown={(e) => handleKeyDown(e, item.id, item.value)}
                  />
                )}
              </div>
            ) : item.value ? (
              item.isPill ? (
                <span
                  className={`ad-status-pill ${
                    item.pillType === 'new' ? 'ad-status-pill--new' : 'ad-status-pill--warm'
                  }`}
                  style={{ alignSelf: 'flex-start', marginTop: '2px' }}
                >
                  {item.value}
                </span>
              ) : (
                <span className="ad-snapshot-value" title={String(item.value)}>
                  {item.value}
                </span>
              )
            ) : (
              <span className="ad-not-available">Not Available</span>
            )}
          </div>
        )
      })}
    </section>
  )
}
