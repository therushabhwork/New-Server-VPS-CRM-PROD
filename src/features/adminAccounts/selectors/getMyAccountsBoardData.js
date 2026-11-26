import { getVisibleAccountStages } from '../config/accountStages'
import { isSameCrmOwner } from '../../users/crmUserDirectory'
import { getAccountsBoardData } from './getAccountsBoardData'

const normalizeCompareValue = (value) => String(value || '').trim().toLowerCase()

const buildBoardDataFromRecords = (records = []) => {
  const stages = getVisibleAccountStages()
  const countsByStage = stages.reduce((lookup, stage) => {
    lookup[stage.key] = 0
    return lookup
  }, {})

  const rowsByStage = stages.reduce((lookup, stage) => {
    lookup[stage.key] = []
    return lookup
  }, {})

  records.forEach((record) => {
    const addToStage = (targetStage) => {
      if (!countsByStage[targetStage]) {
        countsByStage[targetStage] = 0
        rowsByStage[targetStage] = []
      }
      
      if (!rowsByStage[targetStage].some(r => r.id === record.id)) {
        countsByStage[targetStage] += 1
        rowsByStage[targetStage].push(record)
      }
    }

    // Add to its primary stage
    addToStage(record.stage)

    // Also display converted, rejected, and quotation_sent records in the 'new' tab so they remain visible
    if (record.stage !== 'new') {
      addToStage('new')
    }
  })

  return {
    records,
    stages,
    countsByStage,
    rowsByStage,
    totalRecords: records.length,
  }
}

export const isOwnedByCurrentUser = (record, user) => {
  if (!user) return false

  const raw = record.raw || {}
  const rawFormData = raw.formData || {}
  const rawData = raw.data || {}

  // Match by id against creator or owner id on the record / raw.
  const userIds = [user.id, user.legacyId, user._id].map(normalizeCompareValue).filter(Boolean)
  if (userIds.length > 0) {
    const matchingIds = [
      raw.createdBy,
      raw.createdByUserId,
      raw.userId,
      raw.assignedTo,
      raw.ownerUserId,
      raw.ownerId,
      record.createdBy,
      record.createdByUserId,
      record.userId,
      record.assignedTo,
      record.ownerUserId,
      record.assignedUserId,
      record.ownerId,
      record.convertedBy,
      rawFormData.createdBy,
      rawFormData.createdByUserId,
      rawFormData.userId,
      rawFormData.assignedTo,
      rawFormData.ownerUserId,
      rawFormData.ownerId,
      rawData.createdBy,
      rawData.createdByUserId,
      rawData.userId,
      rawData.assignedTo,
      rawData.ownerUserId,
      rawData.ownerId,
    ].map(normalizeCompareValue).filter(Boolean)

    if (userIds.some((uid) => matchingIds.includes(uid))) {
      return true
    }
  }

  const userOwnerCode = normalizeCompareValue(user.ownerCode || user.accountOwnerCode || user.employeeId)
  if (userOwnerCode) {
    const matchingOwnerCodes = [
      record.ownerCode,
      record.accountOwnerCode,
      record.accountNumber,
      record.accountNo,
      raw.ownerCode,
      raw.accountOwnerCode,
      raw.accountNumber,
      raw.accountNo,
      rawFormData.ownerCode,
      rawFormData.accountOwnerCode,
      rawFormData.accountNumber,
      rawFormData.accountNo,
      rawData.ownerCode,
      rawData.accountOwnerCode,
      rawData.accountNumber,
      rawData.accountNo,
    ].map(normalizeCompareValue).filter(Boolean)

    if (matchingOwnerCodes.includes(userOwnerCode)) {
      return true
    }
  }

  // Match by creator or owner name / email using CRM-aware comparison
  const candidateCreators = [
    record.createdByUserName,
    record.createdUserBy,
    record.addedBy,
    record.addedByDisplay,
    record.accountOwner,
    record.accountOwnerName,
    record.accountOwnerDisplay,
    record.ownerName,
    record.owner,
    record.assignedUserName,
    raw.createdByUserName,
    raw.createdUserBy,
    raw.createdBy,
    raw.addedBy,
    raw.addedByDisplay,
    raw.addedByName,
    raw.accountOwner,
    raw.accountOwnerName,
    raw.accountOwnerDisplay,
    raw.ownerName,
    raw.owner,
    raw.assignedUserName,
    rawFormData.createdByUserName,
    rawFormData.createdUserBy,
    rawFormData.addedBy,
    rawFormData.accountOwner,
    rawFormData.accountOwnerName,
    rawFormData.accountOwnerDisplay,
    rawFormData.ownerName,
    rawFormData.owner,
    rawFormData.assignedUserName,
    rawData.createdByUserName,
    rawData.createdUserBy,
    rawData.accountOwner,
    rawData.accountOwnerName,
    rawData.accountOwnerDisplay,
    rawData.ownerName,
    rawData.owner,
    rawData.assignedUserName,
  ].map((v) => String(v || '').trim()).filter(Boolean)

  const userNames = [
    user.name,
    user.ownerDisplayName,
    user.username,
    user.email,
  ].map((v) => String(v || '').trim()).filter(Boolean)

  return candidateCreators.some((candidate) => (
    userNames.some((userName) => {
      const normCand = normalizeCompareValue(candidate)
      const normUser = normalizeCompareValue(userName)
      if (normCand && normCand === normUser) return true
      return isSameCrmOwner(candidate, userName)
    })
  ))
}

export const getMyAccountsBoardData = (accounts = [], user = null) => {
  const boardData = getAccountsBoardData(accounts)
  const records = boardData.records.filter((record) => isOwnedByCurrentUser(record, user))
  return buildBoardDataFromRecords(records)
}
