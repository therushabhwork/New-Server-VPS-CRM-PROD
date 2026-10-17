import apiClient from './apiClient'
import { reportApi } from './reportApi'

export const SYSTEM_DEFAULT_REPORTS = [
  {
    id: 'sys-sales-performance-yesterday',
    reportName: 'Sales Performance Report – Yesterday',
    sourceType: 'system_report',
    dataSource: 'sales_performance',
    description: 'Dynamic team performance by user groups for yesterday (accounts, conversions, won/lost deals & total values)',
    selectedFields: ['slNo', 'salesPerson', 'newAccountsOpened', 'newAccountsConverted', 'conversionRate', 'wonDeals', 'lostDeals', 'activeDeals', 'totalDealValue'],
    dateRangeType: 'yesterday',
    accountOwner: 'all',
  },
  {
    id: 'sys-sales-performance-last7days',
    reportName: 'Sales Performance Report – Last 7 Days',
    sourceType: 'system_report',
    dataSource: 'sales_performance',
    description: 'Dynamic team performance by user groups for the last 7 days',
    selectedFields: ['slNo', 'salesPerson', 'newAccountsOpened', 'newAccountsConverted', 'conversionRate', 'wonDeals', 'lostDeals', 'activeDeals', 'totalDealValue'],
    dateRangeType: 'last_7_days',
    accountOwner: 'all',
  },
  {
    id: 'sys-sales-performance-combined',
    reportName: 'Sales Performance Report – Combined (Yesterday & Last 7 Days)',
    sourceType: 'system_report',
    dataSource: 'sales_performance',
    description: 'Combined delivery containing both Yesterday and Last 7 Days performance tables by user groups',
    selectedFields: ['slNo', 'salesPerson', 'newAccountsOpened', 'newAccountsConverted', 'conversionRate', 'wonDeals', 'lostDeals', 'activeDeals', 'totalDealValue'],
    dateRangeType: 'combined',
    accountOwner: 'all',
  },
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
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.schedules)
            ? response.schedules
            : []
      const kpis = response?.kpis || response?.data?.kpis || {}
      return {
        schedules: list,
        kpis,
      }
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error)
      return { schedules: [], kpis: {} }
    }
  },

  getSchedule: async (id) => {
    try {
      const response = await apiClient.get(`/scheduled-reports/${encodeURIComponent(id)}`)
      if (response && response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        return response.data
      }
      return response || null
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
      if (Array.isArray(response)) return response
      if (Array.isArray(response?.data)) return response.data
      return []
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

    const normalizeEntity = (val) => {
      const s = String(val || 'account').toLowerCase().trim()
      if (s === 'accounts' || s === 'lead' || s === 'leads') return 'account'
      if (s === 'deals') return 'deal'
      if (s === 'customers') return 'customer'
      if (s === 'quotations') return 'quotation'
      return s
    }

    const formattedTemplates = (templates || []).map((t) => {
      const entity = normalizeEntity(t.entityType || t.categoryKey || t.reportContext || t.dataSource)
      const fields = (Array.isArray(t.displayFields) && t.displayFields.length > 0)
        ? t.displayFields
        : (Array.isArray(t.selectedFields) ? t.selectedFields : [])
      const rName = t.reportName || t.name || t.title || 'Custom Report Template'

      return {
        id: String(t._id || t.id),
        reportName: rName,
        sourceType: 'reporttemplate',
        entityType: entity,
        dataSource: entity,
        description: t.description || `${rName} (${entity.toUpperCase()})`,
        selectedFields: fields,
        displayFields: fields,
        filters: Array.isArray(t.filters) ? t.filters : [],
        accountOwner: t.accountOwner || t.owner || 'all',
        dateRangeType: t.dateRangeType || 'last_7_days',
      }
    })

    const formattedGenerated = (generated || []).map((r) => {
      const entity = normalizeEntity(r.entityType || r.categoryKey || r.reportContext || r.dataSource)
      const fields = (Array.isArray(r.displayFields) && r.displayFields.length > 0)
        ? r.displayFields
        : (Array.isArray(r.selectedFields) ? r.selectedFields : [])
      const rName = r.reportName || r.name || r.title || 'Saved Report'

      return {
        id: String(r._id || r.id),
        reportName: rName,
        sourceType: 'saved_report',
        entityType: entity,
        dataSource: entity,
        description: r.description || `${rName} (${entity.toUpperCase()})`,
        selectedFields: fields,
        displayFields: fields,
        filters: Array.isArray(r.filters) ? r.filters : [],
        accountOwner: r.accountOwner || r.owner || 'all',
        dateRangeType: r.dateRangeType || 'last_7_days',
      }
    })

    return [
      ...SYSTEM_DEFAULT_REPORTS,
      ...formattedTemplates,
      ...formattedGenerated,
    ]
  },
}
