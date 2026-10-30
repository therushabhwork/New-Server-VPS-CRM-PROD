const { getMongoModel } = require('../models/mongoModels')
const { createCrudRepository } = require('./crudRepositoryFactory')
const { buildScopedMongoFilter, byLegacyId, mergeFilters } = require('./mongoQueryHelpers')

const baseRepository = createCrudRepository({
  table: 'leads',
  ownerColumn: 'owner_user_id',
})

const Lead = getMongoModel('leads')
const visibleFilter = { frontendDeleted: { $ne: true } }

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const accountSearchFieldsByQueryKey = {
  accountNo: ['accountNo', 'accountNumber', 'ownerCode', 'formData.accountNo', 'formData.accountNumber', 'formData.ownerCode'],
  accountNumber: ['accountNo', 'accountNumber', 'ownerCode', 'formData.accountNo', 'formData.accountNumber', 'formData.ownerCode'],
  accountName: ['accountName', 'customerName', 'name', 'company', 'formData.accountName', 'formData.customerName', 'formData.name', 'formData.Account Name', 'data.accountName', 'data.customerName', 'data.name'],
  name: ['accountName', 'customerName', 'name', 'company', 'formData.accountName', 'formData.customerName', 'formData.name', 'formData.Account Name', 'data.accountName', 'data.customerName', 'data.name'],
  projectName: ['projectName', 'company', 'formData.projectName'],
  accountOwner: ['accountOwner', 'ownerName', 'formData.accountOwner', 'formData.ownerName'],
  accountCategory: ['accountCategory', 'customerType', 'industryType', 'formData.accountCategory'],
  consultantName: ['consultantName', 'formData.consultantName'],
  reasonForLost: ['reasonForLost', 'formData.reasonForLost'],
}

const buildAccountSearchFilter = (filters = {}) => {
  const conditions = Object.entries(accountSearchFieldsByQueryKey).flatMap(([queryKey, fields]) => {
    const value = String(filters[queryKey] || '').trim()
    if (!value) return []

    const pattern = new RegExp(escapeRegExp(value), 'i')
    return [{ $or: fields.map((field) => ({ [field]: pattern })) }]
  })

  return conditions.length > 0 ? { $and: conditions } : {}
}

const buildStageFilter = (stage) => {
  if (!stage || stage === 'all') return {}
  const targetStage = String(stage).trim().toLowerCase()
  if (targetStage === 'quotation_sent') {
    return {
      $or: [
        { status: 'quotation_sent' },
        { stage: 'quotation_sent' },
        { 'formData.accountStatus': { $in: ['Quotation Sent', 'quotation_sent'] } },
        { 'formData.status': 'quotation_sent' },
        { 'formData.stage': 'quotation_sent' },
        { 'formData.accountState': { $in: ['Quotation Sent', 'quotation_sent'] } },
      ],
    }
  }
  return {
    $or: [
      { stage: new RegExp('^' + escapeRegExp(targetStage) + '$', 'i') },
      { status: new RegExp('^' + escapeRegExp(targetStage) + '$', 'i') },
      { 'formData.stage': new RegExp('^' + escapeRegExp(targetStage) + '$', 'i') },
      { 'formData.status': new RegExp('^' + escapeRegExp(targetStage) + '$', 'i') },
      { 'formData.accountStatus': new RegExp('^' + escapeRegExp(targetStage) + '$', 'i') },
      ...(targetStage === 'new' ? [
        { stage: null },
        { stage: '' },
        { stage: { $exists: false } },
      ] : []),
    ],
  }
}

const buildGeneralSearchFilter = (query) => {
  const q = String(query || '').trim()
  if (!q) return {}
  const pattern = new RegExp(escapeRegExp(q), 'i')
  return {
    $or: [
      { accountNo: pattern },
      { accountNumber: pattern },
      { accountName: pattern },
      { customerName: pattern },
      { projectName: pattern },
      { company: pattern },
      { 'formData.accountNo': pattern },
      { 'formData.accountNumber': pattern },
      { 'formData.accountName': pattern },
      { 'formData.customerName': pattern },
      { 'formData.projectName': pattern },
      { 'formData.company': pattern },
    ],
  }
}

