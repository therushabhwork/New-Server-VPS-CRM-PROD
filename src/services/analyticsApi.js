import apiClient from './apiClient'

export const analyticsApi = {
  getDashboardAnalytics: async (params = {}) => {
    const res = await apiClient.get('/dashboard/analytics', { params })
    return res.data?.data || res.data
  },

  getUserDealPerformance: async (params = {}) => {
    const res = await apiClient.get('/dashboard/user-deal-performance', { params })
    return res.data?.data || res.data || []
  },

  getAllUsersPerformanceRoster: async (params = {}) => {
    const res = await apiClient.get('/dashboard/all-users-roster', { params })
    return res.data?.data || res.data
  },

  getUserPerformanceDetails: async (userId) => {
    const res = await apiClient.get(`/dashboard/user-detail/${userId}`)
    return res.data?.data || res.data
  },
}
