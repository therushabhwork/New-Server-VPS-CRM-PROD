import { normalizeAccountRecord } from '../adapters/normalizeAccountRecord'
import { getVisibleAccountStages } from '../config/accountStages'

const parseAnyDateToEpoch = (val) => {
  if (!val || val === '-' || val === 'undefined' || val === 'null') return 0
  if (val instanceof Date) return isNaN(val.getTime()) ? 0 : val.getTime()
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const s = String(val).trim()
  if (!s) return 0

  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (dmy) {
    const d = parseInt(dmy[1], 10)
    const m = parseInt(dmy[2], 10) - 1
    const y = parseInt(dmy[3], 10)
    const dt = new Date(y, m, d, 0, 0, 0, 0)
    return isNaN(dt.getTime()) ? 0 : dt.getTime()
  }

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) {
    const y = parseInt(iso[1], 10)
    const m = parseInt(iso[2], 10) - 1
    const d = parseInt(iso[3], 10)
    const dt = new Date(y, m, d, 0, 0, 0, 0)
    return isNaN(dt.getTime()) ? 0 : dt.getTime()
  }

  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const getRecordObjectIdTime = (record = {}) => {
  const rawId = String(record.id || record._id || record.raw?.id || record.raw?._id || '')
  if (/^[0-9a-fA-F]{24}$/.test(rawId)) {
    const epochSec = parseInt(rawId.substring(0, 8), 16)
    if (!isNaN(epochSec) && epochSec > 0) {
      return epochSec * 1000
    }
  }
  return 0
}

const resolveRecordDateValue = (rec = {}) => {
  const candidates = [
    rec.accountDate,
    rec.addedDate,
    rec.date,
    rec.raw?.accountDate,
    rec.raw?.addedDate,
    rec.raw?.date,
    rec.formData?.accountDate,
    rec.formData?.addedDate,
    rec.formData?.['Account Date'],
    rec.formData?.['Added Date'],
    rec.raw?.formData?.accountDate,
    rec.raw?.formData?.addedDate,
    rec.raw?.formData?.['Account Date'],
    rec.raw?.formData?.['Added Date'],
    rec.data?.accountDate,
    rec.data?.addedDate,
    rec.dealDate,
    rec.raw?.dealDate,
    rec.createdAt,
    rec.raw?.createdAt,
  ]
  for (const v of candidates) {
    if (v !== undefined && v !== null && v !== '' && v !== '-' && v !== 'undefined' && v !== 'null') {
      return v
    }
  }
  return ''
}

export const compareAccountsByNumberAsc = (left = {}, right = {}) => {
  const dateA = parseAnyDateToEpoch(resolveRecordDateValue(left))
  const dateB = parseAnyDateToEpoch(resolveRecordDateValue(right))
  if (dateA !== dateB) return dateB - dateA

  const timeA = parseAnyDateToEpoch(left.updatedAt) || parseAnyDateToEpoch(left.createdAt) || getRecordObjectIdTime(left)
  const timeB = parseAnyDateToEpoch(right.updatedAt) || parseAnyDateToEpoch(right.createdAt) || getRecordObjectIdTime(right)
  if (timeA !== timeB) return timeB - timeA

  const objTimeA = getRecordObjectIdTime(left)
  const objTimeB = getRecordObjectIdTime(right)
  if (objTimeA !== objTimeB && objTimeA > 0 && objTimeB > 0) return objTimeB - objTimeA

  const leftNumber = Number(resolveAccountOwnerSeriesNumber(left) || 0)
  const rightNumber = Number(resolveAccountOwnerSeriesNumber(right) || 0)

  if (leftNumber !== rightNumber && leftNumber > 0 && rightNumber > 0) {
    return rightNumber - leftNumber
  }

  const leftId = Number(left.id) || 0
  const rightId = Number(right.id) || 0
  if (leftId !== rightId && leftId > 0 && rightId > 0) {
    return rightId - leftId
  }

  return String(right.name || '').localeCompare(String(left.name || ''))
}

const resolveAccountOwnerSeriesNumber = (record = {}) => {
  const ownerCode = record.accountOwnerCode
    || record.raw?.accountOwnerCode
    || record.raw?.formData?.accountOwnerCode
    || record.raw?.formData?.ownerCode
    || record.ownerCode
    || record.raw?.ownerCode

  return String(ownerCode || '').trim()
}

const resolveStoredAccountNumber = (record = {}, index = 0) => {
  const ownerCode = record.accountOwnerCode
    || record.raw?.accountOwnerCode
    || record.raw?.formData?.accountOwnerCode
    || record.raw?.formData?.ownerCode

  if (ownerCode) {
    return String(ownerCode).trim()
  }

  const storedValue = record.originalAccountNumber
    || record.accountNumber
    || record.accountNo
    || record.account_no
    || record.raw?.accountNumber
    || record.raw?.accountNo
    || record.raw?.account_no

  if (storedValue) {
    return String(storedValue)
  }

  const ownerSeriesNumber = resolveAccountOwnerSeriesNumber(record)
  return String(ownerSeriesNumber || 1001 + index)
}

export const getAccountsBoardData = (accounts = []) => {
  const records = accounts
    .map((account, index) => normalizeAccountRecord(account, index, { recordSource: 'live' }))
    .filter(Boolean)
    .map((record, index) => ({
      ...record,
      originalAccountNumber: record.originalAccountNumber || record.accountNumber,
      accountNumber: resolveStoredAccountNumber(record, index),
    }))
    .sort((left, right) => {
      const dateA = parseAnyDateToEpoch(resolveRecordDateValue(left))
      const dateB = parseAnyDateToEpoch(resolveRecordDateValue(right))
      if (dateA !== dateB) return dateB - dateA

      const timeA = parseAnyDateToEpoch(left.updatedAt) || parseAnyDateToEpoch(left.createdAt) || getRecordObjectIdTime(left)
      const timeB = parseAnyDateToEpoch(right.updatedAt) || parseAnyDateToEpoch(right.createdAt) || getRecordObjectIdTime(right)
      if (timeA !== timeB) return timeB - timeA

      const objTimeA = getRecordObjectIdTime(left)
      const objTimeB = getRecordObjectIdTime(right)
      if (objTimeA !== objTimeB && objTimeA > 0 && objTimeB > 0) return objTimeB - objTimeA

      const leftId = Number(left.id) || 0
      const rightId = Number(right.id) || 0
      if (leftId !== rightId && leftId > 0 && rightId > 0) return rightId - leftId

      return String(right.name || '').localeCompare(String(left.name || ''))
    })

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
