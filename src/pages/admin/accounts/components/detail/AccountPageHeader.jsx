import React, { useState, useRef } from 'react'
import { FiArrowLeft, FiChevronDown } from 'react-icons/fi'
import { FaSave, FaTimes, FaHistory } from 'react-icons/fa'
import { useClickOutside } from '../../../../../hooks'

export default function AccountPageHeader({
  account = {},
  form = {},
  onClose,
  isSaving = false,
  handleSave,
  actions = [],
  onActionSelect,
  onOpenHistory,
  isEditable = false,
  onCancelEdit,
}) {
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const actionsRef = useClickOutside(() => setIsActionsOpen(false))

  const accountTitle = account.name || form.accountName || 'Account details'
  const accountNumber = account.accountNumber || account.accountNo || account.id || ''

  return (
    <header className="ad-top-header">
      <div className="ad-top-header-left">
        <button
          type="button"
          className="ad-back-btn"
          onClick={onClose}
          title="Back to accounts list"
          aria-label="Back"
        >
          <FiArrowLeft />
        </button>
        <h1 className="ad-top-title" title={accountTitle}>
          {accountTitle}
        </h1>
      </div>

      <div className="ad-top-header-right">
        {accountNumber && (
          <span className="ad-account-id-badge" title="Account Number">
            {accountNumber}
          </span>
        )}

        {typeof onOpenHistory === 'function' && (
          <button
            type="button"
            className="admin-accounts-history-trigger"
            onClick={onOpenHistory}
            title="View History"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 11px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #cbd5e1)',
              background: 'var(--color-surface, #ffffff)',
              color: 'var(--color-primary, #c60016)',
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            <FaHistory />
          </button>
        )}

        <div className="admin-accounts-actions-dropdown" ref={actionsRef}>
          <button
            type="button"
            className="admin-accounts-actions-trigger"
            onClick={() => setIsActionsOpen((prev) => !prev)}
            aria-expanded={isActionsOpen}
            title="Account Actions"
          >
            <span className="admin-accounts-actions-trigger-label">Actions</span>
            <span className="admin-accounts-actions-trigger-caret">
              <FiChevronDown />
            </span>
          </button>

          {isActionsOpen && (
            <div className="admin-accounts-actions-menu">
              {actions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.key}
                    type="button"
                    className="admin-accounts-actions-menu-button"
                    onClick={() => {
                      setIsActionsOpen(false)
                      if (typeof onActionSelect === 'function') {
                        onActionSelect(action.key)
                      }
                    }}
                  >
                    {Icon && <Icon className="admin-accounts-actions-menu-icon" />}
                    <span>{action.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {isEditable && (
          <>
            <button
              type="button"
              className="admin-accounts-header-save-btn"
              onClick={handleSave}
              disabled={isSaving}
              title="Save Changes to MongoDB"
            >
              <FaSave style={{ marginRight: '6px' }} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              className="admin-accounts-header-close-btn"
              onClick={onCancelEdit || onClose}
              aria-label="Close"
              title="Close"
            >
              <FaTimes style={{ marginRight: '6px' }} />
              Close
            </button>
          </>
        )}
      </div>
    </header>
  )
}
