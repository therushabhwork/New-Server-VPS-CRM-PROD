import { ACCOUNT_EXPORT_COLUMNS } from '../adminAccounts/config/accountExportColumns'
import { CUSTOM_VIEW_GROUP_BY_OPTIONS } from '../adminAccounts/customViews/customViewConfig'

const toOption = (value, label = value) => ({
  value,
  label,
})

export const ACCOUNT_REPORT_CONTEXT_OPTIONS = [
  toOption('account', 'Account'),
  toOption('deal', 'Deal'),
  toOption('customer', 'Customer'),
  toOption('quotation', 'Quotation'),
]

export const ACCOUNT_REPORT_VISIBILITY_OPTIONS = [
  toOption('Visible to Me Only', 'Visible to Me Only'),
  toOption('All', 'All'),
]

export const ACCOUNT_REPORT_ORDER_BY_OPTIONS = [
  toOption('', 'Select'),
  ...ACCOUNT_EXPORT_COLUMNS.map((column) => toOption(column.key, column.label)),
]

export const ACCOUNT_REPORT_GROUP_BY_OPTIONS = [
  toOption('', 'Select'),
  ...CUSTOM_VIEW_GROUP_BY_OPTIONS.map((option) => toOption(option.key, option.label)),
]

export const ACCOUNT_REPORT_AGGREGATE_OPTIONS = [
  toOption('', 'Select'),
  toOption('count', 'Count'),
  toOption('sum', 'Sum'),
  toOption('avg', 'Average'),
]

export const ACCOUNT_REPORT_FILTER_FIELD_OPTIONS = [
  toOption('', 'Select'),
  ...ACCOUNT_EXPORT_COLUMNS.map((column) => toOption(column.key, column.label)),
]

export const ACCOUNT_REPORT_FILTER_OPERATOR_OPTIONS = [
  toOption('equals', 'equal'),
  toOption('not_equals', 'not equal'),
  toOption('contains', 'contains'),
  toOption('not_contains', 'not contains'),
  toOption('starts_with', 'starts with'),
  toOption('ends_with', 'ends with'),
  toOption('is_empty', 'is empty'),
  toOption('is_not_empty', 'is not empty'),
]

export const ACCOUNT_REPORT_FIELD_OPTIONS = ACCOUNT_EXPORT_COLUMNS
  .filter((column) => column.key !== '__serialNumber')
  .map((column) => ({
    key: column.key,
    label: column.label,
  }))

export const ACCOUNT_REPORT_FIELD_CATEGORIES = [
  {
    category: 'Account Information',
    keys: [
      'accountNumber', 'accountDate', 'name', 'stageLabel', 'status',
      'accountCategory', 'accountSource', 'accountSubsource',
      'customerType', 'productCategory', 'industryType'
    ]
  },
  {
    category: 'Ownership',
    keys: ['accountOwner', 'addedBy']
  },
  {
    category: 'Contact Information',
    keys: [
      'contactPerson', 'phone', 'email', 'contactDesignation',
      'contactEmail', 'contactPhone', 'contactMobile',
      'alternatePhone', 'alternateEmail'
    ]
  },
  {
    category: 'Location & Address',
    keys: ['location', 'address']
  },
  {
    category: 'Quotation & Commercials',
    keys: [
      'customerName', 'customerRefNo', 'customerRefDate', 'consultantName',
      'gstin', 'poValue', 'statusAsPerQuotationGiven', 'statusAsPerOrderReceived', 'jobNo'
    ]
  },
  {
    category: 'Remarks & Audit',
    keys: [
      'projectName', 'latestRemark', 'remark', 'description',
      'reasonForLost', 'reminderDate', 'reminderMode', 'createdAt', 'updatedAt'
    ]
  }
]

