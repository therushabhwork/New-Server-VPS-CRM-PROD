const ScheduledReport = require('../models/ScheduledReport')
const ReportDeliveryLog = require('../models/ReportDeliveryLog')
const { calculateNextRunAt, executeSchedule } = require('../services/scheduledReportService')

/**
 * List all scheduled reports
 */
async function getSchedules(req, res) {
  try {
    const query = {}
    if (req.user?.companyId) {
      query.companyId = req.user.companyId
    }

    if (req.query.status) {
      query.status = req.query.status
    }

    if (req.query.isEnabled !== undefined) {
      query.isEnabled = req.query.isEnabled === 'true'
    }

    const schedules = await ScheduledReport.find(query)
      .sort({ createdAt: -1 })
      .lean()

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
 */
async function createSchedule(req, res) {
  try {
    const {
      name,
      reportConfig,
      schedule: schedulePayload = {},
      recipient: recipientPayload = {},
      isEnabled = true,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Schedule name is required' })
    }

    const recipientEmail = recipientPayload.email || req.user?.email
    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' })
    }

    const frequency = schedulePayload.frequency || 'daily'
    const time = schedulePayload.time || '18:00'
    const nextRunAt = isEnabled ? calculateNextRunAt(frequency, time, new Date()) : null

    const currentUserId = req.user?.id ?? req.user?._id ?? req.user?.legacyId ?? null
    const newSchedule = await ScheduledReport.create({
      name: name.trim(),
      companyId: req.user?.companyId || null,
      createdBy: currentUserId !== null ? String(currentUserId) : null,
      creatorName: req.user?.name || req.user?.fullName || '',
      creatorEmail: req.user?.email || '',
      reportConfig: reportConfig || {},
      schedule: {
        frequency,
        time,
        timezone: 'Asia/Kolkata',
        activatedAt: new Date(),
        nextRunAt,
        lastRunAt: null,
      },
      recipient: {
        type: recipientPayload.type || 'self',
        email: recipientEmail.trim(),
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
    if (reportConfig) schedule.reportConfig = { ...schedule.reportConfig, ...reportConfig }

    if (recipientPayload) {
      schedule.recipient = {
        ...schedule.recipient,
        ...recipientPayload,
      }
    }

    if (schedulePayload) {
      schedule.schedule.frequency = schedulePayload.frequency || schedule.schedule.frequency
      schedule.schedule.time = schedulePayload.time || schedule.schedule.time
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
