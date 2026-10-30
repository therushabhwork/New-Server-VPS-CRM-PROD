import React from 'react'
import { FaInfoCircle } from 'react-icons/fa'
import InlineAutoSaveField from './InlineAutoSaveField'

export default function AdditionalInfoAccordion({
  account = {},
  form = {},
  deal = {},
  onAutoSave,
  canEdit = true,
}) {
  const projectLocation = form.projectLocation || account.projectLocation || ''
  const consultantName = form.consultantName || account.consultantName || ''
  const pmcName = form.pmcName || account.pmcName || ''
  const architectName = form.architectName || account.architectName || ''
  const alternatePhone = form.alternatePhone || account.alternatePhone || ''
  const alternateEmail = form.alternateEmail || account.alternateEmail || ''

  return (
    <div className="ad-card ad-accordion-card">
      <div className="ad-card-header">
        <h3 className="ad-card-title">
          <FaInfoCircle className="ad-card-title-icon" />
          <span>Additional Information</span>
        </h3>
      </div>

      <div className="ad-additional-info-grid">
        <InlineAutoSaveField
          label="Project Location"
          fieldKey="projectLocation"
          value={projectLocation}
          placeholder="Enter project location"
          canEdit={canEdit}
          onSave={onAutoSave}
        />

        <InlineAutoSaveField
          label="Consultant Name"
          fieldKey="consultantName"
          value={consultantName}
          placeholder="Enter consultant name"
          canEdit={canEdit}
          onSave={onAutoSave}
        />

        <InlineAutoSaveField
          label="PMC Name"
          fieldKey="pmcName"
          value={pmcName}
          placeholder="Enter PMC name"
          canEdit={canEdit}
          onSave={onAutoSave}
        />

        <InlineAutoSaveField
          label="Architect Name"
          fieldKey="architectName"
          value={architectName}
          placeholder="Enter architect name"
          canEdit={canEdit}
          onSave={onAutoSave}
        />

        <InlineAutoSaveField
          label="Alternate Phone"
          fieldKey="alternatePhone"
          value={alternatePhone}
          type="tel"
          placeholder="Enter alternate phone"
          canEdit={canEdit}
          onSave={onAutoSave}
        />

        <InlineAutoSaveField
          label="Alternate Email"
          fieldKey="alternateEmail"
          value={alternateEmail}
          type="email"
          placeholder="Enter alternate email"
          canEdit={canEdit}
          onSave={onAutoSave}
        />
      </div>
    </div>
  )
}
