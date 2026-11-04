import React, { useState } from 'react'
import { FaHistory, FaPhoneAlt } from 'react-icons/fa'

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

export default function ActivityUpdatesCard({ account = {}, remarks = [], reminders = [] }) {
  const [activeTab, setActiveTab] = useState('recent')

  const reminderUpdates = (Array.isArray(reminders) ? reminders : []).map((r) => ({
    id: `rem-${r.id || r._id}`,
    title: `Reminder: ${r.title || r.message || 'Scheduled Follow-up'}`,
    content: r.message || r.content || r.title || 'Follow-up reminder scheduled.',
    createdAt: r.reminderDate || r.dueDate || r.createdAt,
    author: r.ownerName || r.assignedTo || account.accountOwnerDisplay || account.accountOwner || 'User',
    isReminder: true,
  }))

  const ownershipUpdates = [
    ...(Array.isArray(account.ownershipHistory) ? account.ownershipHistory : []),
    ...(Array.isArray(account.raw?.ownershipHistory) ? account.raw.ownershipHistory : []),
    ...(Array.isArray(account.systemUpdates) ? account.systemUpdates : []),
    ...(Array.isArray(account.raw?.systemUpdates) ? account.raw.systemUpdates : []),
  ].map((entry, idx) => ({
    id: entry.id || `reassign-${idx}-${entry.changedAt || entry.createdAt}`,
    title: entry.title || 'Account Reassigned',
    content: entry.content || (entry.fromOwner && entry.toOwner ? `Re-assign Account from ${entry.fromOwner} to ${entry.toOwner}.` : 'Account reassigned.'),
    createdAt: entry.changedAt || entry.createdAt || account.updatedAt,
    author: entry.author || entry.changedBy || 'System',
  }))

  const systemRemarks = (Array.isArray(remarks) ? remarks : [])
    .filter((r) => r.type === 'system' || r.category === 'system' || r.title === 'Account Reassigned' || (r.content && String(r.content).startsWith('Re-assign Account from')))
    .map((r, idx) => ({
      id: r.id || `sys-remark-${idx}`,
      title: r.title || 'Account Reassigned',
      content: r.content || r.remark || '',
      createdAt: r.createdAt || r.date,
      author: r.createdByName || r.author || 'System',
    }))

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
    ...ownershipUpdates,
    ...systemRemarks,
    ...reminderUpdates,
  ].filter((item, index, self) => (
    index === self.findIndex((other) => other.content === item.content && String(other.createdAt).slice(0, 16) === String(item.createdAt).slice(0, 16))
  )).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const recentUpdatesList = (Array.isArray(remarks) ? remarks : []).filter(
    (r) => r.type !== 'system' && r.category !== 'system' && !(r.content && String(r.content).startsWith('Re-assign Account from'))
  )

  const displayList = activeTab === 'recent' ? recentUpdatesList : systemUpdates

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
                <strong style={{ color: 'var(--color-primary, #c60016)' }}>
                  {item.createdByName || item.userName || item.author || 'User'}
                </strong>
                <span>{formatActivityTime(item.createdAt || item.date)}</span>
              </div>
              {item.title && (
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem', marginTop: '1px' }}>
                  {item.title}
                </div>
              )}
              {(item.category === 'call-log' || item.type === 'call-log' || (item.startTime && item.endTime)) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginTop: '3px', marginBottom: '3px' }}>
                  <FaPhoneAlt style={{ fontSize: '0.70rem', color: '#c60016' }} />
                  <span>{item.startTime || '00:00'}{item.endTime ? ` - ${item.endTime}` : ''}</span>
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
  )
}
