import React, { useState } from 'react'
import { FaHistory } from 'react-icons/fa'

const formatActivityTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ActivityUpdatesCard({ account = {}, remarks = [] }) {
  const [activeTab, setActiveTab] = useState('recent')

  const systemUpdates = [
    ...(account.createdAt ? [{
      id: 'sys-created',
      title: 'Account Created',
      content: `Account record was created by ${account.addedByDisplay || account.addedBy || 'User'}.`,
      createdAt: account.createdAt,
      author: account.addedByDisplay || account.addedBy || 'System',
    }] : []),
    ...(account.updatedAt && account.updatedAt !== account.createdAt ? [{
      id: 'sys-updated',
      title: 'Account Modified',
      content: `Account updated to status ${account.status || account.stage || 'Updated'}.`,
      createdAt: account.updatedAt,
      author: account.accountOwnerDisplay || account.accountOwner || 'System',
    }] : []),
  ]

  const displayList = activeTab === 'recent' ? remarks : systemUpdates

  return (
    <div className="ad-card">
      <div className="ad-card-header">
        <h3 className="ad-card-title">
          <FaHistory className="ad-card-title-icon" />
          <span>Activity & Updates</span>
        </h3>
      </div>

      <div className="ad-activity-tabs">
        <button
          type="button"
          className={`ad-activity-tab-btn ${activeTab === 'recent' ? 'ad-activity-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          Recent Updates
        </button>
        <button
          type="button"
          className={`ad-activity-tab-btn ${activeTab === 'system' ? 'ad-activity-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          System Updates
        </button>
      </div>

      <div className="ad-activity-list">
        {displayList && displayList.length > 0 ? (
          displayList.map((item, index) => (
            <div key={item.id || `activity-${index}`} className="ad-activity-item">
              <div className="ad-activity-meta">
                <strong style={{ color: 'var(--color-primary, #2563eb)' }}>
                  {item.createdByName || item.userName || item.author || 'User'}
                </strong>
                <span>{formatActivityTime(item.createdAt || item.date)}</span>
              </div>
              <div className="ad-activity-content">
                {item.content || item.remark || item.note || item.text}
              </div>
            </div>
          ))
        ) : (
          <div className="ad-activity-empty">No updates available</div>
        )}
      </div>
    </div>
  )
}
