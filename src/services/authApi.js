import apiClient from './apiClient'

export const authApi = {
  async login(username, password, role = 'user', options = {}) {
    return apiClient.post('/auth/login', {
      username,
      password,
      role,
      rememberMe: Boolean(options.rememberMe),
    })
  },

  async getMicrosoftLoginUrl(returnUrl = '') {
    return apiClient.get('/auth/microsoft/url', {
      params: returnUrl ? { returnUrl } : {},
    })
  },

  getMicrosoftLoginRedirectUrl(returnUrl = '') {
    const params = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''
    return `/api/auth/microsoft/login${params}`
  },

  async getCurrentUser() {
    return apiClient.get('/auth/me')
  },

  async refreshSession() {
    return apiClient.post('/auth/refresh')
  },

  async rememberedLogin() {
    return apiClient.post('/auth/remembered-login')
  },

  async sendHeartbeat(sessionId, activeSeconds = 60) {
    return apiClient.post('/sessions/heartbeat', { sessionId, activeSeconds })
  },

  async continueSession(sessionId) {
    return apiClient.post('/sessions/continue', { sessionId })
  },

  async sessionTimeout(sessionId) {
    return apiClient.post('/sessions/timeout', { sessionId })
  },

  async logSessionEvent(sessionId, { event = 'popup_arrived', stage = '', details = '', userEmail = '', userName = '', role = '' } = {}) {
    return apiClient.post('/sessions/log-event', {
      sessionId: sessionId || 'active_user',
      event,
      stage,
      details,
      userEmail,
      userName,
      role,
    }).catch(() => {})
  },

  async logout() {
    return apiClient.post('/auth/logout')
  },

  async verifySession() {
    return apiClient.get('/auth/verify')
  },

  async getProfile() {
    return apiClient.get('/auth/profile')
  },

  async getSessions() {
    return apiClient.get('/auth/sessions')
  },

  async logoutSession(sessionId) {
    return apiClient.delete(`/auth/session/${sessionId}`)
  },

  async logoutAllSessions() {
    return apiClient.delete('/auth/logout-all')
  },

  async submitPasswordResetRequest({ login, newPassword, confirmPassword }) {
    return apiClient.post('/auth/password-reset-requests', {
      login,
      newPassword,
      confirmPassword,
    })
  },
}
