import React, { useState, useEffect, useMemo } from 'react'
import {
  FaComments,
  FaSearch,
  FaFilter,
  FaPhoneAlt,
  FaUser,
  FaBuilding,
  FaCalendarAlt,
  FaTag,
  FaPaperPlane,
  FaClock,
  FaChevronRight,
} from 'react-icons/fa'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import { remarkApi } from '../../services/remarkApi'
import { leadApi } from '../../services/leadApi'
import { dealApi } from '../../services/dealApi'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { formatDate } from '../../utils/helpers'
import { filterCommunicationActivitiesForUser } from '../../utils/communicationActivityAccess'
import './CommunicationActivitiesPage.css'

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'call-log', label: 'Call Log' },
  { value: 'general', label: 'General' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'demo', label: 'Demo' },
]

const ENTITY_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'account', label: 'Account' },
  { value: 'deal', label: 'Deal' },
]

const groupActivitiesByDate = (items) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const groups = {
    today: [],
    older: [],
  }

  items.forEach((item) => {
    const rawDate = item.createdAt || item.remarkDate
    if (!rawDate) {
      groups.older.push(item)
      return
    }
    const d = new Date(rawDate)
    if (isNaN(d.getTime())) {
      groups.older.push(item)
      return
    }
    d.setHours(0, 0, 0, 0)
    if (d.getTime() >= today.getTime()) {
      groups.today.push(item)
    } else {
      groups.older.push(item)
    }
  })

  const result = []
  if (groups.today.length > 0) {
    result.push({ key: 'today', label: 'Today', count: groups.today.length, items: groups.today })
  }
  if (groups.older.length > 0) {
    result.push({ key: 'older', label: 'Older', count: groups.older.length, items: groups.older })
  }
  return result
}

