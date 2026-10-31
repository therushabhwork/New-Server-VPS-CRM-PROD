import React from 'react'
import { FaArrowRight, FaClock, FaUser, FaCheckCircle } from 'react-icons/fa'

const DEFAULT_ACCOUNT_STAGES = [
  { key: 'new', label: 'New', aliases: ['new'] },
  { key: 'quotation_sent', label: 'Quotation Sent', aliases: ['quote sent', 'quotation sent', 'quotationsent', 'quote_revision', 'commercial_offer', 'priority_2'] },
  { key: 'order_received', label: 'Order Received', aliases: ['order received', 'orderreceived'] },
  { key: 'convert_to_po', label: 'PO Converted', aliases: ['convert to po', 'convert_to_po', 'po converted', 'poconverted', 'converted', 'closed'] },
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
    normalized.includes('closed')
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
    normalized.includes('priority 2')
  ) {
    return 1
  }
  return 0
}

export default function AccountStageTimeline({ account, deal, form }) {
  if (!account) return null

  // 1. Dual Data Source Resolution:
  // Inspect MongoDB linked deal status if available, or account stage
  const dealStage = deal?.dealStatus || deal?.status || deal?.stage || ''
  const accountStage = form?.stage || account?.stage || account?.accountStatus || account?.status || 'new'

  const dealStageIndex = dealStage ? resolveStageIndex(dealStage) : -1
  const accountStageIndex = resolveStageIndex(accountStage)

  // Use the highest progressed index between linked deal in MongoDB and account
  const activeIndex = Math.max(0, dealStageIndex >= 0 ? Math.max(dealStageIndex, accountStageIndex) : accountStageIndex)

  // 2. Stage History resolution if present in deal or account
  const historyList = Array.isArray(deal?.stageHistory) && deal.stageHistory.length > 0
    ? deal.stageHistory
    : Array.isArray(account?.stageHistory) && account.stageHistory.length > 0
      ? account.stageHistory
      : Array.isArray(account?.statusHistory) && account.statusHistory.length > 0
        ? account.statusHistory
        : []

  const assignedOwner =
    deal?.dealOwner ||
    deal?.dealOwnerDisplay ||
    account?.accountOwner ||
    account?.assignedUserName ||
    account?.addedBy ||
    form?.accountOwner ||
    'Assigned User'

  const lastUpdatedTime =
    deal?.lastUpdated ||
    deal?.updatedAt ||
    account?.lastUpdated ||
    account?.updatedAt ||
    account?.accountDate ||
    account?.createdAt ||
    ''

  const stageCards = DEFAULT_ACCOUNT_STAGES.map((s, idx) => {
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
      : (isCurrent ? lastUpdatedTime : (account?.accountDate || account?.createdAt || lastUpdatedTime))

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
    <section className="c-account-timeline-section" aria-label="Account summary stage timeline">
      <div className="c-account-timeline-header">
        <h2 className="c-account-timeline-title">Account Summary</h2>
      </div>

      <div className="c-account-timeline-scroll-wrapper">
        <div className="c-account-timeline-chain">
          {stageCards.map((stage, idx) => (
            <React.Fragment key={stage.id || idx}>
              <div
                className={`c-account-stage-card ${stage.isCurrent ? 'c-account-stage-card--current' : ''} ${stage.isCompleted ? 'c-account-stage-card--completed' : ''}`}
              >
                <div className="c-account-stage-head-row">
                  <span className="c-account-stage-name">{stage.name}</span>
                  {stage.isCompleted && (
                    <FaCheckCircle className="c-account-stage-completed-icon" aria-label="Completed" />
                  )}
                  {stage.isCurrent && <span className="c-account-stage-current-pill">Current</span>}
                </div>

                <div className="c-account-stage-meta">
                  {stage.user ? (
                    <div className="c-account-stage-meta-item">
                      <FaUser className="c-account-stage-meta-icon" />
                      <span className="c-account-stage-meta-val">{stage.user}</span>
                    </div>
                  ) : (
                    <div className="c-account-stage-meta-item c-account-stage-meta-item--pending">
                      <span>Pending</span>
                    </div>
                  )}

                  {(stage.time || stage.date) && (
                    <div className="c-account-stage-meta-item">
                      <FaClock className="c-account-stage-meta-icon" />
                      <span className="c-account-stage-meta-val">
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
                  className={`c-account-stage-connector ${stage.isCompleted ? 'c-account-stage-connector--active' : ''}`}
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

