import React from 'react'
import { FaArrowRight, FaClock, FaUser } from 'react-icons/fa'

const DEFAULT_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'quotation_sent', label: 'Quotation Sent' },
  { key: 'order_received', label: 'Order Received' },
  { key: 'convert_to_po', label: 'PO Converted' },
]

const formatStageTime = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const formatStageDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

const DealStageTimeline = ({ deal }) => {
  if (!deal) return null

  // Extract explicit stage history if available in deal
  const historyList = Array.isArray(deal.stageHistory)
    ? deal.stageHistory
    : Array.isArray(deal.history)
      ? deal.history.filter((h) => h?.stage || h?.status || h?.type === 'stage_change')
      : []

  const currentStageKey = String(deal.dealStatus || deal.status || deal.stage || 'new').toLowerCase()

  // Determine stage cards to render
  let stageCards = []

  if (historyList.length > 0) {
    stageCards = historyList.map((item, idx) => ({
      id: item.id || `stage-${idx}`,
      name: item.stageName || item.stage || item.status || 'Stage',
      user: item.userName || item.changedBy || item.addedBy || deal.dealOwner || 'User',
      time: formatStageTime(item.timestamp || item.date || item.createdAt),
      date: formatStageDate(item.timestamp || item.date || item.createdAt),
      isCurrent: idx === historyList.length - 1,
      isCompleted: true,
    }))
  } else {
    // Generate canonical progression based on current deal status
    const stageIndex = DEFAULT_STAGES.findIndex((s) => s.key === currentStageKey || s.label.toLowerCase() === currentStageKey)
    const activeIndex = stageIndex >= 0 ? stageIndex : 0

    stageCards = DEFAULT_STAGES.map((s, idx) => {
      const isCompleted = idx < activeIndex
      const isCurrent = idx === activeIndex
      const hasOccurred = idx <= activeIndex

      return {
        id: s.key,
        name: s.label,
        user: hasOccurred ? (deal.dealOwner || deal.addedBy || 'Assigned User') : '',
        time: hasOccurred ? formatStageTime(deal.lastUpdated || deal.dealDate) : '',
        date: hasOccurred ? formatStageDate(deal.dealDate || deal.lastUpdated) : '',
        isCurrent,
        isCompleted,
      }
    })
  }

  return (
    <section className="c-deal-timeline-section" aria-label="Deal summary stage timeline">
      <div className="c-deal-timeline-header">
        <h2 className="c-deal-timeline-title">Deal Summary</h2>
      </div>

      <div className="c-deal-timeline-scroll-wrapper">
        <div className="c-deal-timeline-chain">
          {stageCards.map((stage, idx) => (
            <React.Fragment key={stage.id || idx}>
              <div
                className={`c-deal-stage-card ${stage.isCurrent ? 'c-deal-stage-card--current' : ''} ${stage.isCompleted ? 'c-deal-stage-card--completed' : ''}`}
              >
                <div className="c-deal-stage-badge-row">
                  <span className="c-deal-stage-name">{stage.name}</span>
                  {stage.isCurrent && <span className="c-deal-stage-status-indicator">Current</span>}
                </div>

                <div className="c-deal-stage-meta">
                  {stage.user ? (
                    <div className="c-deal-stage-meta-item">
                      <FaUser className="c-deal-stage-meta-icon" />
                      <span className="c-deal-stage-meta-val">{stage.user}</span>
                    </div>
                  ) : (
                    <div className="c-deal-stage-meta-item c-deal-stage-meta-item--pending">
                      <span>Pending</span>
                    </div>
                  )}

                  {(stage.time || stage.date) && (
                    <div className="c-deal-stage-meta-item">
                      <FaClock className="c-deal-stage-meta-icon" />
                      <span className="c-deal-stage-meta-val">
                        {stage.time ? stage.time : ''}
                        {stage.time && stage.date ? ' • ' : ''}
                        {stage.date ? stage.date : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {idx < stageCards.length - 1 && (
                <div className="c-deal-stage-connector" aria-hidden="true">
                  <FaArrowRight />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

export default React.memo(DealStageTimeline)
