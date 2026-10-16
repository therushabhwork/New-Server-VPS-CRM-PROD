const express = require('express')
const router = express.Router()
const controller = require('../controllers/scheduledReportController')
const { requireAuth } = require('../middleware/authMiddleware')

// All routes require authenticated user
router.use(requireAuth)

router.get('/', controller.getSchedules)
router.post('/', controller.createSchedule)
router.get('/:id', controller.getSchedule)
router.put('/:id', controller.updateSchedule)
router.delete('/:id', controller.deleteSchedule)

router.patch('/:id/activate', controller.activateSchedule)
router.patch('/:id/deactivate', controller.deactivateSchedule)
router.post('/:id/run-now', controller.runNow)
router.get('/:id/history', controller.getDeliveryHistory)

module.exports = router
