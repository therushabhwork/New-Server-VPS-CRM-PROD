import React, { useState } from 'react'
import { FiChevronDown, FiChevronUp, FiUser, FiSettings, FiShoppingCart } from 'react-icons/fi'
import { FaInfoCircle } from 'react-icons/fa'
import InlineAutoSaveField from './InlineAutoSaveField'
import { formatCurrency } from '../../../../../utils/helpers'
import {
  STATE_OPTIONS,
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

const normalizeDate = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 10)
  return d.toISOString().slice(0, 10)
}

const formatDisplayDate = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

export default function AdditionalInfoAccordion({
  account = {},
  form = {},
  deal = {},
  onAutoSave,
  canEdit = true,
}) {
  const [openSections, setOpenSections] = useState({
    contact: false,
    project: false,
    order: false,
  })

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const dealNumber = form.dealNumber || account.dealNumber || deal.dealNumber || deal.dealId || account.dealId || ''

  return (
    <div className="ad-accordion-card">
      <div className="ad-card-header">
        <h3 className="ad-card-title">
          <FaInfoCircle className="ad-card-title-icon" />
          <span>Additional Information</span>
        </h3>
      </div>

      {/* Row 1: Contact Information */}
      <div className="ad-accordion-row">
        <button
          type="button"
          className="ad-accordion-trigger"
          onClick={() => toggleSection('contact')}
          aria-expanded={openSections.contact}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiUser style={{ color: 'var(--color-primary, #2563eb)' }} />
            <span>Contact Information</span>
          </span>
          {openSections.contact ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {openSections.contact && (
          <div className="ad-accordion-content">
            <InlineAutoSaveField
              label="Contact Person"
              fieldKey="contactPerson"
              value={form.contactPerson || account.contactPerson || ''}
              placeholder="Enter contact person"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Designation"
              fieldKey="designation"
              value={form.designation || account.designation || account.contactDesignation || ''}
              placeholder="Enter designation"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Mobile / Phone"
              fieldKey="mobile"
              value={form.mobile || account.mobile || account.phone || ''}
              type="tel"
              placeholder="Enter mobile/phone"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Email"
              fieldKey="email"
              value={form.email || account.email || ''}
              type="email"
              placeholder="Enter email"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Alternate Phone"
              fieldKey="alternatePhone"
              value={form.alternatePhone || account.alternatePhone || ''}
              type="tel"
              placeholder="Enter alternate phone"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Alternate Email"
              fieldKey="alternateEmail"
              value={form.alternateEmail || account.alternateEmail || ''}
              type="email"
              placeholder="Enter alternate email"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="City"
              fieldKey="city"
              value={form.city || account.city || account.location || ''}
              placeholder="Enter city"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="State"
              fieldKey="state"
              value={form.state || account.state || ''}
              type="select"
              options={STATE_OPTIONS}
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Pincode"
              fieldKey="pincode"
              value={form.pincode || account.pincode || ''}
              placeholder="Enter pincode"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Address"
              fieldKey="address"
              value={form.address || account.address || ''}
              multiline
              placeholder="Enter address"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
          </div>
        )}
      </div>

      {/* Row 2: Project & Product Information */}
      <div className="ad-accordion-row">
        <button
          type="button"
          className="ad-accordion-trigger"
          onClick={() => toggleSection('project')}
          aria-expanded={openSections.project}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiSettings style={{ color: 'var(--color-primary, #2563eb)' }} />
            <span>Project & Product Information</span>
          </span>
          {openSections.project ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {openSections.project && (
          <div className="ad-accordion-content">
            <InlineAutoSaveField
              label="Project Name"
              fieldKey="projectName"
              value={form.projectName || account.projectName || deal.projectName || ''}
              placeholder="Enter project name"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <div className="ad-field-pair">
              <span className="ad-field-label">Deal Number</span>
              {dealNumber ? (
                <span className="ad-field-value" style={{ fontWeight: 600 }}>{dealNumber}</span>
              ) : (
                <span className="ad-not-available">Not Available</span>
              )}
            </div>
            <InlineAutoSaveField
              label="Product Category"
              fieldKey="projectType"
              value={form.projectType || account.productCategory || deal.productCategory || ''}
              placeholder="Enter product category"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Industry Type"
              fieldKey="industry"
              value={form.industry || account.industry || ''}
              type="select"
              options={INDUSTRY_TYPE_OPTIONS}
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Project Location"
              fieldKey="projectLocation"
              value={form.projectLocation || account.projectLocation || ''}
              placeholder="Enter project location"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Architect Name"
              fieldKey="architectName"
              value={form.architectName || account.architectName || ''}
              placeholder="Enter architect name"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Consultant Name"
              fieldKey="consultantName"
              value={form.consultantName || account.consultantName || ''}
              placeholder="Enter consultant name"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="PMC Name"
              fieldKey="pmcName"
              value={form.pmcName || account.pmcName || ''}
              placeholder="Enter PMC name"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Deal Owner"
              fieldKey="dealOwner"
              value={form.dealOwner || account.dealOwner || deal.ownerName || ''}
              placeholder="Enter deal owner"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Expected Closure"
              fieldKey="expectedClosureDate"
              value={normalizeDate(form.expectedClosureDate || account.expectedClosureDate || deal.expectedClosureDate)}
              type="date"
              formatter={formatDisplayDate}
              canEdit={canEdit}
              onSave={onAutoSave}
            />
          </div>
        )}
      </div>

      {/* Row 3: Order & Commercial Information */}
      <div className="ad-accordion-row">
        <button
          type="button"
          className="ad-accordion-trigger"
          onClick={() => toggleSection('order')}
          aria-expanded={openSections.order}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiShoppingCart style={{ color: 'var(--color-primary, #2563eb)' }} />
            <span>Order & Commercial Information</span>
          </span>
          {openSections.order ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {openSections.order && (
          <div className="ad-accordion-content">
            <InlineAutoSaveField
              label="Order Status"
              fieldKey="statusAsPerOrderReceived"
              value={form.statusAsPerOrderReceived || account.statusAsPerOrderReceived || ''}
              type="select"
              options={ACCOUNT_ORDER_STATUS_OPTIONS}
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Quotation Status"
              fieldKey="statusAsPerQuotationGiven"
              value={form.statusAsPerQuotationGiven || account.statusAsPerQuotationGiven || ''}
              type="select"
              options={ACCOUNT_QUOTATION_STATUS_OPTIONS}
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Customer Ref No."
              fieldKey="customerRefNo"
              value={form.customerRefNo || account.customerRefNo || ''}
              placeholder="Enter customer ref no"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Customer Ref Date"
              fieldKey="customerRefDate"
              value={normalizeDate(form.customerRefDate || account.customerRefDate)}
              type="date"
              formatter={formatDisplayDate}
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Job Number"
              fieldKey="jobNo"
              value={form.jobNo || account.jobNo || ''}
              placeholder="Enter job number"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="PO Value"
              fieldKey="poValue"
              value={form.poValue || account.poValue || ''}
              type="number"
              formatter={(val) => (val && Number(val) > 0 ? formatCurrency(Number(val)) : '')}
              placeholder="Enter PO value"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="Reason for Lost"
              fieldKey="reasonForLost"
              value={form.reasonForLost || account.reasonForLost || ''}
              type="select"
              options={REASON_FOR_LOST_OPTIONS}
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="GSTIN"
              fieldKey="gstin"
              value={form.gstin || account.gstin || ''}
              placeholder="Enter GSTIN"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
            <InlineAutoSaveField
              label="State Code"
              fieldKey="stateCode"
              value={form.stateCode || account.stateCode || ''}
              placeholder="Enter state code"
              canEdit={canEdit}
              onSave={onAutoSave}
            />
          </div>
        )}
      </div>
    </div>
  )
}
