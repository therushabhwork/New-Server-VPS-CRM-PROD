const express = require('express')
const router = express.Router()
const accountReminderService = require('../services/accountReminderService')

/**
 * Dedicated isolated routes for Account Reminders.
 */
router.post('/', async (req, res, next) => {
  try {
    const actor = req.user || { id: 1, role: 'admin', name: 'System' }
    const result = await accountReminderService.createAccountReminder(req.body, actor)
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

router.get('/account/:accountId', async (req, res, next) => {
  try {
    const results = await accountReminderService.getAccountReminders(req.params.accountId)
    res.json({ success: true, data: results })
  } catch (err) {
    next(err)
  }
})

module.exports = router

