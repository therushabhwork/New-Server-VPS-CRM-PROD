const { getMongoModel } = require('../models/mongoModels')

const User = getMongoModel('users')
const Lead = getMongoModel('leads')
const Deal = getMongoModel('deals')
const ConvertedDeal = getMongoModel('converted_deals')
const UserGroup = getMongoModel('user_groups')
const UserGroupMember = getMongoModel('user_group_members')

const WON_STATUSES = new Set(['won', 'closed', 'closed won', 'converted', 'convert_to_po', 'order received', 'closed_won'])
const LOST_STATUSES = new Set(['lost', 'closed lost', 'rejected', 'order lost', 'closed_lost', 'cancelled'])

const isWon = (status) => WON_STATUSES.has(String(status || '').trim().toLowerCase())
const isLost = (status) => LOST_STATUSES.has(String(status || '').trim().toLowerCase())

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
      ],
    }).catch(() => 0),
    Deal.countDocuments({
      ...companyFilter,
      $or: [
        { status: { $in: Array.from(LOST_STATUSES) } },
        { stage: { $in: Array.from(LOST_STATUSES) } },
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
  const companyFilter = companyId ? { companyId } : {}
  const allUsers = await User.find({
    ...companyFilter,
    $or: [
      { role: { $in: ['admin', 'super_admin'] } },
      { status: 'approved' },
      { isApproved: true },
      { is_approved: true },
    ],
  }).select('id legacyId name username email role designation userGroup isOnline lastLoginAt createdAt').lean().catch(() => [])

  if (!group || group === 'userWisePerformance' || group === 'all') {
    return allUsers
  }

  const normalizedGroup = String(group || '').toLowerCase().replace(/[\s-_]/g, '')

  if (normalizedGroup === 'salesswati' || normalizedGroup === 'swati') {
    const swatiUsers = allUsers.filter((u) => {
      const email = String(u.email || '').toLowerCase()
      const name = String(u.name || '').toLowerCase()
      const ug = String(u.userGroup || '').toLowerCase()
      return (
        email.includes('@swatiswitchgears.com') ||
        (name.includes('swati') && !email.includes('lumossolution')) ||
        ug.includes('swati')
      )
    })
    return swatiUsers
  }

  if (normalizedGroup === 'saleslumos' || normalizedGroup === 'lumos') {
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
      ...companyFilter,
      groupName: { $regex: keyword, $options: 'i' },
    }).lean().catch(() => null)

    if (matchedGroup) {
      const members = await UserGroupMember.find({
        groupId: String(matchedGroup.id ?? matchedGroup.legacyId ?? matchedGroup._id),
      }).lean().catch(() => [])
      const memberUserIds = new Set(members.map((m) => String(m.userId)))
      filtered = allUsers.filter((u) => memberUserIds.has(String(u.id ?? u.legacyId ?? u._id)))
    }
  }

  return filtered.length > 0 ? filtered : allUsers
}

const getUserDealPerformance = async (actor, { group = null } = {}) => {
  const companyId = actor.companyId
  const targetUsers = await resolveGroupUsers(companyId, group)
  const companyFilter = companyId ? { companyId } : {}

  const dailyList = buildDailyKeys(14)
  const monthlyList = buildMonthKeys(12)
  const yearlyList = buildYearKeys(4)

  // Fetch deals and leads dynamically from MongoDB collections
  const [allDeals, allLeads] = await Promise.all([
    Deal.find(companyFilter)
      .select('ownerUserId dealOwner dealOwnerName ownerName accountOwner status stage value createdAt')
      .lean()
      .catch(() => []),
    Lead.find(companyFilter)
      .select('ownerUserId accountOwner ownerName createdBy createdAt status')
      .lean()
      .catch(() => []),
  ])

  // Process per user dynamically
  const userPerformanceList = targetUsers.map((u) => {
    const uId = String(u.id ?? u.legacyId ?? u._id)
    const uName = String(u.name || u.ownerDisplayName || u.fullName || u.username || 'User').trim()
    const uEmail = u.email || ''
    const uRole = u.designation || u.role || 'Sales'

    // Match deals for this user
    const userDeals = allDeals.filter((deal) => {
      const dealOwnerId = String(deal.ownerUserId || deal.dealOwner || '')
      const dealOwnerName = String(deal.dealOwnerName || deal.ownerName || deal.accountOwner || '').trim().toLowerCase()
      return dealOwnerId === uId || (uName && dealOwnerName === uName.toLowerCase())
    })

    // Match leads/accounts for this user
    const userLeads = allLeads.filter((lead) => {
      const leadOwnerId = String(lead.ownerUserId || lead.createdBy || '')
      const leadOwnerName = String(lead.accountOwner || lead.ownerName || '').trim().toLowerCase()
      return leadOwnerId === uId || (uName && leadOwnerName === uName.toLowerCase())
    })

    // Build map helpers
    const dailyMap = new Map()
    dailyList.forEach((d) => {
      dailyMap.set(d.key, { key: d.key, label: d.label, accounts: 0, closedWon: 0, closedLost: 0, totalDeals: 0, wonValue: 0, lostValue: 0 })
    })

    const monthlyMap = new Map()
    monthlyList.forEach((m) => {
      monthlyMap.set(m.key, { key: m.key, label: m.label, accounts: 0, closedWon: 0, closedLost: 0, totalDeals: 0, wonValue: 0, lostValue: 0 })
    })

    const yearlyMap = new Map()
    yearlyList.forEach((y) => {
      yearlyMap.set(y.key, { key: y.key, label: y.label, accounts: 0, closedWon: 0, closedLost: 0, totalDeals: 0, wonValue: 0, lostValue: 0 })
    })

    // Aggregate user accounts from leads collection
    userLeads.forEach((lead) => {
      if (!lead.createdAt) return
      const d = new Date(lead.createdAt)
      if (isNaN(d.getTime())) return

      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const yKey = String(d.getFullYear())

      if (dailyMap.has(dayKey)) dailyMap.get(dayKey).accounts += 1
      if (monthlyMap.has(mKey)) monthlyMap.get(mKey).accounts += 1
      if (yearlyMap.has(yKey)) yearlyMap.get(yKey).accounts += 1
    })

    // Aggregate user deals from deals collection
    userDeals.forEach((deal) => {
      if (!deal.createdAt) return
      const d = new Date(deal.createdAt)
      if (isNaN(d.getTime())) return

      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const yKey = String(d.getFullYear())

      const status = deal.status || deal.stage
      const val = Number(deal.value || 0) || 0
      const won = isWon(status)
      const lost = isLost(status)

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
    })

    return {
      userId: uId,
      ownerName: uName,
      email: uEmail,
      role: uRole,
      isOnline: Boolean(u.isOnline),
      lastActive: u.lastLoginAt || u.updatedAt || u.createdAt || null,
      daily: dailyList.map((d) => dailyMap.get(d.key)),
      monthly: monthlyList.map((m) => monthlyMap.get(m.key)),
      yearly: yearlyList.map((y) => yearlyMap.get(y.key)),
    }
  })

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
