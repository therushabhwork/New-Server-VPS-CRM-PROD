import React from 'react'
import { FaArrowRight, FaClock, FaUser, FaCheckCircle } from 'react-icons/fa'
import { getDynamicPipelineStages, isQuoteRevisionStatus } from '../../../../../utils/pipelineStageHelper'

export default function AccountStageTimeline({ account, deal, form }) {
  if (!account) return null

  // 1. Dual Data Source Resolution:
  // Inspect MongoDB linked deal status if available, or account stage
  const dealStage = deal?.dealStatus || deal?.status || deal?.stage || ''
  const accountStage = form?.stage || account?.stage || account?.accountStatus || account?.accountState || account?.status || 'new'

  const isRev =
    isQuoteRevisionStatus(form?.stage) ||
    isQuoteRevisionStatus(form?.status) ||
    isQuoteRevisionStatus(form?.accountStatus) ||
    isQuoteRevisionStatus(form?.accountState) ||
    isQuoteRevisionStatus(account?.stage) ||
    isQuoteRevisionStatus(account?.status) ||
    isQuoteRevisionStatus(account?.accountStatus) ||
    isQuoteRevisionStatus(account?.accountState) ||
    isQuoteRevisionStatus(account?.raw?.stage) ||
    isQuoteRevisionStatus(account?.raw?.status) ||
    isQuoteRevisionStatus(account?.raw?.accountStatus) ||
    isQuoteRevisionStatus(account?.raw?.accountState) ||
    isQuoteRevisionStatus(account?.formData?.stage) ||
    isQuoteRevisionStatus(account?.formData?.status) ||
    isQuoteRevisionStatus(account?.formData?.accountStatus) ||
    isQuoteRevisionStatus(account?.data?.stage) ||
    isQuoteRevisionStatus(account?.data?.status) ||
    isQuoteRevisionStatus(deal?.dealStatus) ||
    isQuoteRevisionStatus(deal?.status) ||
    isQuoteRevisionStatus(deal?.stage) ||
    isQuoteRevisionStatus(deal?.quotationCustomerStatus)

  // Pick specific non-default status if set on account or deal
  const effectiveStatus = isRev
    ? 'quote_revision'
    : (accountStage && accountStage !== 'new' && accountStage !== 'pending')
      ? accountStage
      : (dealStage || accountStage || 'new')

  // 2. Stage History resolution if present in deal or account
  const rawHistory = [
    ...(Array.isArray(deal?.stageHistory) ? deal.stageHistory : []),
    ...(Array.isArray(deal?.dealTimeline) ? deal.dealTimeline : []),
    ...(Array.isArray(deal?.history) ? deal.history : []),
    ...(Array.isArray(deal?.remarks) ? deal.remarks : []),
    ...(Array.isArray(account?.stageHistory) ? account.stageHistory : []),
    ...(Array.isArray(account?.statusHistory) ? account.statusHistory : []),
    ...(Array.isArray(account?.history) ? account.history : []),
    ...(Array.isArray(account?.remarks) ? account.remarks : []),
  ]

  const historyList = rawHistory.length > 0 ? rawHistory : []

  const accountId = account?.id || account?._id || account?.accountId || ''

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

  const fallbackDate = account?.accountDate || account?.createdAt || lastUpdatedTime

  const stageCards = getDynamicPipelineStages({
    status: effectiveStatus,
    historyList,
    assignedOwner,
    lastUpdatedTime,
    fallbackDate,
    recordId: accountId,
    entityType: 'account',
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