const mapLeadRow = (record) => {
  const row = baseRepository.map(record)
  if (!row) {
    return null
  }

  const mergedFormData = row.formData && typeof row.formData === 'object' ? row.formData : {}
  const mergedData = row.data && typeof row.data === 'object' ? row.data : {}
  const rawAccountNameCandidates = [
    row.accountName,
    row.customerName,
    row.name,
    mergedFormData.accountName,
    mergedFormData.customerName,
    mergedFormData.name,
    mergedFormData['Account Name'],
    mergedFormData['Customer Name'],
    mergedData.accountName,
    mergedData.customerName,
    mergedData.name,
    mergedData['Account Name'],
    row.company,
  ]
  const isCodePattern = (str) => typeof str === 'string' && /^[A-Z]{2,4}\d{4,8}$/i.test(str.trim())
  const validName = rawAccountNameCandidates.find((val) => typeof val === 'string' && val.trim() && !isCodePattern(val))
  const rawAccountName = validName ? validName.trim() : ''
  if (typeof rawAccountName === 'string' && /Report Filter/i.test(rawAccountName)) {
    return null
  }

  const resolvedAccountNo = row.accountNo || row.accountNumber || row['Account Number'] || row.ownerCode || mergedFormData.accountNumber || mergedFormData.accountNo || mergedFormData['Account Number'] || mergedFormData.ownerCode || null
  const resolvedOwnerName = row.accountOwnerName || row.accountOwner || row.ownerName || mergedFormData.accountOwnerName || mergedFormData.accountOwner || mergedFormData.ownerName || ''

    const isQuotationSent = row.status === 'quotation_sent' || row.stage === 'quotation_sent' || mergedFormData.accountStatus === 'Quotation Sent' || mergedFormData.accountStatus === 'quotation_sent' || mergedFormData.status === 'quotation_sent' || mergedFormData.stage === 'quotation_sent' || mergedFormData.accountState === 'Quotation Sent' || mergedFormData.accountState === 'quotation_sent'
    const resolvedStatus = isQuotationSent ? 'quotation_sent' : (row.status || mergedFormData.accountState || 'pending')
    const resolvedStage = isQuotationSent ? 'quotation_sent' : (row.stage || mergedFormData.stage || null)
    const resolvedAccountStatus = isQuotationSent ? 'Quotation Sent' : (mergedFormData.accountStatus || row.accountStatus || mergedFormData.accountState || resolvedStatus)
    const resolvedAccountState = isQuotationSent ? 'Quotation Sent' : (mergedFormData.accountState || row.status || 'pending')

    return {
      ...row,
      ...mergedFormData,
      id: row.id,
      name: rawAccountName,
      customerName: (row.customerName && row.customerName !== rawAccountName)
        ? row.customerName
        : (mergedFormData.customerName || row.customerName || rawAccountName),
      accountName: rawAccountName,
      accountDate: row.accountDate || mergedFormData.accountDate || null,
      accountCategory: row.accountCategory || mergedFormData.accountCategory || null,
      contactPerson: row.contactPerson || mergedFormData.contactPerson || null,
      phone: row.phone || row.mobile || mergedFormData.phone || mergedFormData.alternatePhone || null,
      email: row.email || mergedFormData.email || mergedFormData.alternateEmail || '',
      contactEmail: row.contactEmail || row.email || mergedFormData.contactEmail || mergedFormData.email || '',
      alternatePhone: row.alternatePhone || mergedFormData.alternatePhone || null,
      alternateEmail: row.alternateEmail || mergedFormData.alternateEmail || null,
      secondaryPhone: row.secondaryPhone || row.secondaryPhoneNumber || mergedFormData.secondaryPhone || mergedFormData.secondaryPhoneNumber || mergedData.secondaryPhone || mergedData.secondaryPhoneNumber || null,
      secondaryPhoneNumber: row.secondaryPhoneNumber || row.secondaryPhone || mergedFormData.secondaryPhoneNumber || mergedFormData.secondaryPhone || mergedData.secondaryPhoneNumber || mergedData.secondaryPhone || null,
      customerType: row.customerType || mergedFormData.customerType || null,
      dealName: row.dealName || mergedFormData.dealName || mergedData.dealName || row.projectName || mergedFormData.projectName || rawAccountName,
      projectName: row.projectName || mergedFormData.projectName || row.dealName || mergedFormData.dealName || mergedData.dealName || row.company || '',
      productCategory: row.productCategory || mergedFormData.productCategory || null,
      state: row.state || mergedFormData.state || null,
      location: row.location || mergedFormData.location || null,
      industryType: row.industryType || mergedFormData.industryType || mergedFormData.industry || null,
      customerRefNo: row.customerRefNo || mergedFormData.customerRefNo || null,
      jobNo: row.jobNo || mergedFormData.jobNo || row.customerRefNo || mergedFormData.customerRefNo || null,
      consultantName: row.consultantName || mergedFormData.consultantName || null,
      projectLocation: row.projectLocation || mergedFormData.projectLocation || null,
      pmcName: row.pmcName || mergedFormData.pmcName || null,
      architectName: row.architectName || mergedFormData.architectName || null,
      poValue: [
        row.poValue,
        mergedFormData.poValue,
        mergedData.poValue,
        row.dealValue,
        mergedFormData.dealValue,
        mergedData.dealValue,
        mergedFormData['PO Value'],
        mergedData['PO Value'],
        row['PO Value'],
        row.projectValue,
        mergedFormData.projectValue,
      ].find((v) => v !== undefined && v !== null && String(v).trim() !== '') ?? null,
      dealValue: [
        row.dealValue,
        row.poValue,
        mergedFormData.dealValue,
        mergedFormData.poValue,
        mergedData.dealValue,
        mergedData.poValue,
        mergedFormData['PO Value'],
      ].find((v) => v !== undefined && v !== null && String(v).trim() !== '') ?? null,
      userGroup: row.userGroup || mergedFormData.userGroup || null,
      mobile: row.mobile || row.phone || mergedFormData.alternatePhone || mergedFormData.phone || '',
      company: row.company || row.projectName || mergedFormData.projectName || mergedFormData.company || '',
      status: resolvedStatus,
      stage: resolvedStage,
      accountStatus: resolvedAccountStatus,
      accountState: resolvedAccountState,
      actualAccountStatus: row.actualAccountStatus || mergedFormData.actualAccountStatus || null,
      actualDealStatus: row.actualDealStatus || mergedFormData.actualDealStatus || null,
      projectStatus: row.projectStatus || mergedFormData.projectStatus || null,
      lostDate: row.lostDate || mergedFormData.lostDate || null,
      wonDate: row.wonDate || mergedFormData.wonDate || null,
      statusDate: row.statusDate || mergedFormData.statusDate || null,
      companyId: row.companyId || 1,
      ownerUserId: row.ownerUserId || row.assignedTo || row.createdBy || null,
      projectId: row.projectId || null,
      workflowId: row.workflowId || null,
      assignedTo: row.assignedTo || null,
      createdBy: row.createdBy || null,
      ownerName: resolvedOwnerName,
      notes: row.notes || mergedFormData.remark || '',
      formType: row.formType || 'account',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByUserId: row.createdByUserId || mergedFormData.createdByUserId || row.createdBy || null,
      createdByUserName: row.createdByUserName || mergedFormData.createdByUserName || '',
      createdUserBy: row.createdUserBy || mergedFormData.createdUserBy || '',
      ownerCode: row.ownerCode || row.accountOwnerCode || mergedFormData.ownerCode || mergedFormData.accountOwnerCode || null,
      accountOwnerCode: row.accountOwnerCode || row.ownerCode || mergedFormData.accountOwnerCode || mergedFormData.ownerCode || null,
      employeeId: row.employeeId || mergedFormData.employeeId || '',
      department: row.department || mergedFormData.department || '',
      userEmail: row.userEmail || mergedFormData.userEmail || '',
      accountNo: resolvedAccountNo,
      accountNumber: resolvedAccountNo,
      accountOwner: resolvedOwnerName,
      accountOwnerName: resolvedOwnerName,
      ownerId: row.assignedTo || null,
      assignedUserId: row.assignedTo || null,
      userId: row.createdBy || null,
    }
}

