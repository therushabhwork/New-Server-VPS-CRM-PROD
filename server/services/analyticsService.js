const { getMongoModel } = require('../models/mongoModels')

const User = getMongoModel('users')
const Lead = getMongoModel('leads')
const Deal = getMongoModel('deals')
const ConvertedDeal = getMongoModel('converted_deals')
const Quotation = getMongoModel('quotations')
const UserGroup = getMongoModel('user_groups')
const UserGroupMember = getMongoModel('user_group_members')

const WON_STATUSES = new Set(['won', 'closed', 'closed won', 'converted', 'convert_to_po', 'order received', 'closed_won'])
const LOST_STATUSES = new Set(['lost', 'closed lost', 'rejected', 'order lost', 'closed_lost', 'cancelled'])

const isWon = (itemOrStatus) => {
  if (!itemOrStatus) return false
  if (typeof itemOrStatus === 'string') {
    const s = itemOrStatus.toLowerCase().trim()
    return s === 'convert_to_po' || s === 'won' || WON_STATUSES.has(s)
  }
  const item = itemOrStatus
  const actualDealStatus = String(item.actualDealStatus || item.data?.actualDealStatus || item.formData?.actualDealStatus || '').toLowerCase().trim()
  const actualAccountStatus = String(item.actualAccountStatus || item.data?.actualAccountStatus || item.formData?.actualAccountStatus || '').toLowerCase().trim()
  const projectStatus = String(item.projectStatus || item.data?.projectStatus || item.formData?.projectStatus || '').toLowerCase().trim()
  const stage = String(item.stage || item.dealStage || item.data?.dealStage || item.formData?.dealStage || '').toLowerCase().trim()
  const status = String(item.status || item.dealStatus || item.data?.dealStatus || item.formData?.dealStatus || '').toLowerCase().trim()

  return (
    actualDealStatus === 'won' ||
    actualAccountStatus === 'won' ||
    projectStatus === 'won' ||
    stage === 'won' ||
    stage === 'convert_to_po' ||
    status === 'won' ||
    status === 'convert_to_po' ||
    status === 'converted' ||
    WON_STATUSES.has(status) ||
    WON_STATUSES.has(stage)
  )
}

const isLost = (itemOrStatus) => {
  if (!itemOrStatus) return false
  if (typeof itemOrStatus === 'string') {
    const s = itemOrStatus.toLowerCase().trim()
    return LOST_STATUSES.has(s)
  }
  const item = itemOrStatus
  const actualDealStatus = String(item.actualDealStatus || item.data?.actualDealStatus || item.formData?.actualDealStatus || '').toLowerCase().trim()
  const actualAccountStatus = String(item.actualAccountStatus || item.data?.actualAccountStatus || item.formData?.actualAccountStatus || '').toLowerCase().trim()
  const projectStatus = String(item.projectStatus || item.data?.projectStatus || item.formData?.projectStatus || '').toLowerCase().trim()
  const stage = String(item.stage || item.dealStage || item.data?.dealStage || item.formData?.dealStage || '').toLowerCase().trim()
  const status = String(item.status || item.dealStatus || item.data?.dealStatus || item.formData?.dealStatus || '').toLowerCase().trim()

  return (
    actualDealStatus === 'lost' ||
    actualAccountStatus === 'lost' ||
    projectStatus === 'lost' ||
    stage === 'lost' ||
    stage === 'rejected' ||
    status === 'lost' ||
    status === 'rejected' ||
    LOST_STATUSES.has(status) ||
    LOST_STATUSES.has(stage)
  )
}

const buildDailyKeys = (daysCount = 14) => {
  const list = []
  const now = new Date()
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    list.push({ key, label, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() })
  }
  return list
}

