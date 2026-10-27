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

export default function DealActivityUpdatesCard({ deal = {}, remarks = [], reminders = [] }) {
  const [activeTab, setActiveTab] = useState('recent')

  const reminderUpdates = (Array.isArray(reminders) ? reminders : []).map((r) => ({
    id: `rem-${r.id || r._id}`,
    title: `Reminder: ${r.title || r.message || 'Scheduled Follow-up'}`,
    content: r.message || r.content || r.note || r.title || 'Follow-up reminder scheduled.',
    createdAt: r.reminderDate || r.dueDate || r.createdAt,
    author: r.ownerName || r.assignedTo || deal.dealOwner || 'User',
    isReminder: true,
  }))

  const systemUpdates = [
    ...(deal.createdAt ? [{
      id: 'sys-created',
      title: 'Deal Created',
      content: `Deal record was created by ${deal.addedBy || deal.dealOwner || 'User'}.`,
      createdAt: deal.createdAt,
      author: deal.addedBy || deal.dealOwner || 'System',
    }] : []),
    ...(deal.lastUpdated && deal.lastUpdated !== deal.createdAt ? [{
      id: 'sys-updated',
      title: 'Deal Modified',
      content: `Deal updated to status ${deal.dealStatus || deal.status || 'Updated'}.`,
      createdAt: deal.lastUpdated,
      author: deal.dealOwner || deal.addedBy || 'System',
    }] : []),
    ...reminderUpdates,
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const displayList = activeTab === 'recent' ? remarks : systemUpdates

  return (
    <div className="c-deal-card ad-card">
      <div className="c-deal-card-header ad-card-header">
        <h3 className="c-deal-card-title ad-card-title">
          <span className="c-deal-card-icon">
            <FaHistory />
          </span>
          <span>Activity & Updates</span>
        </h3>
      </div>

      <div className="c-deal-card-content">
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
                  <strong style={{ color: '#c60016' }}>
                    {item.createdByName || item.userName || item.author || 'User'}
                  </strong>
                  <span>{formatActivityTime(item.createdAt || item.date)}</span>
                </div>
                {item.title && (
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem', marginTop: '1px' }}>
                    {item.title}
                  </div>
                )}
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
    </div>
  )
}