const listAllLeads = async () => {
  const records = await Lead.find(visibleFilter).sort({ createdAt: -1, legacyId: -1 }).lean()
  return records.map(mapLeadRow).filter(Boolean)
}

const getLeadScopeOptions = ({ scopeUserIds = null, scopeOwnerCodes = [] } = {}) => ({
  scopeUserIds,
  additionalScopeGroups: scopeOwnerCodes.length
    ? [{ fields: ['accountNo', 'accountNumber', 'ownerCode', 'accountOwnerCode', 'formData.accountNumber', 'formData.accountNo', 'formData.ownerCode', 'formData.accountOwnerCode'], values: scopeOwnerCodes }]
    : [],
})

const buildLeadScopeFilter = (actor, { companyWide = false, scopeUserIds = null, scopeOwnerCodes = [] } = {}) => (
  buildScopedMongoFilter({
    actor,
    ownerFields: ['ownerUserId', 'assignedTo', 'createdBy', 'owner_user_id', 'assigned_to', 'created_by'],
    companyField: 'companyId',
    companyWide,
    ...getLeadScopeOptions({ scopeUserIds, scopeOwnerCodes }),
  })
)

const enrichLeadsWithDealsPoValue = async (mappedRecords = []) => {
  if (!Array.isArray(mappedRecords) || mappedRecords.length === 0) return mappedRecords
  try {
    const Deal = getMongoModel('deals')
    if (!Deal) return mappedRecords

    const missingIds = mappedRecords
      .filter((r) => r.poValue === null || r.poValue === '' || r.poValue === undefined)
      .map((r) => r.legacyId || r.id)
      .filter(Boolean)

    if (missingIds.length === 0) return mappedRecords

    const matchingDeals = await Deal.find({
      $or: [
        { accountId: { $in: missingIds } },
        { accountId: { $in: missingIds.map(String) } },
        { accountId: { $in: missingIds.map(Number).filter(n => !isNaN(n)) } },
      ],
      frontendDeleted: { $ne: true },
    }).sort({ updatedAt: -1, createdAt: -1 }).lean()

    if (matchingDeals && matchingDeals.length > 0) {
      const dealPoMap = new Map()
      matchingDeals.forEach((d) => {
        const accId = String(d.accountId || '')
        if (accId && !dealPoMap.has(accId)) {
          const val = [
            d.poValue,
            d.dealValue,
            d.amount,
            d.value,
            d.formData?.poValue,
            d.formData?.dealValue,
            d.data?.poValue,
            d.data?.dealValue,
          ].find((v) => v !== undefined && v !== null && String(v).trim() !== '')
          if (val !== undefined) {
            dealPoMap.set(accId, val)
          }
        }
      })

      mappedRecords.forEach((row) => {
        if (row.poValue === null || row.poValue === '' || row.poValue === undefined) {
          const accId = String(row.legacyId || row.id || '')
          if (dealPoMap.has(accId)) {
            const foundVal = dealPoMap.get(accId)
            row.poValue = foundVal
            row.dealValue = foundVal
          }
        }
      })
    }
  } catch (err) {
    console.warn('enrichLeadsWithDealsPoValue warning:', err.message)
  }
  return mappedRecords
}

