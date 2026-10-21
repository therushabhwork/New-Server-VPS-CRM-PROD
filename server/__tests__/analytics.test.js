const analyticsService = require('../services/analyticsService')

describe('Analytics & Real-time Performance Service', () => {
  test('analyticsService exports all required methods', () => {
    expect(typeof analyticsService.getDashboardAnalytics).toBe('function')
    expect(typeof analyticsService.getUserDealPerformance).toBe('function')
    expect(typeof analyticsService.getAllUsersPerformanceRoster).toBe('function')
    expect(typeof analyticsService.getUserPerformanceDetails).toBe('function')
  })

  test('dashboardRoutes registers analytics and performance endpoints', () => {
    const router = require('../routes/dashboardRoutes')
    const registeredPaths = router.stack.map((layer) => layer.route?.path).filter(Boolean)

    expect(registeredPaths).toContain('/analytics')
    expect(registeredPaths).toContain('/user-deal-performance')
    expect(registeredPaths).toContain('/all-users-roster')
    expect(registeredPaths).toContain('/user-detail/:userId')
  })
})
