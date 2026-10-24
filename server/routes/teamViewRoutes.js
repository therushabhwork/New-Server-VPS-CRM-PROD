const express = require('express')
const router = express.Router()
const teamViewController = require('../controllers/teamViewController')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireAdmin } = require('../middleware/roleMiddleware')

// Admin only access
router.use(requireAuth)
router.use(requireAdmin)

router.get('/sessions', teamViewController.getTeamViewSessions)
router.get('/attendance-summary', teamViewController.getTeamViewAttendanceSummary)
router.post('/sessions/:sessionId/revoke', teamViewController.revokeSession)

module.exports = router
