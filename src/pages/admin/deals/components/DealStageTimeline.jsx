import React from 'react'
import { FaArrowRight, FaClock, FaUser, FaCheckCircle } from 'react-icons/fa'
import { getDynamicPipelineStages, isQuoteRevisionStatus } from '../../../../utils/pipelineStageHelper'

const DealStageTimeline = ({ deal }) => {
  if (!deal) return null

  // Extract explicit stage history if available in deal
  const rawHistory = [
    ...(Array.isArray(deal.stageHistory) ? deal.stageHistory : []),
    ...(Array.isArray(deal.dealTimeline) ? deal.dealTimeline : []),
    ...(Array.isArray(deal.history) ? deal.history : []),
    ...(Array.isArray(deal.remarks) ? deal.remarks : []),
    ...(Array.isArray(deal.data?.remarks) ? deal.data.remarks : []),
  ]

  const historyList = rawHistory.length > 0 ? rawHistory : []

  const dealId = deal.id || deal._id || deal.dealId || ''

  const isRev =
    isQuoteRevisionStatus(deal.dealStatus) ||
    isQuoteRevisionStatus(deal.status) ||
    isQuoteRevisionStatus(deal.stage) ||
    isQuoteRevisionStatus(deal.quotationCustomerStatus)

  const currentStageKey = isRev
    ? 'quote_revision'
    : String(deal.dealStatus || deal.status || deal.stage || 'new')

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

  const stageCards = getDynamicPipelineStages({
    status: currentStageKey,
    historyList,
    assignedOwner,
    lastUpdatedTime,
    fallbackDate: deal.dealDate || deal.createdAt || lastUpdatedTime,
    recordId: dealId,
    entityType: 'deal',
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