const buildMonthKeys = (monthsCount = 12) => {
  const current = new Date()
  const list = []
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    list.push({ key, label, year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return list
}

const buildYearKeys = (yearsCount = 4) => {
  const currentYear = new Date().getFullYear()
  const list = []
  for (let i = yearsCount - 1; i >= 0; i--) {
    const year = currentYear - i
    const key = String(year)
    list.push({ key, label: String(year), year })
  }
  return list
}

const getDashboardAnalytics = async (actor) => {
  const companyId = actor.companyId

  const companyFilter = companyId ? { companyId } : {}

  const [totalUsers, onlineUsers, totalAccounts, totalDeals, wonDealsCount, lostDealsCount] = await Promise.all([
    User.countDocuments({
      ...companyFilter,
      $or: [
        { role: { $in: ['admin', 'super_admin'] } },
        { status: 'approved' },
        { isApproved: true },
        { is_approved: true },
      ],
    }).catch(() => 0),
    User.countDocuments({ ...companyFilter, isOnline: true }).catch(() => 0),
    Lead.countDocuments(companyFilter).catch(() => 0),
    Deal.countDocuments(companyFilter).catch(() => 0),
    Deal.countDocuments({
      ...companyFilter,
      $or: [
        { status: { $in: Array.from(WON_STATUSES) } },
        { stage: { $in: Array.from(WON_STATUSES) } },
        { actualDealStatus: 'Won' },
        { actualAccountStatus: 'Won' },
        { projectStatus: 'Won' },
        { status: 'convert_to_po' },
        { stage: 'convert_to_po' },
      ],
    }).catch(() => 0),
    Deal.countDocuments({
      ...companyFilter,
      $or: [
        { status: { $in: Array.from(LOST_STATUSES) } },
        { stage: { $in: Array.from(LOST_STATUSES) } },
        { actualDealStatus: 'Lost' },
        { actualAccountStatus: 'Lost' },
        { projectStatus: 'Lost' },
      ],
    }).catch(() => 0),
  ])

  const pendingDealsCount = Math.max(0, totalDeals - wonDealsCount - lostDealsCount)

  // 1. Accounts Created by User
  const rawAccountsByUser = await Lead.aggregate([
    { $match: companyFilter },
    {
      $group: {
        _id: { $ifNull: ['$ownerUserId', { $ifNull: ['$accountOwner', '$createdBy'] }] },
        ownerNameRaw: { $first: { $ifNull: ['$accountOwner', { $ifNull: ['$ownerName', '$accountOwnerName'] }] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]).catch(() => [])

  // 2. Deals Created by User
  const rawDealsByUser = await Deal.aggregate([
    { $match: companyFilter },
    {
      $group: {
        _id: { $ifNull: ['$ownerUserId', { $ifNull: ['$dealOwner', '$createdBy'] }] },
        ownerNameRaw: { $first: { $ifNull: ['$dealOwnerName', { $ifNull: ['$ownerName', '$dealOwner'] }] } },
        count: { $sum: 1 },
        value: { $sum: { $ifNull: ['$value', 0] } },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]).catch(() => [])

  // Resolve user display names
  const allUserIds = Array.from(new Set([
    ...rawAccountsByUser.map((r) => r._id),
    ...rawDealsByUser.map((r) => r._id),
  ].filter(Boolean)))

  const usersList = await User.find({
    $or: [{ id: { $in: allUserIds } }, { legacyId: { $in: allUserIds } }],
  }).select('id legacyId name username email ownerCode').lean().catch(() => [])

  const userMap = new Map()
  usersList.forEach((u) => {
    const idKey = String(u.id ?? u.legacyId ?? '')
    const displayName = u.name || u.username || u.email || 'User'
    if (idKey) userMap.set(idKey, displayName)
  })

  const accountsByUser = rawAccountsByUser.map((item) => ({
    userId: String(item._id || ''),
    userName: userMap.get(String(item._id)) || item.ownerNameRaw || `User ${item._id}`,
    count: item.count,
  }))

  const dealsByUser = rawDealsByUser.map((item) => ({
    userId: String(item._id || ''),
    userName: userMap.get(String(item._id)) || item.ownerNameRaw || `User ${item._id}`,
    count: item.count,
    value: item.value,
  }))

  // 3. Converted vs Pending Deals Donut Chart
  const dealStatusDistribution = [
    { name: 'Converted Deals', value: wonDealsCount, fill: '#16a34a' },
    { name: 'Pending / Active Deals', value: pendingDealsCount, fill: '#2563eb' },
    { name: 'Lost Deals', value: lostDealsCount, fill: '#dc2626' },
  ]

  // 4. Activity Trends over past 6 months
  const monthList = buildMonthKeys(6)
  const startDate = new Date(monthList[0].year, monthList[0].month - 1, 1)

  const [recentAccounts, recentDeals] = await Promise.all([
    Lead.find({ ...companyFilter, createdAt: { $gte: startDate } }).select('createdAt status').lean().catch(() => []),
    Deal.find({ ...companyFilter, createdAt: { $gte: startDate } }).select('createdAt status stage').lean().catch(() => []),
  ])

  const activityTrends = monthList.map((m) => {
    const accountsInMonth = recentAccounts.filter((a) => {
      if (!a.createdAt) return false
      const d = new Date(a.createdAt)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === m.key
    }).length

    const dealsInMonth = recentDeals.filter((d) => {
      if (!d.createdAt) return false
      const cd = new Date(d.createdAt)
      return `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}` === m.key
    })

    const conversionsInMonth = dealsInMonth.filter((d) => isWon(d.status || d.stage)).length

    return {
      date: m.label,
      accounts: accountsInMonth,
      deals: dealsInMonth.length,
      conversions: conversionsInMonth,
    }
  })

  return {
    summary: {
      totalUsers,
      onlineUsers,
      totalAccounts,
      totalDeals,
      convertedDeals: wonDealsCount,
      pendingDeals: pendingDealsCount,
      lostDeals: lostDealsCount,
    },
    accountsByUser,
    dealsByUser,
    dealStatusDistribution,
    activityTrends,
  }
}

const resolveGroupUsers = async (companyId, group) => {
  const normalizedGroup = String(group || '').toLowerCase().replace(/[\s-_]/g, '')
  const isSwatiGroup = normalizedGroup === 'salesswati' || normalizedGroup === 'swati' || normalizedGroup === 'swatigroup' || normalizedGroup === 'ahmedabad' || normalizedGroup.includes('swati') || normalizedGroup.includes('ahmedabad')
  const companyFilter = (companyId && !isSwatiGroup) ? { companyId } : {}

  const allUsers = await User.find({
    ...companyFilter,
    $or: [
      { role: { $in: ['admin', 'super_admin'] } },
      { status: 'approved' },
      { isApproved: true },
      { is_approved: true },
      { email: { $regex: 'swatiswitchgears\\.com', $options: 'i' } },
      { legacyId: 16 },
      { name: { $regex: 'keval', $options: 'i' } },
      { email: { $regex: 'keval', $options: 'i' } },
      { username: { $regex: 'keval', $options: 'i' } },
    ],
  }).select('id legacyId name fullName displayName ownerDisplayName username email role designation userGroup isOnline lastLoginAt createdAt ownerCode').lean().catch(() => [])

  allUsers.forEach((u) => {
    u.name = String(u.name || u.fullName || u.displayName || u.ownerDisplayName || u.username || 'User').trim()
  })

  if (!group || group === 'userWisePerformance' || group === 'all' || group === 'allUsers') {
    return allUsers
  }

  if (isSwatiGroup) {
    const targetGroupId = '6ad9d8aa33a1972497a4756b'
    const mongoose = require('mongoose')
    let targetObjectId = null
    try {
      targetObjectId = new mongoose.Types.ObjectId(targetGroupId)
    } catch (_) {}

    // 1. Fetch matching Swati / Ahmedabad groups from user_groups collection
    const swatiGroups = await UserGroup.find({
      $or: [
        { groupName: { $regex: '^ahmedabad$', $options: 'i' } },
        { groupName: { $regex: 'ahmedabad', $options: 'i' } },
        { groupName: { $regex: 'swati', $options: 'i' } },
        { companyName: { $regex: 'swati', $options: 'i' } },
        { 'createdBy.userId': { $in: [16, '16'] } },
        { 'createdBy.name': { $regex: 'keval', $options: 'i' } },
        ...(targetObjectId ? [{ _id: targetObjectId }] : []),
      ],
    }).select('_id legacyId groupName createdBy').lean().catch(() => [])

    // 2. Collect group IDs (both native ObjectId, string _id, and legacyId) and creator IDs
    const swatiGroupObjectIds = targetObjectId ? [targetObjectId] : []
    const swatiGroupIds = [targetGroupId]
    const swatiCreatorUserIds = new Set(['16'])
    swatiGroups.forEach((g) => {
      if (g._id) {
        swatiGroupIds.push(String(g._id))
        try {
          swatiGroupObjectIds.push(new mongoose.Types.ObjectId(g._id))
        } catch (_) {}
      }
      if (g.legacyId != null) swatiGroupIds.push(String(g.legacyId))
      const creatorId = g.createdBy?.userId || (typeof g.createdBy === 'string' ? g.createdBy : null)
      if (creatorId) swatiCreatorUserIds.add(String(creatorId))
    })

    // 3. Fetch all member records from user_group_members collection using native ObjectIds + groupName
    const swatiMembers = await UserGroupMember.find({
      status: { $ne: 'inactive' },
      $or: [
        { groupName: { $regex: '^ahmedabad$', $options: 'i' } },
        { groupName: { $regex: 'ahmedabad', $options: 'i' } },
        { groupName: { $regex: 'swati', $options: 'i' } },
        { groupId: targetGroupId },
        ...(targetObjectId ? [{ groupId: targetObjectId }] : []),
        ...(swatiGroupObjectIds.length > 0 ? [{ groupId: { $in: swatiGroupObjectIds } }] : []),
        ...(swatiGroupIds.length > 0 ? [{ groupId: { $in: swatiGroupIds } }] : []),
        { userId: { $in: ['16', 16] } },
        { email: { $regex: 'keval', $options: 'i' } },
        { name: { $regex: 'keval', $options: 'i' } },
      ],
    }).select('userId user_id id groupName name userName email memberEmail groupId').lean().catch(() => [])

    const memberUserIds = new Set(swatiMembers.map((m) => String(m.userId || m.user_id || m.id || '')).filter(Boolean))
    memberUserIds.add('16')
    const memberEmails = new Set(swatiMembers.map((m) => String(m.email || m.memberEmail || '').toLowerCase().trim()).filter(Boolean))
    const memberNames = new Set(swatiMembers.map((m) => String(m.name || m.userName || '').toLowerCase().trim()).filter(Boolean))

    const swatiUsers = allUsers.filter((u) => {
      const uId = String(u.id ?? u.legacyId ?? u._id ?? '')
      const uLegacyId = String(u.legacyId ?? '')
      const email = String(u.email || '').toLowerCase().trim()
      const name = String(u.name || '').toLowerCase().trim()
      const ug = String(u.userGroup || '').toLowerCase()

      const isMember = memberUserIds.has(uId) || memberUserIds.has(uLegacyId) || memberEmails.has(email) || memberNames.has(name)
      const isCreator = swatiCreatorUserIds.has(uId) || swatiCreatorUserIds.has(uLegacyId)
      const isKeval = name.includes('keval') || email === 'keval@swatiswitchgears.com' || uLegacyId === '16'
      const isSwatiDomain = email.includes('@swatiswitchgears.com') && !email.includes('lumossolution')

      return isMember || isCreator || isKeval || isSwatiDomain || ug.includes('swati') || ug.includes('ahmedabad')
    })

    if (swatiUsers.length === 0) {
      const kevalUser = allUsers.find((u) => String(u.name || '').toLowerCase().includes('keval') || String(u.email || '').toLowerCase().includes('keval'))
      if (kevalUser) swatiUsers.push(kevalUser)
    }

    // Sort to place Keval V Shah at the top of the roster
    swatiUsers.sort((a, b) => {
      const aKeval = String(a.name || '').toLowerCase().includes('keval') || String(a.legacyId) === '16'
      const bKeval = String(b.name || '').toLowerCase().includes('keval') || String(b.legacyId) === '16'
      if (aKeval && !bKeval) return -1
      if (!aKeval && bKeval) return 1
      return 0
    })

    return swatiUsers.length > 0 ? swatiUsers : allUsers
  }

  if (normalizedGroup === 'saleslumos' || normalizedGroup === 'lumos' || normalizedGroup === 'lumosgroup') {
    const lumosUsers = allUsers.filter((u) => {
      const email = String(u.email || '').toLowerCase()
      const name = String(u.name || '').toLowerCase()
      const ug = String(u.userGroup || '').toLowerCase()
      return (
        email.includes('@lumossolution.com') ||
        name.includes('lumos') ||
        ug.includes('lumos')
      )
    })
    return lumosUsers
  }

  const keyword = group.toLowerCase().replace(/^sales/, '').trim()
  let filtered = allUsers.filter((u) => {
    const ug = String(u.userGroup || '').toLowerCase()
    const name = String(u.name || '').toLowerCase()
    return ug.includes(keyword) || name.includes(keyword)
  })

  if (filtered.length === 0) {
    const matchedGroup = await UserGroup.findOne({
      groupName: { $regex: keyword, $options: 'i' },
    }).lean().catch(() => null)

    if (matchedGroup) {
      const mongoose = require('mongoose')
      let matchedGroupObjId = null
      try {
        if (matchedGroup._id) matchedGroupObjId = new mongoose.Types.ObjectId(matchedGroup._id)
      } catch (_) {}

      const members = await UserGroupMember.find({
        $or: [
          ...(matchedGroupObjId ? [{ groupId: matchedGroupObjId }] : []),
          { groupId: String(matchedGroup.id ?? matchedGroup.legacyId ?? matchedGroup._id) },
          { groupName: { $regex: keyword, $options: 'i' } },
        ],
      }).lean().catch(() => [])
      const memberUserIds = new Set(members.map((m) => String(m.userId || m.user_id || m.id || '')).filter(Boolean))
      filtered = allUsers.filter((u) => memberUserIds.has(String(u.id ?? u.legacyId ?? u._id)))
    }
  }

  return filtered.length > 0 ? filtered : allUsers
}

const matchesUser = (entity, userRecord, entityType = 'general') => {
  if (!entity || !userRecord) return false

  const userIds = new Set([
    String(userRecord.legacyId ?? '').trim(),
    String(userRecord.id ?? '').trim(),
    String(userRecord._id ?? '').trim(),
  ].filter(Boolean))

  const uName = String(userRecord.name || userRecord.ownerDisplayName || userRecord.fullName || '').trim().toLowerCase()
  const uUsername = String(userRecord.username || '').trim().toLowerCase()
  const uEmail = String(userRecord.email || '').trim().toLowerCase()
  const uCode = String(userRecord.ownerCode || '').trim().toLowerCase()
  const isKeval = uName.includes('keval') || uEmail === 'keval@swatiswitchgears.com' || userIds.has('16')

  const matchId = (rawId) => {
    if (rawId == null) return false
    const str = String(rawId).trim()
    if (userIds.has(str)) return true
    if (userRecord._id && typeof rawId.equals === 'function') {
      try {
        if (rawId.equals(userRecord._id)) return true
      } catch (_) {}
    }
    return false
  }

  const matchName = (nameStr) => {
    if (!nameStr) return false
    const s = String(nameStr).trim().toLowerCase()
    if (!s) return false
    if (uName && (s === uName || s.replace(/\s+/g, '') === uName.replace(/\s+/g, ''))) return true
    if (isKeval && s.includes('keval')) return true
    if (uUsername && s === uUsername) return true
    if (uEmail && (s === uEmail || s === uEmail.split('@')[0])) return true
    return false
  }

  const matchCode = (codeStr) => {
    if (!codeStr || !uCode) return false
    return String(codeStr).trim().toLowerCase() === uCode
  }

  // 1. Leads / Accounts
  if (entityType === 'lead') {
    const primaryId = entity.ownerUserId ?? entity.assignedTo
    if (matchId(primaryId)) return true

    const primaryName = entity.accountOwner || entity.ownerName || entity.data?.accountOwner || entity.formData?.accountOwner
    if (matchName(primaryName)) return true

    const code = entity.ownerCode || entity.data?.ownerCode || entity.formData?.ownerCode
    if (matchCode(code)) return true

    if (isKeval && [entity.ownerUserId, entity.userId].some((id) => String(id) === '16')) return true

    // Fallback to creator ONLY if primary owner is completely unassigned
    if (!primaryId && !primaryName && !code && entity.createdBy != null) {
      return matchId(entity.createdBy)
    }
    return false
  }

  // 2. Deals
  if (entityType === 'deal') {
    const primaryId = entity.ownerUserId ?? entity.dealOwner
    if (matchId(primaryId)) return true

    const primaryName = entity.dealOwnerName || entity.ownerName || entity.data?.dealOwnerName
    if (matchName(primaryName)) return true

    const code = entity.ownerCode || entity.data?.ownerCode || entity.formData?.ownerCode
    if (matchCode(code)) return true

    if (isKeval && [entity.ownerUserId, entity.dealOwner, entity.userId].some((id) => String(id) === '16')) return true

    // Fallback to accountOwner / createdBy only if dealOwner is completely unassigned
    if (!primaryId && !primaryName && !code) {
      if (matchName(entity.accountOwner)) return true
      if (entity.createdBy != null && matchId(entity.createdBy)) return true
    }
    return false
  }

  // 3. Quotations
  if (entityType === 'quotation') {
    const primaryId = entity.ownerUserId ?? entity.preparedBy ?? entity.dealOwner
    if (matchId(primaryId)) return true

    const primaryName = entity.preparedBy || entity.dealOwner || entity.userName || entity.ownerName || entity.createdByUserName
    if (matchName(primaryName)) return true

    const code = entity.ownerCode || entity.data?.ownerCode || entity.formData?.ownerCode
    if (matchCode(code)) return true

    if (isKeval && [entity.ownerUserId, entity.preparedBy, entity.dealOwner].some((id) => String(id) === '16')) return true

    return false
  }

  // General fallback
  const rawId = entity.ownerUserId ?? entity.dealOwner ?? entity.userId
  if (matchId(rawId)) return true
  const rawName = entity.dealOwnerName || entity.ownerName || entity.accountOwner || entity.preparedBy
  if (matchName(rawName)) return true
  if (matchCode(entity.ownerCode)) return true

  return false
}

const getUserDealPerformance = async (actor, { group = null, startDate = null, endDate = null } = {}) => {
  const companyId = actor.companyId
  const normalizedGroup = String(group || '').toLowerCase().replace(/[\s-_]/g, '')
  const isSwatiGroup = normalizedGroup === 'salesswati' || normalizedGroup === 'swati' || normalizedGroup === 'swatigroup' || normalizedGroup.includes('swati') || normalizedGroup.includes('ahmedabad')
  
  const targetUsers = await resolveGroupUsers(companyId, group)
  const mongoose = require('mongoose')

  const targetObjectIds = targetUsers.map((u) => {
    try {
      const rawId = u._id || u.id
      return rawId ? new mongoose.Types.ObjectId(rawId) : null
    } catch (_) {
      return null
    }
  }).filter(Boolean)

  const targetUserIds = targetUsers.map((u) => u.legacyId ?? u.id ?? u._id).filter(Boolean)
  const targetUserStrings = targetUsers.flatMap((u) => [
    String(u.legacyId ?? ''),
    String(u.id ?? ''),
    String(u._id ?? ''),
  ]).filter(Boolean)

  const targetNames = targetUsers.map((u) => String(u.name || u.ownerDisplayName || u.fullName || u.username || '').trim()).filter(Boolean)
  const targetOwnerCodes = targetUsers.map((u) => String(u.ownerCode || '').trim()).filter(Boolean)

  // Construct non-restrictive query for team data with native ObjectIds and legacy IDs
  const dataQuery = isSwatiGroup
    ? {
        $or: [
          { companyId: 1 },
          { companyId: '1' },
          { ownerUserId: { $in: [...targetObjectIds, ...targetUserIds, ...targetUserStrings] } },
          { createdBy: { $in: [...targetObjectIds, ...targetUserIds, ...targetUserStrings] } },
          { accountOwner: { $in: targetNames } },
          { dealOwner: { $in: [...targetObjectIds, ...targetUserStrings, ...targetNames] } },
          { dealOwnerName: { $in: targetNames } },
          { ownerName: { $in: targetNames } },
          ...(targetOwnerCodes.length > 0 ? [{ ownerCode: { $in: targetOwnerCodes } }] : []),
        ],
      }
    : (companyId ? {
        $or: [
          { companyId },
          { companyId: String(companyId) },
          { ownerUserId: { $in: [...targetObjectIds, ...targetUserIds, ...targetUserStrings] } },
          { accountOwner: { $in: targetNames } },
          { dealOwner: { $in: [...targetObjectIds, ...targetUserStrings, ...targetNames] } },
          { dealOwnerName: { $in: targetNames } },
          { ownerName: { $in: targetNames } },
          ...(targetOwnerCodes.length > 0 ? [{ ownerCode: { $in: targetOwnerCodes } }] : []),
        ]
      } : {})

  const dailyList = buildDailyKeys(14)
  const monthlyList = buildMonthKeys(12)
  const yearlyList = buildYearKeys(4)

  // Setup custom date range bucket if startDate & endDate provided
  let customBucketList = []
  let customDateFilter = null
  if (startDate && endDate) {
    const startObj = new Date(`${startDate}T00:00:00.000Z`)
    const endObj = new Date(`${endDate}T23:59:59.999Z`)
    if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime()) && startObj <= endObj) {
      customDateFilter = { start: startObj, end: endObj }
      const diffDays = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24))
      if (diffDays <= 31) {
        const cur = new Date(startObj)
        while (cur <= endObj) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
          const label = `${cur.getDate()} ${cur.toLocaleString('en-US', { month: 'short' })}`
          customBucketList.push({ key, label })
          cur.setDate(cur.getDate() + 1)
        }
      } else {
        const cur = new Date(startObj.getFullYear(), startObj.getMonth(), 1)
        while (cur <= endObj) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
          const label = `${cur.toLocaleString('en-US', { month: 'short' })} ${cur.getFullYear()}`
          customBucketList.push({ key, label })
          cur.setMonth(cur.getMonth() + 1)
        }
      }
    }
  }

  // Fetch deals, leads, and quotations dynamically from MongoDB collections with full status, date, and value fields
  const [allDeals, allLeads, allQuotations] = await Promise.all([
    Deal.find(dataQuery)
      .select('ownerUserId dealOwner dealOwnerName ownerName accountOwner status stage actualDealStatus actualAccountStatus projectStatus value createdAt dealDate addedOn date data formData ownerCode')
      .lean()
      .catch(() => []),
    Lead.find(dataQuery)
      .select('ownerUserId accountOwner ownerName createdBy createdAt accountDate addedOn date status actualAccountStatus actualDealStatus projectStatus ownerCode createdByUserName createdUserBy userEmail data formData value dealValue')
      .lean()
      .catch(() => []),
    Quotation.find({ ...dataQuery, frontendDeleted: { $ne: true } })
      .select('ownerUserId createdBy preparedBy dealOwner accountOwner userName ownerName createdAt quotationDate quoteDate date quotationNumber quoteNumber ownerCode createdByUserName createdUserBy userEmail data formData')
      .lean()
      .catch(() => []),
  ])

  // Process per user dynamically
  const userPerformanceList = targetUsers.map((u) => {
    const uId = String(u.id ?? u.legacyId ?? u._id)
    const uName = String(u.name || u.ownerDisplayName || u.fullName || u.username || 'User').trim()
    const uEmail = u.email || ''
    const uRole = u.designation || u.role || 'Sales'

    // Match deals, leads, and quotations using entity-aware primary ownership
    const userDeals = allDeals.filter((deal) => matchesUser(deal, u, 'deal'))
    const userLeads = allLeads.filter((lead) => matchesUser(lead, u, 'lead'))
    const userQuotations = allQuotations.filter((q) => matchesUser(q, u, 'quotation'))

    // Helper to test if a record is within custom date filter
    const isWithinCustom = (item, dateField1, dateField2) => {
      if (!customDateFilter) return true
      const raw = item[dateField1] || item[dateField2] || item.createdAt || item.date || item.data?.[dateField1]
      if (!raw) return false
      const d = new Date(raw)
      return !isNaN(d.getTime()) && d >= customDateFilter.start && d <= customDateFilter.end
    }

    const scopedLeads = customDateFilter ? userLeads.filter((l) => isWithinCustom(l, 'accountDate', 'addedOn')) : userLeads
    const scopedDeals = customDateFilter ? userDeals.filter((d) => isWithinCustom(d, 'dealDate', 'addedOn')) : userDeals
    const wonFromDeals = scopedDeals.filter((deal) => isWon(deal))
    const lostFromDeals = scopedDeals.filter((deal) => isLost(deal))
    const scopedQuotations = customDateFilter ? userQuotations.filter((q) => isWithinCustom(q, 'quotationDate', 'quoteDate')) : userQuotations

    // Build map helpers
    const dailyMap = new Map()
    dailyList.forEach((d) => {
      dailyMap.set(d.key, { key: d.key, label: d.label, accounts: 0, closedWon: 0, closedLost: 0, totalDeals: 0, wonValue: 0, lostValue: 0, quotations: 0 })
    })

    const monthlyMap = new Map()
    monthlyList.forEach((m) => {
      monthlyMap.set(m.key, { key: m.key, label: m.label, accounts: 0, closedWon: 0, closedLost: 0, totalDeals: 0, wonValue: 0, lostValue: 0, quotations: 0 })
    })

    const yearlyMap = new Map()
    yearlyList.forEach((y) => {
      yearlyMap.set(y.key, { key: y.key, label: y.label, accounts: 0, closedWon: 0, closedLost: 0, totalDeals: 0, wonValue: 0, lostValue: 0, quotations: 0 })
    })

    const customMap = new Map()
    customBucketList.forEach((c) => {
      customMap.set(c.key, { key: c.key, label: c.label, accounts: 0, closedWon: 0, closedLost: 0, totalDeals: 0, wonValue: 0, lostValue: 0, quotations: 0 })
    })

    // Aggregate user accounts from leads collection
    userLeads.forEach((lead) => {
      const rawDate = lead.accountDate || lead.addedOn || lead.createdAt || lead.date || lead.data?.accountDate || lead.data?.addedOn
      if (!rawDate) return
      const d = new Date(rawDate)
      if (isNaN(d.getTime())) return

      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const yKey = String(d.getFullYear())

      if (dailyMap.has(dayKey)) dailyMap.get(dayKey).accounts += 1
      if (monthlyMap.has(mKey)) monthlyMap.get(mKey).accounts += 1
      if (yearlyMap.has(yKey)) yearlyMap.get(yKey).accounts += 1

      if (customMap.has(dayKey)) customMap.get(dayKey).accounts += 1
      else if (customMap.has(mKey)) customMap.get(mKey).accounts += 1
    })

    // Aggregate user deals from deals collection with exact Won / Lost evaluation
    userDeals.forEach((deal) => {
      const rawDate = deal.dealDate || deal.addedOn || deal.createdAt || deal.date || deal.data?.dealDate || deal.data?.addedOn
      if (!rawDate) return
      const d = new Date(rawDate)
      if (isNaN(d.getTime())) return

      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const yKey = String(d.getFullYear())

      const val = Number(deal.value || 0) || 0
      const won = isWon(deal)
      const lost = isLost(deal)

      const updateBucket = (bucket) => {
        if (!bucket) return
        bucket.totalDeals += 1
        if (won) {
          bucket.closedWon += 1
          bucket.wonValue += val
        } else if (lost) {
          bucket.closedLost += 1
          bucket.lostValue += val
        }
      }

      if (dailyMap.has(dayKey)) updateBucket(dailyMap.get(dayKey))
      if (monthlyMap.has(mKey)) updateBucket(monthlyMap.get(mKey))
      if (yearlyMap.has(yKey)) updateBucket(yearlyMap.get(yKey))

      if (customMap.has(dayKey)) updateBucket(customMap.get(dayKey))
      else if (customMap.has(mKey)) updateBucket(customMap.get(mKey))
    })

    // Aggregate user quotations from quotations collection
    userQuotations.forEach((q) => {
      const rawDate = q.quotationDate || q.quoteDate || q.createdAt || q.date || q.data?.quotationDate
      if (!rawDate) return
      const d = new Date(rawDate)
      if (isNaN(d.getTime())) return

      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const yKey = String(d.getFullYear())

      if (dailyMap.has(dayKey)) dailyMap.get(dayKey).quotations += 1
      if (monthlyMap.has(mKey)) monthlyMap.get(mKey).quotations += 1
      if (yearlyMap.has(yKey)) yearlyMap.get(yKey).quotations += 1

      if (customMap.has(dayKey)) customMap.get(dayKey).quotations += 1
      else if (customMap.has(mKey)) customMap.get(mKey).quotations += 1
    })

    return {
      userId: uId,
      ownerName: uName,
      email: uEmail,
      role: uRole,
      isOnline: Boolean(u.isOnline),
      lastActive: u.lastLoginAt || u.updatedAt || u.createdAt || null,
      // Direct MongoDB native collection totals (scoped to date range when custom filter active)
      totalAccounts: scopedLeads.length,
      totalDeals: scopedDeals.length,
      totalWon: wonFromDeals.length,
      totalLost: lostFromDeals.length,
      totalQuotations: scopedQuotations.length,
      daily: dailyList.map((d) => dailyMap.get(d.key)),
      monthly: monthlyList.map((m) => monthlyMap.get(m.key)),
      yearly: yearlyList.map((y) => yearlyMap.get(y.key)),
      custom: customBucketList.map((c) => customMap.get(c.key)),
    }
  })

  // Deduplicated team summary directly from matched MongoDB collection document IDs
  const isDocWithinCustom = (item, dateField1, dateField2) => {
    if (!customDateFilter) return true
    const raw = item[dateField1] || item[dateField2] || item.createdAt || item.date || item.data?.[dateField1]
    if (!raw) return false
    const d = new Date(raw)
    return !isNaN(d.getTime()) && d >= customDateFilter.start && d <= customDateFilter.end
  }

  const teamLeadsScoped = customDateFilter ? allLeads.filter((l) => isDocWithinCustom(l, 'accountDate', 'addedOn')) : allLeads
  const teamDealsScoped = customDateFilter ? allDeals.filter((d) => isDocWithinCustom(d, 'dealDate', 'addedOn')) : allDeals
  const teamQuotesScoped = customDateFilter ? allQuotations.filter((q) => isDocWithinCustom(q, 'quotationDate', 'quoteDate')) : allQuotations

  const teamLeadIds = new Set(teamLeadsScoped.map((l) => String(l._id || l.id)))
  const teamDealIds = new Set(teamDealsScoped.map((d) => String(d._id || d.id)))
  const teamWonDealIds = new Set(teamDealsScoped.filter(isWon).map((d) => String(d._id || d.id)))
  const teamLostDealIds = new Set(teamDealsScoped.filter(isLost).map((d) => String(d._id || d.id)))
  const teamQuoteIds = new Set(teamQuotesScoped.map((q) => String(q._id || q.id)))

  const teamSummary = {
    totalAccounts: teamLeadIds.size,
    totalDeals: teamDealIds.size,
    totalWon: teamWonDealIds.size,
    totalLost: teamLostDealIds.size,
    totalQuotations: teamQuoteIds.size,
  }

  userPerformanceList.forEach((u) => {
    u.teamSummary = teamSummary
  })
  userPerformanceList.teamSummary = teamSummary

  return userPerformanceList
}

const getAllUsersPerformanceRoster = async (actor, { search = '', status = 'all', page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = {}) => {
  const companyId = actor.companyId
  const companyFilter = companyId ? { companyId } : {}

  const allUsers = await User.find({
    ...companyFilter,
    $or: [
      { role: { $in: ['admin', 'super_admin'] } },
      { status: 'approved' },
      { isApproved: true },
      { is_approved: true },
    ],
  }).select('id legacyId name username email role designation ownerCode isOnline lastLoginAt createdAt updatedAt').lean().catch(() => [])

  // Aggregate accounts count per user
  const [accountCounts, dealCounts] = await Promise.all([
    Lead.aggregate([
      { $match: companyFilter },
      {
        $group: {
          _id: { $ifNull: ['$ownerUserId', { $ifNull: ['$accountOwner', '$createdBy'] }] },
          count: { $sum: 1 },
        },
      },
    ]).catch(() => []),
    Deal.aggregate([
      { $match: companyFilter },
      {
        $group: {
          _id: { $ifNull: ['$ownerUserId', { $ifNull: ['$dealOwner', '$createdBy'] }] },
          total: { $sum: 1 },
          won: {
            $sum: {
              $cond: [
                {
                  $in: [
                    { $toLower: { $ifNull: ['$status', { $ifNull: ['$stage', ''] }] } },
                    Array.from(WON_STATUSES),
                  ],
                },
                1,
                0,
              ],
            },
          },
          lost: {
            $sum: {
              $cond: [
                {
                  $in: [
                    { $toLower: { $ifNull: ['$status', { $ifNull: ['$stage', ''] }] } },
                    Array.from(LOST_STATUSES),
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]).catch(() => []),
  ])

  const accountsMap = new Map()
  accountCounts.forEach((a) => {
    if (a._id) accountsMap.set(String(a._id), a.count)
  })

  const dealsMap = new Map()
  dealCounts.forEach((d) => {
    if (d._id) dealsMap.set(String(d._id), d)
  })

  let roster = allUsers.map((u) => {
    const uId = String(u.id ?? u.legacyId ?? u._id)
    const ownerName = String(u.name || u.username || 'User').trim()
    const accountsCount = accountsMap.get(uId) || accountsMap.get(ownerName) || 0
    const dealStats = dealsMap.get(uId) || dealsMap.get(ownerName) || { total: 0, won: 0, lost: 0 }
    const closedCount = (dealStats.won || 0) + (dealStats.lost || 0)
    const winRate = closedCount > 0 ? Number(((dealStats.won / closedCount) * 100).toFixed(1)) : 0.0

    return {
      id: uId,
      ownerName,
      email: u.email || '',
      role: u.designation || u.role || 'Sales',
      ownerCode: u.ownerCode || '',
      isOnline: Boolean(u.isOnline),
      lastActive: u.lastLoginAt || u.updatedAt || u.createdAt || null,
      accountsCount,
      dealsCount: dealStats.total || 0,
      convertedDealsCount: dealStats.won || 0,
      winRate,
    }
  })

  // Search filter
  if (search) {
    const query = search.toLowerCase()
    roster = roster.filter((r) => (
      r.ownerName.toLowerCase().includes(query)
      || r.email.toLowerCase().includes(query)
      || r.role.toLowerCase().includes(query)
    ))
  }

  // Status filter
  if (status === 'online') {
    roster = roster.filter((r) => r.isOnline)
  } else if (status === 'offline') {
    roster = roster.filter((r) => !r.isOnline)
  }

  // Sorting
  roster.sort((a, b) => {
    let left = a[sortBy]
    let right = b[sortBy]
    if (typeof left === 'string') left = left.toLowerCase()
    if (typeof right === 'string') right = right.toLowerCase()

    if (left < right) return sortOrder === 'desc' ? 1 : -1
    if (left > right) return sortOrder === 'desc' ? -1 : 1
    return 0
  })

  const total = roster.length
  const startIndex = (page - 1) * limit
  const paginatedUsers = roster.slice(startIndex, startIndex + limit)

  return {
    users: paginatedUsers,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit) || 1,
  }
}

const getUserPerformanceDetails = async (actor, userId) => {
  const companyId = actor.companyId
  const companyFilter = companyId ? { companyId } : {}

  const userRecord = await User.findOne({
    ...companyFilter,
    $or: [{ id: userId }, { legacyId: userId }],
  }).select('id legacyId name username email role designation ownerCode isOnline lastLoginAt createdAt updatedAt').lean()

  if (!userRecord) {
    return null
  }

  const uId = String(userRecord.id ?? userRecord.legacyId ?? userRecord._id)
  const ownerName = String(userRecord.name || userRecord.username || 'User').trim()

  const [recentAccounts, recentDeals, performanceList] = await Promise.all([
    Lead.find({
      ...companyFilter,
      $or: [{ ownerUserId: uId }, { accountOwner: ownerName }],
    }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
    Deal.find({
      ...companyFilter,
      $or: [{ ownerUserId: uId }, { dealOwner: uId }, { dealOwnerName: ownerName }],
    }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
    getUserDealPerformance(actor, { group: null, monthsCount: 12 }),
  ])

  const userPerformance = performanceList.find((p) => p.userId === uId || p.ownerName.toLowerCase() === ownerName.toLowerCase()) || {
    summary: { totalDeals: recentDeals.length, closedWon: 0, closedLost: 0, winRate: 0, wonValue: 0, lostValue: 0 },
    monthly: buildMonthKeys(12).map((m) => ({ key: m.key, label: m.label, total: 0, closedWon: 0, closedLost: 0, wonValue: 0, lostValue: 0 })),
  }

  return {
    user: {
      id: uId,
      ownerName,
      email: userRecord.email || '',
      role: userRecord.designation || userRecord.role || 'Sales',
      ownerCode: userRecord.ownerCode || '',
      isOnline: Boolean(userRecord.isOnline),
      lastActive: userRecord.lastLoginAt || userRecord.updatedAt || userRecord.createdAt,
    },
    summary: userPerformance.summary,
    monthly: userPerformance.monthly,
    accounts: recentAccounts.map((a) => ({
      id: a.legacyId || a.id || a._id,
      accountName: a.accountName || a.name || 'Untitled Account',
      accountNumber: a.accountNumber || a.accountNo || '',
      status: a.status || 'Active',
      createdAt: a.createdAt,
    })),
    deals: recentDeals.map((d) => ({
      id: d.legacyId || d.id || d._id,
      title: d.title || d.dealName || d.name || 'Untitled Deal',
      dealNumber: d.dealNumber || '',
      value: d.value || 0,
      stage: d.stage || d.status || 'New',
      createdAt: d.createdAt,
    })),
  }
}

module.exports = {
  getDashboardAnalytics,
  getUserDealPerformance,
  getAllUsersPerformanceRoster,
  getUserPerformanceDetails,
}
