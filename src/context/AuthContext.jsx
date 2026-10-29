import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { authService } from '../services/authService'
import { authApi } from '../services/authApi'
import { auditClient } from '../services/auditClient'
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearStoredAuth,
  getStoredAuthToken,
  isAuthTokenExpired,
  setStoredAuthToken,
} from '../services/apiClient'
import { userApi } from '../services/userApi'
import {
  closeSocketConnection,
  createSocketConnection,
} from '../services/socketService'
import SessionExpiryModal from '../components/common/SessionExpiryModal'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [socket, setSocket] = useState(null)
  const [socketId, setSocketId] = useState('')
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const socketRef = useRef(null)

  const teardownSocket = useCallback(() => {
    if (!socketRef.current) return

    closeSocketConnection(socketRef.current)
    socketRef.current = null
    setSocket(null)
    setSocketId('')
  }, [])

  const initializeSocket = useCallback((userData, authToken) => {
    teardownSocket()

    const nextSocket = createSocketConnection(userData, {
      token: authToken,
      onConnect: () => {
        setIsOnline(true)
        setSocketId(nextSocket.id)
      },
      onDisconnect: () => {
        setIsOnline(false)
        setSocketId('')
      },
      onConnectError: (error) => {
        if (import.meta.env.DEV) {
          console.error('Socket connection error:', error)
        }
      },
    })

    socketRef.current = nextSocket
    setSocket(nextSocket)
    return nextSocket
  }, [teardownSocket])

  const syncAvailableUsers = useCallback(async () => {
    try {
      const users = await userApi.listDirectory()
      authService.saveAvailableUsers(users)
    } catch {
      authService.saveAvailableUsers([])
    }
  }, [])

  const [currentSessionId, setCurrentSessionId] = useState(() => localStorage.getItem('crm_session_id') || '')
  const [showExpiryModal, setShowExpiryModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [remainingModalSeconds, setRemainingModalSeconds] = useState(3600)
  const [autoLogoutOnZero, setAutoLogoutOnZero] = useState(false)
  const showExpiryModalRef = useRef(false)
  const lastActivityTimeRef = useRef(Date.now())
  const lastHeartbeatTimeRef = useRef(Date.now())
  const pageHiddenTimeRef = useRef(Date.now())
  const isModalLockedRef = useRef(false)
  const lastMousePosRef = useRef({ x: 0, y: 0 })
  const dismissedStagesRef = useRef(new Set())

  useEffect(() => {
    const bootstrapAuth = async () => {
      let savedToken = getStoredAuthToken()

      if (savedToken && isAuthTokenExpired(savedToken)) {
        clearStoredAuth()
        savedToken = ''
      }

      try {
        let result = await authApi.getCurrentUser()
        const hasSavedLoginState = Boolean(savedToken || authService.getCurrentUser())
        if (!result.user && hasSavedLoginState) {
          try {
            await authApi.refreshSession()
            result = await authApi.getCurrentUser()
          } catch {
            // Normal signed-out path continues below.
          }
        }

        // If no user yet, attempt 30-day remembered device login (passwordless re-entry)
        if (!result.user) {
          try {
            const remResult = await authApi.rememberedLogin()
            if (remResult?.success && remResult?.user) {
              result = { user: remResult.user }
              if (remResult.sessionId) {
                setCurrentSessionId(remResult.sessionId)
                localStorage.setItem('crm_session_id', remResult.sessionId)
              }
            }
          } catch {
            // No valid 30-day device token
          }
        }

        const nextUser = result.user
        if (!nextUser) {
          clearStoredAuth()
          authService.logout()
          setUser(null)
          return
        }

        const nextToken = ''
        setStoredAuthToken('')
        setUser(nextUser)
        authService.saveUser(nextUser)
        await syncAvailableUsers()
        initializeSocket(nextUser, nextToken)
      } catch {
        if (!savedToken && getStoredAuthToken()) {
          return
        }

        clearStoredAuth()
        authService.logout()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    bootstrapAuth()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      teardownSocket()
    }
  }, [initializeSocket, syncAvailableUsers, teardownSocket])

  const logout = useCallback(async () => {
    if (user) {
      auditClient.record('frontend.auth.logout', {
        actorMode: user.role === 'admin' || user.role === 'super_admin' ? 'admin' : 'user',
        role: user.role,
        actualRole: user.actualRole,
        userId: user.id,
      })
    }
    teardownSocket()
    const sid = currentSessionId || localStorage.getItem('crm_session_id')
    if (sid) {
      try {
        await authApi.logoutSession(sid)
      } catch {
        // Ignored
      }
      localStorage.removeItem('crm_session_id')
      setCurrentSessionId('')
    }
    try {
      await authApi.logout()
    } catch {
      // Local logout must still complete if the session is already expired.
    }
    clearStoredAuth()
    authService.logout()
    setUser(null)
  }, [teardownSocket, user, currentSessionId])

  const handleSessionContinue = useCallback(async () => {
    isModalLockedRef.current = false
    showExpiryModalRef.current = false
    lastActivityTimeRef.current = Date.now()
    pageHiddenTimeRef.current = Date.now()
    localStorage.removeItem('crm_page_away_start')
    localStorage.removeItem('crm_minimized_at')
    dismissedStagesRef.current.clear()
    setShowExpiryModal(false)
    setModalMessage('')
    console.log('%c[USER ACTION] ✅ Clicked Continue - Session kept active', 'color: #16a34a; font-weight: bold;')
    const sid = currentSessionId || localStorage.getItem('crm_session_id') || 'active_user'
    try {
      if (sid && sid !== 'active_user') {
        await authApi.continueSession(sid)
      }
      authApi.logSessionEvent(sid, {
        event: 'user_continued',
        stage: 'continued',
        details: 'User clicked Continue - Inactivity reset to 0',
        userEmail: user?.email,
        userName: user?.name,
        role: user?.role,
      })
    } catch {
      // Ignored
    }
  }, [currentSessionId, user])

  const handleSessionModalLogout = useCallback(async (reason = 'manual_logout') => {
    isModalLockedRef.current = false
    showExpiryModalRef.current = false
    setShowExpiryModal(false)
    setModalMessage('')
    localStorage.removeItem('crm_page_away_start')
    localStorage.removeItem('crm_minimized_at')
    dismissedStagesRef.current.clear()
    const sid = currentSessionId || localStorage.getItem('crm_session_id') || 'active_user'
    try {
      if (reason === 'inactivity_timeout') {
        console.log('%c[AUTO LOGOUT] 🔴 Session Auto-Logout executed (1 Hour Inactivity)', 'color: #dc2626; font-weight: bold;')
        authApi.logSessionEvent(sid, {
          event: 'auto_logout',
          stage: '1h_inactivity',
          details: '1-Hour inactivity limit reached',
          userEmail: user?.email,
          userName: user?.name,
          role: user?.role,
        })
        if (sid !== 'active_user') {
          await authApi.sessionTimeout(sid)
        }
      } else {
        if (sid !== 'active_user') {
          await authApi.logoutSession(sid)
        }
      }
    } catch {
      // Ignored
    }
    await logout()
  }, [currentSessionId, logout, user])

  const previewExpiryModal = useCallback((customMsg = '') => {
    isModalLockedRef.current = true
    showExpiryModalRef.current = true
    const msg = customMsg || 'Preview Mode: This is how the Session Expiry Warning Popup displays to users.'
    setModalMessage(msg)
    setRemainingModalSeconds(300)
    setAutoLogoutOnZero(false)
    setShowExpiryModal(true)
    console.log('%c[POPUP PREVIEW] ⚠️ Warning Popup Preview Triggered', 'color: #c60016; font-weight: bold;')
    const sid = currentSessionId || localStorage.getItem('crm_session_id') || 'active_user'
    authApi.logSessionEvent(sid, {
      event: 'popup_arrived',
      stage: 'preview_test',
      details: 'Admin clicked Preview Test Button',
      userEmail: user?.email,
      userName: user?.name,
      role: user?.role,
    })
  }, [currentSessionId, user])

  // Listen to window events for instant popup testing & minimize simulation
  useEffect(() => {
    const handlePreviewEvent = (e) => {
      previewExpiryModal(e?.detail?.message)
    }
    const handleSimulateEvent = () => {
      isModalLockedRef.current = true
      showExpiryModalRef.current = true
      setModalMessage('You have been away / page minimized for 20 minutes. Click Continue to keep working.')
      setRemainingModalSeconds(3600)
      setAutoLogoutOnZero(true)
      setShowExpiryModal(true)
      console.log('%c[TEST SIMULATION] ⏱️ 20-Minute Minimize Popup Simulated (60m Counter)', 'color: #c60016; font-weight: bold;')
      const sid = currentSessionId || localStorage.getItem('crm_session_id') || 'active_user'
      authApi.logSessionEvent(sid, {
        event: 'popup_arrived',
        stage: '5m_minimized',
        details: 'Admin clicked Test 5-Min Minimize (Instant)',
        userEmail: user?.email,
        userName: user?.name,
        role: user?.role,
      })
    }
    window.addEventListener('crm:preview-expiry-modal', handlePreviewEvent)
    window.addEventListener('crm:simulate-minimize-popup', handleSimulateEvent)
    return () => {
      window.removeEventListener('crm:preview-expiry-modal', handlePreviewEvent)
      window.removeEventListener('crm:simulate-minimize-popup', handleSimulateEvent)
    }
  }, [previewExpiryModal, currentSessionId, user])

  // Inactivity & Dual-Event Minimized Page Monitor (20m Minimized trigger, 60m Countdown & Auto-Logout)
  useEffect(() => {
    if (!user) return undefined

    const triggerPopup = (stage, message, remainingSec = 3600, shouldAutoLogout = true) => {
      isModalLockedRef.current = true
      showExpiryModalRef.current = true
      setModalMessage(message)
      setRemainingModalSeconds(remainingSec)
      setAutoLogoutOnZero(shouldAutoLogout)
      setShowExpiryModal(true)

      console.log(
        `%c[POPUP ARRIVED] ⚠️ Warning Popup Arrived: ${stage} (${message})`,
        'color: #c60016; font-weight: bold; font-size: 13px; background: #fff1f2; padding: 4px 8px; border-radius: 4px;'
      )

      const sid = currentSessionId || localStorage.getItem('crm_session_id') || 'active_user'
      authApi.logSessionEvent(sid, {
        event: 'popup_arrived',
        stage,
        details: message,
        userEmail: user?.email,
        userName: user?.name,
        role: user?.role,
      })
    }

    // Dual Detection: Record exact timestamp when window is minimized or blurred or tab is switched
    const recordAwayStart = () => {
      const now = Date.now()
      pageHiddenTimeRef.current = now
      if (!localStorage.getItem('crm_minimized_at')) {
        localStorage.setItem('crm_minimized_at', String(now))
      }
      localStorage.setItem('crm_page_away_start', String(now))
    }

    // Instant check when window is restored / focused (BEFORE any mouse events can reset)
    // Triggers only when user was away / minimized for >= 20 minutes (1200s)
    const checkAwayOnRestore = () => {
      const stored = localStorage.getItem('crm_minimized_at') || localStorage.getItem('crm_page_away_start')
      const awayStart = stored ? Number(stored) : pageHiddenTimeRef.current
      if (!awayStart) return

      const awaySeconds = Math.floor((Date.now() - awayStart) / 1000)
      if (awaySeconds >= 1200 && !dismissedStagesRef.current.has('20m_minimized') && !showExpiryModalRef.current) {
        dismissedStagesRef.current.add('20m_minimized')
        localStorage.removeItem('crm_minimized_at')
        localStorage.removeItem('crm_page_away_start')
        triggerPopup(
          '20m_minimized',
          `You have been away / page minimized for ${Math.floor(awaySeconds / 60)} minutes. For your security, your CRM session will automatically end in:`,
          3600, // 60 minutes countdown
          true  // Automatically log out when 60 minutes countdown finishes
        )
      }
    }

    // Mouse movement threshold guard (15px) and keyboard tracking to reset activity and prevent false triggers
    const updateActivity = (e) => {
      if (showExpiryModalRef.current || isModalLockedRef.current) return

      if (e?.type === 'mousemove') {
        const dx = Math.abs(e.clientX - lastMousePosRef.current.x)
        const dy = Math.abs(e.clientY - lastMousePosRef.current.y)
        if (dx < 15 && dy < 15) return
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }
      }

      // Check if user was away/minimized >= 20m before mouse/key reset
      checkAwayOnRestore()

      lastActivityTimeRef.current = Date.now()
      if (!showExpiryModalRef.current) {
        dismissedStagesRef.current.clear()
      }
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }))

    window.addEventListener('blur', recordAwayStart)
    window.addEventListener('focus', checkAwayOnRestore)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordAwayStart()
      } else {
        checkAwayOnRestore()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Global Test Helper for Developer / Console testing
    window.testInactivityPopup = (stage = '20m') => {
      if (stage === '1h' || stage === '60m') {
        handleSessionModalLogout('inactivity_timeout')
      } else {
        triggerPopup('20m_minimized', 'Test Mode: You have been away / page minimized for 20 minutes. For your security, your CRM session will automatically end in:', 3600, true)
      }
    }

    const checkInterval = setInterval(() => {
      const now = Date.now()
      const idleSeconds = Math.floor((now - lastActivityTimeRef.current) / 1000)
      const secondsSinceHeartbeat = Math.floor((now - lastHeartbeatTimeRef.current) / 1000)
      const sid = currentSessionId || localStorage.getItem('crm_session_id')

      // Send throttled heartbeat every 60 seconds if active (< 3600s idle)
      if (secondsSinceHeartbeat >= 60 && idleSeconds < 3600) {
        lastHeartbeatTimeRef.current = now
        if (sid && sid !== 'active_user') {
          authApi.sendHeartbeat(sid, 60).catch(() => {})
        }
      }

      // Check if window returned after >= 20 minutes away
      const stored = localStorage.getItem('crm_minimized_at') || localStorage.getItem('crm_page_away_start')
      const awayStart = stored ? Number(stored) : pageHiddenTimeRef.current
      const awaySeconds = Math.floor((now - awayStart) / 1000)

      if (document.visibilityState === 'visible' && awaySeconds >= 1200 && !dismissedStagesRef.current.has('20m_minimized') && !showExpiryModalRef.current) {
        checkAwayOnRestore()
      }

      // Fallback: 60 minutes inactive without modal open -> auto logout
      if (idleSeconds >= 3600 && !showExpiryModalRef.current) {
        showExpiryModalRef.current = false
        setShowExpiryModal(false)
        setModalMessage('')
        handleSessionModalLogout('inactivity_timeout')
      }
    }, 5000)

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity))
      window.removeEventListener('blur', recordAwayStart)
      window.removeEventListener('focus', checkAwayOnRestore)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(checkInterval)
    }
  }, [user, currentSessionId, handleSessionModalLogout])

  const login = async (username, password, role = 'user', options = {}) => {
    try {
      const result = await authApi.login(username, password, role, options)

      if (!result.success) {
        return { success: false, message: result.message }
      }

      if (result.sessionId) {
        setCurrentSessionId(result.sessionId)
        localStorage.setItem('crm_session_id', result.sessionId)
      }

      lastActivityTimeRef.current = Date.now()
      lastHeartbeatTimeRef.current = Date.now()
      setShowExpiryModal(false)

      setStoredAuthToken('')
      authService.saveUser(result.user)
      setUser(result.user)
      await syncAvailableUsers()
      teardownSocket()
      initializeSocket(result.user, '')
      auditClient.record('frontend.auth.login_success', {
        actorMode: result.user?.role === 'admin' || result.user?.role === 'super_admin' ? 'admin' : 'user',
        role: result.user?.role,
        actualRole: result.user?.actualRole,
        userId: result.user?.id,
      })
      return { success: true, user: result.user }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please try again.',
      }
    }
  }

  const getSessions = useCallback(async () => {
    const result = await authApi.getSessions()
    return result.sessions || []
  }, [])

  const logoutSession = useCallback(async (sessionId) => {
    await authApi.logoutSession(sessionId)
  }, [])

  const logoutAllSessions = useCallback(async () => {
    teardownSocket()
    try {
      await authApi.logoutAllSessions()
    } finally {
      localStorage.removeItem('crm_session_id')
      setCurrentSessionId('')
      clearStoredAuth()
      authService.logout()
      setUser(null)
    }
  }, [teardownSocket])

  useEffect(() => {
    const handleUnauthorized = () => {
      teardownSocket()
      localStorage.removeItem('crm_session_id')
      setCurrentSessionId('')
      clearStoredAuth()
      authService.logout()
      setUser(null)
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [teardownSocket])

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)
    authService.saveUser(updatedUser)
  }

  const value = {
    user,
    socket,
    socketId,
    isOnline,
    loading,
    currentSessionId,
    login,
    logout,
    getSessions,
    logoutSession,
    logoutAllSessions,
    updateUser,
    previewExpiryModal,
    simulateMinimizeModal: () => window.dispatchEvent(new CustomEvent('crm:simulate-minimize-popup')),
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      <SessionExpiryModal
        isOpen={showExpiryModal}
        message={modalMessage}
        remainingSeconds={remainingModalSeconds}
        autoLogoutOnZero={autoLogoutOnZero}
        onContinue={handleSessionContinue}
        onLogout={handleSessionModalLogout}
      />
    </AuthContext.Provider>
  )
}
