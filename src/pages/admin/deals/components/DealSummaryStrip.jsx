import React from 'react'
import InfoFieldItem from './InfoFieldItem'
import { formatCurrency, formatDate } from '../../../../utils/helpers'

const DealSummaryStrip = ({
  deal,
  customerLabel,
  editingFieldKey,
  editValue,
  isSavingField,
  onStartEdit,
  onChangeEditValue,
  onSaveField,
  onCancelEdit,
  dealTypeOptions,
  statusOptions,
  toDateInputValue,
}) => {
  if (!deal) return null

  const row1Items = [
    {
      key: 'dealName',
      label: 'DEAL NAME',
      value: deal.dealName || deal.dealNumber,
      rawValue: deal.dealName,
      type: 'text',
      readonly: false,
    },
    {
      key: 'customerName',
      label: 'CUSTOMER',
      value: customerLabel,
      rawValue: customerLabel,
      readonly: true,
    },
    {
      key: 'dealDate',
      label: 'DEAL DATE',
      value: deal.dealDate ? formatDate(deal.dealDate) : '',
      rawValue: toDateInputValue(deal.dealDate),
      type: 'date',
      readonly: false,
    },
    {
      key: 'dealType',
      label: 'DEAL TYPE',
      value: deal.dealType,
      rawValue: deal.dealType,
      type: 'select',
      options: dealTypeOptions,
      readonly: false,
    },
    {
      key: 'dealOwner',
      label: 'DEAL OWNER',
      value: deal.dealOwner,
      rawValue: deal.dealOwner,
      readonly: true,
    },
  ]

  const row2Items = [
    {
      key: 'dealValue',
      label: 'DEAL VALUE',
      value: formatCurrency(deal.dealValue || 0),
      rawValue: deal.dealValue || 0,
      type: 'number',
      readonly: false,
    },
    {
      key: 'dealScore',
      label: 'DEAL SCORE',
      value: deal.dealScore !== undefined && deal.dealScore !== null ? deal.dealScore : '0',
      rawValue: deal.dealScore || 0,
      type: 'number',
      readonly: false,
    },
    {
      key: 'probability',
      label: 'PROBABILITY',
      value: `${deal.probability !== undefined && deal.probability !== null ? deal.probability : 0}%`,
      rawValue: deal.probability || 0,
      type: 'number',
      readonly: false,
    },
    {
      key: 'expectedClosureDate',
      label: 'EXPECTED CLOSURE DATE',
      value: deal.expectedClosureDate ? formatDate(deal.expectedClosureDate) : '',
      rawValue: toDateInputValue(deal.expectedClosureDate),
      type: 'date',
      readonly: false,
    },
    {
      key: 'dealStatus',
      label: 'DEAL STATUS',
      value: deal.dealStatus || 'NEW',
      rawValue: deal.dealStatus || 'new',
      type: 'select',
      options: statusOptions,
      badge: true,
      badgeColor: 'red',
      readonly: false,
    },
  ]

  return (
    <section className="c-deal-summary-strip" aria-label="Deal summary strip">
      <div className="c-deal-summary-strip-row c-deal-summary-strip-row-1">
        {row1Items.map((item) => (
          <InfoFieldItem
            key={item.key}
            itemKey={item.key}
            label={item.label}
            value={item.value}
            rawValue={item.rawValue}
            type={item.type}
            options={item.options}
            readonly={item.readonly}
            badge={item.badge}
            badgeColor={item.badgeColor}
            isEditing={editingFieldKey === item.key}
            editValue={editValue}
            isSaving={isSavingField}
            onStartEdit={onStartEdit}
            onChangeEditValue={onChangeEditValue}
            onSave={onSaveField}
            onCancel={onCancelEdit}
            className="c-deal-summary-strip-item"
          />
        ))}
      </div>

      <div className="c-deal-summary-strip-row c-deal-summary-strip-row-2">
        {row2Items.map((item) => (
          <InfoFieldItem
            key={item.key}
            itemKey={item.key}
            label={item.label}
            value={item.value}
            rawValue={item.rawValue}
            type={item.type}
            options={item.options}
            readonly={item.readonly}
            badge={item.badge}
            badgeColor={item.badgeColor}
            isEditing={editingFieldKey === item.key}
            editValue={editValue}
            isSaving={isSavingField}
            onStartEdit={onStartEdit}
            onChangeEditValue={onChangeEditValue}
            onSave={onSaveField}
            onCancel={onCancelEdit}
            className="c-deal-summary-strip-item"
          />
        ))}
      </div>
    </section>
  )
}

export default React.memo(DealSummaryStrip)
