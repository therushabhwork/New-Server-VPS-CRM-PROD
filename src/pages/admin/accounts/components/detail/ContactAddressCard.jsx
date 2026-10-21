import React from 'react'
import { FaAddressCard } from 'react-icons/fa'
import InlineAutoSaveField from './InlineAutoSaveField'
import { STATE_OPTIONS } from '../../../../../features/accounts/config/accountDropdownOptions'

export default function ContactAddressCard({
  account = {},
  form = {},
  onAutoSave,
  canEdit = true,
}) {
  const alternatePhone = form.alternatePhone || account.alternatePhone || ''
  const alternateEmail = form.alternateEmail || account.alternateEmail || ''
  const address = form.address || account.address || ''
  const city = form.city || account.city || ''
  const state = form.state || account.state || ''
  const pincode = form.pincode || account.pincode || form.zipCode || account.zipCode || ''
  const landline = form.landline || account.landline || form.phone2 || account.phone2 || ''
  const description = form.description || account.description || ''

  return (
    <div className="ad-card">
      <div className="ad-card-header">
        <h3 className="ad-card-title">
          <FaAddressCard className="ad-card-title-icon" />
          <span>Contact & Address</span>
        </h3>
      </div>

      <div className="ad-contact-address-split">
        {/* Contact Details Column */}
        <div className="ad-sub-section">
          <span className="ad-sub-section-title">Contact Details</span>

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

          <InlineAutoSaveField
            label="Landline"
            fieldKey="landline"
            value={landline}
            type="tel"
            placeholder="Enter landline"
            canEdit={canEdit}
            onSave={onAutoSave}
          />
        </div>

        {/* Address Column */}
        <div className="ad-sub-section">
          <span className="ad-sub-section-title">Address & Location</span>

          <InlineAutoSaveField
            label="Address"
            fieldKey="address"
            value={address}
            multiline
            placeholder="Enter address"
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="City"
            fieldKey="city"
            value={city}
            placeholder="Enter city"
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="State"
            fieldKey="state"
            value={state}
            type="select"
            options={STATE_OPTIONS}
            canEdit={canEdit}
            onSave={onAutoSave}
          />

          <InlineAutoSaveField
            label="Pincode"
            fieldKey="pincode"
            value={pincode}
            placeholder="Enter pincode"
            canEdit={canEdit}
            onSave={onAutoSave}
          />
        </div>
      </div>

      <hr className="ad-divider" />

      {/* Description Section */}
      <div className="ad-sub-section">
        <InlineAutoSaveField
          label="Description"
          fieldKey="description"
          value={description}
          multiline
          placeholder="Enter description..."
          canEdit={canEdit}
          onSave={onAutoSave}
        />
      </div>
    </div>
  )
}
