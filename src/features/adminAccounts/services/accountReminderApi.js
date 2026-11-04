import apiClient from '../../../services/apiClient'
import { reminderApi } from '../../../services/reminderApi'

const unwrapData = (response, fallback) => response?.data?.data ?? response?.data ?? fallback

/**
 * Isolated frontend service for Account-wise Reminder API operations.
 */
export const accountReminderApi = {
  /**
   * Create an account reminder in MongoDB reminders collection.
   * Attempts isolated endpoint first, with seamless fallback to reminderApi.createReminder.
   */
  async createAccountReminder(payload = {}) {
    const remindAt = payload.remindAt || (payload.reminderDate && payload.reminderTime
      ? `${payload.reminderDate}T${String(payload.reminderTime).padEnd(5, ':00')}:00`
      : new Date().toISOString())

    const fullPayload = {
      title: payload.title || `Reassigned Account Follow-Up: ${payload.accountName || 'Account'}`,
      message: payload.message || 'Account has been assigned to you',
      remindAt,
      status: payload.status || 'scheduled',
      reminderDate: payload.reminderDate || String(remindAt).slice(0, 10),
      reminderTime: payload.reminderTime || String(remindAt).slice(11, 16) || '09:00',
      reminderMode: payload.reminderMode || 'Ownership Follow Up',
      assignedTo: payload.assignedTo != null ? String(payload.assignedTo) : '',
      relatedEntityType: 'account',
      relatedEntityId: payload.accountId != null ? String(payload.accountId) : '',
      accountId: payload.accountId != null ? String(payload.accountId) : '',
      dealId: null, // Strictly null to isolate from Deal reminders
      data: {
        ...(payload.data || {}),
        accountName: payload.accountName || '',
        accountNumber: payload.accountNumber || '',
        description: payload.description || '',
        entityType: 'account',
      },
    }

    try {
      const response = await apiClient.post('/account-reminders', fullPayload)
      return unwrapData(response, null)
    } catch (err) {
      // Robust fallback to standard /reminders endpoint with same isolated contract
      return reminderApi.createReminder(fullPayload)
    }
  },

  /**
   * Fetch reminders specific to an account.
   */
  async getAccountReminders(accountId) {
    if (!accountId) return []
    try {
      const response = await apiClient.get(`/account-reminders/account/${encodeURIComponent(accountId)}`)
      return unwrapData(response, [])
    } catch {
      const allReminders = await reminderApi.getReminders()
      const targetIdStr = String(accountId)
      return allReminders.filter((entry) => {
        const matchAccount = String(entry.accountId || entry.relatedEntityId || entry.data?.accountId || '') === targetIdStr
        return matchAccount && (entry.relatedEntityType === 'account' || entry.data?.entityType === 'account')
      })
    }
  },
}

