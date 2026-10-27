const mongoose = require('mongoose')
const XLSX = require('xlsx')
const ScheduledReport = require('../models/ScheduledReport')
const ReportDeliveryLog = require('../models/ReportDeliveryLog')
const { getMongoModel } = require('../models/mongoModels')
const User = getMongoModel('users')
const integrationService = require('./integrationService')
const reportFieldDefinitions = require('../config/reportFieldDefinitions')
const { executeReportPayload } = require('./reportEngine')

/**
 * Calculates the next run Date object for IST (Asia/Kolkata)
 * @param {string} frequency - 'daily' | 'weekly_7_days'
 * @param {string} timeStr - 'HH:mm' in 24h format
 * @param {Date} [baseDate] - reference date (defaults to now)
 */
function calculateNextRunAt(frequency = 'daily', timeStr = '18:00', baseDate = new Date()) {
  const parts = String(timeStr || '18:00').split(':')
  const hours = parseInt(parts[0], 10) || 18
  const minutes = parseInt(parts[1], 10) || 0

  // Calculate IST target time offset (+05:30 = 330 minutes)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const now = new Date(baseDate.getTime())

  if (frequency === 'weekly_7_days') {
    // 7 days from now
    const target = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    // Convert to IST representation, set hours & minutes, convert back to UTC
    const istTime = new Date(target.getTime() + IST_OFFSET_MS)
    istTime.setUTCHours(hours, minutes, 0, 0)
    return new Date(istTime.getTime() - IST_OFFSET_MS)
  }

  // Daily: Check if today's IST time has passed
  const currentIst = new Date(now.getTime() + IST_OFFSET_MS)
  const todayTargetIst = new Date(currentIst.getTime())
  todayTargetIst.setUTCHours(hours, minutes, 0, 0)

  if (todayTargetIst.getTime() > currentIst.getTime()) {
    // Run today at target time
    return new Date(todayTargetIst.getTime() - IST_OFFSET_MS)
  }

  // Otherwise, run tomorrow at target time
  const tomorrowTargetIst = new Date(todayTargetIst.getTime() + 24 * 60 * 60 * 1000)
  return new Date(tomorrowTargetIst.getTime() - IST_OFFSET_MS)
}

/**
 * Resolves Date range bounds from dateRangeType
 */
function resolveDateRange(dateRangeType = 'last_7_days', customStart = null, customEnd = null) {
  const now = new Date()
  let fromDate = null
  let toDate = new Date()

  if (dateRangeType === 'today') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  } else if (dateRangeType === 'last_7_days') {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    fromDate.setHours(0, 0, 0, 0)
  } else if (dateRangeType === 'this_month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  } else if (dateRangeType === 'previous_month') {
    fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  } else if (dateRangeType === 'custom' && customStart && customEnd) {
    fromDate = new Date(customStart)
    toDate = new Date(customEnd)
    toDate.setHours(23, 59, 59, 999)
  } else {
    // all_time
    fromDate = null
    toDate = null
  }

  return { fromDate, toDate }
}

const { generateCustomReportExcelBuffer } = require('./customReportEngine')
const salesPerformanceReportService = require('./salesPerformanceReportService')

function isPerformanceSchedule(schedule) {
  const ds = schedule?.reportConfig?.dataSource || ''
  const rName = schedule?.reportConfig?.reportName || ''
  const name = schedule?.name || ''
  return (
    ds === 'sales_performance' ||
    rName.toLowerCase().includes('sales performance') ||
    name.toLowerCase().includes('sales performance')
  )
}

function resolvePerformancePeriod(schedule) {
  const dr = schedule?.reportConfig?.dateRangeType
  const freq = schedule?.schedule?.frequency
  const name = (schedule?.name || '') + ' ' + (schedule?.reportConfig?.reportName || '')
  if (dr === 'combined' || name.toLowerCase().includes('combined')) {
    return 'combined'
  }
  if (dr === 'last_7_days' || freq === 'weekly_7_days' || name.toLowerCase().includes('7 days') || name.toLowerCase().includes('7-days')) {
    return 'last_7_days'
  }
  return 'yesterday'
}

/**
 * Compiles report data into an in-memory .xlsx buffer with all custom report columns
 */
