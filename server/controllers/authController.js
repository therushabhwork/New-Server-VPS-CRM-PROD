const authService = require('../services/authService')
const passwordResetService = require('../services/passwordResetService')
const { env } = require('../config/env')
const { extractToken } = require('../middleware/authMiddleware')
const { verifyJwt } = require('../utils/jwt')

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: env.jwtCookieMaxAgeMs,
  path: '/',
})

const refreshCookieOptions = (expiresAt = null) => ({
  ...cookieOptions(),
  maxAge: expiresAt
    ? Math.max(0, new Date(expiresAt).getTime() - Date.now())
    : env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
})

const setSessionCookies = (res, result = {}) => {
  if (result.token) {
    res.cookie('token', result.token, cookieOptions())
  }
  if (result.refreshToken) {
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt))
  }
}

const shouldReturnTokens = (req) => (
  req.body?.includeToken === true
  || String(req.body?.clientType || '').toLowerCase() === 'mobile'
)

const buildTokenPayload = (req, result = {}) => {
  if (!shouldReturnTokens(req)) return {}

  return {
    tokens: {
      accessToken: result.token || '',
      refreshToken: result.refreshToken || '',
      refreshTokenExpiresAt: result.refreshTokenExpiresAt || null,
    },
  }
}

const getRequestMeta = (req) => ({
  userAgent: req.headers['user-agent'] || '',
  ipAddress: req.ip || req.socket?.remoteAddress || '',
  deviceName: req.body?.deviceName,
  browser: req.body?.browser,
})

const sessionService = require('../services/sessionService')

const rememberedDeviceCookieOptions = (expiresAt) => ({
  ...cookieOptions(),
  maxAge: expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 30 * 24 * 60 * 60 * 1000,
})

const setRememberedDeviceCookie = (res, deviceResult = {}) => {
  if (deviceResult?.rawToken) {
    res.cookie('crm_device_token', deviceResult.rawToken, rememberedDeviceCookieOptions(deviceResult.expiresAt))
  }
}

const login = async (req, res, next) => {
  try {
    const requestMeta = getRequestMeta(req)
    const result = await authService.login(req.body || {}, requestMeta)
    setSessionCookies(res, result)

    // Record session in user_sessions & issue 30-day remembered device
    const sessionId = result.session?.id || `${Date.now()}`
    await sessionService.recordLoginSession({
      user: result.user,
      sessionId,
      deviceName: requestMeta.deviceName || 'Desktop',
      ipAddress: requestMeta.ipAddress,
      loginMode: 'password',
    })

    const deviceResult = await sessionService.issueRememberedDevice({
      user: result.user,
      deviceName: requestMeta.deviceName || 'Desktop',
    })
    setRememberedDeviceCookie(res, deviceResult)

    res.json({
      success: true,
      user: result.user,
      session: {
        ...result.session,
        id: sessionId,
      },
      sessionId,
      ...buildTokenPayload(req, result),
    })
  } catch (error) {
    next(error)
  }
}

const rememberedLogin = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.crm_device_token || req.body?.deviceToken
    if (!rawToken) {
      return res.status(401).json({ success: false, message: 'No remembered device token found.' })
    }

    const verifiedUser = await sessionService.verifyRememberedDevice(rawToken)
    if (!verifiedUser) {
      res.clearCookie('crm_device_token', { path: '/' })
      return res.status(401).json({ success: false, message: 'Remembered device expired or user account not active.' })
    }

    const requestMeta = getRequestMeta(req)
    // Issue brand new CRM session without password
    const safeUser = await authService.getCurrentUser(verifiedUser.legacyId || verifiedUser._id)
    const portalRole = safeUser.role
    const session = await authService.issueSession(safeUser, verifiedUser, {
      rememberMe: true,
      requestMeta,
    })

    setSessionCookies(res, session)
    const sessionId = session.session?.id || `${Date.now()}`

    await sessionService.recordLoginSession({
      user: safeUser,
      sessionId,
      deviceName: requestMeta.deviceName || 'Desktop',
      ipAddress: requestMeta.ipAddress,
      loginMode: 'remembered_device',
    })

    res.json({
      success: true,
      user: safeUser,
      session: {
        ...session.session,
        id: sessionId,
      },
      sessionId,
      ...buildTokenPayload(req, session),
    })
  } catch (error) {
    next(error)
  }
}

const microsoftLoginUrl = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        authUrl: authService.buildMicrosoftLoginAuthUrl(req.query?.returnUrl || req.body?.returnUrl),
      },
    })
  } catch (error) {
    next(error)
  }
}

const microsoftLoginRedirect = async (req, res, next) => {
  try {
    const authUrl = authService.buildMicrosoftLoginAuthUrl(req.query?.returnUrl || req.body?.returnUrl)
    res.redirect(authUrl)
  } catch (error) {
    next(error)
  }
}

