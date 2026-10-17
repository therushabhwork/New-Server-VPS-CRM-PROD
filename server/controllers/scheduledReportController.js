const ScheduledReport = require('../models/ScheduledReport')
const ReportDeliveryLog = require('../models/ReportDeliveryLog')
const { calculateNextRunAt, executeSchedule } = require('../services/scheduledReportService')
const { getMongoModel } = require('../models/mongoModels')
const User = getMongoModel('users')

function formatTimeIST(timeStr) {
  if (!timeStr) return '18:00 IST'
  const parts = String(timeStr).split(':')
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  const mm = m < 10 ? `0${m}` : m
  return `${h12}:${mm} ${ampm} IST`
}

function getDateScopeLabel(dateRangeType) {
  switch (dateRangeType) {
    case 'today':
      return 'Today Only (00:00 - 23:59 IST)'
    case 'last_7_days':
      return 'Last 7 Days'
    case 'this_month':
      return 'Current Month to Date'
    case 'previous_month':
      return 'Previous Full Month'
    case 'all_time':
      return 'All Time'
    default:
      return dateRangeType || 'All Time'
  }
}

/**
 * List all scheduled reports
 * Completely decoupled from companyId; uses user email lookup in MongoDB users collection
 */
async function getSchedules(req, res) {
  try {
    const userEmail = (req.user?.email || '').trim()
    let isUserAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin'

    // Look up user in MongoDB users collection by email
    let dbUser = null
    if (userEmail) {
      dbUser = await User.findOne({
        email: { $regex: new RegExp(`^${userEmail}$`, 'i') },
      }).lean()
      if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'super_admin')) {
        isUserAdmin = true
      }
    }

    const query = {}
    // If not admin, restrict visibility to schedules created by or assigned to this user's email
    if (!isUserAdmin && userEmail) {
      query.$or = [
        { creatorEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
        { 'recipient.email': { $regex: new RegExp(`^${userEmail}$`, 'i') } },
        { 'recipient.additionalEmails': { $regex: new RegExp(`^${userEmail}$`, 'i') } },
      ]
    }

    if (req.query.status) {
      query.status = req.query.status
    }

    if (req.query.isEnabled !== undefined) {
      query.isEnabled = req.query.isEnabled === 'true'
    }

    const rawSchedules = await ScheduledReport.find(query)
      .sort({ createdAt: -1 })
      .lean()

    // Enrich with display helpers
    const schedules = rawSchedules.map((s) => ({
      ...s,
      schedule: {
        ...s.schedule,
        timeFormatted: s.schedule?.timeFormatted || formatTimeIST(s.schedule?.time),
      },
      reportConfig: {
        ...s.reportConfig,
        dateScopeLabel: s.reportConfig?.dateScopeLabel || getDateScopeLabel(s.reportConfig?.dateRangeType),
      },
    }))

    // Calculate summary statistics for KPI cards
    const totalSchedules = schedules.length
    const activeSchedules = schedules.filter((s) => s.isEnabled).length
    const inactiveSchedules = schedules.filter((s) => !s.isEnabled).length
    const totalSuccessfulRuns = schedules.reduce((sum, s) => sum + (s.successfulRuns || 0), 0)
    const totalFailedRuns = schedules.reduce((sum, s) => sum + (s.failedRuns || 0), 0)

    res.json({
      success: true,
      data: schedules,
      kpis: {
        totalSchedules,
        activeSchedules,
        inactiveSchedules,
        totalSuccessfulRuns,
        totalFailedRuns,
      },
    })
  } catch (error) {
    console.error('[ScheduledReportController] getSchedules error:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch schedules' })
  }
}

/**
 * Get single schedule by ID
 */
async function getSchedule(req, res) {
  try {
    const schedule = await ScheduledReport.findById(req.params.id)
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Scheduled report not found' })
    }
    res.json({ success: true, data: schedule })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch schedule' })
  }
}

/**
 * Create a new scheduled report
 * Resolves creator from MongoDB users collection by email; zero companyId dependency
 */
async function createSchedule(req, res) {
  try {
    const {
      name,
      reportConfig = {},
      schedule: schedulePayload = {},
      recipient: recipientPayload = {},
      isEnabled = true,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Schedule name is required' })
    }

    const userEmail = (req.user?.email || '').trim()
    let dbUser = null
    if (userEmail) {
      dbUser = await User.findOne({
        email: { $regex: new RegExp(`^${userEmail}$`, 'i') },
      }).lean()
    }

    const recipientEmail = (recipientPayload.email || userEmail || '').trim()
    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' })
    }

    const frequency = schedulePayload.frequency || 'daily'
    const time = schedulePayload.time || '18:00'
    const nextRunAt = isEnabled ? calculateNextRunAt(frequency, time, new Date()) : null
    const timeFormatted = formatTimeIST(time)
    const dateScopeLabel = getDateScopeLabel(reportConfig.dateRangeType)

    const creatorName = dbUser?.name || req.user?.name || req.user?.fullName || 'Admin'
    const creatorEmail = dbUser?.email || userEmail

    const currentUserId = dbUser?._id ?? req.user?.id ?? req.user?._id ?? null
    const newSchedule = await ScheduledReport.create({
      name: name.trim(),
      companyId: null, // Zero dependency on companyId
      createdBy: currentUserId !== null ? String(currentUserId) : null,
      creatorName,
      creatorEmail,
      reportConfig: {
        ...reportConfig,
        dateScopeLabel,
      },
      schedule: {
        frequency,
        time,
        timeFormatted,
        timezone: 'Asia/Kolkata',
        activatedAt: new Date(),
        nextRunAt,
        lastRunAt: null,
      },
      recipient: {
        type: recipientPayload.type || 'self',
        email: recipientEmail,
        additionalEmails: recipientPayload.additionalEmails || [],
      },
      isEnabled: Boolean(isEnabled),
      status: isEnabled ? 'active' : 'inactive',
    })

    res.status(201).json({ success: true, data: newSchedule })
  } catch (error) {
    console.error('[ScheduledReportController] createSchedule error:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to create schedule' })
  }
}

