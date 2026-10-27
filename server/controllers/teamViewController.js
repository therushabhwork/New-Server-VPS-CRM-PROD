const { getMongoModel } = require('../models/mongoModels')

const UserSession = getMongoModel('user_sessions')
const User = getMongoModel('users')
const UserGroup = getMongoModel('user_groups')
const UserGroupMember = getMongoModel('user_group_members')

/**
 * Lists session history with filtering by group, email, date, and pagination
 */
const getTeamViewSessions = async (req, res, next) => {
  try {
    const {
      group = '',
      email = '',
      search = '',
      date = '',
      status = '',
      page = 1,
      limit = 25,
    } = req.query

    const query = {}

    if (group && group !== 'all') {
      query.userGroup = { $regex: new RegExp(`^${group}$`, 'i') }
    }

    if (email) {
      query.userEmail = { $regex: new RegExp(email, 'i') }
    }

    if (status && status !== 'all') {
      query.status = status
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [
        { userName: searchRegex },
        { userEmail: searchRegex },
        { userGroup: searchRegex },
        { ownerCode: searchRegex },
      ]
    }

    if (date) {
      const targetDate = new Date(date)
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))
      query.loginAt = { $gte: startOfDay, $lte: endOfDay }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25))
    const skip = (pageNum - 1) * limitNum

    const [total, sessions, allGroups, allMembers] = await Promise.all([
      UserSession.countDocuments(query),
      UserSession.find(query)
        .sort({ loginAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      UserGroup ? UserGroup.find({}, '_id legacyId groupName name').lean().catch(() => []) : [],
      UserGroupMember ? UserGroupMember.find({}, 'userId email groupId groupName').lean().catch(() => []) : [],
    ])

    const groupMap = {}
    ;(allGroups || []).forEach((g) => {
      const name = g.groupName || g.name || ''
      if (name) {
        if (g._id) groupMap[String(g._id)] = name
        if (g.legacyId) groupMap[String(g.legacyId)] = name
        if (g.id) groupMap[String(g.id)] = name
      }
    })

    const memberGroupMap = {}
    ;(allMembers || []).forEach((m) => {
      const name = m.groupName || groupMap[String(m.groupId)] || ''
      if (name) {
        if (m.email) memberGroupMap[String(m.email).toLowerCase()] = name
        if (m.userId) memberGroupMap[String(m.userId)] = name
      }
    })

    const enrichedSessions = sessions.map((s) => {
      let resolved = groupMap[String(s.userGroup)]
      if (!resolved && s.userEmail) {
        resolved = memberGroupMap[String(s.userEmail).toLowerCase()]
      }
      if (!resolved && s.userId) {
        resolved = memberGroupMap[String(s.userId)]
      }
      if (!resolved && s.userGroup && !/^[0-9a-fA-F]{24}$/.test(String(s.userGroup))) {
        resolved = s.userGroup
      }
      return {
        ...s,
        userGroup: resolved || 'General',
      }
    })

    res.json({
      success: true,
      data: enrichedSessions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Returns attendance summary per user / group for selected date
 */
const getTeamViewAttendanceSummary = async (req, res, next) => {
  try {
    const { group = '', date = '' } = req.query
    const targetDate = date ? new Date(date) : new Date()
    const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0))
    const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999))

    const sessionQuery = {
      loginAt: { $gte: startOfDay, $lte: endOfDay },
    }
    if (group && group !== 'all') {
      sessionQuery.userGroup = { $regex: new RegExp(`^${group}$`, 'i') }
    }

    const [sessions, allGroups, allMembers] = await Promise.all([
      UserSession.find(sessionQuery).sort({ loginAt: 1 }).lean(),
      UserGroup ? UserGroup.find({}, '_id legacyId groupName name').lean().catch(() => []) : [],
      UserGroupMember ? UserGroupMember.find({}, 'userId email groupId groupName').lean().catch(() => []) : [],
    ])

    const groupMap = {}
    ;(allGroups || []).forEach((g) => {
      const name = g.groupName || g.name || ''
      if (name) {
        if (g._id) groupMap[String(g._id)] = name
        if (g.legacyId) groupMap[String(g.legacyId)] = name
        if (g.id) groupMap[String(g.id)] = name
      }
    })

    const memberGroupMap = {}
    ;(allMembers || []).forEach((m) => {
      const name = m.groupName || groupMap[String(m.groupId)] || ''
      if (name) {
        if (m.email) memberGroupMap[String(m.email).toLowerCase()] = name
        if (m.userId) memberGroupMap[String(m.userId)] = name
      }
    })

    // Aggregate by userEmail
    const summaryByUser = {}

    sessions.forEach((s) => {
      const email = s.userEmail || 'unknown'
      let resolvedGroup = groupMap[String(s.userGroup)]
      if (!resolvedGroup && s.userEmail) {
        resolvedGroup = memberGroupMap[String(s.userEmail).toLowerCase()]
      }
      if (!resolvedGroup && s.userId) {
        resolvedGroup = memberGroupMap[String(s.userId)]
      }
      if (!resolvedGroup && s.userGroup && !/^[0-9a-fA-F]{24}$/.test(String(s.userGroup))) {
        resolvedGroup = s.userGroup
      }
      resolvedGroup = resolvedGroup || 'General'
      if (!summaryByUser[email]) {
        summaryByUser[email] = {
          userId: s.userId,
          userEmail: s.userEmail,
          userName: s.userName,
          userGroup: resolvedGroup,
          ownerCode: s.ownerCode,
          firstLogin: s.loginAt,
          lastLogout: s.logoutAt,
          totalActiveSeconds: 0,
          totalIdleSeconds: 0,
          totalDurationSeconds: 0,
          sessionCount: 0,
          isCurrentlyOnline: s.status === 'active',
          latestStatus: s.status,
          latestLogoutReason: s.logoutReason,
        }
      }

      const rec = summaryByUser[email]
      rec.sessionCount += 1
      rec.totalActiveSeconds += s.totalActiveSeconds || 0
      rec.totalIdleSeconds += s.totalIdleSeconds || 0

      if (s.loginAt && new Date(s.loginAt) < new Date(rec.firstLogin)) {
        rec.firstLogin = s.loginAt
      }

      if (s.logoutAt) {
        if (!rec.lastLogout || new Date(s.logoutAt) > new Date(rec.lastLogout)) {
          rec.lastLogout = s.logoutAt
        }
      } else if (s.status === 'active') {
        rec.isCurrentlyOnline = true
      }

      const sessionDuration = s.logoutAt
        ? Math.max(0, Math.floor((new Date(s.logoutAt) - new Date(s.loginAt)) / 1000))
        : Math.max(0, Math.floor((new Date() - new Date(s.loginAt)) / 1000))
      rec.totalDurationSeconds += sessionDuration
    })

    const summaryList = Object.values(summaryByUser)

    // Calculate daily metrics
    const totalLoggedIn = summaryList.length
    const currentlyOnline = summaryList.filter((u) => u.isCurrentlyOnline).length
    const avgActiveSeconds = totalLoggedIn
      ? Math.floor(summaryList.reduce((acc, u) => acc + u.totalActiveSeconds, 0) / totalLoggedIn)
      : 0
    const avgIdleSeconds = totalLoggedIn
      ? Math.floor(summaryList.reduce((acc, u) => acc + u.totalIdleSeconds, 0) / totalLoggedIn)
      : 0

    res.json({
      success: true,
      data: {
        date: startOfDay.toISOString().split('T')[0],
        metrics: {
          totalLoggedIn,
          currentlyOnline,
          avgActiveSeconds,
          avgIdleSeconds,
        },
        users: summaryList,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Revoke session immediately
 */
const revokeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params
    if (sessionId) {
      await UserSession.updateOne(
        { sessionId },
        { $set: { status: 'revoked', logoutReason: 'admin_revoked', logoutAt: new Date(), updatedAt: new Date() } }
      )
    }
    res.json({ success: true, message: 'Session revoked successfully' })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getTeamViewSessions,
  getTeamViewAttendanceSummary,
  revokeSession,
}
