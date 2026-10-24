const sessionService = require('../services/sessionService')

const heartbeat = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId || req.headers['x-session-id']
    const activeSeconds = Number(req.body?.activeSeconds) || 60
    if (sessionId) {
      await sessionService.recordHeartbeat(sessionId, activeSeconds)
    }
    res.json({ success: true, timestamp: new Date() })
  } catch (error) {
    next(error)
  }
}

const continueSession = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId || req.headers['x-session-id']
    if (sessionId) {
      await sessionService.continueSession(sessionId)
    }
    res.json({ success: true, message: 'Session extended' })
  } catch (error) {
    next(error)
  }
}

const timeout = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId || req.headers['x-session-id']
    if (sessionId) {
      await sessionService.closeSession(sessionId, 'inactivity_timeout')
    }
    res.json({ success: true, message: 'Session ended due to inactivity timeout' })
  } catch (error) {
    next(error)
  }
}

const logoutSession = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId || req.headers['x-session-id']
    const reason = req.body?.reason || 'manual_logout'
    if (sessionId) {
      await sessionService.closeSession(sessionId, reason)
    }
    res.json({ success: true, message: 'Session closed' })
  } catch (error) {
    next(error)
  }
}

const logEvent = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId || req.headers['x-session-id']
    const { event, stage, details } = req.body || {}
    const user = req.user || {}
    const userEmail = String(user.email || req.body?.userEmail || '').trim() || 'User'
    const userName = String(user.name || user.username || req.body?.userName || '').trim() || userEmail
    const role = String(user.role || req.body?.role || 'user')
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    if (event === 'popup_arrived') {
      console.log(`\n\x1b[33m================================================================================\x1b[0m`)
      console.log(`\x1b[33m[POPUP ARRIVED]\x1b[0m ⚠️ Warning Popup Arrived for \x1b[36m${userName} (${userEmail})\x1b[0m`)
      console.log(`Role: \x1b[35m${role}\x1b[0m | Stage: \x1b[33m${stage || 'idle'}\x1b[0m | Time: \x1b[32m${timeStr}\x1b[0m`)
      if (details) console.log(`Details: ${details}`)
      console.log(`\x1b[33m================================================================================\x1b[0m\n`)
    } else if (event === 'user_continued') {
      console.log(`\n\x1b[32m================================================================================\x1b[0m`)
      console.log(`\x1b[32m[USER ACTION]\x1b[0m ✅ \x1b[36m${userName} (${userEmail})\x1b[0m clicked Continue - Session kept active`)
      console.log(`Time: \x1b[32m${timeStr}\x1b[0m | Timer reset to 0 | Ready for next 5-min minimize`)
      console.log(`\x1b[32m================================================================================\x1b[0m\n`)
    } else if (event === 'auto_logout') {
      console.log(`\n\x1b[31m================================================================================\x1b[0m`)
      console.log(`\x1b[31m[AUTO LOGOUT]\x1b[0m 🔴 Session Auto-Logout executed (1 Hour Inactivity) for \x1b[36m${userName} (${userEmail})\x1b[0m`)
      console.log(`Time: \x1b[31m${timeStr}\x1b[0m`)
      console.log(`\x1b[31m================================================================================\x1b[0m\n`)
    }

    if (sessionId && sessionId !== 'active_user') {
      await sessionService.recordSessionEvent(sessionId, { event, stage, details })
    }

    res.json({ success: true, timestamp: new Date() })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  heartbeat,
  continueSession,
  timeout,
  logoutSession,
  logEvent,
}
