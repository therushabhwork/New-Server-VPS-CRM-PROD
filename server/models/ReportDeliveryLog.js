const mongoose = require('mongoose')

const reportDeliveryLogSchema = new mongoose.Schema({
  scheduleId: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true,
  },
  scheduleName: {
    type: String,
    default: '',
  },
  reportType: {
    type: String,
    default: 'deal',
  },
  recipientEmail: {
    type: String,
    required: true,
  },
  additionalRecipients: {
    type: [String],
    default: [],
  },
  executedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  recordCount: {
    type: Number,
    default: 0,
  },
  attachmentName: {
    type: String,
    default: '',
  },
  attachmentSizeKB: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    required: true,
    index: true,
  },
  deliveryMethod: {
    type: String,
    default: 'outlook_graph',
  },
  errorMessage: {
    type: String,
    default: null,
  },
  executionType: {
    type: String,
    enum: ['scheduled', 'manual_run_now'],
    default: 'scheduled',
  },
}, {
  timestamps: true,
})

reportDeliveryLogSchema.index({ scheduleId: 1, executedAt: -1 })

module.exports = mongoose.model('ReportDeliveryLog', reportDeliveryLogSchema)