const listLeadsForActor = async (actor, options = {}) => {
  const rawLimit = String(options.limit ?? options.filters?.limit ?? '').trim().toLowerCase()
  const shouldReturnAll = !rawLimit || ['all', '0', '-1'].includes(rawLimit)
  const page = Math.max(1, Number.parseInt(String(options.page || options.filters?.page || '1'), 10) || 1)
  const limit = shouldReturnAll ? 0 : Math.min(5000, Math.max(1, Number.parseInt(rawLimit, 10) || 5000))

  const filter = mergeFilters(
    buildLeadScopeFilter(actor, options),
    buildAccountSearchFilter(options.filters || {}),
    buildStageFilter(options.filters?.stage || options.stage),
    buildGeneralSearchFilter(options.filters?.search || options.filters?.query || options.filters?.q || options.search),
    visibleFilter
  )

  let query = Lead.find(filter).sort({ createdAt: -1, legacyId: -1 })

  if (limit > 0) {
    const total = await Lead.countDocuments(filter)
    query = query.skip((page - 1) * limit).limit(limit)
    const records = await query.lean()
    const mapped = records.map(mapLeadRow).filter(Boolean)
    const enriched = await enrichLeadsWithDealsPoValue(mapped)
    return {
      records: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  const records = await query.lean()
  const mapped = records.map(mapLeadRow).filter(Boolean)
  return enrichLeadsWithDealsPoValue(mapped)
}

const listAssignedLeads = async (userId) => {
  const records = await Lead
    .find(mergeFilters({ $or: [{ assignedTo: userId }, { createdBy: userId }] }, visibleFilter))
    .sort({ createdAt: -1, legacyId: -1 })
    .lean()

  return records.map(mapLeadRow).filter(Boolean)
}

const listCreatedLeadsForActor = async (actor, filters = {}) => {
  const rawLimit = String(filters.limit ?? '').trim().toLowerCase()
  const shouldReturnAll = !rawLimit || ['all', '0', '-1'].includes(rawLimit)
  const page = Math.max(1, Number.parseInt(String(filters.page || '1'), 10) || 1)
  const limit = shouldReturnAll ? 0 : Math.min(5000, Math.max(1, Number.parseInt(rawLimit, 10) || 5000))

  const ownerCodeStr = String(actor.ownerCode || actor.employeeId || '').trim()
  const actorName = String(actor.name || actor.username || '').trim()

  const filter = mergeFilters(
    {
      companyId: actor.companyId,
      $or: [
        { createdBy: actor.id },
        { createdByUserId: actor.id },
        { assignedTo: actor.id },
        { ownerUserId: actor.id },
        { 'formData.userId': actor.id },
        { 'formData.createdByUserId': actor.id },
        { 'formData.assignedTo': actor.id },
        { 'formData.ownerId': actor.id },
        ...(ownerCodeStr ? [
          { ownerCode: ownerCodeStr },
          { accountOwnerCode: ownerCodeStr },
          { accountNumber: ownerCodeStr },
          { accountNo: ownerCodeStr },
          { 'formData.ownerCode': ownerCodeStr },
          { 'formData.accountOwnerCode': ownerCodeStr },
        ] : []),
        ...(actorName ? [
          { accountOwner: actorName },
          { accountOwnerName: actorName },
          { ownerName: actorName },
          { 'formData.accountOwner': actorName },
          { 'formData.accountOwnerName': actorName },
          { 'formData.ownerName': actorName },
        ] : []),
      ],
    },
    buildAccountSearchFilter(filters),
    buildStageFilter(filters.stage),
    buildGeneralSearchFilter(filters.search || filters.query || filters.q),
    visibleFilter
  )

  let query = Lead.find(filter).sort({ createdAt: -1, legacyId: -1 })

  if (limit > 0) {
    const total = await Lead.countDocuments(filter)
    query = query.skip((page - 1) * limit).limit(limit)
    const records = await query.lean()
    const mapped = records.map(mapLeadRow).filter(Boolean)
    return {
      records: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  const records = await query.lean()
  return records.map(mapLeadRow).filter(Boolean)
}

const findLeadById = async (leadId) => {
  const record = await Lead.findOne(mergeFilters(byLegacyId(leadId), visibleFilter)).lean()
  const mapped = mapLeadRow(record)
  if (!mapped) return null
  const [enriched] = await enrichLeadsWithDealsPoValue([mapped])
  return enriched || mapped
}

const findLeadByIdForActor = async (leadId, actor, options = {}) => {
  const record = await Lead.findOne(mergeFilters(byLegacyId(leadId), buildLeadScopeFilter(actor, options), visibleFilter)).lean()
  const mapped = mapLeadRow(record)
  if (!mapped) return null
  const [enriched] = await enrichLeadsWithDealsPoValue([mapped])
  return enriched || mapped
}

const createLead = async (payload) => {
  const created = await baseRepository.create(payload)
  if (!created.accountNo && !created.accountNumber) {
    const generatedAccountNo = `ACC${String(created.id).padStart(5, '0')}`
    await baseRepository.update(created.id, {
      accountNo: generatedAccountNo,
      accountNumber: generatedAccountNo,
      formData: {
        ...(created.formData && typeof created.formData === 'object' ? created.formData : {}),
        accountNo: generatedAccountNo,
        accountNumber: generatedAccountNo,
        account_no: generatedAccountNo,
      },
    })
  }
  return findLeadById(created.id)
}

const updateLead = async (leadId, updates = {}) => {
  const updated = await baseRepository.update(leadId, updates)
  return updated?.id ? findLeadById(updated.id) : null
}

const deleteLead = async (leadId) => {
  const result = await Lead.findOneAndDelete(byLegacyId(leadId)).lean()
  return Boolean(result)
}

const frontendDeleteLead = async (leadId, actor = {}) => {
  const deletedAt = new Date().toISOString()
  const record = await Lead.findOneAndUpdate(
    byLegacyId(leadId),
    {
      $set: {
        frontendDeleted: true,
        frontendDeletedAt: deletedAt,
        frontendDeletedBy: actor?.id || null,
      },
    },
    { new: true }
  ).lean()
  return mapLeadRow(record)
}

module.exports = {
  listAllLeads,
  listLeadsForActor,
  listAssignedLeads,
  listCreatedLeadsForActor,
  findLeadById,
  findLeadByIdForActor,
  createLead,
  updateLead,
  deleteLead,
  frontendDeleteLead,
  mapLeadRow,
}
