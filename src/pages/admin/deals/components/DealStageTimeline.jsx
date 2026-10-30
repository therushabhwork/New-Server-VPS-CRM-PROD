import React from 'react'
import { FaArrowRight, FaClock, FaUser, FaCheckCircle } from 'react-icons/fa'

const DEFAULT_STAGES = [
  { key: 'new', label: 'New', aliases: ['new', 'pending', 'created'] },
  { key: 'quotation_sent', label: 'Quotation Sent', aliases: ['quote sent', 'quotation sent', 'quotationsent', 'quote_revision', 'quotation revision', 'quotation_revision', 'commercial_offer', 'commercial offer', 'technical_offer', 'technical offer', 'priority_1', 'priority 1', 'priority_2', 'priority 2', 'follow_up', 'follow up', 'followup'] },
  { key: 'order_received', label: 'Order Received', aliases: ['order received', 'order_received', 'orderreceived'] },
  { key: 'convert_to_po', label: 'PO Converted', aliases: ['convert to po', 'convert_to_po', 'po converted', 'poconverted', 'converted', 'closed', 'won'] },
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

const normalizeStageString = (val) => String(val || '').toLowerCase().trim().replace(/[-_]/g, ' ')

const resolveStageIndex = (stageStr) => {
  const normalized = normalizeStageString(stageStr)
  if (!normalized) return 0

  if (
    normalized.includes('po') ||
    normalized.includes('convert') ||
    normalized.includes('closed') ||
    normalized.includes('won')
  ) {
    return 3
  }
  if (normalized.includes('order received') || normalized.includes('order_received')) {
    return 2
  }
  if (
    normalized.includes('quotation') ||
    normalized.includes('quote') ||
    normalized.includes('commercial offer') ||
    normalized.includes('technical offer') ||
    normalized.includes('priority') ||
    normalized.includes('follow')
  ) {
    return 1
  }
  return 0
}

const DealStageTimeline = ({ deal }) => {
  if (!deal) return null

  // Extract explicit stage history if available in deal
  const historyList = Array.isArray(deal.stageHistory) && deal.stageHistory.length > 0
    ? deal.stageHistory
    : Array.isArray(deal.history) && deal.history.length > 0
      ? deal.history.filter((h) => h?.stage || h?.status || h?.type === 'stage_change')
      : []

  const currentStageKey = String(deal.dealStatus || deal.status || deal.stage || 'new').toLowerCase().trim()
  const activeIndex = resolveStageIndex(currentStageKey)

  const assignedOwner =
    deal.dealOwner ||
    deal.dealOwnerDisplay ||
    deal.assignedUserName ||
    deal.addedBy ||
    deal.ownerName ||
    'Assigned User'

  const lastUpdatedTime =
    deal.lastUpdated ||
    deal.updatedAt ||
    deal.dealDate ||
    deal.createdAt ||
    ''

  // Generate canonical 4-stage progression, harmonizing history records when present
  const stageCards = DEFAULT_STAGES.map((s, idx) => {
    const isCompleted = idx < activeIndex
    const isCurrent = idx === activeIndex
    const hasOccurred = idx <= activeIndex

    // Check if there is a matching history record for this stage
    const matchedHistory = historyList.find((h) => {
      const hStage = normalizeStageString(h?.stageName || h?.stage || h?.status)
      return s.aliases.some((alias) => normalizeStageString(alias) === hStage)
    })

    const stageUser = matchedHistory
      ? (matchedHistory.userName || matchedHistory.changedBy || matchedHistory.user || assignedOwner)
      : (hasOccurred ? assignedOwner : '')

    const stageDateSource = matchedHistory
      ? (matchedHistory.timestamp || matchedHistory.date || matchedHistory.createdAt)
      : (isCurrent ? lastUpdatedTime : (deal.dealDate || deal.createdAt || lastUpdatedTime))

    return {
      id: s.key,
      name: s.label,
      user: stageUser,
      time: hasOccurred && stageDateSource ? formatStageTime(stageDateSource) : '',
      date: hasOccurred && stageDateSource ? formatStageDate(stageDateSource) : '',
      isCurrent,
      isCompleted,
    }
  })

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
                <div className="c-deal-stage-head-row">
                  <span className="c-deal-stage-name">{stage.name}</span>
                  {stage.isCompleted && (
                    <FaCheckCircle className="c-deal-stage-completed-icon" aria-label="Completed" />
                  )}
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
                <div
                  className={`c-deal-stage-connector ${stage.isCompleted ? 'c-deal-stage-connector--active' : ''}`}
                  aria-hidden="true"
                >
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
