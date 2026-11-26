import React from 'react'

export const formatStageTime = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export const formatStageDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export const normalizeStageString = (val) =>
  String(val || '')
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, ' ')

export const isQuoteRevisionStatus = (val) => {
  if (!val) return false
  const str = String(val).toLowerCase().trim()
  const norm = normalizeStageString(val)
  return (
    norm === 'quote revision' ||
    norm === 'quotation revision' ||
    norm === 'quote_revision' ||
    norm === 'quotation_revision' ||
    norm === 'quotationrevision' ||
    norm === 'quoterevision' ||
    norm === 'revision' ||
    norm.includes('revision') ||
    str.includes('revision')
  )
}

const findHistoryRecord = (historyList, aliases = []) => {
  if (!Array.isArray(historyList) || historyList.length === 0) return null
  return historyList.find((h) => {
    const hStage = normalizeStageString(h?.stageName || h?.stage || h?.status || h?.title || h?.type || '')
    return aliases.some((alias) => {
      const normAlias = normalizeStageString(alias)
      return normAlias && hStage.includes(normAlias)
    })
  }) || null
}

const buildStageCard = (def, idx, activeIndex, historyList, assignedOwner, lastUpdatedTime, fallbackDate) => {
  const isCompleted = idx < activeIndex
  const isCurrent = idx === activeIndex
  const hasOccurred = idx <= activeIndex

  const matchedHistory = findHistoryRecord(historyList, def.aliases)

  const stageUser = matchedHistory
    ? (matchedHistory.userName || matchedHistory.changedBy || matchedHistory.author || matchedHistory.user || matchedHistory.createdByName || assignedOwner)
    : (hasOccurred ? assignedOwner : '')

  const stageDateSource = matchedHistory
    ? (matchedHistory.timestamp || matchedHistory.date || matchedHistory.dateTime || matchedHistory.changedAt || matchedHistory.createdAt)
    : (isCurrent ? lastUpdatedTime : (fallbackDate || lastUpdatedTime))

  return {
    id: def.key,
    name: def.label,
    user: stageUser,
    time: hasOccurred && stageDateSource ? formatStageTime(stageDateSource) : '',
    date: hasOccurred && stageDateSource ? formatStageDate(stageDateSource) : '',
    isCurrent,
    isCompleted,
  }
}

// Storage key helper for remembering intermediate stages across transitions
const getCachedIntermediateStage = (recordId, entityType = 'record') => {
  if (!recordId || typeof window === 'undefined') return null
  try {
    return window.sessionStorage?.getItem(`crm_stage_cache_${entityType}_${recordId}`) || null
  } catch {
    return null
  }
}

