const mongoose = require('mongoose')

const scheduledReportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  companyId: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  creatorName: {
    type: String,
    default: '',
  },
  creatorEmail: {
    type: String,
    default: '',
    index: true,
  },

  // Complete Report Definition from Sources 1, 2, or 3
  reportConfig: {
    sourceType: {
      type: String,
      enum: ['reporttemplate', 'saved_report', 'system_report'],
      default: 'system_report',
    },
    templateId: {
      type: String,
      default: '',
    },
    reportName: {
      type: String,
      default: '',
    },
    dataSource: {
      type: String,
      enum: ['account', 'deal', 'customer', 'quotation', 'remark', 'sales_performance'],
      default: 'deal',
    },
    selectedFields: {
      type: [String],
      default: [],
    },
    filters: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    userGroups: {
      type: [String],
      default: [],
    },
    accountOwner: {
      type: String,
      default: 'all',
    },
    dateRangeType: {
      type: String,
      enum: ['today', 'yesterday', 'last_7_days', 'this_month', 'previous_month', 'all_time', 'custom', 'combined'],
      default: 'last_7_days',
    },
    dateScopeLabel: {
      type: String,
      default: '',
    },
    customStartDate: {
      type: Date,
      default: null,
    },
    customEndDate: {
      type: Date,
      default: null,
    },
  },

  schedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly_7_days'],
      default: 'daily',
    },
    time: {
      type: String,
      default: '18:00', // 24-hr HH:mm format (IST)
    },
    timeFormatted: {
      type: String,
      default: '', // e.g. "10:10 AM IST"
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    nextRunAt: {
      type: Date,
      index: true,
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
  },

  recipient: {
    type: {
      type: String,
      enum: ['self', 'custom'],
      default: 'self',
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    additionalEmails: {
      type: [String],
      default: [],
    },
  },

  isEnabled: {
    type: Boolean,
    default: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'processing', 'failed'],
    default: 'active',
    index: true,
  },
  lastRunStatus: {
    type: String,
    enum: ['success', 'failed', null],
    default: null,
  },
  lastError: {
    type: String,
    default: null,
  },
  totalRuns: {
    type: Number,
    default: 0,
  },
  successfulRuns: {
    type: Number,
    default: 0,
  },
  failedRuns: {
    type: Number,
    default: 0,
  },

  // Distributed atomic execution lock
  lockedAt: {
    type: Date,
    default: null,
  },
  lockWorkerId: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
})

scheduledReportSchema.index({ isEnabled: 1, status: 1, 'schedule.nextRunAt': 1 })

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema)