async function generateReportExcelBuffer(scheduledReport) {
  if (isPerformanceSchedule(scheduledReport)) {
    const period = resolvePerformancePeriod(scheduledReport)
    const perfData = await salesPerformanceReportService.fetchSalesPerformanceData({
      period,
      companyId: scheduledReport.companyId,
    })
    const { buffer, fileName } = salesPerformanceReportService.generateSalesPerformanceExcelBuffer(perfData)
    return {
      buffer,
      recordCount: perfData.overallTotals?.totalOpened || 0,
      fileName,
      perfData,
    }
  }

  try {
    return await generateCustomReportExcelBuffer({ scheduledReport })
  } catch (err) {
    console.error('[ScheduledReport] Error in customReportEngine, falling back to reportEngine:', err)
    const config = scheduledReport.reportConfig || {}
    const dataSource = config.dataSource || 'deal'
    const { fromDate, toDate } = resolveDateRange(config.dateRangeType, config.customStartDate, config.customEndDate)

    const reportResult = await executeReportPayload({
      dataSource,
      selectedFields: config.selectedFields || [],
      reportType: 'detail',
      period: fromDate && toDate ? 'custom' : 'all',
      dateRange: { fromDate, toDate },
      ownerFilter: config.accountOwner || 'all',
      companyId: scheduledReport.companyId,
    })

    let rows = reportResult.rows || []
    const cleanRows = rows.map((row) => {
      const copy = { ...row }
      delete copy._ownerCode
      delete copy._ownerName
      return copy
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(cleanRows.length > 0 ? cleanRows : [{ 'Status': 'No records found for the selected criteria' }])
    const sheetName = String(config.reportName || dataSource || 'Report').substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_')
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return {
      buffer,
      recordCount: cleanRows.length,
      fileName: `${(scheduledReport.name || 'CRM_Report').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    }
  }
}

/**
 * Executes a single schedule (run now or scheduled cron trigger)
 */
async function executeSchedule(scheduleId, options = {}) {
  const executionType = options.executionType === 'manual_run_now' ? 'manual_run_now' : 'scheduled'
  let actor = options.actor || null

  const schedule = await ScheduledReport.findById(scheduleId)
  if (!schedule) {
    throw new Error('Scheduled report not found')
  }

  // Pre-Execution Guard: Only proceed if schedule is enabled (or explicit manual run now)
  if (executionType === 'scheduled' && !schedule.isEnabled) {
    console.log(`[ScheduledReport] Schedule ${scheduleId} is disabled; skipping execution.`)
    return { skipped: true, reason: 'schedule_disabled' }
  }

  // Determine user actor with Outlook capability (resolve from MongoDB users collection by email)
  if (!actor) {
    if (schedule.creatorEmail) {
      actor = await User.findOne({
        email: { $regex: new RegExp(`^${schedule.creatorEmail.trim()}$`, 'i') },
      }).lean().catch(() => null)
    }
    if (!actor && schedule.createdBy) {
      actor = await User.findOne({
        $or: [
          { _id: schedule.createdBy },
          { id: schedule.createdBy },
          { legacyId: schedule.createdBy },
        ],
      }).lean().catch(() => null)
    }
    if (!actor) {
      // Fallback to active admin user from MongoDB users collection
      actor = await User.findOne({ role: 'admin' }).lean().catch(() => null)
    }
  }

  if (!actor) {
    actor = { id: 'shared', role: 'admin', email: schedule.creatorEmail || 'admin' }
  } else {
    actor = {
      ...actor,
      id: actor.id || (actor._id ? String(actor._id) : 'shared'),
      role: actor.role || 'admin',
    }
  }

  // Fallback to organization-wide connected Outlook (shared) if actor's personal Outlook is not connected
  try {
    const outlookStatus = await integrationService.getOutlookStatus(actor)
    if (!outlookStatus || !outlookStatus.connected) {
      actor = {
        ...actor,
        id: 'shared',
        role: 'admin',
      }
    }
  } catch (_) {
    actor = {
      ...actor,
      id: 'shared',
      role: 'admin',
    }
  }

  const recipientEmail = schedule.recipient?.email || actor.email
  if (!recipientEmail) {
    throw new Error('No recipient email specified')
  }

  // Build Attachments (Both Excel and PDF)
  const reportFiles = await generateReportExcelBuffer(schedule)
  const excelBuffer = reportFiles.excelBuffer || reportFiles.buffer
  const excelFileName = reportFiles.excelFileName || reportFiles.fileName
  const pdfBuffer = reportFiles.pdfBuffer
  const pdfFileName = reportFiles.pdfFileName
  const recordCount = reportFiles.recordCount || 0
  const perfData = reportFiles.perfData

  // Re-verify enabled status and database existence right before external send (Halt Microsoft Graph if deleted or paused)
  if (executionType === 'scheduled') {
    const currentCheck = await ScheduledReport.findById(scheduleId, { isEnabled: 1, status: 1 }).lean().catch(() => null)
    if (!currentCheck || !currentCheck.isEnabled || currentCheck.status !== 'active') {
      console.log(`[ScheduledReport] Schedule ${scheduleId} was deleted or deactivated right before dispatch; halting Microsoft Graph send.`)
      return { skipped: true, reason: 'schedule_deleted_or_deactivated' }
    }
  }

  const frequencyLabel = schedule.schedule.frequency === 'weekly_7_days' ? 'Weekly (Every 7 Days)' : 'Daily'

  const now = new Date()
  const istDateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
  const istTimeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
  const runTag = Math.random().toString(36).substring(2, 7).toUpperCase()

  const emailSubject = perfData
    ? `Swati Sales CRM :- Sales Performance Report – ${perfData.periodLabel} [${istDateStr}, ${istTimeStr}]`
    : `Swati Sales CRM :- ${schedule.name} [${istDateStr}, ${istTimeStr}]`

  const emailMessage = perfData
    ? salesPerformanceReportService.generateSalesPerformanceHtmlBody(perfData, {
        istDateStr,
        istTimeStr,
        runTag,
      })
    : `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <h2 style="color: #c60016; margin-bottom: 4px;">Swati Sales CRM :- Report Delivery</h2>
      <p style="margin-top: 0; color: #666; font-size: 13px;">Frequency: <strong>${frequencyLabel}</strong> | Report: <strong>${schedule.reportConfig?.reportName || schedule.name}</strong></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
      <p>Hello,</p>
      <p>Please find attached the latest automated report <strong>${schedule.name}</strong> generated on <strong>${istDateStr} at ${istTimeStr} (IST)</strong> in both Excel (.xlsx) and PDF (.pdf) formats.</p>
      <table style="border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Data Source:</td><td style="font-weight: 600;">${schedule.reportConfig?.dataSource || 'Deal'}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Date Range:</td><td style="font-weight: 600;">${schedule.reportConfig?.dateRangeType || 'All time'}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Total Records:</td><td style="font-weight: 600; color: #c60016;">${recordCount}</td></tr>
      </table>
      <p style="font-size: 12px; color: #888; margin-top: 24px;">This is an automated delivery from your Swati CRM Automated Email Reporting Scheduler. Ref: #${runTag}</p>
    </div>`

  const attachments = []
  if (excelBuffer) {
    attachments.push({
      name: excelFileName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentBytes: excelBuffer.toString('base64'),
    })
  }
  if (pdfBuffer) {
    attachments.push({
      name: pdfFileName || `${(schedule.name || 'CRM_Report').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
      contentType: 'application/pdf',
      contentBytes: pdfBuffer.toString('base64'),
    })
  }

  const emailPayload = {
    to: recipientEmail,
    cc: (schedule.recipient?.additionalEmails || []).join(','),
    subject: emailSubject,
    message: emailMessage,
    isHtml: true,
    attachments,
  }

  let sendResult = null
  let deliveryStatus = 'sent'
  let deliveryError = null

  try {
    sendResult = await integrationService.sendOutlookEmail(actor, emailPayload)
  } catch (error) {
    deliveryStatus = 'failed'
    deliveryError = error.message || 'Outlook send failed'
    console.error(`[ScheduledReport] Error sending email for schedule ${scheduleId}:`, error)
  }

  // Calculate next run date in advance for logging
  const nextRunAt = calculateNextRunAt(
    schedule.schedule.frequency,
    schedule.schedule.time,
    new Date()
  )

  // Resolve exact Date Range bounds
  const { fromDate, toDate } = resolveDateRange(
    schedule.reportConfig?.dateRangeType,
    schedule.reportConfig?.customStartDate,
    schedule.reportConfig?.customEndDate
  )

  // Resolve attachment metadata safely (supporting both Excel and PDF)
  const primaryAttachmentName =
    excelFileName && pdfFileName
      ? `${excelFileName} + ${pdfFileName}`
      : excelFileName || pdfFileName || `${(schedule.name || 'CRM_Report').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`
  const totalAttachmentBytes =
    (excelBuffer && excelBuffer.length ? excelBuffer.length : 0) +
    (pdfBuffer && pdfBuffer.length ? pdfBuffer.length : 0)
  const attachmentSizeKB = Math.round(totalAttachmentBytes / 1024)

  // Create Delivery Log with explicit scheduled time, date range, and next run timestamp
  const log = await ReportDeliveryLog.create({
    scheduleId: schedule._id,
    scheduleName: schedule.name,
    reportType: schedule.reportConfig?.dataSource || 'deal',
    recipientEmail,
    additionalRecipients: schedule.recipient?.additionalEmails || [],
    scheduledTime: schedule.schedule?.time ? `${schedule.schedule.time} IST` : '18:00 IST',
    dateRangeType: schedule.reportConfig?.dateRangeType || 'today',
    dateRangeFrom: fromDate,
    dateRangeTo: toDate,
    nextScheduledRunAt: nextRunAt,
    recordCount,
    attachmentName: primaryAttachmentName,
    attachmentSizeKB,
    status: deliveryStatus,
    deliveryMethod: 'outlook_graph',
    errorMessage: deliveryError,
    executionType,
  })

  // Update metrics and nextRunAt
  const updateFields = {
    lastRunAt: new Date(),
    lastRunStatus: deliveryStatus === 'sent' ? 'success' : 'failed',
    lastError: deliveryError,
    $inc: {
      totalRuns: 1,
      successfulRuns: deliveryStatus === 'sent' ? 1 : 0,
      failedRuns: deliveryStatus === 'failed' ? 1 : 0,
    },
    lockedAt: null,
    lockWorkerId: null,
  }

  if (executionType === 'scheduled' && schedule.isEnabled) {
    updateFields['schedule.nextRunAt'] = nextRunAt
  }

  await ScheduledReport.findByIdAndUpdate(schedule._id, updateFields)

  return {
    success: deliveryStatus === 'sent',
    logId: log._id,
    status: deliveryStatus,
    recordCount,
    nextRunAt,
    error: deliveryError,
  }
}

module.exports = {
  calculateNextRunAt,
  resolveDateRange,
  generateReportExcelBuffer,
  executeSchedule,
}