const setCachedIntermediateStage = (recordId, stageKey, entityType = 'record') => {
  if (!recordId || !stageKey || typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem(`crm_stage_cache_${entityType}_${recordId}`, stageKey)
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

const getCachedRevisionStage = (recordId, entityType = 'record') => {
  if (!recordId || typeof window === 'undefined') return false
  try {
    return window.sessionStorage?.getItem(`crm_stage_cache_rev_${entityType}_${recordId}`) === 'true'
  } catch {
    return false
  }
}

const setCachedRevisionStage = (recordId, entityType = 'record') => {
  if (!recordId || typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem(`crm_stage_cache_rev_${entityType}_${recordId}`, 'true')
  } catch {
    // Ignore storage errors
  }
}

export const getDynamicPipelineStages = ({
  status = 'new',
  historyList = [],
  assignedOwner = 'Assigned User',
  lastUpdatedTime = '',
  fallbackDate = '',
  recordId = '',
  entityType = 'record',
}) => {
  const norm = normalizeStageString(status)

  // 1. Rejected Status: placed after New, hides Quotation Sent, Order Received, PO Converted
  if (norm.includes('reject') || norm.includes('order lost') || norm === 'lost') {
    const stageDefs = [
      { key: 'new', label: 'New', aliases: ['new', 'pending', 'created'] },
      { key: 'rejected', label: 'Rejected', aliases: ['rejected', 'reject', 'order lost', 'lost'] },
    ]
    return stageDefs.map((def, idx) =>
      buildStageCard(def, idx, 1, historyList, assignedOwner, lastUpdatedTime, fallbackDate)
    )
  }

  // 2. Not Quoted Status: placed after New, hides all remaining downstream nodes
  if (norm.includes('not quoted')) {
    const stageDefs = [
      { key: 'new', label: 'New', aliases: ['new', 'pending', 'created'] },
      { key: 'not_quoted', label: 'Not Quoted', aliases: ['not quoted', 'not_quoted'] },
    ]
    return stageDefs.map((def, idx) =>
      buildStageCard(def, idx, 1, historyList, assignedOwner, lastUpdatedTime, fallbackDate)
    )
  }

  // 3. Pre-quote Intermediate Stage detection (Priority 1, Priority 2, Commercial Offer, Technical Offer, Follow Up)
  let preQuoteStage = null
  if (norm.includes('priority 1')) {
    preQuoteStage = { key: 'priority_1', label: 'Priority 1', aliases: ['priority 1', 'priority_1'] }
    if (recordId) setCachedIntermediateStage(recordId, 'priority_1', entityType)
  } else if (norm.includes('priority 2')) {
    preQuoteStage = { key: 'priority_2', label: 'Priority 2', aliases: ['priority 2', 'priority_2'] }
    if (recordId) setCachedIntermediateStage(recordId, 'priority_2', entityType)
  } else if (norm.includes('commercial offer')) {
    preQuoteStage = { key: 'commercial_offer', label: 'Commercial Offer', aliases: ['commercial offer', 'commercial_offer'] }
    if (recordId) setCachedIntermediateStage(recordId, 'commercial_offer', entityType)
  } else if (norm.includes('technical offer')) {
    preQuoteStage = { key: 'technical_offer', label: 'Technical Offer', aliases: ['technical offer', 'technical_offer'] }
    if (recordId) setCachedIntermediateStage(recordId, 'technical_offer', entityType)
  } else if (norm.includes('follow up') || norm === 'followup') {
    preQuoteStage = { key: 'follow_up', label: 'Follow Up', aliases: ['follow up', 'follow_up', 'followup'] }
    if (recordId) setCachedIntermediateStage(recordId, 'follow_up', entityType)
  } else {
    // If current status is not an intermediate status (e.g. it is quotation_sent, quote_revision, order_received, convert_to_po),
    // check if an intermediate stage occurred in history or cached in session
    const matchedHistory = historyList.find((h) => {
      const hNorm = normalizeStageString(h?.stageName || h?.stage || h?.status || h?.title || h?.remarks || h?.content || '')
      return (
        hNorm.includes('priority 1') ||
        hNorm.includes('priority 2') ||
        hNorm.includes('commercial offer') ||
        hNorm.includes('technical offer') ||
        hNorm.includes('follow up')
      )
    })

    if (matchedHistory) {
      const hNorm = normalizeStageString(matchedHistory?.stageName || matchedHistory?.stage || matchedHistory?.status || matchedHistory?.title || matchedHistory?.remarks || matchedHistory?.content || '')
      if (hNorm.includes('priority 1')) preQuoteStage = { key: 'priority_1', label: 'Priority 1', aliases: ['priority 1', 'priority_1'] }
      else if (hNorm.includes('priority 2')) preQuoteStage = { key: 'priority_2', label: 'Priority 2', aliases: ['priority 2', 'priority_2'] }
      else if (hNorm.includes('commercial offer')) preQuoteStage = { key: 'commercial_offer', label: 'Commercial Offer', aliases: ['commercial offer', 'commercial_offer'] }
      else if (hNorm.includes('technical offer')) preQuoteStage = { key: 'technical_offer', label: 'Technical Offer', aliases: ['technical offer', 'technical_offer'] }
      else if (hNorm.includes('follow up')) preQuoteStage = { key: 'follow_up', label: 'Follow Up', aliases: ['follow up', 'follow_up'] }
    } else if (recordId) {
      // Check session cache for remembered prior intermediate status
      const cachedKey = getCachedIntermediateStage(recordId, entityType)
      if (cachedKey === 'priority_1') preQuoteStage = { key: 'priority_1', label: 'Priority 1', aliases: ['priority 1', 'priority_1'] }
      else if (cachedKey === 'priority_2') preQuoteStage = { key: 'priority_2', label: 'Priority 2', aliases: ['priority 2', 'priority_2'] }
      else if (cachedKey === 'commercial_offer') preQuoteStage = { key: 'commercial_offer', label: 'Commercial Offer', aliases: ['commercial offer', 'commercial_offer'] }
      else if (cachedKey === 'technical_offer') preQuoteStage = { key: 'technical_offer', label: 'Technical Offer', aliases: ['technical offer', 'technical_offer'] }
      else if (cachedKey === 'follow_up') preQuoteStage = { key: 'follow_up', label: 'Follow Up', aliases: ['follow up', 'follow_up'] }
    }
  }

  // 4. Quote Revision Stage detection (active, in history, or in session cache)
  const isQuoteRevisionActive = isQuoteRevisionStatus(status)
  if (isQuoteRevisionActive && recordId) {
    setCachedRevisionStage(recordId, entityType)
  }

  const hasQuoteRevisionInHistory = isQuoteRevisionActive || historyList.some((h) => {
    const hNorm = normalizeStageString(h?.stageName || h?.stage || h?.status || h?.title || h?.remarks || h?.content || '')
    return isQuoteRevisionStatus(hNorm)
  }) || (recordId ? getCachedRevisionStage(recordId, entityType) : false)

  // 5. Build dynamic ordered stage definitions
  const stageDefs = [
    { key: 'new', label: 'New', aliases: ['new', 'pending', 'created'] },
    ...(preQuoteStage ? [preQuoteStage] : []),
    { key: 'quotation_sent', label: 'Quotation Sent', aliases: ['quote sent', 'quotation sent', 'quotationsent'] },
    ...(hasQuoteRevisionInHistory ? [{
      key: 'quote_revision',
      label: 'Quote Revision',
      aliases: ['quote revision', 'quotation revision', 'quote_revision', 'quotation_revision', 'revision'],
    }] : []),
    { key: 'order_received', label: 'Order Received', aliases: ['order received', 'order_received', 'orderreceived'] },
    { key: 'convert_to_po', label: 'PO Converted', aliases: ['convert to po', 'convert_to_po', 'po converted', 'poconverted', 'converted', 'closed', 'won'] },
  ]

  // 6. Compute activeIndex in dynamic stage definitions
  // Strictly evaluate Quote Revision BEFORE generic 'quote' / 'quotation' check
  let activeIndex = 0
  if (norm.includes('po') || norm.includes('convert') || norm.includes('closed') || norm.includes('won')) {
    activeIndex = stageDefs.findIndex((s) => s.key === 'convert_to_po')
  } else if (norm.includes('order received') || norm.includes('order_received')) {
    activeIndex = stageDefs.findIndex((s) => s.key === 'order_received')
  } else if (isQuoteRevisionActive) {
    activeIndex = stageDefs.findIndex((s) => s.key === 'quote_revision')
  } else if (norm.includes('quotation') || norm.includes('quote')) {
    activeIndex = stageDefs.findIndex((s) => s.key === 'quotation_sent')
  } else if (preQuoteStage && norm.includes(normalizeStageString(preQuoteStage.label))) {
    activeIndex = stageDefs.findIndex((s) => s.key === preQuoteStage.key)
  } else {
    activeIndex = 0
  }

  if (activeIndex < 0) activeIndex = 0

  return stageDefs.map((def, idx) =>
    buildStageCard(def, idx, activeIndex, historyList, assignedOwner, lastUpdatedTime, fallbackDate)
  )
}
