const cron = require('node-cron')
const ScheduledReport = require('../models/ScheduledReport')
const { executeSchedule } = require('../services/scheduledReportService')

let isTickRunning = false

function init() {
  console.log('[ReportScheduler] Initializing background email report scheduler job...')

  // Run every minute: '*/1 * * * *'
  cron.schedule('*/1 * * * *', async () => {
    if (isTickRunning) {
      return
    }

    isTickRunning = true
    const now = new Date()

    try {
      // Find all enabled, active schedules that are due for execution
      const dueSchedules = await ScheduledReport.find({
        isEnabled: true,
        status: 'active',
        'schedule.nextRunAt': { $lte: now },
        $or: [
          { lockedAt: null },
          // Release stale locks older than 10 minutes
          { lockedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } },
        ],
      }).limit(5)

      for (const schedule of dueSchedules) {
        // Atomic lock acquisition
        const locked = await ScheduledReport.findOneAndUpdate(
          {
            _id: schedule._id,
            isEnabled: true,
            $or: [
              { lockedAt: null },
              { lockedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } },
            ],
          },
          {
            $set: {
              lockedAt: new Date(),
              lockWorkerId: `worker-${process.pid}`,
            },
          },
          { new: true }
        )

        if (!locked) {
          // Already claimed by another worker
          continue
        }

        console.log(`[ReportScheduler] Triggering scheduled execution for "${schedule.name}" (${schedule._id})...`)
        try {
          await executeSchedule(schedule._id, { executionType: 'scheduled' })
          console.log(`[ReportScheduler] Completed execution for "${schedule.name}".`)
        } catch (execErr) {
          console.error(`[ReportScheduler] Execution failed for schedule ${schedule._id}:`, execErr)
          await ScheduledReport.findByIdAndUpdate(schedule._id, {
            $set: {
              lockedAt: null,
              lastRunStatus: 'failed',
              lastError: execErr.message || 'Execution failed',
            },
            $inc: { failedRuns: 1, totalRuns: 1 },
          })
        }
      }
    } catch (tickErr) {
      console.error('[ReportScheduler] Error in scheduler tick:', tickErr)
    } finally {
      isTickRunning = false
    }
  })

  console.log('[ReportScheduler] Background email report scheduler initialized.')
}

module.exports = {
  init,
}