/**
 * Update an existing scheduled report
 */
async function updateSchedule(req, res) {
  try {
    const schedule = await ScheduledReport.findById(req.params.id)
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Scheduled report not found' })
    }

    const {
      name,
      reportConfig,
      schedule: schedulePayload,
      recipient: recipientPayload,
      isEnabled,
    } = req.body

    if (name) schedule.name = name.trim()
    if (reportConfig) {
      schedule.reportConfig = {
        ...schedule.reportConfig,
        ...reportConfig,
        dateScopeLabel: getDateScopeLabel(reportConfig.dateRangeType || schedule.reportConfig?.dateRangeType),
      }
    }

    if (recipientPayload) {
      schedule.recipient = {
        ...schedule.recipient,
        ...recipientPayload,
      }
    }

    if (schedulePayload) {
      schedule.schedule.frequency = schedulePayload.frequency || schedule.schedule.frequency
      schedule.schedule.time = schedulePayload.time || schedule.schedule.time
      schedule.schedule.timeFormatted = formatTimeIST(schedule.schedule.time)
    }

    if (isEnabled !== undefined) {
      schedule.isEnabled = Boolean(isEnabled)
      schedule.status = schedule.isEnabled ? 'active' : 'inactive'
    }

    if (schedule.isEnabled) {
      schedule.schedule.nextRunAt = calculateNextRunAt(
        schedule.schedule.frequency,
        schedule.schedule.time,
        new Date()
      )
    } else {
      schedule.schedule.nextRunAt = null
    }

    await schedule.save()
    res.json({ success: true, data: schedule })
  } catch (error) {
    console.error('[ScheduledReportController] updateSchedule error:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to update schedule' })
  }
}

/**
 * Activate a schedule
 */
async function activateSchedule(req, res) {
  try {
    const schedule = await ScheduledReport.findById(req.params.id)
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Scheduled report not found' })
    }

    const nextRunAt = calculateNextRunAt(
      schedule.schedule.frequency,
      schedule.schedule.time,
      new Date()
    )

    schedule.isEnabled = true
    schedule.status = 'active'
    schedule.schedule.activatedAt = new Date()
    schedule.schedule.nextRunAt = nextRunAt
    schedule.schedule.timeFormatted = formatTimeIST(schedule.schedule.time)
    schedule.lockedAt = null
    schedule.lockWorkerId = null

    await schedule.save()
    res.json({ success: true, message: 'Schedule activated successfully', data: schedule })
  } catch (error) {
    console.error('[ScheduledReportController] activateSchedule error:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to activate schedule' })
  }
}

/**
 * Deactivate a schedule
 */
async function deactivateSchedule(req, res) {
  try {
    const schedule = await ScheduledReport.findById(req.params.id)
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Scheduled report not found' })
    }

    schedule.isEnabled = false
    schedule.status = 'inactive'
    schedule.schedule.nextRunAt = null
    schedule.lockedAt = null
    schedule.lockWorkerId = null

    await schedule.save()
    res.json({ success: true, message: 'Schedule deactivated successfully', data: schedule })
  } catch (error) {
    console.error('[ScheduledReportController] deactivateSchedule error:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to deactivate schedule' })
  }
}

/**
 * Run schedule immediately (Manual Run Now)
 */
async function runNow(req, res) {
  try {
    const schedule = await ScheduledReport.findById(req.params.id)
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Scheduled report not found' })
    }

    const result = await executeSchedule(schedule._id, {
      executionType: 'manual_run_now',
      actor: req.user,
    })

    res.json({
      success: true,
      message: result.success ? 'Report generated and sent via Outlook' : 'Report generated but email dispatch encountered an issue',
      result,
    })
  } catch (error) {
    console.error('[ScheduledReportController] runNow error:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to execute report now' })
  }
}

/**
 * Get delivery history logs for a schedule
 */
async function getDeliveryHistory(req, res) {
  try {
    const logs = await ReportDeliveryLog.find({ scheduleId: req.params.id })
      .sort({ executedAt: -1 })
      .limit(50)
      .lean()

    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch delivery history' })
  }
}

/**
 * Delete a schedule
 */
async function deleteSchedule(req, res) {
  try {
    const schedule = await ScheduledReport.findById(req.params.id)
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Scheduled report not found' })
    }

    // Immediately disable schedule so any concurrent tick drops it, then remove from DB
    await ScheduledReport.findByIdAndUpdate(req.params.id, {
      $set: { isEnabled: false, status: 'inactive', 'schedule.nextRunAt': null, lockedAt: null },
    }).catch(() => null)

    await ScheduledReport.findByIdAndDelete(req.params.id)
    await ReportDeliveryLog.deleteMany({ scheduleId: req.params.id }).catch(() => null)

    res.json({ success: true, message: 'Schedule and delivery history deleted successfully. Automated email dispatch halted.' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete schedule' })
  }
}

module.exports = {
  getSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  activateSchedule,
  deactivateSchedule,
  runNow,
  getDeliveryHistory,
  deleteSchedule,
}
