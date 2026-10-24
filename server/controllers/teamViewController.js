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

    const [total, sessions] = await Promise.all([
      UserSession.countDocuments(query),
      UserSession.find(query)
        .sort({ loginAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ])

    res.json({
      success: true,
      data: sessions,
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

    const sessions = await UserSession.find(sessionQuery).sort({ loginAt: 1 }).lean()

    // Aggregate by userEmail
    const summaryByUser = {}

    sessions.forEach((s) => {
      const email = s.userEmail || 'unknown'
      if (!summaryByUser[email]) {
        summaryByUser[email] = {
          userId: s.userId,
          userEmail: s.userEmail,
          userName: s.userName,
          userGroup: s.userGroup,
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
