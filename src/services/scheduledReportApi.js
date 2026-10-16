import apiClient from './apiClient'
import { reportApi } from './reportApi'

export const SYSTEM_DEFAULT_REPORTS = [
  {
    id: 'sys-account-report',
    reportName: 'Account Report',
    sourceType: 'system_report',
    dataSource: 'account',
    description: 'All accounts / leads with owners, stages, and contact info',
    selectedFields: ['accountNo', 'accountName', 'stage', 'status', 'accountOwner', 'addedOn'],
    dateRangeType: 'last_7_days',
    accountOwner: 'all',
  },
  {
    id: 'sys-deal-report',
    reportName: 'Deal Report',
    sourceType: 'system_report',
    dataSource: 'deal',
    description: 'Executive deal pipeline with status, deal value, and owners',
    selectedFields: ['dealNo', 'dealName', 'dealValue', 'dealStatus', 'dealOwner', 'addedOn'],
    dateRangeType: 'last_7_days',
    accountOwner: 'all',
  },
  {
    id: 'sys-customer-daily-status',
    reportName: 'Customer Daily Status',
    sourceType: 'system_report',
    dataSource: 'customer',
    description: 'Daily customer status snapshot and engagement metrics',
    selectedFields: ['customerNo', 'customerName', 'companyName', 'phone', 'city', 'createdAt'],
    dateRangeType: 'today',
    accountOwner: 'all',
  },
  {
    id: 'sys-remark-update',
    reportName: 'Remark Update',
    sourceType: 'system_report',
    dataSource: 'account',
    description: 'Latest communication logs, call remarks, and follow-ups',
    selectedFields: ['accountName', 'remark', 'lastContacted', 'nextFollowUp', 'accountOwner'],
    dateRangeType: 'last_7_days',
    accountOwner: 'all',
  },
]

export const scheduledReportApi = {
  getSchedules: async (params = {}) => {
    try {
      const response = await apiClient.get('/scheduled-reports', { params })
      const body = response?.data ?? response
      return {
        schedules: Array.isArray(body?.data) ? body.data : [],
        kpis: body?.kpis || {},
      }
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error)
      return { schedules: [], kpis: {} }
    }
  },

  getSchedule: async (id) => {
    try {
      const response = await apiClient.get(`/scheduled-reports/${encodeURIComponent(id)}`)
      const body = response?.data ?? response
      return body?.data || null
    } catch (error) {
      console.error('Failed to fetch schedule details:', error)
      return null
    }
  },

  createSchedule: async (payload) => {
    try {
      const response = await apiClient.post('/scheduled-reports', payload)
      return response?.data ?? response
    } catch (error) {
      console.error('Failed to create scheduled report:', error)
      throw error
    }
  },

  updateSchedule: async (id, payload) => {
    try {
      const response = await apiClient.put(`/scheduled-reports/${encodeURIComponent(id)}`, payload)
      return response?.data ?? response
    } catch (error) {
      console.error('Failed to update scheduled report:', error)
      throw error
    }
  },

  activateSchedule: async (id) => {
    try {
      const response = await apiClient.patch(`/scheduled-reports/${encodeURIComponent(id)}/activate`)
      return response?.data ?? response
    } catch (error) {
      console.error('Failed to activate scheduled report:', error)
      throw error
    }
  },

  deactivateSchedule: async (id) => {
    try {
      const response = await apiClient.patch(`/scheduled-reports/${encodeURIComponent(id)}/deactivate`)
      return response?.data ?? response
    } catch (error) {
      console.error('Failed to deactivate scheduled report:', error)
      throw error
    }
  },

  runNow: async (id) => {
    try {
      const response = await apiClient.post(`/scheduled-reports/${encodeURIComponent(id)}/run-now`)
      return response?.data ?? response
    } catch (error) {
      console.error('Failed to trigger manual run now:', error)
      throw error
    }
  },

  getDeliveryHistory: async (id) => {
    try {
      const response = await apiClient.get(`/scheduled-reports/${encodeURIComponent(id)}/history`)
      const body = response?.data ?? response
      return Array.isArray(body?.data) ? body.data : []
    } catch (error) {
      console.error('Failed to fetch delivery history:', error)
      return []
    }
  },

  deleteSchedule: async (id) => {
    try {
      const response = await apiClient.delete(`/scheduled-reports/${encodeURIComponent(id)}`)
      return response?.data ?? response
    } catch (error) {
      console.error('Failed to delete scheduled report:', error)
      throw error
    }
  },

  /**
   * Fetches report options aggregated across all 3 sources:
   * 1. MongoDB reporttemplates
   * 2. MongoDB reports
   * 3. Built-in System Templates
   */
  getAvailableReports: async () => {
    const [templates, generated] = await Promise.all([
      reportApi.getReportTemplates().catch(() => []),
      reportApi.getGeneratedReports().catch(() => []),
    ])

    const formattedTemplates = (templates || []).map((t) => ({
      id: t._id || t.id,
      reportName: t.templateName || t.name || 'Custom Template',
      sourceType: 'reporttemplate',
      dataSource: t.reportContext || t.dataSource || 'deal',
      description: `Custom Template (${t.reportContext || 'report'})`,
      selectedFields: t.selectedFields || [],
      filters: t.filters || [],
      accountOwner: t.accountOwner || 'all',
      dateRangeType: t.dateRangeType || 'last_7_days',
    }))

    const formattedGenerated = (generated || []).map((r) => ({
      id: r._id || r.id,
      reportName: r.reportName || r.title || 'Saved Report',
      sourceType: 'saved_report',
      dataSource: r.reportContext || r.dataSource || 'deal',
      description: `Saved Report (${r.reportContext || 'report'})`,
      selectedFields: r.displayFields || r.selectedFields || [],
      filters: r.filters || [],
      accountOwner: r.accountOwner || 'all',
      dateRangeType: 'last_7_days',
    }))

    return [
      ...SYSTEM_DEFAULT_REPORTS,
      ...formattedTemplates,
      ...formattedGenerated,
    ]
  },
}