const CommunicationActivitiesPage = ({ isAdmin = false }) => {
  const { user } = useAuth()
  const { addNotification } = useData()
  const [remarks, setRemarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedEntityType, setSelectedEntityType] = useState('all')
  const [selectedRemark, setSelectedRemark] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [threadRemarks, setThreadRemarks] = useState([])
  const [replyContent, setReplyContent] = useState('')
  const [postingReply, setPostingReply] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const loadData = async () => {
    setLoading(true)
    try {
      const allRemarks = await remarkApi.getAllRemarks()
      const [leadsData, dealsData] = await Promise.all([
        leadApi.getLeads().catch(() => []),
        dealApi.getDeals().catch(() => []),
      ])

      const leadsList = Array.isArray(leadsData) ? leadsData : Array.isArray(leadsData?.data) ? leadsData.data : []
      const dealsList = Array.isArray(dealsData) ? dealsData : Array.isArray(dealsData?.data) ? dealsData.data : []

      const leadMap = new Map(leadsList.map((l) => [String(l.id || l._id), l]))
      const dealMap = new Map(dealsList.map((d) => [String(d.id || d._id), d]))

      const enriched = (Array.isArray(allRemarks) ? allRemarks : []).map((rem) => {
        let recordOwnerName = ''
        let accountName = rem.accountName || ''
        let dealName = rem.dealName || ''
        let accountNo = rem.accountNo || ''

        if (rem.accountId && leadMap.has(String(rem.accountId))) {
          const acc = leadMap.get(String(rem.accountId))
          accountName = accountName || acc.accountName || acc.name || ''
          recordOwnerName = acc.accountOwner || acc.ownerName || ''
          accountNo = acc.accountNumber || acc.accountNo || ''
        }

        if (rem.dealId && dealMap.has(String(rem.dealId))) {
          const dl = dealMap.get(String(rem.dealId))
          dealName = dealName || dl.dealName || dl.name || ''
          recordOwnerName = recordOwnerName || dl.dealOwner || dl.ownerName || ''
        }

        return {
          ...rem,
          accountName,
          dealName,
          recordOwnerName,
          accountNo,
        }
      })

      setRemarks(filterCommunicationActivitiesForUser(enriched, user, {
        allowAll: false,
      }))
    } catch (err) {
      console.error('Failed to load communication activities:', err)
      addNotification('error', 'Error Loading Data', 'Failed to load communication activities.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategory, selectedEntityType])

  const filteredRemarks = useMemo(() => {
    const list = remarks.filter((rem) => {
      const matchesCategory = selectedCategory === 'all' || rem.category === selectedCategory
      const matchesEntity = selectedEntityType === 'all' || rem.relatedEntityType === selectedEntityType
      const targetText = `${rem.content || ''} ${rem.accountName || ''} ${rem.dealName || ''} ${rem.recordOwnerName || ''} ${rem.createdByName || ''}`.toLowerCase()
      const matchesSearch = !searchTerm || targetText.includes(searchTerm.toLowerCase())
      return matchesCategory && matchesEntity && matchesSearch
    })

    // Sort strictly LIFO (newest record first)
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.remarkDate || 0).getTime()
      const timeB = new Date(b.createdAt || b.remarkDate || 0).getTime()
      if (timeA !== timeB) return timeB - timeA
      return (b.id || b._id || 0) > (a.id || a._id || 0) ? 1 : -1
    })
  }, [remarks, selectedCategory, selectedEntityType, searchTerm])

  const totalPages = Math.ceil(filteredRemarks.length / pageSize) || 1

  const paginatedRemarks = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRemarks.slice(start, start + pageSize)
  }, [filteredRemarks, currentPage, pageSize])

  const groupedActivities = useMemo(() => {
    return groupActivitiesByDate(paginatedRemarks)
  }, [paginatedRemarks])

  const handleRowClick = (remark) => {
    setSelectedRemark(remark)
    const thread = remarks.filter((r) => {
      if (remark.dealId) return String(r.dealId) === String(remark.dealId)
      if (remark.accountId) return String(r.accountId) === String(remark.accountId)
      return false
    }).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))

    setThreadRemarks(thread)
    setIsDetailModalOpen(true)
  }

  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyContent.trim() || !selectedRemark) return

    setPostingReply(true)
    try {
      const payload = {
        accountId: selectedRemark.accountId || null,
        dealId: selectedRemark.dealId || null,
        relatedEntityId: String(selectedRemark.dealId || selectedRemark.accountId || ''),
        relatedEntityType: selectedRemark.relatedEntityType || (selectedRemark.dealId ? 'deal' : 'account'),
        category: selectedRemark.category || 'general',
        content: replyContent.trim(),
        createdBy: user?.id || null,
        createdByName: user?.name || user?.username || 'User',
      }

      const created = await remarkApi.createRemark(payload)
      const newEntry = {
        ...created,
        accountName: selectedRemark.accountName,
        dealName: selectedRemark.dealName,
        recordOwnerName: selectedRemark.recordOwnerName,
      }

      setRemarks((prev) => [newEntry, ...prev])
      setThreadRemarks((prev) => [...prev, newEntry])
      setReplyContent('')
      addNotification('success', 'Reply Added', 'Reply posted successfully.')
    } catch (err) {
      console.error('Failed to post reply:', err)
      addNotification('error', 'Error Posting Reply', 'Unable to send reply.')
    } finally {
      setPostingReply(false)
    }
  }

  return (
    <div className="comm-activities-page">
      <div className="comm-activities-shell">
        {/* Page Header */}
        <div className="comm-activities-header">
          <div className="comm-activities-header-left">
            <div className="comm-activities-title-icon-wrap">
              <FaComments />
            </div>
            <div>
              <h1 className="comm-activities-title">Communication Activities</h1>
              <p className="comm-activities-subtitle">
                Track and monitor all client remarks, calls, logs, feedback, and discussion threads across accounts and deals.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="comm-activities-toolbar">
          <div className="comm-activities-search-wrap">
            <FaSearch className="comm-activities-search-icon" />
            <input
              type="text"
              placeholder="Search activities, names, content, or owners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="comm-activities-search-input"
            />
          </div>

          <div className="comm-activities-filters-right">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="comm-activities-select"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="comm-activities-select"
            >
              {ENTITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Activity Cards Section */}
        <div className="comm-activities-list-card">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading communication activities...</div>
          ) : filteredRemarks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontWeight: 500 }}>No communication activities found</div>
          ) : (
            <>
              <div className="comm-activities-groups-wrap">
                {groupedActivities.map((group) => (
                  <section key={group.key} className="comm-date-group-section">
                    <div className="comm-date-group-header">
                      <div className="comm-date-group-title">
                        <FaCalendarAlt className="comm-date-group-icon" />
                        <span>{group.label}</span>
                      </div>
                      <span className="comm-date-group-badge">
                        {group.count} {group.count === 1 ? 'Activity' : 'Activities'}
                      </span>
                    </div>

                    <div className="comm-activities-cards-list">
                      {group.items.map((rem, idx) => {
                        const isCallLog = rem.category === 'call-log'
                        const isDeal = rem.relatedEntityType === 'deal' || Boolean(rem.dealId)
                        const recordName = rem.dealName || rem.accountName || 'Record'
                        const ownerName = rem.recordOwnerName || rem.accountOwnerName || rem.dealOwnerName || 'Owner'
                        const authorName = rem.createdByName || rem.authorName || 'User'
                        const dateFormatted = rem.remarkDate ? formatDate(rem.remarkDate, 'long') : (rem.createdAt ? formatDate(rem.createdAt, 'long') : '-')
                        const timeSlot = rem.startTime || rem.endTime || rem.callLogTime

                        return (
                          <div
                            key={rem.id || rem._id || `${group.key}-${idx}`}
                            className="comm-activity-row-card"
                            onClick={() => handleRowClick(rem)}
                          >
                            {/* Left Circular Activity Icon */}
                            <div className={`comm-activity-icon-bubble ${isCallLog ? 'comm-activity-icon-bubble--call' : 'comm-activity-icon-bubble--general'}`}>
                              {isCallLog ? <FaPhoneAlt /> : <FaComments />}
                            </div>

                            {/* Middle Details */}
                            <div className="comm-activity-main-info">
                              <div className="comm-activity-top-line">
                                <span className="comm-activity-name">{recordName}</span>
                                <span className={`comm-activity-type-tag comm-activity-type-tag--${isDeal ? 'deal' : 'account'}`}>
                                  {isDeal ? 'Deal' : 'Account'}
                                </span>
                              </div>
                              <div className="comm-activity-remark-text">
                                {rem.content || rem.remark || rem.note || '-'}
                              </div>
                              <div className="comm-activity-attribution">
                                <span className="comm-activity-owner">{ownerName}</span>
                                <span className="comm-activity-arrow-sep">→</span>
                                <span className="comm-activity-author">{authorName}</span>
                              </div>
                            </div>

                            {/* Right Metadata */}
                            <div className="comm-activity-side-meta">
                              <div className="comm-activity-side-top">
                                <span className={`comm-activity-category-tag comm-activity-category-tag--${rem.category || 'general'}`}>
                                  {isCallLog ? 'Call-Log' : (rem.category ? rem.category.charAt(0).toUpperCase() + rem.category.slice(1) : 'General')}
                                </span>
                                <FaChevronRight className="comm-activity-chevron" />
                              </div>

                              <div className="comm-activity-side-bottom">
                                {isCallLog && timeSlot ? (
                                  <span className="comm-activity-time-slot">
                                    <FaClock style={{ fontSize: '0.72rem', marginRight: '4px' }} />
                                    {rem.startTime || rem.callLogTime || '09:00'} – {rem.endTime || '09:30'}
                                  </span>
                                ) : null}
                                <span className="comm-activity-date-text">
                                  {dateFormatted}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {/* Pagination Controls */}
              <div className="comm-activities-pagination">
                <div className="comm-activities-pagination-info">
                  Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredRemarks.length)}</strong> to <strong>{Math.min(currentPage * pageSize, filteredRemarks.length)}</strong> of <strong>{filteredRemarks.length}</strong> records
                </div>

                <div className="comm-activities-pagination-btns">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="comm-pagination-btn comm-pagination-btn--nav"
                  >
                    First
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`comm-pagination-btn ${pageNum === currentPage ? 'comm-pagination-btn--active' : ''}`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="comm-pagination-btn comm-pagination-btn--nav"
                  >
                    Last
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row Click Detail & Chat Replies Modal */}
      {selectedRemark && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Communication Detail - ${selectedRemark.dealName || selectedRemark.accountName || 'Record'}`}
          size="large"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
            {/* Top Section: Account Details as Clean Normal Text (No Background Container, No Rounded Border) */}
            <div style={{ padding: '4px 0 16px 0', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                {selectedRemark.relatedEntityType === 'deal' ? 'Deal Details' : 'Account Details'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 24px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Account Name: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRemark.dealName || selectedRemark.accountName || '-'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Record Owner: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRemark.recordOwnerName || selectedRemark.dealOwnerName || selectedRemark.accountOwnerName || selectedRemark.ownerName || '-'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Account No: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRemark.accountNo || selectedRemark.accountId || selectedRemark.id || '-'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Created By: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRemark.createdByName || 'User'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Created Date: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRemark.createdAt ? formatDate(selectedRemark.createdAt) : '-'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Category: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRemark.category || 'general'}</span>
                </div>
              </div>
            </div>

            {/* Bottom Section: Chat Replies & Discussion Thread */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#1e293b' }}>
                <FaComments style={{ color: '#2563eb' }} /> Remarks & Chat Discussion Replies ({threadRemarks.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', maxHeight: '300px', overflowY: 'auto', paddingRight: '6px' }}>
                {threadRemarks.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      background: item.id === selectedRemark.id ? '#eff6ff' : '#f8fafc',
                      border: item.id === selectedRemark.id ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaUser style={{ color: '#740a03', fontSize: '12px' }} />
                        {item.createdByName || 'Keval V Shah'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                        {item.createdAt ? formatDate(item.createdAt, 'long') : 'Sep 29, 2026'}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: '1.5', whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                      {item.content}
                    </div>
                    {item.category === 'call-log' && (item.startTime || item.endTime || item.callLogTime) && (
                      <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '8px', fontWeight: 600 }}>
                        Call Duration: {item.startTime || item.callLogTime || '09:00'} - {item.endTime || '09:30'}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Chat Reply Form */}
              <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Type a reply regarding this remark..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  disabled={postingReply}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={postingReply || !replyContent.trim()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: postingReply || !replyContent.trim() ? '#94a3b8' : '#740a03',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: postingReply || !replyContent.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <FaPaperPlane /> {postingReply ? 'Sending...' : 'Reply'}
                </button>
              </form>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default CommunicationActivitiesPage
