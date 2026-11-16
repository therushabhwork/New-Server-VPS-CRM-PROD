export const normalizeSectionSearchValue = (value) => (
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
)

const SEARCH_FIELD_ALIASES = {
  accountNumber: ['accountNumber', 'accountNo', 'account_number', 'ownerCode', 'id'],
  accountNo: ['accountNo', 'accountNumber', 'account_number', 'ownerCode', 'id'],
  accountName: ['accountName', 'name', 'customerName', 'companyName'],
  name: ['name', 'accountName', 'customerName', 'companyName'],
  projectName: ['projectName', 'project', 'project_name', 'productCategory'],
  accountOwner: ['accountOwner', 'accountOwnerDisplay', 'accountOwnerName', 'ownerName', 'assignedToName', 'owner'],
  dealOwner: ['dealOwner', 'dealOwnerDisplay', 'dealOwnerName', 'ownerName', 'owner'],
  customerOwner: ['customerOwner', 'customerOwnerDisplay', 'customerOwnerName', 'ownerName', 'owner'],
  quotationOwner: ['quotationOwner', 'quotationOwnerDisplay', 'quotationOwnerName', 'ownerName', 'owner'],
  ownerName: ['ownerName', 'owner', 'assignedToName', 'accountOwner', 'dealOwner', 'customerOwner'],
  accountDate: ['accountDate', 'account_date', 'accountDateDisplay', 'createdAt', 'addedDate'],
  dealDate: ['dealDate', 'deal_date', 'dealDateDisplay', 'createdAt'],
  quotationDate: ['quotationDate', 'quotation_date', 'date', 'createdAt'],
  addedDate: ['addedDate', 'addedOn', 'createdAt'],
  serviceDate: ['serviceDate', 'srDate', 'requestDate', 'service_date', 'createdAt'],
  lastUpdated: ['lastUpdated', 'updatedAt', 'updatedAtDisplay'],
  accountStatus: ['accountStatus', 'status'],
  dealStatus: ['dealStatus', 'status', 'stage'],
  customerStatus: ['customerStatus', 'status'],
  status: ['status', 'accountStatus', 'dealStatus', 'customerStatus'],
  accountCategory: ['accountCategory', 'category'],
  accountState: ['accountState', 'state'],
  customerCategory: ['customerCategory', 'category'],
  customerType: ['customerType', 'type'],
  dealType: ['dealType', 'type'],
  convertToPo: ['convertToPo', 'convertPO', 'convert_to_po', 'convertToPO'],
  poValue: ['poValue', 'po_value'],
  dealValue: ['dealValue', 'deal_value', 'value'],
  lostOrderReason: ['lostOrderReason', 'reasonForLostOrder', 'reasonForLost', 'lost_order_reason'],
  reasonForLostOrder: ['reasonForLostOrder', 'lostOrderReason', 'reasonForLost', 'lost_order_reason'],
  quotationNumber: ['quotationNumber', 'quotationNo', 'num', 'number'],
  companyName: ['companyName', 'company', 'clientName', 'customerName'],
  amount: ['amount', 'amountLabel', 'totalAmount', 'total_amount'],
  srNumber: ['srNumber', 'srNo', 'sr_number'],
  requestType: ['requestType', 'serviceType', 'type'],
  customerNumber: ['customerNumber', 'customerNo', 'customer_number'],
  latestRemark: ['latestRemark', 'remark', 'remarks'],
  contactPerson: ['contactPerson', 'contactName', 'clientName', 'contact_person', 'name', 'contacts.0.name', 'contacts.0.contactPerson'],
  phone: ['phone', 'contactMobile', 'contactPhone', 'mobile', 'telephone', 'contacts.0.mobile', 'contacts.0.phone'],
  email: ['email', 'contactEmail', 'userEmail', 'contacts.0.email'],
  stage: ['stage', 'status', 'accountStatus', 'accountCategory', 'priority'],
}

const getNestedValue = (record, path) => String(path).split('.').reduce((value, key) => value?.[key], record)

export const getSectionSearchValues = (record = {}, field) => {
  if (typeof field === 'function') return [field(record)]

  const keys = Array.isArray(field)
    ? field
    : (SEARCH_FIELD_ALIASES[field] || [field])

  const sources = [record, record?.raw, record?.formData, record?.raw?.formData]
  const baseValues = sources.flatMap((source) => keys.map((key) => getNestedValue(source, key)))

  // Also include values from embedded contacts list if searching for contact, phone, or email
  const fieldStr = String(field || '').toLowerCase()
  if (fieldStr.includes('contact') || fieldStr.includes('phone') || fieldStr.includes('email')) {
    const contactLists = [record.contacts, record.raw?.contacts, record.formData?.contacts, record.raw?.formData?.contacts]
    for (const cl of contactLists) {
      if (Array.isArray(cl)) {
        for (const c of cl) {
          if (c && typeof c === 'object') {
            baseValues.push(c.name, c.contactPerson, c.mobile, c.phone, c.email)
          }
        }
      }
    }
  }

  return baseValues
}

export const matchesSectionSearch = (record, fields, query) => {
  const normalizedQuery = normalizeSectionSearchValue(query)
  if (!normalizedQuery) return true

  return fields.some((field) => {
    return getSectionSearchValues(record, field)
      .some((value) => normalizeSectionSearchValue(value).includes(normalizedQuery))
  })
}
