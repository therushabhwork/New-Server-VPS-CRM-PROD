const { getMongoModel } = require('../models/mongoModels')
const { toNumberOrNull } = require('../security/accessScope')
const { createCrudRepository } = require('./crudRepositoryFactory')
const { buildScopedMongoFilter, byLegacyId, mergeFilters, regexSearch } = require('./mongoQueryHelpers')

const baseRepository = createCrudRepository({
  table: 'deals',
  ownerColumn: 'owner_user_id',
})

const Deal = getMongoModel('deals')
const Lead = getMongoModel('leads')
const User = getMongoModel('users')
const visibleFilter = { frontendDeleted: { $ne: true } }

const normalizeDealCityForFilter = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'ahmedabad' || normalizedValue === 'ahmadabad') return 'ahmadabad'
  if (normalizedValue === 'baroda' || normalizedValue === 'vadodara') return 'vadodara'
  return String(value || '').trim()
}

const normalizeMappedDeal = async (record, accountMap = null) => {
  const mapped = baseRepository.map(record)
  if (!mapped) return null

  const data = mapped.data && typeof mapped.data === 'object' ? mapped.data : {}
  const latest = (...values) => values.find((value) => value !== undefined && value !== null)
  const latestText = (...values) => String(latest(...values, '') || '').trim()
  const resolvedAmount = latest(data.amount, data.value, data.dealValue, data.deal_value, mapped.amount, mapped.value, mapped.dealValue, mapped.deal_value)
  const resolvedTitle = latestText(data.name, data.dealName, data.deal_name, mapped.name, mapped.dealName, mapped.deal_name, mapped.title)
  const resolvedProjectName = latestText(data.projectName, data.project_name, mapped.projectName, mapped.project_name, resolvedTitle)
  const resolvedCity = latestText(data.city, data.location, data.branchLocation, data.projectLocation, mapped.city, mapped.location, mapped.branchLocation, mapped.projectLocation)
  let linkedAccountName = mapped.linkedAccountName || mapped.accountName || mapped.account_name || data.linkedAccountName || data.accountName || data.account_name || ''
  let linkedAccountNumber = mapped.linkedAccountNumber || mapped.accountNumber || mapped.account_number || data.linkedAccountNumber || data.accountNumber || data.account_number || data.accountNo || data.account_no || ''

  const accountId = toNumberOrNull(mapped.accountId)
  let account = null
  let formData = {}
  if (accountId !== null) {
    account = accountMap ? accountMap.get(accountId) : null
    if (!account && !accountMap) {
      account = await Lead.findOne(byLegacyId(accountId)).lean()
    }
    if (account) {
      formData = account?.formData && typeof account.formData === 'object' ? account.formData : {}
      if (!linkedAccountName) {
        linkedAccountName = account?.accountName || formData.accountName || account?.customerName || formData.customerName || (account?.company !== account?.projectName ? account?.company : '') || ''
      }
      if (!linkedAccountNumber) {
        linkedAccountNumber = formData.accountNumber || formData.accountNo || account?.accountNo || ''
      }
    }
  }

  const dynamicReassignedDates = []
  const scanTargets = [mapped, data, record]
  for (const target of scanTargets) {
    if (!target || typeof target !== 'object') continue
    for (const [k, v] of Object.entries(target)) {
      if (/^reassignedDate\d*$/i.test(k) && v) {
        dynamicReassignedDates.push(v)
      }
    }
  }
  const resolvedReassignedDate = dynamicReassignedDates.length > 0
    ? dynamicReassignedDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : latestText(data.reassignedDate, mapped.reassignedDate, data.reassignDate, mapped.reassignDate)

  return {
    ...mapped,
    dealNumber: mapped.dealNumber || mapped.deal_number || data.dealNumber || data.deal_number || '',
    name: resolvedTitle,
    title: resolvedTitle || mapped.title || 'Untitled Deal',
    amount: resolvedAmount ?? null,
    value: resolvedAmount ?? null,
    dealValue: resolvedAmount ?? null,
    customerName: latestText(mapped.customerName, mapped.customer_name, data.customerName, data.customer_name, linkedAccountName),
    customerNumber: latestText(mapped.customerNumber, mapped.customer_number, data.customerNumber, data.customer_number, data.customerNo, data.customer_no),
    accountName: linkedAccountName,
    linkedAccountName: linkedAccountName,
    accountNumber: linkedAccountNumber,
    status: latestText(data.status, mapped.status, data.stage, mapped.stage),
    stage: latestText(data.stage, mapped.stage, data.status, mapped.status) || 'new',
    probability: latest(data.probability, mapped.probability, null),
    expectedCloseDate: latestText(data.expectedCloseDate, data.expectedClosureDate, data.closeDate, mapped.expectedCloseDate, mapped.expectedClosureDate, mapped.closeDate),
    expectedClosureDate: latestText(data.expectedClosureDate, data.expectedCloseDate, data.closeDate, mapped.expectedClosureDate, mapped.expectedCloseDate, mapped.closeDate),
    closeDate: latestText(data.closeDate, data.expectedCloseDate, mapped.closeDate, mapped.expectedCloseDate),
    actualClosureDate: latestText(data.actualClosureDate, data.actual_closure_date, mapped.actualClosureDate, mapped.actual_closure_date),
    dealDate: latestText(data.dealDate, data.deal_date, mapped.dealDate, mapped.deal_date, data.accountDate, mapped.accountDate, data.createdAt, mapped.createdAt),
    dealType: latestText(data.dealType, data.deal_type, mapped.dealType, mapped.deal_type, data.customerCategory, data.customer_category, mapped.customerCategory, mapped.customer_category),
    dealSource: latestText(data.dealSource, data.deal_source, data.source, mapped.dealSource, mapped.deal_source, mapped.source),
    source: latestText(data.source, data.dealSource, mapped.source, mapped.dealSource),
    dealSubsource: latestText(data.dealSubsource, data.subsource, mapped.dealSubsource, mapped.subsource),
    subsource: latestText(data.subsource, data.dealSubsource, mapped.subsource, mapped.dealSubsource),
    city: normalizeDealCityForFilter(resolvedCity),
    location: resolvedCity,
    companyName: latestText(data.companyName, data.company_name, mapped.companyName, mapped.company_name, data.accountName, data.account_name, linkedAccountName),
    companyProfile: latestText(data.companyProfile, data.company_profile, mapped.companyProfile, mapped.company_profile, data.company, mapped.company),
    companyLogo: latestText(data.companyLogo, mapped.companyLogo),
    projectName: resolvedProjectName,
    projectStatus: latestText(data.projectStatus, mapped.projectStatus),
    actualDealStatus: latestText(data.actualDealStatus, mapped.actualDealStatus),
    actualAccountStatus: latestText(data.actualAccountStatus, mapped.actualAccountStatus),
    accountState: latestText(data.accountState, mapped.accountState),
    lostDate: latestText(data.lostDate, mapped.lostDate),
    wonDate: latestText(data.wonDate, mapped.wonDate),
    statusDate: latestText(data.statusDate, mapped.statusDate),
    actualDealStatusDate: latestText(data.actualDealStatusDate, mapped.actualDealStatusDate),
    actualAccountStatusDate: latestText(data.actualAccountStatusDate, mapped.actualAccountStatusDate),
    statusAsPerOrderReceived: latestText(data.statusAsPerOrderReceived, data.orderCustomerStatus, mapped.statusAsPerOrderReceived, mapped.orderCustomerStatus),
    statusAsPerQuotationGiven: latestText(data.statusAsPerQuotationGiven, data.quotationCustomerStatus, mapped.statusAsPerQuotationGiven, mapped.quotationCustomerStatus),
    poValue: latest(data.poValue, mapped.poValue, ''),
    jobNo: latestText(data.jobNo, mapped.jobNo),
    contactPerson: latestText(data.contactPerson, data.contactName, mapped.contactPerson, mapped.contactName),
    contactName: latestText(data.contactName, data.contactPerson, mapped.contactName, mapped.contactPerson),
    contactMobile: latestText(data.contactMobile, data.phone, mapped.contactMobile, mapped.phone),
    contactPhone: latestText(data.contactPhone, data.phone, mapped.contactPhone, mapped.phone),
    phone: latestText(data.phone, data.contactMobile, data.contactPhone, mapped.phone, mapped.contactMobile, mapped.contactPhone),
    secondaryPhoneNumber: latestText(data.secondaryPhoneNumber, data.secondaryPhone, data.alternatePhone, mapped.secondaryPhoneNumber, mapped.secondaryPhone, mapped.alternatePhone, account?.secondaryPhoneNumber, account?.secondaryPhone, account?.alternatePhone, formData?.secondaryPhoneNumber, formData?.secondaryPhone, formData?.alternatePhone),
    secondaryPhone: latestText(data.secondaryPhoneNumber, data.secondaryPhone, data.alternatePhone, mapped.secondaryPhoneNumber, mapped.secondaryPhone, mapped.alternatePhone, account?.secondaryPhoneNumber, account?.secondaryPhone, account?.alternatePhone, formData?.secondaryPhoneNumber, formData?.secondaryPhone, formData?.alternatePhone),
    alternatePhone: latestText(data.secondaryPhoneNumber, data.secondaryPhone, data.alternatePhone, mapped.secondaryPhoneNumber, mapped.secondaryPhone, mapped.alternatePhone, account?.secondaryPhoneNumber, account?.secondaryPhone, account?.alternatePhone, formData?.secondaryPhoneNumber, formData?.secondaryPhone, formData?.alternatePhone),
    reassignedDate: resolvedReassignedDate,
    reassignDate: resolvedReassignedDate,
    contactEmail: latestText(data.contactEmail, data.email, mapped.contactEmail, mapped.email),
    email: latestText(data.email, data.contactEmail, mapped.email, mapped.contactEmail),
    address: latestText(data.address, mapped.address),
    description: latestText(data.description, mapped.description),
    dealScore: latest(data.dealScore, mapped.dealScore, null),
    productCategory: latestText(data.productCategory, mapped.productCategory),
    consultantName: latestText(data.consultantName, mapped.consultantName),
    gstin: latestText(data.gstin, mapped.gstin),
    orderCustomerStatus: latestText(data.orderCustomerStatus, mapped.orderCustomerStatus),
    quotationCustomerStatus: latestText(data.quotationCustomerStatus, mapped.quotationCustomerStatus),
    customerReferenceDate: latestText(data.customerReferenceDate, data.customerRefDate, mapped.customerReferenceDate, mapped.customerRefDate),
    customerReferenceNumber: latestText(data.customerReferenceNumber, data.customerRefNo, mapped.customerReferenceNumber, mapped.customerRefNo),
    reasonForLostOrder: latestText(data.reasonForLostOrder, data.reasonForLost, mapped.reasonForLostOrder, mapped.reasonForLost),
    reasonForLost: latestText(data.reasonForLost, data.reasonForLostOrder, mapped.reasonForLost, mapped.reasonForLostOrder),
    linkedAccountName,
    linkedAccountNumber,
  }
}

