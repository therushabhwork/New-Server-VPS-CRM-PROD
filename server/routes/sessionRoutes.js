const express = require('express')
const router = express.Router()
const sessionController = require('../controllers/sessionController')
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware')

router.post('/log-event', optionalAuth, sessionController.logEvent)

router.use(requireAuth)
router.post('/heartbeat', sessionController.heartbeat)
router.post('/continue', sessionController.continueSession)
router.post('/timeout', sessionController.timeout)
router.post('/logout', sessionController.logoutSession)

module.exports = router
