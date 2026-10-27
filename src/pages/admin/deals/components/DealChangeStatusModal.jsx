import React, { useEffect, useState } from 'react'
import Modal from '../../../../components/common/Modal'
import Button from '../../../../components/common/Button'
import {
  ACCOUNT_CHANGE_STATUS_OPTIONS,
  getAccountChangeStatusOption,
} from '../../../../features/adminAccounts/config/accountStages'
import {
  CUSTOMER_QUOTATION_STATUS_OPTIONS,
  DEAL_LIFECYCLE_STATUS_OPTIONS,
} from '../../../../features/adminDeals/config/dealUtils'

const REASON_FOR_LOST_OPTIONS = [
  'Intense Competition',
  'On Hold',
  'Payment Terms not matching',
  'Delivery not matching',
  'Budgetory Offer',
]

const toDateInputValue = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

const DealChangeStatusModal = ({
  isOpen,
  onClose,
  deal,
  onSaveStatus,
  onSavePoValueOnly,
  isSaving,
}) => {
  const [stage, setStage] = useState('new')
  const [reasonForLost, setReasonForLost] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [poValue, setPoValue] = useState('')
  const [customerReferenceDate, setCustomerReferenceDate] = useState('')
  const [customerReferenceNumber, setCustomerReferenceNumber] = useState('')
  const [orderCustomerStatus, setOrderCustomerStatus] = useState('NEW')
  const [quotationCustomerStatus, setQuotationCustomerStatus] = useState('NEW')
  const [formError, setFormError] = useState('')
  const [isSavingPoValue, setIsSavingPoValue] = useState(false)

  useEffect(() => {
    if (deal) {
      const initialStage = deal.dealStatus || deal.status || deal.stage || 'new'
      setStage(initialStage)
      setReasonForLost(deal.reasonForLostOrder || deal.reasonForLost || '')
      setStatusNote(deal.latestRemark || deal.remark || '')
      setPoValue(deal.poValue !== undefined && deal.poValue !== null ? String(deal.poValue) : '')
      setCustomerReferenceDate(toDateInputValue(deal.customerReferenceDate))
      setCustomerReferenceNumber(deal.customerReferenceNumber || '')
      setOrderCustomerStatus(deal.orderCustomerStatus || 'NEW')
      setQuotationCustomerStatus(deal.quotationCustomerStatus || 'NEW')
      setFormError('')
    }
  }, [deal, isOpen])

  if (!deal) return null

  const isConvertPo = stage === 'convert_to_po' || stage === 'Convert To PO' || stage === 'po converted'
  const isRejected = stage === 'rejected' || stage === 'Rejected'
  const isNotQuoted = stage === 'not_quoted' || stage === 'Not Quoted'

  const handleSavePoOnly = async () => {
    if (!String(poValue).trim()) {
      setFormError('Please enter a valid PO Value.')
      return
    }
    setIsSavingPoValue(true)
    try {
      await onSavePoValueOnly?.(poValue)
      setFormError('')
    } finally {
      setIsSavingPoValue(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError('')

    if (!stage) {
      setFormError('Status is required.')
      return
    }

    if (isNotQuoted && !statusNote.trim()) {
      setFormError('Status Note / Reason is mandatory for Not Quoted.')
      return
    }

    if (isConvertPo && !String(poValue).trim()) {
      setFormError('PO Value is required to convert deal to PO Converted status.')
      return
    }

    onSaveStatus({
      stage,
      reasonForLost: isRejected ? reasonForLost : '',
      statusNote: statusNote.trim(),
      poValue: isConvertPo ? poValue : deal.poValue,
      customerReferenceDate: isConvertPo ? customerReferenceDate : deal.customerReferenceDate,
      customerReferenceNumber: isConvertPo ? customerReferenceNumber : deal.customerReferenceNumber,
      orderCustomerStatus: isConvertPo ? orderCustomerStatus : deal.orderCustomerStatus,
      quotationCustomerStatus: isConvertPo ? quotationCustomerStatus : deal.quotationCustomerStatus,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Deal Status"
      size="medium"
    >
      <form onSubmit={handleSubmit} className="c-deal-status-form">
        {formError && (
          <div className="c-deal-status-error-alert" role="alert">
            {formError}
          </div>
        )}

        {/* Read-only Context Reference */}
        <div className="c-deal-status-grid">
          <label className="c-deal-status-field">
            <span className="c-deal-status-label">Deal / Account No.</span>
            <input
              type="text"
              className="c-deal-status-input c-deal-status-input--readonly"
              value={deal.dealNumber || deal.customerNumber || '-'}
              readOnly
            />
          </label>

          <label className="c-deal-status-field">
            <span className="c-deal-status-label">Project / Deal Name</span>
            <input
              type="text"
              className="c-deal-status-input c-deal-status-input--readonly"
              value={deal.dealName || deal.projectName || '-'}
              readOnly
            />
          </label>
        </div>

        {/* Status Selection Grid */}
        <div className="c-deal-status-grid">
          <label className="c-deal-status-field c-deal-status-field-full">
            <span className="c-deal-status-label">Deal Status *</span>
            <select
              className="c-deal-status-select"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              disabled={isSaving}
            >
              {ACCOUNT_CHANGE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {isRejected && (
            <label className="c-deal-status-field c-deal-status-field-full">
              <span className="c-deal-status-label">Reason For Lost</span>
              <select
                className="c-deal-status-select"
                value={reasonForLost}
                onChange={(e) => setReasonForLost(e.target.value)}
                disabled={isSaving}
              >
                <option value="">Choose Reason For Lost</option>
                {REASON_FOR_LOST_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="c-deal-status-field c-deal-status-field-full">
            <span className="c-deal-status-label">
              Status Note {isNotQuoted && <span className="c-deal-status-required">* (Mandatory for Not Quoted)</span>}
            </span>
            <textarea
              className="c-deal-status-textarea"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Add status note / remark..."
              rows={3}
              disabled={isSaving}
            />
          </label>
        </div>

        {/* PO Converted Section */}
        {isConvertPo && (
          <div className="c-deal-status-po-section">
            <div className="c-deal-status-section-title">
              Please fill in the PO Converted details below
            </div>

            <div className="c-deal-status-grid">
              <label className="c-deal-status-field">
                <span className="c-deal-status-label">
                  PO Value <span className="c-deal-status-required">* (Mandatory to Convert)</span>
                </span>
                <div className="c-deal-status-po-input-group">
                  <input
                    type="number"
                    min="0"
                    className="c-deal-status-input"
                    value={poValue}
                    onChange={(e) => setPoValue(e.target.value)}
                    placeholder="Enter PO value"
                    disabled={isSaving}
                  />
                  {onSavePoValueOnly && (
                    <button
                      type="button"
                      className="c-deal-status-save-po-btn"
                      onClick={handleSavePoOnly}
                      disabled={isSavingPoValue || isSaving}
                    >
                      {isSavingPoValue ? 'Saving...' : 'Save PO Value'}
                    </button>
                  )}
                </div>
              </label>

              <label className="c-deal-status-field">
                <span className="c-deal-status-label">Customer Ref. Date</span>
                <input
                  type="date"
                  className="c-deal-status-input"
                  value={customerReferenceDate}
                  onChange={(e) => setCustomerReferenceDate(e.target.value)}
                  disabled={isSaving}
                />
              </label>

              <label className="c-deal-status-field">
                <span className="c-deal-status-label">Customer Ref. No.</span>
                <input
                  type="text"
                  className="c-deal-status-input"
                  value={customerReferenceNumber}
                  onChange={(e) => setCustomerReferenceNumber(e.target.value)}
                  placeholder="Enter reference number"
                  disabled={isSaving}
                />
              </label>

              <label className="c-deal-status-field">
                <span className="c-deal-status-label">Status of Customer as per Order Received</span>
                <select
                  className="c-deal-status-select"
                  value={orderCustomerStatus}
                  onChange={(e) => setOrderCustomerStatus(e.target.value)}
                  disabled={isSaving}
                >
                  {DEAL_LIFECYCLE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="c-deal-status-field">
                <span className="c-deal-status-label">Status of Customer as per Quotation Given</span>
                <select
                  className="c-deal-status-select"
                  value={quotationCustomerStatus}
                  onChange={(e) => setQuotationCustomerStatus(e.target.value)}
                  disabled={isSaving}
                >
                  {CUSTOMER_QUOTATION_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="c-deal-status-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="c-deal-status-submit-btn"
          >
            {isSaving ? 'Saving...' : 'Save Status'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default React.memo(DealChangeStatusModal)
