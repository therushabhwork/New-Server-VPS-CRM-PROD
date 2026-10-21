import React from 'react'
import { FaBuilding } from 'react-icons/fa'
import InlineAutoSaveField from './InlineAutoSaveField'
import { formatCurrency } from '../../../../../utils/helpers'
import {
  CUSTOMER_TYPE_OPTIONS,
  INDUSTRY_TYPE_OPTIONS,
} from '../../../../../features/accounts/config/accountDropdownOptions'
import {
  ACCOUNT_ORDER_STATUS_OPTIONS,
  ACCOUNT_QUOTATION_STATUS_OPTIONS,
} from '../../../../../features/adminAccounts/config/accountStages'

const REASON_FOR_LOST_OPTIONS = [
  'Intense Competition',
  'On Hold',
  'Payment Terms not matching',
  'Delivery not matching',
  'Price High',
  'Lost to Competitor',
  'Specification Changed',
  'Client Cancelled Project',
  'Other',
]

const formatDateDisplay = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export default function CustomerProjectCard({
  account = {},
  form = {},
  deal = {},
  onAutoSave,
  canEdit = true,
}) {
  // Column 1: Customer Info
  const customerType = form.customerType || account.customerType || form.accountCategory || ''
  const customerName = form.customerName || account.customerName || deal.customerName || account.name || ''
  const customerRefNo = form.customerRefNo || account.customerRefNo || deal.customerRefNo || ''
  const customerRefDate = form.customerRefDate || account.customerRefDate || deal.customerRefDate || ''

  // Column 2: Project / Product Info
  const projectName = form.projectName || account.projectName || deal.projectName || ''
  const productCategory = form.projectType || account.productCategory || deal.productCategory || ''
  const industryType = form.industry || account.industry || account.industryType || ''
  const rawPoValue = form.poValue || account.poValue || deal.poValue || ''
  const jobNo = form.jobNo || account.jobNo || deal.jobNo || ''

  // Column 3: Order / Commercial Info
  const orderStatus = form.statusAsPerOrderReceived || account.statusAsPerOrderReceived || ''
  const quotationStatus = form.statusAsPerQuotationGiven || account.statusAsPerQuotationGiven || ''
  const reasonForLost = form.reasonForLost || account.reasonForLost || ''

  return (
    <div className="ad-card">
      <div className="ad-card-header">
        <h3 className="ad-card-title">
          <FaBuilding className="ad-card-title-icon" />
          <span>Customer & Project Information</span>
        </h3>
      </div>

      <div className="ad-three-column-grid">
        {/* Column 1: Customer Information */}
        <div className="ad-info-column">
          <span className="ad-info-col-title">Customer Information</span>

          <InlineAutoSaveField
            label="Customer Type"
            fieldKey="customerType"
            value={customerType}
            type="select"
            options={CUSTOMER_TYPE_OPTIONS}
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Customer Name"
            fieldKey="customerName"
            value={customerName}
            placeholder="Enter customer name"
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Customer Ref. No."
            fieldKey="customerRefNo"
            value={customerRefNo}
            placeholder="Enter ref no"
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Customer Ref. Date"
            fieldKey="customerRefDate"
            value={customerRefDate}
            type="date"
            formatter={formatDateDisplay}
            canEdit={canEdit}
            onSave={onAutoSave}
          />
        </div>

        {/* Column 2: Project / Product Information */}
        <div className="ad-info-column">
          <span className="ad-info-col-title">Project / Product Information</span>

          <InlineAutoSaveField
            label="Project Name"
            fieldKey="projectName"
            value={projectName}
            placeholder="Enter project name"
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Product Category"
            fieldKey="projectType"
            value={productCategory}
            placeholder="Enter product category"
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Industry Type"
            fieldKey="industry"
            value={industryType}
            type="select"
            options={INDUSTRY_TYPE_OPTIONS}
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="PO Value"
            fieldKey="poValue"
            value={rawPoValue}
            type="number"
            formatter={(val) => (val && Number(val) > 0 ? formatCurrency(Number(val)) : '')}
            placeholder="Enter PO value"
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Job No."
            fieldKey="jobNo"
            value={jobNo}
            placeholder="Enter job no"
            canEdit={canEdit}
            onSave={onAutoSave}
          />
        </div>

        {/* Column 3: Order / Commercial Information */}
        <div className="ad-info-column">
          <span className="ad-info-col-title">Order / Commercial Information</span>

          <InlineAutoSaveField
            label="Order Status"
            fieldKey="statusAsPerOrderReceived"
            value={orderStatus}
            type="select"
            options={ACCOUNT_ORDER_STATUS_OPTIONS}
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Quotation Status"
            fieldKey="statusAsPerQuotationGiven"
            value={quotationStatus}
            type="select"
            options={ACCOUNT_QUOTATION_STATUS_OPTIONS}
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Reason For Lost"
            fieldKey="reasonForLost"
            value={reasonForLost}
            type="select"
            options={REASON_FOR_LOST_OPTIONS}
            canEdit={canEdit}
            onSave={onAutoSave}
          />
        </div>
      </div>
    </div>
  )
}
