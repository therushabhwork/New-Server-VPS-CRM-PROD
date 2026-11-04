const reminderService = require('./reminderService')
const reminderRepository = require('../repositories/reminderRepository')
const { AppError } = require('../utils/appError')

/**
 * Isolated service for Account-wise Reminder Creation & Querying.
 * Strictly guarantees isolation between Account reminders and Deal reminders.
 */
const accountReminderService = {
  /**
   * Creates a reminder for an account re-assignment in MongoDB reminders collection.
   * Enforces relatedEntityType: 'account' and dealId: null.
   */
  async createAccountReminder(body = {}, actor = {}) {
    const accountId = body.accountId || body.relatedEntityId
    if (!accountId) {
      throw new AppError('accountId is required for account reminder creation.', 400)
    }

    const remindAt = body.remindAt || (body.reminderDate && body.reminderTime ? `${body.reminderDate}T${String(body.reminderTime).padEnd(5, ':00')}:00` : null)
    if (!remindAt) {
      throw new AppError('Reminder requires a valid remindAt timestamp.', 400)
    }

    const accountName = body.accountName || body.name || 'Account'
    const accountNumber = body.accountNumber || body.accountNo || ''
    const assignedTo = body.assignedTo || actor.id

    const reminderPayload = {
      title: body.title || `Reassigned Account Follow-Up: ${accountName}${accountNumber ? ` (${accountNumber})` : ''}`,
      message: body.message || 'Account has been assigned to you',
      remindAt,
      status: body.status || 'scheduled',
      reminderDate: body.reminderDate || String(remindAt).slice(0, 10),
      reminderTime: body.reminderTime || String(remindAt).slice(11, 16) || '09:00',
      reminderMode: body.reminderMode || 'Ownership Follow Up',
      recurrence: 'none',
      assignedTo,
      relatedEntityType: 'account',
      relatedEntityId: String(accountId),
      accountId: String(accountId),
      dealId: null, // Strictly null to isolate from Deal reminders
      data: {
        ...(body.data || {}),
        accountName,
        accountNumber,
        description: body.description || '',
        reassignedBy: actor.name || actor.username || 'System',
        entityType: 'account',
      },
    }

    return reminderService.create(reminderPayload, actor)
  },

  /**
   * Fetches reminders specific to an account.
   */
  async getAccountReminders(accountId) {
    if (!accountId) return []
    const allReminders = await reminderRepository.listAll()
    const targetIdStr = String(accountId)
    return allReminders.filter((entry) => {
      const matchAccount = String(entry.accountId || entry.relatedEntityId || entry.data?.accountId || '') === targetIdStr
      const matchType = (entry.relatedEntityType === 'account' || entry.data?.entityType === 'account')
      return matchAccount && matchType
    })
  },
}

module.exports = accountReminderService