const mapDeals = async (records = []) => {
  if (!Array.isArray(records) || records.length === 0) return []
  const missingAccountIds = new Set()
  records.forEach((record) => {
    const raw = record.data && typeof record.data === 'object' ? record.data : {}
    const hasName = record.linkedAccountName || record.accountName || raw.linkedAccountName || raw.accountName
    const hasNumber = record.linkedAccountNumber || record.accountNumber || raw.linkedAccountNumber || raw.accountNumber
    const accId = toNumberOrNull(record.accountId ?? raw.accountId)
    if (accId !== null && (!hasName || !hasNumber)) {
      missingAccountIds.add(accId)
    }
  })
  const accountMap = new Map()
  if (missingAccountIds.size > 0) {
    try {
      const idList = Array.from(missingAccountIds)
      const accounts = await Lead.find({
        $or: [{ legacyId: { $in: idList } }, { id: { $in: idList } }],
      }).lean()
      accounts.forEach((acc) => {
        const key = acc.legacyId ?? acc.id
        if (key !== undefined && key !== null) {
          accountMap.set(Number(key), acc)
        }
      })
    } catch (err) {
      console.warn('Batch account lookup warning in mapDeals:', err.message)
    }
  }
  return Promise.all(records.map((r) => normalizeMappedDeal(r, accountMap)))
}

