const express = require('express')
const { requireAuth } = require('../middleware/authMiddleware')
const { requireAdmin } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const { idParam } = require('../validation/schemas')
const controller = require('../controllers/dashboardController')

const router = express.Router()
router.use(requireAuth)
router.get('/stats', controller.getStats)
router.get('/charts', controller.getCharts)
router.get('/tabs', controller.listTabs)
router.post('/tabs', controller.createTab)
router.put('/tabs/:id', validate({ params: idParam }), controller.updateTab)
router.delete('/tabs/:id', validate({ params: idParam }), controller.deleteTab)

// Real-time Analytics & User Performance Routes (Admin Only)
router.get('/analytics', requireAdmin, controller.getDashboardAnalytics)
router.get('/user-deal-performance', requireAdmin, controller.getUserDealPerformance)
router.get('/all-users-roster', requireAdmin, controller.getAllUsersPerformanceRoster)
router.get('/user-detail/:userId', requireAdmin, controller.getUserPerformanceDetails)

module.exports = router

