import React, { useState, useEffect, useRef } from 'react'
import { FiEdit2, FiCheck, FiLoader } from 'react-icons/fi'

/**
 * Modern auto-save inline field editor.
 * STRICTLY NO SAVE BUTTON - auto-saves on blur, Enter keypress, or dropdown change.
 * Supports text, number, date, select, and textarea.
 */
export default function InlineAutoSaveField({
  label,
  fieldKey,
  value = '',
  type = 'text',
  options = [],
  placeholder = '',
  emptyText = 'Not Available',
  canEdit = true,
  onSave,
  className = '',
  formatter,
  multiline = false,
  onEditingChange,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value ?? '')
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const inputRef = useRef(null)

  useEffect(() => {
    if (typeof onEditingChange === 'function') {
      onEditingChange(isEditing)
    }
  }, [isEditing, onEditingChange])

  useEffect(() => {
    setTempValue(value ?? '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current.select && type !== 'date' && type !== 'select') {
        inputRef.current.select()
      }
    }
  }, [isEditing, type])

  useEffect(() => {
    let timer
    if (saveStatus === 'saved') {
      timer = setTimeout(() => {
        setSaveStatus('idle')
      }, 1500)
    }
    return () => clearTimeout(timer)
  }, [saveStatus])

  const handleStartEdit = (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!canEdit || saveStatus === 'saving') return
    setTempValue(value ?? '')
    setIsEditing(true)
  }

  const handleCommit = async (valToSave) => {
    const nextVal = valToSave !== undefined ? valToSave : tempValue
    setIsEditing(false)

    // Check if value actually changed
    const cleanCurrent = String(value ?? '').trim()
    const cleanNew = String(nextVal ?? '').trim()
    if (cleanCurrent === cleanNew) {
      return
    }

    if (typeof onSave === 'function') {
      setSaveStatus('saving')
      try {
        const success = await onSave(fieldKey, nextVal)
        if (success !== false) {
          setSaveStatus('saved')
        } else {
          setSaveStatus('error')
        }
      } catch (err) {
        console.error('Auto-save error for field', fieldKey, err)
        setSaveStatus('error')
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleCommit(tempValue)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setTempValue(value ?? '')
      setIsEditing(false)
    }
  }

  const handleSelectChange = (e) => {
    const selectedVal = e.target.value
    setTempValue(selectedVal)
    handleCommit(selectedVal)
  }

  const displayVal = formatter ? formatter(value) : value

  return (
    <div className={`ad-field-pair ${className}`}>
      {label && (
        <div className="ad-field-label-row">
          <span className="ad-field-label">{label}</span>
          {saveStatus === 'saving' && (
            <span className="ad-field-saving-indicator">
              <FiLoader className="ad-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="ad-field-saved-indicator">
              <FiCheck /> Saved
            </span>
          )}
          {canEdit && !isEditing && (
            <button
              type="button"
              className="ad-field-edit-btn"
              onClick={handleStartEdit}
              title={`Edit ${label}`}
              aria-label={`Edit ${label}`}
            >
              <FiEdit2 />
            </button>
          )}
        </div>
      )}

      {isEditing ? (
        <div className="ad-inline-edit-wrapper">
          {type === 'select' ? (
            <select
              ref={inputRef}
              className="ad-inline-input ad-inline-select"
              value={tempValue}
              onChange={handleSelectChange}
              onBlur={() => handleCommit(tempValue)}
              onKeyDown={handleKeyDown}
            >
              <option value="">-- Select {label || 'Option'} --</option>
              {options.map((opt) => {
                const optVal = typeof opt === 'object' ? opt.value : opt
                const optLabel = typeof opt === 'object' ? opt.label : opt
                return (
                  <option key={optVal} value={optVal}>
                    {optLabel}
                  </option>
                )
              })}
            </select>
          ) : multiline ? (
            <textarea
              ref={inputRef}
              className="ad-inline-input ad-inline-textarea"
              rows={3}
              placeholder={placeholder || `Enter ${label}...`}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => handleCommit(tempValue)}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <input
              ref={inputRef}
              type={type}
              className="ad-inline-input"
              placeholder={placeholder || `Enter ${label}...`}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => handleCommit(tempValue)}
              onKeyDown={handleKeyDown}
            />
          )}
        </div>
      ) : (
        <div className="ad-field-value-row">
          {displayVal ? (
            <span
              className="ad-field-value"
              style={multiline ? { whiteSpace: 'pre-wrap' } : undefined}
            >
              {displayVal}
            </span>
          ) : (
            <span className="ad-not-available">{emptyText}</span>
          )}
          {!label && canEdit && (
            <button
              type="button"
              className="ad-field-edit-btn"
              onClick={handleStartEdit}
              title="Edit"
            >
              <FiEdit2 />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