const buildSearchFilter = (searchTerm) => {
  const trimmedSearch = String(searchTerm || '').trim()
  if (!trimmedSearch) return {}

  const pattern = regexSearch(trimmedSearch)
  return {
    $or: [
      { title: pattern },
      { customerName: pattern },
      { dealNumber: pattern },
      { accountName: pattern },
      { linkedAccountName: pattern },
      { 'data.dealNumber': pattern },
      { 'data.accountName': pattern },
      { 'data.projectName': pattern },
      { 'data.customerName': pattern },
    ],
  }
}

const sortFromFilters = (filters = {}) => {
  const sortBy = String(filters.sortBy || '').trim()
  const direction = String(filters.sortDir || '').trim().toLowerCase() === 'asc' ? 1 : -1
  const sortableFields = {
    amount: 'amount',
    createdAt: 'createdAt',
    customerName: 'customerName',
    expectedCloseDate: 'expectedCloseDate',
    stage: 'stage',
    title: 'title',
    updatedAt: 'updatedAt',
    legacyId: 'legacyId',
  }

  if (!sortBy) {
    return { updatedAt: -1, createdAt: -1, legacyId: -1 }
  }

  return {
    [sortableFields[sortBy] || 'createdAt']: direction,
    legacyId: -1,
  }
}

