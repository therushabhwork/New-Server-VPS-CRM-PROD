const crypto = require('crypto')
const { getMongoModel } = require('../models/mongoModels')

const UserSession = getMongoModel('user_sessions')
const RememberedDevice = getMongoModel('remembered_devices')
const User = getMongoModel('users')
const UserGroupMember = getMongoModel('user_group_members')
const UserGroup = getMongoModel('user_groups')

const hashDeviceToken = (token) => {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

/**
 * Creates or updates a session ledger entry on login
 */
const recordLoginSession = async ({ user = {}, sessionId = '', deviceName = 'Desktop', ipAddress = '', loginMode = 'password' }) => {
  if (!user.id && !user._id) return null

  const userId = String(user.id || user._id)
  const userEmail = String(user.email || '').trim().toLowerCase()
  const userName = String(user.name || user.username || '').trim()
  const ownerCode = String(user.ownerCode ?? user.owner_code ?? '').trim()

  // Attempt to resolve the user's primary group dynamically from user_group_members or user
  let userGroup = String(user.userGroup || user.groupName || '').trim()
  if (!userGroup) {
    try {
      const memberDoc = await UserGroupMember.findOne({
        $or: [{ userId: String(userId) }, { 'member.email': userEmail }, { email: userEmail }]
      }).lean()
      if (memberDoc) {
        userGroup = String(memberDoc.groupName || memberDoc.groupId || '').trim()
        if (memberDoc.groupId && (!userGroup || userGroup === String(memberDoc.groupId))) {
          const groupDoc = await UserGroup.findById(memberDoc.groupId).lean()
          if (groupDoc) {
            userGroup = String(groupDoc.groupName || '').trim()
          }
        }
      }
    } catch {
      // Non-critical fallback
    }
  }
  if (!userGroup) userGroup = 'General'

  const effectiveSessionId = sessionId || `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
  const now = new Date()

  const sessionDoc = await UserSession.findOneAndUpdate(
    { sessionId: effectiveSessionId },
    {
      $set: {
        userId,
        sessionId: effectiveSessionId,
        userEmail,
        userName,
        userGroup,
        ownerCode,
        deviceName: deviceName || 'Desktop',
        ipAddress: ipAddress || null,
        loginAt: now,
        lastActivityAt: now,
        logoutAt: null,
        status: 'active',
        logoutReason: null,
        loginMode,
        updatedAt: now,
      },
      $setOnInsert: {
        totalActiveSeconds: 0,
        totalIdleSeconds: 0,
        createdAt: now,
      },
    },
    { upsert: true, new: true }
  ).lean()

  return sessionDoc
}

/**
 * Creates a 30-day remembered device token
 */
const issueRememberedDevice = async ({ user = {}, deviceName = 'Desktop' }) => {
  const userId = String(user.id || user._id)
  const userEmail = String(user.email || '').trim().toLowerCase()
  if (!userId || !userEmail) return null

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashDeviceToken(rawToken)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await RememberedDevice.findOneAndUpdate(
    { userId, tokenHash },
    {
      $set: {
        userId,
        userEmail,
        tokenHash,
        deviceName: deviceName || 'Desktop',
        expiresAt,
        lastUsedAt: now,
        status: 'active',
        revokedAt: null,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  )

  return { rawToken, expiresAt }
}

/**
 * Verifies remembered device and returns user document if valid and active
 */
const verifyRememberedDevice = async (rawToken) => {
  if (!rawToken) return null
  const tokenHash = hashDeviceToken(rawToken)
  const now = new Date()

  const device = await RememberedDevice.findOne({
    tokenHash,
    status: 'active',
    expiresAt: { $gt: now },
  }).lean()

  if (!device) return null

  // Cross-verify with users collection
  const user = await User.findOne({
    $or: [{ _id: device.userId }, { legacyId: Number(device.userId) || -1 }, { email: device.userEmail }],
    status: 'approved',
  }).lean()

  if (!user || user.status === 'disabled' || user.status === 'rejected') {
    return null
  }

  // Update lastUsedAt
  await RememberedDevice.updateOne({ _id: device._id }, { $set: { lastUsedAt: now } })

  return user
}

/**
 * Updates session activity / heartbeat
 */
const recordHeartbeat = async (sessionId, activeSecondsIncrement = 60) => {
  if (!sessionId) return null
  const now = new Date()

  return UserSession.findOneAndUpdate(
    { sessionId, status: 'active' },
    {
      $set: { lastActivityAt: now, updatedAt: now },
      $inc: { totalActiveSeconds: activeSecondsIncrement },
    },
    { new: true }
  ).lean()
}

/**
 * Resets inactivity and confirms session continuation
 */
const continueSession = async (sessionId) => {
  if (!sessionId) return null
  const now = new Date()

  return UserSession.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        status: 'active',
        lastActivityAt: now,
        logoutAt: null,
        logoutReason: null,
        updatedAt: now,
      },
    },
    { new: true }
  ).lean()
}

/**
 * Closes session (manual logout or inactivity timeout)
 */
const closeSession = async (sessionId, reason = 'manual_logout') => {
  if (!sessionId) return null
  const now = new Date()
  const status = reason === 'inactivity_timeout' ? 'idle_timeout' : 'logged_out'

  return UserSession.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        status,
        logoutAt: now,
        logoutReason: reason,
        updatedAt: now,
      },
    },
    { new: true }
  ).lean()
}

/**
 * Records a session event (popup arrived, user continued, auto logout)
 */
const recordSessionEvent = async (sessionId, { event = 'popup_arrived', stage = '', details = '' }) => {
  if (!sessionId) return null
  const now = new Date()
  return UserSession.findOneAndUpdate(
    { sessionId },
    {
      $push: {
        sessionLogs: {
          event,
          stage,
          details,
          timestamp: now,
        },
      },
      $set: { updatedAt: now },
    },
    { new: true }
  ).lean()
}

/**
 * Revokes all remembered devices for a user
 */
const revokeAllRememberedDevices = async (userId) => {
  return RememberedDevice.updateMany(
    { userId: String(userId) },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  )
}

module.exports = {
  recordLoginSession,
  issueRememberedDevice,
  verifyRememberedDevice,
  recordHeartbeat,
  continueSession,
  closeSession,
  recordSessionEvent,
  revokeAllRememberedDevices,
  hashDeviceToken,
}
