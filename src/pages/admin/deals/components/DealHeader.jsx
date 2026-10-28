import React, { useEffect, useRef } from 'react'
import { FaArrowLeft, FaEllipsisV, FaHistory, FaPencilAlt } from 'react-icons/fa'
import { FiEdit2 } from 'react-icons/fi'

const DealHeader = ({
  dealName,
  dealNumber,
  onBack,
  onOpenHistory,
  isActionsMenuOpen,
  setIsActionsMenuOpen,
  actionsMenuItems,
  onActionsItemClick,
  onStartEditTitle,
  isEditingTitle,
  titleEditValue,
  onChangeTitleEditValue,
  onSaveTitle,
  onCancelTitle,
  isSavingTitle,
}) => {
  const actionsMenuRef = useRef(null)

  useEffect(() => {
    if (!isActionsMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setIsActionsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isActionsMenuOpen, setIsActionsMenuOpen])

  return (
    <header className="c-deal-header">
      <div className="c-deal-header-left">
        <button
          type="button"
          className="c-deal-back-btn"
          onClick={onBack}
          aria-label="Back to deals"
          title="Back to deals"
        >
          <FaArrowLeft />
        </button>

        <div className="c-deal-title-group">
          {isEditingTitle ? (
            <div className="c-deal-title-inline-editor">
              <input
                type="text"
                className="c-deal-title-input"
                value={titleEditValue}
                onChange={(e) => onChangeTitleEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (!isSavingTitle && onSaveTitle) onSaveTitle()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    if (onCancelTitle) onCancelTitle()
                  }
                }}
                disabled={isSavingTitle}
                autoFocus
              />
              <button
                type="button"
                className="c-deal-inline-btn c-deal-inline-btn-save"
                onClick={onSaveTitle}
                disabled={isSavingTitle}
              >
                {isSavingTitle ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="c-deal-inline-btn c-deal-inline-btn-cancel"
                onClick={onCancelTitle}
                disabled={isSavingTitle}
              >
                Close
              </button>
            </div>
          ) : (
            <div className="c-deal-title-display">
              <h1 className="c-deal-title-text" title={dealName || 'Deal Details'}>
                {dealName || 'Deal Details'}
              </h1>
              {onStartEditTitle && (
                <button
                  type="button"
                  className="c-deal-title-pencil-btn"
                  onClick={onStartEditTitle}
                  aria-label="Edit deal title"
                  title="Edit deal title"
                >
                  <FiEdit2 />
                </button>
              )}
            </div>
          )}

          {dealNumber && (
            <div className="c-deal-no-badge">
              <span className="c-deal-no-label">Deal No.:</span>
              <strong className="c-deal-no-val">{dealNumber}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="c-deal-header-right">
        {onOpenHistory && (
          <button
            type="button"
            className="c-deal-history-btn"
            onClick={onOpenHistory}
            title="Remarks & History"
            aria-label="Remarks & History"
          >
            <FaHistory />
            <span className="c-deal-history-text">History</span>
          </button>
        )}

        <div className="c-deal-actions-wrapper" ref={actionsMenuRef}>
          <button
            type="button"
            className="c-deal-actions-trigger"
            onClick={() => setIsActionsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isActionsMenuOpen}
            title="Actions"
            aria-label="Actions"
          >
            <span className="c-deal-actions-trigger-text">Actions</span>
            <FaEllipsisV />
          </button>

          {isActionsMenuOpen && (
            <div className="c-deal-actions-dropdown" role="menu">
              {actionsMenuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={`c-deal-actions-dropdown-item c-deal-actions-item-${item.accent || 'slate'}`}
                  onClick={() => onActionsItemClick(item)}
                >
                  <span className="c-deal-actions-item-icon">{item.icon}</span>
                  <span className="c-deal-actions-item-label">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default React.memo(DealHeader)
