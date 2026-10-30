import React from 'react'
import { FiEdit2 } from 'react-icons/fi'

const hasDisplayValue = (value) => {
  if (typeof value === 'number') return true
  return String(value || '').trim() !== ''
}

const renderDisplayValue = (value, options = null, fallback = 'Not Available') => {
  if (!hasDisplayValue(value)) return fallback
  if (options && Array.isArray(options)) {
    const opt = options.find((o) => String(o.value) === String(value))
    if (opt && opt.label) return opt.label
  }
  return value
}

const InfoFieldItem = ({
  itemKey,
  label,
  value,
  rawValue,
  type = 'text',
  options = null,
  icon = null,
  readonly = false,
  isEditing = false,
  editValue = '',
  isSaving = false,
  onStartEdit,
  onChangeEditValue,
  onSave,
  onCancel,
  badge = false,
  badgeColor = 'red',
  className = '',
}) => {
  const isSelect = options && Array.isArray(options) && options.length > 0

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!isSaving && onSave) {
        onSave(itemKey, editValue)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (onCancel) {
        onCancel()
      }
    }
  }

  return (
    <div className={`c-deal-info-field ${className} ${isEditing ? 'c-deal-info-field--editing' : ''}`} data-field-key={itemKey}>
      <div className="c-deal-info-field-header">
        <span className="c-deal-info-field-label">
          {icon && <span className="c-deal-info-field-label-icon">{icon}</span>}
          <span>{label}</span>
        </span>
        {!readonly && !isEditing && onStartEdit && (
          <button
            type="button"
            className="c-deal-info-field-pencil-btn"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onStartEdit(itemKey, rawValue !== undefined ? rawValue : value)
            }}
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
          >
            <FiEdit2 />
          </button>
        )}
      </div>

      <div className="c-deal-info-field-body">
        {isEditing ? (
          <div className="c-deal-inline-editor">
            {isSelect ? (
              <select
                className="c-deal-inline-input c-deal-inline-select"
                value={editValue}
                onChange={(e) => onChangeEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                autoFocus
              >
                <option value="">Select...</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : type === 'date' ? (
              <input
                type="date"
                className="c-deal-inline-input"
                value={editValue}
                onChange={(e) => onChangeEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                autoFocus
              />
            ) : type === 'number' ? (
              <input
                type="number"
                className="c-deal-inline-input"
                value={editValue}
                onChange={(e) => onChangeEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                autoFocus
              />
            ) : (
              <input
                type="text"
                className="c-deal-inline-input"
                value={editValue}
                onChange={(e) => onChangeEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                autoFocus
              />
            )}
            <div className="c-deal-inline-actions">
              <button
                type="button"
                className="c-deal-inline-btn c-deal-inline-btn-save"
                onClick={() => onSave(itemKey)}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="c-deal-inline-btn c-deal-inline-btn-cancel"
                onClick={onCancel}
                disabled={isSaving}
              >
                Close
              </button>
            </div>
          </div>
        ) : badge ? (
          <span className={`c-deal-badge c-deal-badge-${badgeColor}`}>
            {renderDisplayValue(value, options)}
          </span>
        ) : (
          <span className={`c-deal-info-field-value ${hasDisplayValue(value) ? '' : 'c-deal-info-field-value--empty'}`}>
            {renderDisplayValue(value, options)}
          </span>
        )}
      </div>
    </div>
  )
}

export default React.memo(InfoFieldItem)