const listWithFilters = async (actor, filters = {}, { companyWide = false, scopeUserIds = null } = {}) => {
  const ownerUserId = toNumberOrNull(filters.ownerUserId ?? filters.owner_id ?? filters.ownerId)
  const coOwnerId = toNumberOrNull(filters.coOwnerId ?? filters.co_owner_id ?? filters.coOwnerUserId)
  const ownerName = String(filters.ownerName ?? filters.owner_name ?? '').trim()
  const stage = String(filters.stage || '').trim()
  const rawLimit = String(filters.limit ?? '').trim().toLowerCase()
  const shouldReturnAll = !rawLimit || ['all', '0', '-1'].includes(rawLimit)
  const page = Math.max(1, Number.parseInt(String(filters.page || '1'), 10) || 1)
  const limit = shouldReturnAll
    ? 0
    : Math.min(5000, Math.max(1, Number.parseInt(rawLimit, 10) || 5000))

  const isMineOnly = filters.scope === 'mine' || filters.myDeals === 'true' || filters.myDeals === true
  const effectiveCompanyWide = isMineOnly ? false : companyWide

  let mineFilter = {}
  if (isMineOnly) {
    let resolvedOwnerName = String(actor?.name || actor?.username || '').trim()
    let resolvedOwnerEmail = String(actor?.email || '').trim().toLowerCase()

    if (User) {
      const userCriteria = []
      if (actor?.id) userCriteria.push({ id: actor.id }, { legacyId: actor.id })
      if (actor?.email) userCriteria.push({ email: actor.email })
      if (actor?.name) userCriteria.push({ name: actor.name })
      if (actor?.username) userCriteria.push({ username: actor.username })
      if (userCriteria.length > 0) {
        const userDoc = await User.findOne({ $or: userCriteria }).lean().catch(() => null)
        if (userDoc) {
          if (userDoc.name) resolvedOwnerName = String(userDoc.name).trim()
          if (userDoc.email) resolvedOwnerEmail = String(userDoc.email).trim().toLowerCase()
        }
      }
    }

    let linkedAccountIds = []
    if (Lead && (resolvedOwnerName || resolvedOwnerEmail)) {
      const leadQuery = []
      if (resolvedOwnerName) {
        const nameEscaped = resolvedOwnerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const nameRegex = new RegExp(`^${nameEscaped}$`, 'i')
        leadQuery.push(
          { accountOwner: nameRegex },
          { 'formData.accountOwner': nameRegex },
          { assignedUserName: nameRegex },
          { ownerName: nameRegex }
        )
      }
      if (resolvedOwnerEmail) {
        const emailEscaped = resolvedOwnerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const emailRegex = new RegExp(`^${emailEscaped}$`, 'i')
        leadQuery.push(
          { email: emailRegex },
          { contactEmail: emailRegex },
          { 'formData.email': emailRegex },
          { 'formData.contactEmail': emailRegex },
          { userEmail: emailRegex }
        )
      }
      if (leadQuery.length > 0) {
        const matchedLeads = await Lead.find({ $or: leadQuery }, { legacyId: 1, id: 1 }).lean().catch(() => [])
        linkedAccountIds = matchedLeads.map((l) => l.legacyId ?? l.id).filter(Boolean)
      }
    }

    const mineClauses = []
    if (resolvedOwnerName) {
      const nameEscaped = resolvedOwnerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const nameRegex = new RegExp(nameEscaped, 'i')
      mineClauses.push(
        { dealOwner: nameRegex },
        { ownerName: nameRegex },
        { addedBy: nameRegex },
        { addedByName: nameRegex },
        { createdByName: nameRegex },
        { 'data.dealOwner': nameRegex },
        { 'data.ownerName': nameRegex },
        { 'data.addedBy': nameRegex },
        { 'data.addedByName': nameRegex },
        { 'data.createdByName': nameRegex }
      )
    }
    if (resolvedOwnerEmail) {
      const emailEscaped = resolvedOwnerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const emailRegex = new RegExp(`^${emailEscaped}$`, 'i')
      mineClauses.push(
        { email: emailRegex },
        { userEmail: emailRegex },
        { ownerEmail: emailRegex },
        { createdByEmail: emailRegex },
        { contactEmail: emailRegex },
        { 'data.email': emailRegex },
        { 'data.userEmail': emailRegex },
        { 'data.ownerEmail': emailRegex },
        { 'data.createdByEmail': emailRegex },
        { 'data.contactEmail': emailRegex }
      )
    }
    if (linkedAccountIds.length > 0) {
      mineClauses.push(
        { accountId: { $in: linkedAccountIds } },
        { 'data.accountId': { $in: linkedAccountIds } }
      )
    }
    if (actor?.ownerCode) {
      mineClauses.push(
        { ownerCode: actor.ownerCode },
        { dealOwnerCode: actor.ownerCode },
        { 'data.ownerCode': actor.ownerCode },
        { 'data.dealOwnerCode': actor.ownerCode }
      )
    }

    if (mineClauses.length > 0) {
      mineFilter = { $or: mineClauses }
    }
  }

  const filter = mergeFilters(
    isMineOnly ? mineFilter : (effectiveCompanyWide ? {} : buildScopedMongoFilter({
      actor,
      ownerFields: ['ownerUserId', 'assignedTo', 'createdBy', 'owner_user_id', 'assigned_to', 'created_by', 'reassignedTo', 'reassignOwnerId', 'reassignUserId'],
      companyWide: effectiveCompanyWide,
      scopeUserIds,
    })),
    buildSearchFilter(filters.search ?? filters.q),
    visibleFilter,
    ownerUserId === null ? {} : { ownerUserId },
    stage ? { stage } : {},
    ownerName ? { $or: [{ 'data.ownerName': ownerName }, { 'data.dealOwner': ownerName }, { ownerName }] } : {},
    coOwnerId === null ? {} : {
      $or: [
        { 'data.coOwnerId': String(coOwnerId) },
        { 'data.co_owner_id': String(coOwnerId) },
        { 'data.coOwnerIds': String(coOwnerId) },
        { 'data.co_owner_ids': String(coOwnerId) },
      ],
    }
  )

  let query = Deal
    .find(filter)
    .sort(sortFromFilters(filters))

  if (limit > 0) {
    const total = await Deal.countDocuments(filter)
    query = query.skip((page - 1) * limit).limit(limit)
    const records = await query.lean()
    const mapped = await mapDeals(records)
    return {
      records: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  const records = await query.lean()

  return mapDeals(records)
}

const findById = async (id) => {
  const record = await Deal.findOne(mergeFilters(byLegacyId(id), visibleFilter)).lean()
  return normalizeMappedDeal(record)
}

const findByIdForActor = async (id, actor, { companyWide = false, scopeUserIds = null } = {}) => {
  const filters = {}
  const isMineOnly = filters.scope === 'mine' || filters.myDeals === 'true' || filters.myDeals === true
  const effectiveCompanyWide = isMineOnly ? false : companyWide
  const filter = mergeFilters(
    byLegacyId(id),
    buildScopedMongoFilter({
      actor,
      ownerFields: ['ownerUserId', 'assignedTo', 'createdBy', 'owner_user_id', 'assigned_to', 'created_by', 'reassignedTo', 'reassignOwnerId', 'reassignUserId'],
      companyWide: effectiveCompanyWide,
      scopeUserIds,
    }),
    visibleFilter
  )

  const record = await Deal.findOne(filter).lean()
  return normalizeMappedDeal(record)
}

const findConvertedFromAccount = async (accountId, actor, { companyWide = false, scopeUserIds = null } = {}) => {
  const filters = {}
  const normalizedAccountId = toNumberOrNull(accountId)
  if (normalizedAccountId === null) {
    return null
  }

  const isMineOnly = filters.scope === 'mine' || filters.myDeals === 'true' || filters.myDeals === true
  const effectiveCompanyWide = isMineOnly ? false : companyWide
  const filter = mergeFilters(
    { accountId: normalizedAccountId },
    {
      $or: [
        { 'data.conversionSource': 'search-account' },
        { 'data.convertedFromAccount': true },
        { 'data.convertedFromAccount': 'true' },
        { conversionSource: 'search-account' },
        { convertedFromAccount: true },
        { convertedFromAccount: 'true' },
      ],
    },
    buildScopedMongoFilter({
      actor,
      ownerFields: ['ownerUserId', 'assignedTo', 'createdBy', 'owner_user_id', 'assigned_to', 'created_by', 'reassignedTo', 'reassignOwnerId', 'reassignUserId'],
      companyWide: effectiveCompanyWide,
      scopeUserIds,
    }),
    visibleFilter
  )

  const record = await Deal.findOne(filter).sort({ createdAt: -1, legacyId: -1 }).lean()
  return normalizeMappedDeal(record)
}

const findDuplicate = async ({ title, accountId = null, customerName = null } = {}, { excludeId = null, companyId = null } = {}) => {
  const trimmedTitle = String(title || '').trim()
  if (!trimmedTitle) {
    return null
  }

  const normalizedAccountId = toNumberOrNull(accountId)
  const normalizedCompanyId = toNumberOrNull(companyId)
  const filter = {
    title: new RegExp(`^${trimmedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    accountId: normalizedAccountId,
    customerName: new RegExp(`^${String(customerName || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    ...(normalizedCompanyId === null ? {} : { companyId: normalizedCompanyId }),
    frontendDeleted: { $ne: true },
  }

  const normalizedExcludeId = toNumberOrNull(excludeId)
  if (normalizedExcludeId !== null) {
    filter.legacyId = { $ne: normalizedExcludeId }
  } else if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const record = await Deal.findOne(filter).sort({ legacyId: -1 }).lean()
  return baseRepository.map(record)
}

const getNextDealSequence = async (companyId = null) => {
  const normalizedCompanyId = toNumberOrNull(companyId)
  const records = await Deal.find(mergeFilters(normalizedCompanyId === null ? {} : { companyId: normalizedCompanyId }, visibleFilter))
    .select({ dealNumber: 1, data: 1 })
    .lean()

  const maxSequence = records.reduce((maxValue, record) => {
    const rawNumber = record.dealNumber || record.data?.dealNumber || record.data?.deal_number || ''
    const sequence = Number.parseInt(String(rawNumber).replace(/\D/gu, ''), 10)
    return Number.isFinite(sequence) ? Math.max(maxValue, sequence) : maxValue
  }, 0)

  return maxSequence + 1
}

module.exports = {
  ...baseRepository,
  getNextDealSequence,
  create: async (payload) => {
    const created = await baseRepository.create(payload)
    return findById(created.id)
  },
  update: async (id, payload) => {
    const updated = await baseRepository.update(id, payload)
    return updated?.id ? findById(updated.id) : null
  },
  findById,
  findByIdForActor,
  findConvertedFromAccount,
  findDuplicate,
  listWithFilters,
}
