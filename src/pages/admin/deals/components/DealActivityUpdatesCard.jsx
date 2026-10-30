import React, { useState, useMemo } from 'react'
import { FaHistory, FaPhoneAlt } from 'react-icons/fa'
import { getCrmOwnerDisplay, getCrmOwnerRecord } from '../../../../features/users/crmUserDirectory'

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

export default function DealActivityUpdatesCard({ deal = {}, remarks = [], reminders = [], users = [] }) {
  const [activeTab, setActiveTab] = useState('recent')

  const resolveUserName = (rawIdOrName, fallback = 'User') => {
    if (!rawIdOrName) return fallback
    const str = String(rawIdOrName).trim()
    if (!str) return fallback

    const isPureNumber = /^\d+$/.test(str)

    if (Array.isArray(users) && users.length > 0) {
      const matched = users.find((u) => (
        String(u.id) === str
        || String(u._id) === str
        || String(u.legacyId) === str
        || String(u.ownerCode) === str
        || String(u.userId) === str
        || String(u.value) === str
        || (u.name && u.name.toLowerCase() === str.toLowerCase())
      ))
      if (matched) {
        return matched.ownerDisplayName || matched.name || matched.label || matched.username || str
      }
    }

    const crmRecord = getCrmOwnerRecord(str)
    if (crmRecord?.ownerDisplayName || crmRecord?.name) {
      return crmRecord.ownerDisplayName || crmRecord.name
    }

    const crmDisplay = getCrmOwnerDisplay(str)
    if (crmDisplay && !/^\d+$/.test(crmDisplay)) {
      return crmDisplay
    }

    if (isPureNumber) {
      if (deal.addedByName && !/^\d+$/.test(deal.addedByName)) return deal.addedByName
      if (deal.createdByName && !/^\d+$/.test(deal.createdByName)) return deal.createdByName
      if (deal.dealOwner && !/^\d+$/.test(deal.dealOwner)) return deal.dealOwner
      if (deal.ownerName && !/^\d+$/.test(deal.ownerName)) return deal.ownerName
    }

    return str
  }

  const creatorName = resolveUserName(
    deal.addedByName || deal.addedBy || deal.createdBy || deal.createdByName || deal.dealOwner || deal.ownerName,
    'User'
  )

  const reminderUpdates = (Array.isArray(reminders) ? reminders : []).map((r) => ({
    id: `rem-${r.id || r._id}`,
    title: `Reminder: ${r.title || r.message || 'Scheduled Follow-up'}`,
    content: r.message || r.content || r.note || r.title || 'Follow-up reminder scheduled.',
    createdAt: r.reminderDate || r.dueDate || r.createdAt,
    author: resolveUserName(r.ownerName || r.assignedTo || deal.dealOwner, 'User'),
    isReminder: true,
  }))

  const systemUpdates = [
    ...(deal.createdAt ? [{
      id: 'sys-created',
      title: 'Deal Created',
      content: `Deal record was created by ${creatorName}.`,
      createdAt: deal.createdAt,
      author: creatorName,
    }] : []),
    ...(deal.lastUpdated && deal.lastUpdated !== deal.createdAt ? [{
      id: 'sys-updated',
      title: 'Deal Modified',
      content: `Deal updated to status ${deal.dealStatus || deal.status || 'Updated'}.`,
      createdAt: deal.lastUpdated,
      author: resolveUserName(deal.dealOwner || deal.addedBy, 'System'),
    }] : []),
    ...reminderUpdates,
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const recentUpdatesList = useMemo(() => {
    const list = Array.isArray(remarks) ? [...remarks] : []
    const reassignText = deal.reassignDescriptions || deal.reassignDescription
    if (reassignText && typeof reassignText === 'string' && reassignText.trim()) {
      const alreadyPresent = list.some((r) => (r.content || r.remark || '') === reassignText.trim())
      if (!alreadyPresent) {
        list.unshift({
          id: `reassign-desc-${deal.id || 'deal'}`,
          title: 'Deal Reassigned',
          content: reassignText.trim(),
          createdAt: deal.updatedAt || deal.lastUpdated || deal.dealDate || deal.createdAt || new Date().toISOString(),
          author: resolveUserName(deal.dealOwner || deal.ownerName || deal.addedBy, 'Admin'),
        })
      }
    }
    return list
  }, [remarks, deal.reassignDescriptions, deal.reassignDescription, deal.id, deal.updatedAt, deal.lastUpdated, deal.dealDate, deal.createdAt, deal.dealOwner, deal.ownerName, deal.addedBy])

  const displayList = activeTab === 'recent' ? recentUpdatesList : systemUpdates

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
                    {resolveUserName(item.createdByName || item.userName || item.author, 'User')}
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
    </div>
  )
}