const microsoftCallback = async (req, res, next) => {
  try {
    const callbackData = {
      ...(req.query || {}),
      ...(req.body || {}),
    }
    const result = await authService.loginWithMicrosoftCallback(callbackData, getRequestMeta(req))
    setSessionCookies(res, result)

    const redirectUrl = new URL(result.returnUrl || env.clientUrl)
    redirectUrl.searchParams.set('microsoft', 'success')
    if (result.outlookConnected) {
      redirectUrl.searchParams.set('outlook', 'connected')
      if (result.outlookEmail) redirectUrl.searchParams.set('outlookEmail', result.outlookEmail)
    }
    res.redirect(redirectUrl.toString())
  } catch (error) {
    try {
      const fallbackUrl = new URL(env.clientUrl || 'http://localhost:5173')
      fallbackUrl.pathname = '/login'
      fallbackUrl.searchParams.set('microsoft', 'failed')
      fallbackUrl.searchParams.set('message', error.message || 'Microsoft login failed.')
      res.redirect(fallbackUrl.toString())
      return
    } catch (_redirectError) {
      next(error)
    }
  }
}

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refreshSession(req.cookies?.refreshToken || req.body?.refreshToken)
    setSessionCookies(res, result)
    res.json({
      success: true,
      user: result.user,
      session: result.session,
      ...buildTokenPayload(req, result),
    })
  } catch (error) {
    res.clearCookie('token', { path: '/' })
    res.clearCookie('refreshToken', { path: '/' })
    next(error)
  }
}

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body || {})
    res.status(201).json({
      success: true,
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

const me = async (req, res, next) => {
  try {
    if (!req.user) {
      res.json({
        success: true,
        authenticated: false,
        user: null,
      })
      return
    }

    const user = await authService.getCurrentUser(req.user.id)
    if (req.user.canActAsUser && req.user.role !== user.role) {
      user.actualRole = req.user.actualRole || user.role
      user.role = req.user.role
      user.canActAsUser = true
      user.userRoleMode = req.user.userRoleMode || user.userRoleMode || 'both'
    }
    const token = extractToken(req)
    if (token) {
      res.cookie('token', token, cookieOptions())
    }
    res.json({
      success: true,
      user,
    })
  } catch (error) {
    next(error)
  }
}

const profile = me

const verify = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        authenticated: false,
        message: 'Authentication is required.',
      })
      return
    }

    const user = await authService.getCurrentUser(req.user.id)
    res.json({
      success: true,
      authenticated: true,
      user,
    })
  } catch (error) {
    next(error)
  }
}

const logout = async (req, res) => {
  try {
    const token = extractToken(req)
    if (token) {
      const payload = verifyJwt(token, env.jwtSecret)
      await authService.logoutUser(payload.userId)
    } else {
      await authService.logoutRefreshSession(req.cookies?.refreshToken || req.body?.refreshToken)
    }
  } catch {
    // Cookie/local cleanup should still happen when the token is already bad.
    try {
      await authService.logoutRefreshSession(req.cookies?.refreshToken || req.body?.refreshToken)
    } catch {
      // Ignore secondary cleanup failure.
    }
  }

  res.clearCookie('token', { path: '/' })
  res.clearCookie('refreshToken', { path: '/' })
  res.json({ success: true })
}

const sessions = async (req, res, next) => {
  try {
    const result = await authService.listSessions(req.user?.id)
    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

const deleteSession = async (req, res, next) => {
  try {
    await authService.revokeSession(req.user?.id, req.params.id)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

const submitPasswordResetRequest = async (req, res, next) => {
  try {
    const result = await passwordResetService.requestPasswordReset(req.body || {}, getRequestMeta(req))
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.request,
    })
  } catch (error) {
    next(error)
  }
}

const logoutAll = async (req, res, next) => {
  try {
    await authService.logoutAllSessions(req.user?.id)
    res.clearCookie('token', { path: '/' })
    res.clearCookie('refreshToken', { path: '/' })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

const notImplemented = (featureName) => (_req, res) => {
  res.status(501).json({
    success: false,
    code: 'NOT_IMPLEMENTED',
    message: `${featureName} is planned but is not enabled yet.`,
  })
}

module.exports = {
  login,
  rememberedLogin,
  microsoftLoginUrl,
  microsoftLoginRedirect,
  microsoftCallback,
  refresh,
  register,
  me,
  profile,
  verify,
  logout,
  sessions,
  deleteSession,
  logoutAll,
  forgotPassword: submitPasswordResetRequest,
  submitPasswordResetRequest,
  resetPassword: notImplemented('Reset password'),
  changePassword: notImplemented('Change password'),
}
