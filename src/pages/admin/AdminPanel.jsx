import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FaAddressCard,
  FaCalendarAlt,
  FaBell,
  FaBriefcase,
  FaClipboardList,
  FaDesktop,
  FaFileAlt,
  FaFilter,
  FaHandshake,
  FaHome,
  FaRegClock,
  FaStar,
  FaSyncAlt,
  FaTable,
  FaTasks,
  FaUser,
  FaUsers,
  FaComments,
  FaCheck,
  FaPlus,
  FaTimes,
  FaExternalLinkAlt,
} from 'react-icons/fa'
import { FiArrowLeft, FiArrowRight, FiChevronDown, FiEdit2, FiPlus, FiSettings, FiTrash2 } from 'react-icons/fi'
import Modal from '../../components/common/Modal'
import ActiveReminderActionModal from './reminders/ActiveReminderActionModal'
import { useClickOutside } from '../../hooks'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../services/apiClient'
import { remarkApi } from '../../services/remarkApi'
import { customerService } from '../../services/customerService'
import { APP_NAME } from '../../utils/constants'
import { filterCommunicationActivitiesForUser } from '../../utils/communicationActivityAccess'
import { getAdminBookmarks, subscribeAdminBookmarks, toggleAdminBookmark } from '../../features/adminBookmarks/adminBookmarkStorage'
import {
  DASHBOARD_TAB_TEMPLATES,
  addDashboardTab,
  deleteDashboardTab,
  getDashboardTabs,
  moveDashboardTab,
  saveDashboardTabs,
  subscribeDashboardTabs,
  updateDashboardTab,
} from '../../features/adminDashboardTabs/dashboardTabStorage'
import { getWeeklyReportsAllBoardData } from '../../features/adminAccounts/selectors/getWeeklyReportsAllBoardData'
import { getSwBarodaMumBoardData } from '../../features/adminAccounts/selectors/getSwBarodaMumBoardData'
import { getAdminReminders } from '../../features/adminReminders/getAdminReminders'
import { activateAdminReminder, closeAdminReminder, getAdminReminderStates, subscribeAdminReminderStates } from '../../features/adminReminders/reminderStorage'
import { buildMonthlyWonLostData, buildPerformanceSummary } from '../../features/adminDashboardTabs/dashboardInsights'
import './AdminPanel.css'
import { analyticsApi } from '../../services/analyticsApi'
import DealPerformanceCard from '../../components/dashboard/DealPerformanceCard'
import AdminAnalyticsGraphs from '../../components/dashboard/AdminAnalyticsGraphs'

const QUICK_NAV = [
  { id: 'dash', dotColor: '#3498db', label: 'Start with Dashboard', route: '/admin/monitoring' },
  { id: 'work', dotColor: '#bdc3c7', label: 'Let me check with my work and status', route: '/admin/my-work-status' },
  { id: 'reports', dotColor: '#e67e22', label: 'Analyze and monitor custom reports', route: '/admin/reports/custom' },
  { id: 'admin', dotColor: '#27ae60', label: 'Take me to Administration', route: '/admin/settings' },
  { id: 'profile', dotColor: '#f1c40f', label: 'My User Profile', route: '/admin/user-management' },
]

const TAB_ICON = <FaDesktop />
const MY_CRM_ICON = <FaUsers />
const MY_CRM_VIEW_ROUTES = {
  accounts: '/admin/accounts',
  customers: '/admin/customers/my-customers',
  supportRequests: '/admin/support-requests/list',
  deals: '/admin/deals/view',
}
const WON_TAB_STATUSES = new Set(['won', 'closed won', 'converted'])
const LOST_TAB_STATUSES = new Set(['lost', 'closed lost', 'rejected'])

const normalizeDashboardStatus = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
)

const getDashboardDrilldownMonthKey = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const formatStatusLabel = (value, fallback = 'Pending') => {
  const normalized = String(value || '').trim()
  if (!normalized) return fallback

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const formatTodoDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const buildStatusSummary = (records, getValue, fallbackLabels = [], maxItems = 6) => {
  const counts = records.reduce((accumulator, record) => {
    const key = formatStatusLabel(getValue(record), '')
    if (!key) return accumulator
    accumulator[key] = (accumulator[key] || 0) + 1
    return accumulator
  }, {})

  const items = Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, maxItems)
    .map(([label, value]) => ({ label, value }))

  if (items.length > 0) return items

  return fallbackLabels.slice(0, maxItems).map((label) => ({ label, value: 0 }))
}

const buildEmptyTabDraft = () => ({
  name: '',
  viewKey: 'swatiGroup',
})

const buildDashboardBookmarkRoute = (tab) => `/admin/monitoring?view=${encodeURIComponent(tab.viewKey)}`

const resolveRequestedSection = (search, tabs) => {
  const params = new URLSearchParams(search)
  const requestedSection = params.get('section')

  if (requestedSection === 'home') {
    return 'home'
  }

  const requestedTabId = params.get('tabId')
  if (requestedTabId && tabs.some((tab) => tab.id === requestedTabId)) {
    return requestedTabId
  }

  const requestedView = params.get('view')
  if (requestedView) {
    const matchingTab = tabs.find((tab) => tab.viewKey === requestedView)
    if (matchingTab) {
      return matchingTab.id
    }
  }

  return 'home'
}

const DashboardTabModal = ({
  isOpen,
  title,
  submitLabel,
  draft,
  onDraftChange,
  onClose,
  onSubmit,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="small"
    footer={(
      <>
        <button type="button" className="ap-modal-btn ap-modal-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ap-modal-btn ap-modal-btn-primary" onClick={onSubmit}>
          {submitLabel}
        </button>
      </>
    )}
  >
    <div className="ap-modal-form">
      <label className="ap-modal-field">
        <span>Tab Name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(event) => onDraftChange((currentValue) => ({ ...currentValue, name: event.target.value }))}
          placeholder="Enter dashboard tab name"
        />
      </label>

      <label className="ap-modal-field">
        <span>Dashboard Type</span>
        <select
          value={draft.viewKey}
          onChange={(event) => onDraftChange((currentValue) => ({ ...currentValue, viewKey: event.target.value }))}
        >
          {DASHBOARD_TAB_TEMPLATES.map((template) => (
            <option key={template.value} value={template.value}>
              {template.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  </Modal>
)

const AdminPanel = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { accounts, deals, quotations = [], activities = [], supportRequests, tasks = [], reminders = [], refreshData, addNotification, updateReminder, updateDeal, updateAccount } = useData()
  const { user, socket } = useAuth()
  const [dashboardTabs, setDashboardTabs] = useState(() => getDashboardTabs())
  const [activeSection, setActiveSection] = useState('home')
  const [openMenuState, setOpenMenuState] = useState(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const [activeReminderModalItem, setActiveReminderModalItem] = useState(null)
  const [tabDraft, setTabDraft] = useState(buildEmptyTabDraft)
  const [editingTabId, setEditingTabId] = useState('')
  const [bookmarks, setBookmarks] = useState(() => getAdminBookmarks(user))
  const [selectedPerformanceMetric, setSelectedPerformanceMetric] = useState('won')
  const [collapsedMyCrmCards, setCollapsedMyCrmCards] = useState([])
  const [todoReplies, setTodoReplies] = useState([])
  const [communicationRemarks, setCommunicationRemarks] = useState([])
  const [activeTodoTab, setActiveTodoTab] = useState('all')
  const [todoFilter, setTodoFilter] = useState('all')
  const [reminderStatesById, setReminderStatesById] = useState(() => getAdminReminderStates())
  const menuRef = useClickOutside(() => setOpenMenuState(null))
  const customers = useMemo(() => customerService.getCustomers(), [])
  const isAdmin = user?.role === 'admin'

  const [analyticsData, setAnalyticsData] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [userPerformanceList, setUserPerformanceList] = useState([])
  const [loadingUserPerformance, setLoadingUserPerformance] = useState(false)
  const isFetchingPerfRef = useRef(false)
  const lastFetchedKeyRef = useRef('')
  const lastToastKeyRef = useRef('')

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true)
      const data = await analyticsApi.getDashboardAnalytics()
      if (data) setAnalyticsData(data)
    } catch (err) {
      console.error('Failed to fetch dashboard analytics:', err)
    } finally {
      setLoadingAnalytics(false)
    }
  }, [])

  const notifyGroupPerformance = useCallback((tabName, perfList, isRealtime = false) => {
    if (!perfList || !Array.isArray(perfList) || perfList.length === 0) return

    const toastKey = `${tabName}_${perfList.length}`
    if (!isRealtime && lastToastKeyRef.current === toastKey) {
      return
    }
    lastToastKeyRef.current = toastKey

    let totalAccounts = 0
    let totalWon = 0
    let totalLost = 0
    let totalQuotations = 0

    perfList.forEach((u) => {
      const monthly = u.monthly || []
      monthly.forEach((m) => {
        totalAccounts += Number(m.accounts || 0)
        totalWon += Number(m.closedWon || 0)
        totalLost += Number(m.closedLost || 0)
        totalQuotations += Number(m.quotations || 0)
      })
    })

    const memberNames = perfList.map((p) => p.ownerName).filter(Boolean)
    const displayNames = memberNames.slice(0, 4).join(', ') + (memberNames.length > 4 ? ` +${memberNames.length - 4} more` : '')

    addNotification(
      'info',
      `${tabName} — ${isRealtime ? 'Real-Time Live Update' : 'Real-Time Performance'}`,
      `Members: ${displayNames} | Accounts: ${totalAccounts} | Closed Won: ${totalWon} | Closed Lost: ${totalLost} | Quotations: ${totalQuotations}`
    )
  }, [addNotification])

  const fetchUserPerformance = useCallback(async (viewKey, isRealtime = false) => {
    if (!viewKey) return
    if (!isRealtime && isFetchingPerfRef.current && lastFetchedKeyRef.current === viewKey) {
      return
    }

    try {
      isFetchingPerfRef.current = true
      lastFetchedKeyRef.current = viewKey
      setLoadingUserPerformance(true)
      const data = await analyticsApi.getUserDealPerformance({ group: viewKey })
      if (Array.isArray(data)) {
        setUserPerformanceList(data)
        const currentTab = dashboardTabs.find((tab) => tab.id === activeSection || tab.viewKey === viewKey)
        const tabTitle = currentTab?.name || 'Group Performance'
        notifyGroupPerformance(tabTitle, data, isRealtime)
      }
    } catch (err) {
      console.error('Failed to fetch user deal performance:', err)
    } finally {
      isFetchingPerfRef.current = false
      setLoadingUserPerformance(false)
    }
  }, [activeSection, dashboardTabs, notifyGroupPerformance])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  useEffect(() => {
    if (activeSection !== 'home') {
      const currentTab = dashboardTabs.find((tab) => tab.id === activeSection)
      const vk = currentTab?.viewKey || ''
      const isSwatiOrGroup = /swati|ahmedabad/i.test(vk) || /swati|ahmedabad/i.test(currentTab?.name || '') || /swati|ahmedabad/i.test(activeSection)
      if (isSwatiOrGroup || ['salesSwati', 'swatiGroup', 'salesLumos', 'userWisePerformance', 'allUsers', 'salesPerformanceA', 'salesPerformanceB'].includes(vk)) {
        fetchUserPerformance(isSwatiOrGroup ? (vk || 'salesSwati') : vk)
      }
    }
  }, [activeSection, dashboardTabs, fetchUserPerformance])

  useEffect(() => {
    if (!socket) return undefined
    const handleRealtimeRefresh = () => {
      fetchAnalytics()
      const currentTab = dashboardTabs.find((tab) => tab.id === activeSection)
      const vk = currentTab?.viewKey || ''
      const isSwatiOrGroup = /swati|ahmedabad/i.test(vk) || /swati|ahmedabad/i.test(currentTab?.name || '') || /swati|ahmedabad/i.test(activeSection)
      if (currentTab && (isSwatiOrGroup || ['salesSwati', 'swatiGroup', 'salesLumos', 'userWisePerformance', 'allUsers', 'salesPerformanceA', 'salesPerformanceB'].includes(vk))) {
        fetchUserPerformance(isSwatiOrGroup ? (vk || 'salesSwati') : vk, true)
      }
    }

    socket.on('dashboard:update', handleRealtimeRefresh)
    socket.on('user:online', handleRealtimeRefresh)
    socket.on('user:offline', handleRealtimeRefresh)
    socket.on('users:online', handleRealtimeRefresh)

    return () => {
      socket.off('dashboard:update', handleRealtimeRefresh)
      socket.off('user:online', handleRealtimeRefresh)
      socket.off('user:offline', handleRealtimeRefresh)
      socket.off('users:online', handleRealtimeRefresh)
    }
  }, [socket, fetchAnalytics, activeSection, dashboardTabs, fetchUserPerformance])

  const fetchTodoReplies = useCallback(async () => {
    try {
      const res = await apiClient.get('/support-requests/todo/replies')
      setTodoReplies(Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []))
    } catch (error) {
      console.error('Failed to fetch todo replies:', error)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    remarkApi.getAllRemarks({ limit: 10 }).then((res) => {
      if (isMounted && Array.isArray(res)) {
        setCommunicationRemarks(filterCommunicationActivitiesForUser(res, user).slice(0, 10))
      }
    }).catch(() => {})
    return () => { isMounted = false }
  }, [user])

  useEffect(() => {
    fetchTodoReplies()
  }, [fetchTodoReplies])
  useEffect(() => subscribeAdminReminderStates(setReminderStatesById), [])

  const weeklyData = useMemo(() => getWeeklyReportsAllBoardData(accounts), [accounts])
  const swBarodaData = useMemo(() => getSwBarodaMumBoardData(accounts), [accounts])
  const requestedSection = useMemo(() => (
    resolveRequestedSection(location.search, dashboardTabs)
  ), [dashboardTabs, location.search])

  useEffect(() => subscribeDashboardTabs(setDashboardTabs), [])
  useEffect(() => {
    setBookmarks(getAdminBookmarks(user))
    return subscribeAdminBookmarks(user, setBookmarks)
  }, [user])

  useEffect(() => {
    if (location.search) {
      setActiveSection(requestedSection)
      return
    }

    if (activeSection !== 'home' && !dashboardTabs.some((tab) => tab.id === activeSection)) {
      setActiveSection('home')
    }
  }, [activeSection, dashboardTabs, location.search, requestedSection])

  useEffect(() => {
    if (!socket) return undefined

    const handleRemoteTabs = (payload) => {
      if (!payload?.tabs) return
      setDashboardTabs(saveDashboardTabs(payload.tabs))
    }

    socket.on('dashboard-tabs:update', handleRemoteTabs)
    return () => socket.off('dashboard-tabs:update', handleRemoteTabs)
  }, [socket])

  useEffect(() => {
    if (!openMenuState) {
      return undefined
    }

    const closeMenu = () => setOpenMenuState(null)

    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [openMenuState])

  const syncTabs = useCallback((tabs) => {
    setDashboardTabs(tabs)
    if (socket) {
      socket.emit('dashboard-tabs:update', {
        tabs,
        userName: user?.name || '',
      })
    }
  }, [socket, user])

  const handleSelectTab = (tabId) => {
    if (location.search) {
      navigate('/admin/monitoring', { replace: true })
    }
    setActiveSection(tabId)
    setOpenMenuState(null)
  }

  const handleSelectHome = () => {
    if (location.search) {
      navigate('/admin/monitoring', { replace: true })
    }
    setActiveSection('home')
    setOpenMenuState(null)
  }

  const handleOpenAddModal = () => {
    setTabDraft(buildEmptyTabDraft())
    setIsAddModalOpen(true)
  }

  const handleCreateTab = () => {
    const trimmedName = tabDraft.name.trim()
    if (!trimmedName) return

    const nextTabs = addDashboardTab({
      name: trimmedName,
      viewKey: tabDraft.viewKey,
    }, user)
    syncTabs(nextTabs)
    setActiveSection(nextTabs[nextTabs.length - 1]?.id || 'home')
    setIsAddModalOpen(false)
  }

  const handleOpenManageModal = (tab) => {
    setEditingTabId(tab.id)
    setTabDraft({
      name: tab.name,
      viewKey: tab.viewKey,
    })
    setIsManageModalOpen(true)
    setOpenMenuState(null)
  }

  const handleManageTab = () => {
    const trimmedName = tabDraft.name.trim()
    if (!trimmedName || !editingTabId) return

    const nextTabs = updateDashboardTab(editingTabId, {
      name: trimmedName,
      viewKey: tabDraft.viewKey,
    })
    syncTabs(nextTabs)
    setIsManageModalOpen(false)
    setEditingTabId('')
  }

  const handleRenameTab = (tab) => {
    handleOpenManageModal(tab)
  }

  const handleMoveTab = (tabId, direction) => {
    const nextTabs = moveDashboardTab(tabId, direction)
    syncTabs(nextTabs)
    setOpenMenuState(null)
  }

  const handleDeleteTab = (tab) => {
    if (dashboardTabs.length <= 1) return
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`Delete tab "${tab.name}"? This cannot be undone.`)
      : true
    if (!confirmed) {
      setOpenMenuState(null)
      return
    }
    const nextTabs = deleteDashboardTab(tab.id)
    syncTabs(nextTabs)
    if (activeSection === tab.id) {
      setActiveSection('home')
    }
    setOpenMenuState(null)
  }

  const handleToggleTabBookmark = (tab) => {
    const bookmark = {
      id: `bookmark-dashboard-${tab.id}`,
      label: tab.name,
      route: buildDashboardBookmarkRoute(tab),
      iconKey: tab.viewKey === 'myCrm' ? 'profile' : 'dashboard',
    }
    const alreadyBookmarked = bookmarks.some((entry) => entry.route === bookmark.route)

    setBookmarks(toggleAdminBookmark(user, bookmark))
    addNotification(
      'success',
      alreadyBookmarked ? 'Bookmark removed' : 'Bookmark saved',
      `${tab.name} ${alreadyBookmarked ? 'removed from' : 'added to'} bookmarks.`
    )
    setOpenMenuState(null)
  }

  const handleToggleTabMenu = (tab, event) => {
    const triggerElement = event?.currentTarget || null
    if (!triggerElement) {
      return
    }

    setOpenMenuState((currentValue) => {
      if (currentValue?.id === tab.id) {
        return null
      }

      const triggerRect = triggerElement.getBoundingClientRect()
      const viewportPadding = 12
      const popupWidth = 248
      const popupHeight = 296
      const clickX = typeof event?.clientX === 'number'
        ? event.clientX
        : triggerRect.left + (triggerRect.width / 2)
      const clickY = typeof event?.clientY === 'number'
        ? event.clientY
        : triggerRect.bottom
      const left = Math.min(
        Math.max(viewportPadding, clickX),
        window.innerWidth - popupWidth - viewportPadding
      )
      const spaceBelow = window.innerHeight - clickY
      const top = spaceBelow >= popupHeight + viewportPadding
        ? clickY
        : Math.max(viewportPadding, clickY - popupHeight)

      return {
        id: tab.id,
        left,
        top,
      }
    })
  }

  const handleDashboardMonthClick = (scopedDeals, entry, statusType = 'closed') => {
    const matchingDeals = scopedDeals.filter((deal) => {
      const monthKey = getDashboardDrilldownMonthKey(deal.closeDate || deal.updatedAt || deal.createdAt)
      if (monthKey !== entry.key) {
        return false
      }

      const normalizedStatus = normalizeDashboardStatus(deal.status)
      if (statusType === 'won') {
        return WON_TAB_STATUSES.has(normalizedStatus)
      }

      if (statusType === 'lost') {
        return LOST_TAB_STATUSES.has(normalizedStatus)
      }

      return WON_TAB_STATUSES.has(normalizedStatus) || LOST_TAB_STATUSES.has(normalizedStatus)
    })

    navigate('/admin/deals/view', {
      state: {
        dashboardDealDrilldown: {
          monthLabel: entry.label,
          statusType,
          sourceTabName: activeTab?.name || 'Sales Dashboard',
          dealIds: matchingDeals.map((deal) => deal.id),
        },
      },
    })
  }

  const myCrmCards = useMemo(() => ([]), [])

  const isCurrentUserOwner = useCallback((reminder) => {
    if (!reminder) return false
    const ownerName = reminder.ownerName || reminder.assignedUserName || reminder.userName || ''
    const currentUserName = user?.name || user?.username || ''
    const currentUserId = user?.id || user?._id || ''
    return Boolean(
      (reminder.userId && String(reminder.userId) === String(currentUserId))
      || (ownerName && currentUserName && ownerName.trim().toLowerCase() === currentUserName.trim().toLowerCase())
    )
  }, [user?._id, user?.id, user?.name, user?.username])

  const isReminderItemActivated = useCallback((reminder) => {
    if (!reminder) return false
    return String(
      reminder.status ||
      reminder.reminderStatus ||
      reminder.rawStatus ||
      reminder.raw?.reminderStatus ||
      ''
    ).toLowerCase() === 'activated'
  }, [])

  const handleOpenReminderModal = useCallback((reminder, event) => {
    event?.stopPropagation()
    setActiveReminderModalItem(reminder)
  }, [])

  const handleDirectJumpToActivePage = useCallback((reminder, event) => {
    event?.stopPropagation()
    const owner = reminder?.ownerName
    const reminderId = reminder?.id || reminder?.sourceId
    const params = new URLSearchParams()
    if (owner && owner !== 'Unassigned') params.set('owner', owner)
    if (reminderId) params.set('reminderId', reminderId)
    const targetUrl = `/admin/reminders/active${params.toString() ? `?${params.toString()}` : ''}`
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }, [])

  const handleModalActivateInPlace = useCallback(async (reminder) => {
    if (reminder?.sourceType === 'account' && reminder?.sourceId) {
      await updateAccount(reminder.sourceId, { reminderStatus: 'activated' })
    } else if (reminder?.sourceType === 'deal' && reminder?.sourceId) {
      await updateDeal(reminder.sourceId, { reminderStatus: 'activated' })
    } else if (reminder?.id && !reminder?.sourceType) {
      await updateReminder(reminder.id, { status: 'activated' })
    }

    if (reminder?.sourceType && reminder?.sourceId) {
      const activatedState = activateAdminReminder({
        sourceType: reminder.sourceType,
        sourceId: reminder.sourceId,
        userName: user?.name || user?.username || '',
      })
      setReminderStatesById((currentStates) => ({
        ...currentStates,
        [activatedState.id]: activatedState,
      }))
    }

    if (refreshData) {
      try {
        await refreshData()
      } catch (e) {
        console.warn('Failed to refresh data after reminder activation', e)
      }
    }
    addNotification('success', 'Reminder Activated', `Activated reminder for ${reminder.ownerName || 'team member'}.`)
  }, [addNotification, refreshData, updateAccount, updateDeal, updateReminder, user?.name, user?.username])

  const handleModalCloseInPlace = useCallback(async (reminder) => {
    if (reminder?.sourceType === 'account' && reminder?.sourceId) {
      await updateAccount(reminder.sourceId, { reminderStatus: 'closed' })
    } else if (reminder?.sourceType === 'deal' && reminder?.sourceId) {
      await updateDeal(reminder.sourceId, { reminderStatus: 'closed' })
    } else if (reminder?.id && !reminder?.sourceType) {
      await updateReminder(reminder.id, { status: 'closed' })
    }

    if (reminder?.sourceType && reminder?.sourceId) {
      const closedState = closeAdminReminder({
        sourceType: reminder.sourceType,
        sourceId: reminder.sourceId,
        userName: user?.name || user?.username || '',
      })
      setReminderStatesById((currentStates) => ({
        ...currentStates,
        [closedState.id]: closedState,
      }))
    }

    if (refreshData) {
      try {
        await refreshData()
      } catch (e) {}
    }
    addNotification('success', 'Reminder Closed', `Closed reminder for ${reminder.ownerName || 'team member'}.`)
  }, [addNotification, refreshData, updateAccount, updateDeal, updateReminder, user?.name, user?.username])

  const handleModalRescheduleInPlace = useCallback(async (reminder, newDate) => {
    if (!newDate) return
    if (reminder?.sourceType === 'deal') {
      await updateDeal(reminder.sourceId, { reminderDate: newDate })
    } else if (reminder?.sourceType === 'account') {
      await updateAccount(reminder.sourceId, { reminderDate: newDate })
    } else if (reminder?.sourceType === 'customer') {
      const customer = customerService.getCustomerById(reminder.sourceId)
      if (customer) await customerService.saveCustomer({ ...customer, reminderDate: newDate })
    } else if (reminder?.id && !reminder?.sourceType) {
      await updateReminder(reminder.id, { reminderDate: newDate, remindAt: newDate })
    }
    if (reminder?.id && reminder?.sourceType) {
      try {
        await updateReminder(reminder.id, { reminderDate: newDate, remindAt: newDate })
      } catch (e) {}
    }
    if (refreshData) {
      try {
        await refreshData()
      } catch (e) {}
    }
    addNotification('success', 'Reminder Rescheduled', `Reminder rescheduled to ${newDate}.`)
  }, [addNotification, refreshData, updateAccount, updateDeal, updateReminder])

  const handleTodoReminderActive = useCallback(async (reminder, event) => {
    event?.stopPropagation()
    handleOpenReminderModal(reminder, event)
  }, [handleOpenReminderModal])

  const handleTodoReminderClose = useCallback(async (reminder, event) => {
    event?.stopPropagation()
    if (reminder?.id && !reminder?.sourceType) {
      await updateReminder(reminder.id, { status: 'closed' })
      navigate('/admin/reminders/closed', {
        replace: false,
        state: {
          reminderId: reminder.id,
          selectedOwner: reminder.ownerName,
        },
      })
      return
    }

    const closedState = closeAdminReminder({
      sourceType: reminder.sourceType,
      sourceId: reminder.sourceId,
      userName: user?.name || user?.username || '',
    })
    setReminderStatesById((currentStates) => ({
      ...currentStates,
      [closedState.id]: closedState,
    }))
    navigate('/admin/reminders/closed', {
      replace: false,
      state: {
        reminderId: reminder.id,
        selectedOwner: reminder.ownerName,
      },
    })
  }, [navigate, updateReminder, user?.name, user?.username])

  const allReminderItems = useMemo(() => {
    const reminderItems = getAdminReminders({
      accounts,
      deals,
      supportRequests,
      user,
      variantKey: 'my',
      reminderStatesById,
      isAdmin,
    })
      .filter((reminder) => ['active', 'activated'].includes(reminder.status))
      .map((reminder) => ({
        id: `reminder-${reminder.id}`,
        type: reminder.status === 'activated' ? 'Reminder (Activated)' : 'Reminder',
        title: reminder.name || 'Reminder',
        meta: `${reminder.sourceLabel || 'Reminder'} | ${reminder.reminderDateDisplay || ''}`,
        message: reminder.note || reminder.reminderMode || '-',
        date: reminder.reminderDate,
        reminder,
        onClick: () => navigate('/admin/reminders/my', {
          state: {
            activeMyReminderTab: 'today',
            reminderId: reminder.id,
          },
        }),
      }))

    const dbReminderItems = (reminders || [])
      .filter((r) => String(r.status || '').toLowerCase() !== 'closed')
      .map((r) => ({
        id: `db-reminder-${r.id || r._id}`,
        type: String(r.status || '').toLowerCase() === 'activated'
          ? 'Reminder (Activated)'
          : (r.reminderMode ? `Reminder (${r.reminderMode.toUpperCase()})` : 'Reminder'),
        title: r.title || r.note || r.message || 'Reminder',
        meta: r.reminderDate ? formatTodoDateTime(r.reminderDate) : 'Today',
        message: r.note || r.remark || r.description || '-',
        date: r.reminderDate || r.createdAt,
        reminder: r,
        onClick: () => navigate('/admin/reminders/my'),
      }))

    const seen = new Set()
    const list = []
    for (const item of [...reminderItems, ...dbReminderItems]) {
      const key = item.reminder?.id || item.reminder?._id || item.id
      if (!seen.has(key)) {
        seen.add(key)
        list.push(item)
      }
    }
    return list.sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime())
  }, [accounts, deals, isAdmin, navigate, reminderStatesById, reminders, supportRequests, user])

  const allTaskAndReplyItems = useMemo(() => {
    const replyItems = (todoReplies || []).map((reply, index) => {
      const requestId = reply.support_request_id || reply.supportRequestId || reply.relatedEntityId || ''
      const matchedRequest = supportRequests.find((request) => (
        [request.id, request.mongoId, request._id, request.legacyId].some((value) => String(value || '') === String(requestId || ''))
      ))
      const targetRequestId = matchedRequest?.id || requestId
      return {
        id: `reply-${reply._id || reply.id || index}`,
        type: 'Reply',
        title: reply.sender_email || reply.senderEmail || 'Support Reply',
        meta: formatTodoDateTime(reply.created_at || reply.createdAt),
        message: reply.message || '-',
        date: reply.created_at || reply.createdAt,
        onClick: () => navigate('/admin/tickets', {
          state: {
            activeTab: 'replied',
            expandedTicketId: targetRequestId,
            supportRequestId: targetRequestId,
          },
        }),
      }
    })

    const taskItems = (tasks || [])
      .filter((task) => String(task.status || '').toLowerCase() === 'pending' || String(task.status || '').toLowerCase() === 'open')
      .map((task) => {
        const timestamp = new Date(task.createdAt || task.created_at || task.dueDate || task.date || 0).getTime()
        return {
          id: `task-${task.id || task._id}`,
          type: task.activityType === 're-assign-account' ? 'Reassignment' : 'Task',
          title: task.title || task.name || 'Pending Task',
          meta: formatTodoDateTime(task.dueDate || task.createdAt),
          message: task.description || task.note || '-',
          date: task.createdAt || task.dueDate || task.date,
          timestamp,
          task,
          onClick: () => navigate('/admin/tasks/all'),
        }
      })

    const replyItemsWithTs = (replyItems || []).map((r) => ({
      ...r,
      timestamp: new Date(r.date || r.created_at || r.createdAt || 0).getTime(),
    }))

    return [...replyItemsWithTs, ...taskItems]
      .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
  }, [navigate, supportRequests, tasks, todoReplies])

  const todoCounts = useMemo(() => {
    return {
      all: allTaskAndReplyItems.length,
      task: allTaskAndReplyItems.filter((i) => i.type?.toLowerCase().includes('task') || i.type?.toLowerCase().includes('reassignment')).length,
      reply: allTaskAndReplyItems.filter((i) => i.type?.toLowerCase().includes('reply')).length,
      reminder: allReminderItems.length,
    }
  }, [allReminderItems.length, allTaskAndReplyItems])

  const [reminderPage, setReminderPage] = useState(1)
  const REMINDERS_PER_PAGE = 10
  const totalReminderPages = Math.ceil(allReminderItems.length / REMINDERS_PER_PAGE) || 1

  const paginatedReminderItems = useMemo(() => {
    const page = Math.min(Math.max(1, reminderPage), totalReminderPages)
    const start = (page - 1) * REMINDERS_PER_PAGE
    return allReminderItems.slice(start, start + REMINDERS_PER_PAGE)
  }, [allReminderItems, reminderPage, totalReminderPages])

  const [todoPage, setTodoPage] = useState(1)
  const TODOS_PER_PAGE = 10
  const displayedTodoItems = useMemo(() => {
    if (todoFilter === 'task') {
      return allTaskAndReplyItems.filter((i) => i.type?.toLowerCase().includes('task') || i.type?.toLowerCase().includes('reassignment'))
    }
    if (todoFilter === 'reply') {
      return allTaskAndReplyItems.filter((i) => i.type?.toLowerCase().includes('reply'))
    }
    return allTaskAndReplyItems
  }, [allTaskAndReplyItems, todoFilter])

  const totalTodoPages = Math.ceil(displayedTodoItems.length / TODOS_PER_PAGE) || 1

  const paginatedTodoItems = useMemo(() => {
    const page = Math.min(Math.max(1, todoPage), totalTodoPages)
    const start = (page - 1) * TODOS_PER_PAGE
    return displayedTodoItems.slice(start, start + TODOS_PER_PAGE)
  }, [displayedTodoItems, todoPage, totalTodoPages])

  const handleMyCrmViewList = (card) => {
    addNotification('info', 'View list', `Opening ${card.title}.`)
    navigate(MY_CRM_VIEW_ROUTES[card.id] || '/admin/monitoring?view=myCrm')
  }

  const handleMyCrmRefresh = async (card) => {
    await refreshData()
    addNotification('success', 'Summary refreshed', `${card.title} was refreshed.`)
  }

  const handleToggleMyCrmCard = (card) => {
    const isCollapsed = collapsedMyCrmCards.includes(card.id)
    setCollapsedMyCrmCards((currentValue) => (
      isCollapsed
        ? currentValue.filter((entry) => entry !== card.id)
        : [...currentValue, card.id]
    ))
    addNotification(
      'info',
      isCollapsed ? 'Summary expanded' : 'Summary collapsed',
      `${card.title} ${isCollapsed ? 'expanded' : 'collapsed'}.`
    )
  }

  const upcomingTasks = useMemo(() => (
    [...(tasks || [])]
      .filter((t) => t.status === 'pending')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5)
  ), [tasks])

  const renderHomeContent = () => {
    return (
      <div className="ap-home-layout">
        {/* 4 Equal Horizontal KPI Cards */}
        <div className="ap-kpi-grid">
          <div
            className="ap-kpi-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/accounts/my-accounts?stage=new&page=1')}
          >
            <div className="ap-kpi-icon-wrap ap-kpi-icon--red">
              <FaUsers />
            </div>
            <div className="ap-kpi-main">
              <div className="ap-kpi-val-row">
                <span className="ap-kpi-value">{accounts?.length || 14}</span>
                <span className="ap-kpi-trend ap-kpi-trend--up">↗ +12%</span>
              </div>
              <div className="ap-kpi-title">Accounts</div>
            </div>
            <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path d="M0,25 Q30,10 60,20 T100,5 L100,30 L0,30 Z" fill="rgba(220, 38, 38, 0.08)" />
            </svg>
          </div>

          <div
            className="ap-kpi-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/customers/my-customers')}
          >
            <div className="ap-kpi-icon-wrap ap-kpi-icon--blue">
              <FaUser />
            </div>
            <div className="ap-kpi-main">
              <div className="ap-kpi-val-row">
                <span className="ap-kpi-value">{customers?.length || 0}</span>
                <span className="ap-kpi-trend ap-kpi-trend--neutral">0%</span>
              </div>
              <div className="ap-kpi-title">Customers</div>
            </div>
            <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path d="M0,22 Q30,28 60,15 T100,10 L100,30 L0,30 Z" fill="rgba(2, 132, 199, 0.08)" />
            </svg>
          </div>

          <div
            className="ap-kpi-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/deals/view')}
          >
            <div className="ap-kpi-icon-wrap ap-kpi-icon--green">
              <FaHandshake />
            </div>
            <div className="ap-kpi-main">
              <div className="ap-kpi-val-row">
                <span className="ap-kpi-value">{deals?.length || 18}</span>
                <span className="ap-kpi-trend ap-kpi-trend--up">↗ +8%</span>
              </div>
              <div className="ap-kpi-title">Deals</div>
            </div>
            <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path d="M0,28 Q30,15 60,22 T100,8 L100,30 L0,30 Z" fill="rgba(22, 163, 74, 0.08)" />
            </svg>
          </div>

          <div
            className="ap-kpi-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/quotation-manager/view')}
          >
            <div className="ap-kpi-icon-wrap ap-kpi-icon--orange">
              <FaFileAlt />
            </div>
            <div className="ap-kpi-main">
              <div className="ap-kpi-val-row">
                <span className="ap-kpi-value">{quotations.length}</span>
              </div>
              <div className="ap-kpi-title">Quotation Manager</div>
            </div>
            <svg className="ap-kpi-wave" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path d="M0,20 Q30,25 60,12 T100,18 L100,30 L0,30 Z" fill="rgba(234, 88, 12, 0.08)" />
            </svg>
          </div>
        </div>

        {/* Side-by-Side Monitoring Grid: Left = To Do List & Reminders, Right = Communication Activity */}
        <div className="ap-dashboard-main-grid ap-monitoring-side-by-side" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '1.25rem', marginTop: '1.25rem', marginBottom: '1.25rem', alignItems: 'start' }}>
          {/* Left Column: Stacked To Do List & Dedicated Reminders */}
          <div className="ap-todo-full-container" style={{ margin: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Card 1: To Do List */}
            <div className="ap-card-box ap-todo-card--expansive" style={{ margin: 0 }}>
              <div className="ap-todo-header-expansive" style={{ padding: '0.85rem 1.15rem' }}>
                <div className="ap-todo-header-left">
                  <div className="ap-todo-header-icon-box" style={{ width: '2.3rem', height: '2.3rem', fontSize: '1.1rem' }}>
                    <FaClipboardList />
                  </div>
                  <div>
                    <div className="ap-todo-title-row">
                      <h3 className="ap-todo-main-title" style={{ fontSize: '1.05rem' }}>To Do List</h3>
                      <span className="ap-todo-count-badge">{todoCounts.all} items</span>
                    </div>
                    <p className="ap-todo-subtitle" style={{ fontSize: '0.75rem' }}>Prioritized pending tasks and support replies</p>
                  </div>
                </div>

                <div className="ap-todo-filter-tabs">
                  <button
                    type="button"
                    className={`ap-todo-tab ${todoFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setTodoFilter('all')
                      setTodoPage(1)
                    }}
                  >
                    All ({todoCounts.all})
                  </button>
                  <button
                    type="button"
                    className={`ap-todo-tab ${todoFilter === 'task' ? 'active' : ''}`}
                    onClick={() => {
                      setTodoFilter('task')
                      setTodoPage(1)
                    }}
                  >
                    Tasks ({todoCounts.task})
                  </button>
                  <button
                    type="button"
                    className={`ap-todo-tab ${todoFilter === 'reply' ? 'active' : ''}`}
                    onClick={() => {
                      setTodoFilter('reply')
                      setTodoPage(1)
                    }}
                  >
                    Replies ({todoCounts.reply})
                  </button>
                </div>

                <div className="ap-todo-header-right">
                  <button
                    type="button"
                    className="ap-btn-red"
                    onClick={() => navigate('/admin/tasks')}
                  >
                    + Add Task
                  </button>
                </div>
              </div>

              <div className="ap-todo-list--expansive" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0.85rem 1rem', background: '#fdfcfb', maxHeight: '250px', overflowY: 'auto' }}>
                {paginatedTodoItems.length > 0 ? (
                  paginatedTodoItems.map((item) => {
                    const isTask = Boolean(item.task || item.type?.toLowerCase().includes('task') || item.type?.toLowerCase().includes('reassignment'))
                    if (isTask) {
                      return (
                        <div
                          key={item.id}
                          className="ap-todo-row ap-todo-row--task"
                          onClick={() => navigate('/admin/tasks/all')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            minHeight: '44px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            transition: 'all 0.18s ease',
                          }}
                        >
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              border: '2px solid #94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={item.id}
                        className="ap-todo-row ap-todo-row--reply"
                        onClick={item.onClick}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          minHeight: '44px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            border: '2px solid #3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{item.meta}</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="ap-todo-empty-state">
                    <FaClipboardList className="ap-todo-empty-icon" />
                    <p>No {todoFilter !== 'all' ? todoFilter : ''} to-do items found right now.</p>
                  </div>
                )}
              </div>

              {totalTodoPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.85rem',
                    borderTop: '1px solid #f1f5f9',
                    background: '#fafafa',
                    borderBottomLeftRadius: '12px',
                    borderBottomRightRadius: '12px',
                    fontSize: '0.75rem',
                    color: '#64748b',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTodoPage(1)}
                    disabled={todoPage === 1}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: todoPage === 1 ? '#f8fafc' : '#ffffff',
                      color: todoPage === 1 ? '#94a3b8' : '#c60016',
                      fontWeight: 700,
                      cursor: todoPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.72rem',
                    }}
                  >
                    &laquo; First
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ marginRight: '4px', fontSize: '0.72rem', color: '#64748b' }}>
                      Page {todoPage} of {totalTodoPages}
                    </span>
                    {Array.from({ length: totalTodoPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalTodoPages || Math.abs(p - todoPage) <= 1)
                      .map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && p - arr[idx - 1] > 1 && (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setTodoPage(p)}
                            style={{
                              minWidth: '22px',
                              height: '22px',
                              padding: '0 4px',
                              borderRadius: '4px',
                              border: p === todoPage ? '1px solid #c60016' : '1px solid #e2e8f0',
                              background: p === todoPage ? '#c60016' : '#ffffff',
                              color: p === todoPage ? '#ffffff' : '#334155',
                              fontWeight: p === todoPage ? 700 : 500,
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                            }}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTodoPage(totalTodoPages)}
                    disabled={todoPage === totalTodoPages}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: todoPage === totalTodoPages ? '#f8fafc' : '#ffffff',
                      color: todoPage === totalTodoPages ? '#94a3b8' : '#c60016',
                      fontWeight: 700,
                      cursor: todoPage === totalTodoPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.72rem',
                    }}
                  >
                    Last &raquo;
                  </button>
                </div>
              )}
            </div>

            {/* Card 2: Dedicated Reminders Section */}
            <div className="ap-card-box ap-reminders-card--expansive" style={{ margin: 0 }}>
              <div className="ap-todo-header-expansive" style={{ padding: '0.85rem 1.15rem' }}>
                <div className="ap-todo-header-left">
                  <div className="ap-todo-header-icon-box" style={{ width: '2.3rem', height: '2.3rem', fontSize: '1.1rem', background: '#fff1f2', color: '#c60016', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaBell style={{ color: '#c60016' }} />
                  </div>
                  <div>
                    <div className="ap-todo-title-row">
                      <h3 className="ap-todo-main-title" style={{ fontSize: '1.05rem' }}>Reminders</h3>
                      <span className="ap-todo-count-badge" style={{ background: '#fff1f2', color: '#c60016', borderColor: '#fecdd3' }}>{allReminderItems.length} items</span>
                    </div>
                    <p className="ap-todo-subtitle" style={{ fontSize: '0.75rem' }}>Active follow-ups & account/deal alerts</p>
                  </div>
                </div>

                <div className="ap-todo-header-right">
                  <button
                    type="button"
                    className="ap-link-btn"
                    onClick={() => navigate('/admin/reminders/my')}
                  >
                    View All &rarr;
                  </button>
                  <button
                    type="button"
                    className="ap-btn-red"
                    onClick={() => navigate('/admin/reminders/add')}
                  >
                    + Add Reminder
                  </button>
                </div>
              </div>

              <div className="ap-reminders-list--expansive" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0.85rem 1rem', background: '#fdfcfb', maxHeight: '280px', overflowY: 'auto' }}>
                {paginatedReminderItems.length > 0 ? (
                  paginatedReminderItems.map((item) => (
                    <div
                      key={item.id}
                      className={`ap-todo-row ap-todo-row--${item.type.toLowerCase().replace(/[^a-z]/g, '')}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        minHeight: '44px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        <FaBell style={{ color: '#dc2626', fontSize: '1.15rem', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.reminder?.accountName || item.reminder?.dealName ? `${item.reminder.accountName || item.reminder.dealName} | ` : ''}{item.meta || 'Follow up'} {item.reminder?.ownerName ? `| ${item.reminder.ownerName}` : ''}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title || item.message}>
                            {item.title || item.message}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {!isReminderItemActivated(item.reminder) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              if (item.reminder) handleOpenReminderModal(item.reminder, e)
                              else item.onClick?.(e)
                            }}
                            title="Activate Reminder"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1.5px solid #ef4444',
                              background: '#ffffff',
                              color: '#dc2626',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                            }}
                          >
                            <FaCheck />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            if (item.reminder) handleOpenReminderModal(item.reminder, e)
                            else navigate('/admin/tasks')
                          }}
                          title="Create Task / Reschedule"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1.5px solid #ef4444',
                            background: '#ffffff',
                            color: '#dc2626',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                          }}
                        >
                          <FaPlus />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            if (item.reminder) handleTodoReminderClose(item.reminder, e)
                            else if (typeof refreshData === 'function') refreshData()
                          }}
                          title="Close Reminder"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1.5px solid #ef4444',
                            background: '#ffffff',
                            color: '#dc2626',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                          }}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="ap-todo-empty-state">
                    <FaBell className="ap-todo-empty-icon" style={{ color: '#dc2626' }} />
                    <p>No active reminders right now.</p>
                  </div>
                )}
              </div>

              {totalReminderPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.85rem',
                    borderTop: '1px solid #f1f5f9',
                    background: '#fafafa',
                    borderBottomLeftRadius: '12px',
                    borderBottomRightRadius: '12px',
                    fontSize: '0.75rem',
                    color: '#64748b',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setReminderPage(1)}
                    disabled={reminderPage === 1}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: reminderPage === 1 ? '#f8fafc' : '#ffffff',
                      color: reminderPage === 1 ? '#94a3b8' : '#c60016',
                      fontWeight: 700,
                      cursor: reminderPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.72rem',
                    }}
                  >
                    &laquo; First
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ marginRight: '4px', fontSize: '0.72rem', color: '#64748b' }}>
                      Page {reminderPage} of {totalReminderPages}
                    </span>
                    {Array.from({ length: totalReminderPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalReminderPages || Math.abs(p - reminderPage) <= 1)
                      .map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && p - arr[idx - 1] > 1 && (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setReminderPage(p)}
                            style={{
                              minWidth: '22px',
                              height: '22px',
                              padding: '0 4px',
                              borderRadius: '4px',
                              border: p === reminderPage ? '1px solid #c60016' : '1px solid #e2e8f0',
                              background: p === reminderPage ? '#c60016' : '#ffffff',
                              color: p === reminderPage ? '#ffffff' : '#334155',
                              fontWeight: p === reminderPage ? 700 : 500,
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                            }}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setReminderPage(totalReminderPages)}
                    disabled={reminderPage === totalReminderPages}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '5px',
                      border: '1px solid #e2e8f0',
                      background: reminderPage === totalReminderPages ? '#f8fafc' : '#ffffff',
                      color: reminderPage === totalReminderPages ? '#94a3b8' : '#c60016',
                      fontWeight: 700,
                      cursor: reminderPage === totalReminderPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.72rem',
                    }}
                  >
                    Last &raquo;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Communication Activity Summary Section */}
          <div className="ap-card-box ap-communication-summary-card" style={{ margin: 0, padding: '1.15rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaComments style={{ color: '#c60016', fontSize: '1.2rem' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Communication Activity</h3>
              </div>
              <button
                type="button"
                className="ap-link-btn"
                onClick={() => navigate('/admin/communication-activities')}
                style={{ background: 'none', border: 'none', color: '#c60016', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                View All &rarr;
              </button>
            </div>
            {communicationRemarks.length === 0 ? (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>
                No recent communication activities found.
              </div>
            ) : (
              <div className="ap-communication-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.35rem', maxHeight: '270px', overflowY: 'auto', paddingRight: '4px' }}>
                {communicationRemarks.map((rmk) => {
                  const isGeneral = String(rmk.category || 'General').toLowerCase() === 'general'
                  const isCall = String(rmk.category || '').toLowerCase().includes('call')
                  const badgeBg = isGeneral ? '#fee2e2' : isCall ? '#e0f2fe' : '#f1f5f9'
                  const badgeColor = isGeneral ? '#dc2626' : isCall ? '#0284c7' : '#475569'
                  const formattedDate = rmk.createdAt
                    ? new Date(rmk.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'
                  const authorName = rmk.createdByName || 'User'

                  return (
                    <div
                      key={rmk.id || rmk._id}
                      style={{
                        padding: '4px 8px',
                        background: '#fffdfa',
                        borderRadius: '7px',
                        border: '1px solid #fde68a',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.35rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ marginTop: '1px', color: '#64748b', fontSize: '0.72rem', flexShrink: 0 }}>
                        <FaComments />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {/* Line 1: Date & Time + Author on left; Category badge on right */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.60rem', color: '#64748b', fontWeight: 600 }}>
                            {formattedDate} | By: {authorName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.55rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px',
                              padding: '1px 5px',
                              borderRadius: '9999px',
                              background: badgeBg,
                              color: badgeColor,
                            }}
                          >
                            {String(rmk.category || 'General').toUpperCase()}
                          </span>
                        </div>

                        {/* Line 2: Bold title / account or deal name */}
                        <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rmk.accountName || rmk.dealName || `Account #${rmk.accountId || rmk.dealId || '-'}`}
                        </div>

                        {/* Line 3: Content / remark */}
                        <div style={{ fontSize: '0.64rem', color: '#475569', fontWeight: 500, lineHeight: 1.2, wordBreak: 'break-word' }}>
                          {rmk.content || '-'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <AdminAnalyticsGraphs
          analyticsData={analyticsData}
          loading={loadingAnalytics}
        />
      </div>
    )
  }

  const renderSalesDashboard = () => {
    const { scope, entries, scopedDeals } = buildMonthlyWonLostData(
      deals,
      activeTab?.viewKey || 'salesDashboard',
      user,
    )
    const maxValue = Math.max(...entries.map((entry) => entry.won + entry.lost), 1)

    return (
      <div className="ap-dashboard-shell">
        <div className="ap-dashboard-card">
          <div className="ap-dashboard-card-header">
            <button
              type="button"
              className="ap-dashboard-card-title ap-dashboard-card-title-link"
              onClick={() => navigate('/admin/deals/view')}
              title="Open Sales Board"
            >
              Closed Won-Lost Deals
            </button>
          </div>
          <div className="ap-dashboard-card-body">
            <p className="ap-dashboard-subtitle">
              Last 12 months closed won and lost deal count for {scope.subtitleLabel} ({scopedDeals.length} deals)
            </p>
            <div className="ap-dashboard-chart">
              <div className="ap-dashboard-chart-grid">
                {[20, 15, 10, 5, 0].map((value) => (
                  <div key={value} className="ap-dashboard-grid-row">
                    <span>{value}</span>
                    <div />
                  </div>
                ))}
              </div>

              <div className="ap-dashboard-bars">
                {entries.map((entry) => {
                  const total = entry.won + entry.lost
                  const totalHeight = total === 0 ? 0 : (total / maxValue) * 240
                  const wonHeight = total === 0 ? 0 : (entry.won / total) * totalHeight
                  const lostHeight = totalHeight - wonHeight

                  return (
                    <div
                      key={entry.label}
                      className="ap-dashboard-bar-group ap-dashboard-bar-group--interactive"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDashboardMonthClick(scopedDeals, entry, 'closed')}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleDashboardMonthClick(scopedDeals, entry, 'closed')
                        }
                      }}
                      title={total > 0 ? `Open ${entry.label} closed deals` : `Open Sales Board for ${entry.label}`}
                    >
                      <div className="ap-dashboard-bar-stack" style={{ height: `${totalHeight}px` }}>
                        <button
                          type="button"
                          className="ap-dashboard-bar ap-dashboard-bar-won ap-dashboard-bar-button"
                          style={{ height: `${wonHeight}px` }}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDashboardMonthClick(scopedDeals, entry, 'won')
                          }}
                          aria-label={`Open ${entry.label} won deals`}
                        />
                        <button
                          type="button"
                          className="ap-dashboard-bar ap-dashboard-bar-lost ap-dashboard-bar-button"
                          style={{ height: `${lostHeight}px` }}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDashboardMonthClick(scopedDeals, entry, 'lost')
                          }}
                          aria-label={`Open ${entry.label} lost deals`}
                        />
                      </div>
                      <span>{entry.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isWonDealLocal = (deal) => {
    const normalized = String(deal.status || '').trim().toLowerCase()
    return normalized === 'won' || normalized === 'closed won' || normalized === 'converted' || normalized === 'order received' || normalized === 'convert to po'
  }

  const isLostDealLocal = (deal) => {
    const normalized = String(deal.status || '').trim().toLowerCase()
    return normalized === 'lost' || normalized === 'closed lost' || normalized === 'rejected' || normalized === 'order lost'
  }

  const isOpenDealLocal = (deal) => {
    return !isWonDealLocal(deal) && !isLostDealLocal(deal)
  }

  const buildMonthlyPerformanceData = (summary, metricKey) => {
    const currentMonth = new Date()
    const monthEntries = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - (11 - index), 1)
      return {
        key: getDashboardDrilldownMonthKey(date),
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: 0,
      }
    })

    const monthLookup = monthEntries.reduce((lookup, entry) => {
      lookup[entry.key] = entry
      return lookup
    }, {})

    if (metricKey === 'won') {
      summary.scopedDeals.filter(isWonDealLocal).forEach((deal) => {
        const sourceDate = deal.closeDate || deal.updatedAt || deal.createdAt
        const parsedDate = sourceDate ? new Date(sourceDate) : null
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
          const monthEntry = monthLookup[getDashboardDrilldownMonthKey(parsedDate)]
          if (monthEntry) {
            monthEntry.value += 1
          }
        }
      })
    } else if (metricKey === 'open') {
      summary.scopedDeals.filter(isOpenDealLocal).forEach((deal) => {
        const sourceDate = deal.createdAt || deal.updatedAt
        const parsedDate = sourceDate ? new Date(sourceDate) : null
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
          const monthEntry = monthLookup[getDashboardDrilldownMonthKey(parsedDate)]
          if (monthEntry) {
            monthEntry.value += 1
          }
        }
      })
    } else if (metricKey === 'accounts') {
      summary.scopedAccounts.forEach((account) => {
        const sourceDate = account.createdAt || account.updatedAt
        const parsedDate = sourceDate ? new Date(sourceDate) : null
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
          const monthEntry = monthLookup[getDashboardDrilldownMonthKey(parsedDate)]
          if (monthEntry) {
            monthEntry.value += 1
          }
        }
      })
    } else if (metricKey === 'pipeline') {
      summary.scopedDeals.forEach((deal) => {
        const sourceDate = deal.createdAt || deal.updatedAt
        const parsedDate = sourceDate ? new Date(sourceDate) : null
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
          const monthEntry = monthLookup[getDashboardDrilldownMonthKey(parsedDate)]
          if (monthEntry) {
            monthEntry.value += Number(deal.value) || 0
          }
        }
      })
    }

    return monthEntries
  }

  const handlePerformanceBarClick = (summary, entry, metricKey) => {
    if (metricKey === 'won' || metricKey === 'open' || metricKey === 'pipeline') {
      const matchingDeals = summary.scopedDeals.filter((deal) => {
        const parsedDate = deal.closeDate || deal.updatedAt || deal.createdAt ? new Date(deal.closeDate || deal.updatedAt || deal.createdAt) : null
        if (!parsedDate || Number.isNaN(parsedDate.getTime())) return false
        if (getDashboardDrilldownMonthKey(parsedDate) !== entry.key) return false

        if (metricKey === 'won') return isWonDealLocal(deal)
        if (metricKey === 'open') return isOpenDealLocal(deal)
        return true // For pipeline value
      })

      navigate('/admin/deals/view', {
        state: {
          dashboardDealDrilldown: {
            monthLabel: entry.label,
            statusType: metricKey === 'won' ? 'won' : metricKey === 'open' ? 'open' : 'all',
            sourceTabName: activeTab?.name || 'Sales Performance',
            dealIds: matchingDeals.map((deal) => deal.id),
          },
        },
      })
    } else if (metricKey === 'accounts') {
      const matchingAccounts = summary.scopedAccounts.filter((account) => {
        const parsedDate = account.createdAt || account.updatedAt ? new Date(account.createdAt || account.updatedAt) : null
        if (!parsedDate || Number.isNaN(parsedDate.getTime())) return false
        return getDashboardDrilldownMonthKey(parsedDate) === entry.key
      })

      navigate('/admin/accounts', {
        state: {
          dashboardAccountDrilldown: {
            monthLabel: entry.label,
            sourceTabName: activeTab?.name || 'Sales Performance',
            accountIds: matchingAccounts.map((acc) => acc.id),
          },
        },
      })
    }
  }

  const renderPerformanceGraph = () => {
    const summary = buildPerformanceSummary(accounts, deals, activeTab?.viewKey || 'salesDashboard', user)
    const monthEntries = buildMonthlyPerformanceData(summary, selectedPerformanceMetric)
    const maxValue = Math.max(...monthEntries.map((entry) => entry.value), 1)

    const gridValues = [
      maxValue,
      Math.round(maxValue * 0.75),
      Math.round(maxValue * 0.5),
      Math.round(maxValue * 0.25),
      0
    ]

    const getBarColor = (metric) => {
      switch (metric) {
        case 'won':
          return 'linear-gradient(180deg, #ffd875 0%, #e9b528 100%)' // Yellow/Gold like won deals
        case 'open':
          return 'linear-gradient(180deg, #5dade2 0%, #2980b9 100%)' // Blue for open
        case 'accounts':
          return 'linear-gradient(180deg, #af7ac5 0%, #7d3c98 100%)' // Purple for accounts
        case 'pipeline':
          return 'linear-gradient(180deg, #f8c471 0%, #d35400 100%)' // Orange/Amber for pipeline value
        default:
          return 'linear-gradient(180deg, #5dade2 0%, #2980b9 100%)'
      }
    }

    const formatGridValue = (value) => {
      if (selectedPerformanceMetric !== 'pipeline') return value
      if (value >= 10000000) return `Rs ${(value / 10000000).toFixed(1)} Cr`
      if (value >= 100000) return `Rs ${(value / 100000).toFixed(1)} L`
      if (value >= 1000) return `Rs ${(value / 1000).toFixed(1)} K`
      return `Rs ${value}`
    }

    return (
      <div className="ap-dashboard-shell">
        <div className="ap-dashboard-card">
          <div className="ap-dashboard-card-header ap-dashboard-card-header--performance" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <button
              type="button"
              className="ap-dashboard-card-title ap-dashboard-card-title-link"
              onClick={() => {
                if (selectedPerformanceMetric === 'accounts') {
                  navigate('/admin/accounts')
                } else {
                  navigate('/admin/deals/view')
                }
              }}
              title="Open CRM Board"
            >
              {summary.scope.title}
            </button>
            <div className="ap-dashboard-header-dropdown-wrap">
              <span className="ap-performance-select-label">Metric:</span>
              <select
                className="ap-performance-select"
                value={selectedPerformanceMetric}
                onChange={(e) => setSelectedPerformanceMetric(e.target.value)}
              >
                <option value="won">Won Deals</option>
                <option value="open">Open Deals</option>
                <option value="accounts">Active Accounts</option>
                <option value="pipeline">Pipeline Value</option>
              </select>
            </div>
          </div>
          <div className="ap-dashboard-card-body">
            <p className="ap-dashboard-subtitle">
              Last 12 months performance tracking for {summary.scope.subtitleLabel} (metric: {selectedPerformanceMetric})
            </p>
            <div className="ap-dashboard-chart">
              <div className="ap-dashboard-chart-grid">
                {gridValues.map((value, i) => (
                  <div key={i} className="ap-dashboard-grid-row">
                    <span>
                      {formatGridValue(value)}
                    </span>
                    <div />
                  </div>
                ))}
              </div>

              <div className="ap-dashboard-bars">
                {monthEntries.map((entry) => {
                  const val = entry.value
                  const totalHeight = val === 0 ? 0 : (val / maxValue) * 240

                  return (
                    <div
                      key={entry.label}
                      className="ap-dashboard-bar-group ap-dashboard-bar-group--interactive"
                      role="button"
                      tabIndex={0}
                      onClick={() => handlePerformanceBarClick(summary, entry, selectedPerformanceMetric)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handlePerformanceBarClick(summary, entry, selectedPerformanceMetric)
                        }
                      }}
                      title={val > 0 ? `Open details for ${entry.label}` : `No records for ${entry.label}`}
                    >
                      <div className="ap-dashboard-bar-stack" style={{ height: `${totalHeight}px` }}>
                        <div
                          className="ap-dashboard-bar"
                          style={{
                            height: `${totalHeight}px`,
                            width: '100%',
                            borderRadius: '16px 16px 0 0',
                            background: getBarColor(selectedPerformanceMetric)
                          }}
                        />
                      </div>
                      <span>{entry.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderMyCrmContent = () => (
    <div className="ap-dashboard-shell">
      <div className="ap-mycrm-layout">
        <div className="ap-dashboard-card ap-mycrm-profile-card">
          <div className="ap-dashboard-card-header">
            <span className="ap-dashboard-card-title">My Profile</span>
          </div>

          <div className="ap-mycrm-profile-content">
            <div className="ap-mycrm-profile-avatar">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>

            <div className="ap-mycrm-profile-copy">
              <h2>{user?.name || 'Demo User'}</h2>
              <div className="ap-mycrm-profile-list">
                <div><strong>Login ID</strong><span>{user?.username || user?.email || 'Not available'}</span></div>
                <div><strong>E-Mail</strong><span>{user?.email || 'Not available'}</span></div>
                <div><strong>Type</strong><span>{formatStatusLabel(user?.role, 'User')}</span></div>
                <div><strong>Added</strong><span>{new Date().toLocaleString('en-IN')}</span></div>
              </div>
            </div>

            <div className="ap-mycrm-action-grid">
              <button type="button" className="ap-mycrm-action-btn" onClick={() => navigate('/admin/user-management')}>
                <FaAddressCard />
                <span>My Profile</span>
              </button>
              <button type="button" className="ap-mycrm-action-btn" onClick={() => navigate('/admin/accounts/my-accounts')}>
                <FaBriefcase />
                <span>My Accounts</span>
              </button>
              <button type="button" className="ap-mycrm-action-btn" onClick={() => navigate('/admin/customers/my-customers')}>
                <FaUsers />
                <span>My Customers</span>
              </button>
              <button type="button" className="ap-mycrm-action-btn" onClick={() => navigate('/admin/reminders/my')}>
                <FaBell />
                <span>My Reminders</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const activeTab = dashboardTabs.find((tab) => tab.id === activeSection) || dashboardTabs[0]

  const renderUserWisePerformanceGraphs = () => (
    <div className="ap-dashboard-shell">
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
            {activeTab.name} — Real-Time Accounts, Deals & Quotations Performance
          </h2>
        </div>
      </div>

      {loadingUserPerformance ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          Loading real-time user-wise performance graphs...
        </div>
      ) : userPerformanceList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          No user performance records found for this team.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {userPerformanceList.map((userPerf) => (
            <DealPerformanceCard key={userPerf.userId} userPerformance={userPerf} />
          ))}
        </div>
      )}
    </div>
  )

  const renderActiveTabContent = () => {
    if (activeSection === 'home') return renderHomeContent()
    if (!activeTab) return renderHomeContent()

    switch (activeTab.viewKey) {
      case 'salesSwati':
      case 'swatiGroup':
      case 'salesLumos':
      case 'userWisePerformance':
      case 'allUsers':
      case 'salesPerformanceA':
      case 'salesPerformanceB':
        return renderUserWisePerformanceGraphs()
      case 'myCrm':
        return renderMyCrmContent()
      default:
        return renderUserWisePerformanceGraphs()
    }
  }

  const openMenuTab = dashboardTabs.find((tab) => tab.id === openMenuState?.id) || null
  const openMenuTabIndex = openMenuTab ? dashboardTabs.findIndex((tab) => tab.id === openMenuTab.id) : -1
  const openMenuCanMoveLeft = openMenuTabIndex > 0
  const openMenuCanMoveRight = openMenuTabIndex > -1 && openMenuTabIndex < dashboardTabs.length - 1
  const openMenuCanDelete = dashboardTabs.length > 1
  const openMenuIsBookmarked = openMenuTab
    ? bookmarks.some((entry) => entry.route === buildDashboardBookmarkRoute(openMenuTab))
    : false

  return (
    <div className="admin-panel">
      <div className="ap-tabbar">
        <button
          type="button"
          className={`ap-home-tab ${activeSection === 'home' ? 'ap-home-tab--active' : ''}`}
          onClick={handleSelectHome}
        >
          <FaHome />
          <span>Home</span>
        </button>

        <div className="ap-tabs">
          {dashboardTabs.map((tab) => {
            const isActive = activeSection === tab.id

            return (
              <div
                key={tab.id}
                className={`ap-tab-wrap ${isActive ? 'ap-tab-wrap--active' : ''}`}
              >
                <button
                  type="button"
                  className={`ap-tab ${isActive ? 'ap-tab--active' : ''}`}
                  onClick={() => handleSelectTab(tab.id)}
                >
                  <span className="ap-tab-icon">{tab.viewKey === 'myCrm' ? MY_CRM_ICON : TAB_ICON}</span>
                  <span>{tab.name}</span>
                </button>

                {isAdmin ? (
                  <button
                    type="button"
                    className={`ap-tab-caret ${isActive || openMenuState?.id === tab.id ? 'ap-tab-caret--active' : ''}`}
                    onClick={(event) => handleToggleTabMenu(tab, event)}
                    aria-label={`Open ${tab.name} tab menu`}
                    aria-haspopup="menu"
                    aria-expanded={openMenuState?.id === tab.id}
                  >
                    <FiChevronDown />
                  </button>
                ) : null}
              </div>
            )
          })}

          {isAdmin ? (
            <button
              type="button"
              className="ap-tab-add"
              title="Add New Monitoring Tab"
              onClick={handleOpenAddModal}
            >
              <FiPlus />
              <span>Add Tab</span>
            </button>
          ) : null}
        </div>
      </div>
      <div className="ap-tabbar-divider-line" style={{ height: '1px', background: '#cbd5e1', margin: '0 0 1rem 0' }} />

      {/* Top Welcome Header - Placed below tab bar */}
      <div className="ap-welcome-row" style={{ marginBottom: '0.75rem' }}>
        <div className="ap-welcome-header-block">
          <span className="ap-welcome-subhead">Welcome,</span>
          <h1 className="ap-welcome-heading">{user?.name || 'Keval V Shah'}!</h1>
          <p className="ap-welcome-sub">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
      </div>

      {isAdmin && openMenuTab && openMenuState ? createPortal(
        (
          <div
            ref={menuRef}
            className="ap-tab-menu"
            role="menu"
            style={{ left: `${openMenuState.left}px`, top: `${openMenuState.top}px` }}
          >
            <button type="button" role="menuitem" className="ap-tab-menu-item" onClick={() => handleRenameTab(openMenuTab)}>
              <FiEdit2 />
              <span>Rename Tab</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="ap-tab-menu-item"
              onClick={() => openMenuCanMoveLeft && handleMoveTab(openMenuTab.id, 'left')}
              disabled={!openMenuCanMoveLeft}
            >
              <FiArrowLeft />
              <span>Move Tab To Left</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="ap-tab-menu-item"
              onClick={() => openMenuCanMoveRight && handleMoveTab(openMenuTab.id, 'right')}
              disabled={!openMenuCanMoveRight}
            >
              <FiArrowRight />
              <span>Move Tab To Right</span>
            </button>
            <button type="button" role="menuitem" className="ap-tab-menu-item ap-tab-menu-item-manage" onClick={() => handleOpenManageModal(openMenuTab)}>
              <FiSettings />
              <span>Manage</span>
            </button>
            <button type="button" role="menuitem" className="ap-tab-menu-item" onClick={() => handleToggleTabBookmark(openMenuTab)}>
              <FaStar className={openMenuIsBookmarked ? 'ap-tab-menu-icon-bookmark-active' : ''} />
              <span>{openMenuIsBookmarked ? 'Remove Bookmark' : 'Bookmark Tab'}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="ap-tab-menu-item ap-tab-menu-item-delete"
              onClick={() => handleDeleteTab(openMenuTab)}
              disabled={!openMenuCanDelete}
            >
              <FiTrash2 />
              <span>Delete Tab</span>
            </button>
          </div>
        ),
        document.body
      ) : null}

      {renderActiveTabContent()}

      <DashboardTabModal
        isOpen={isAddModalOpen}
        title="Add Dashboard Tab"
        submitLabel="Add Tab"
        draft={tabDraft}
        onDraftChange={setTabDraft}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateTab}
      />

      <DashboardTabModal
        isOpen={isManageModalOpen}
        title="Manage Dashboard Tab"
        submitLabel="Save Changes"
        draft={tabDraft}
        onDraftChange={setTabDraft}
        onClose={() => {
          setIsManageModalOpen(false)
          setEditingTabId('')
        }}
        onSubmit={handleManageTab}
      />

      {activeReminderModalItem ? (
        <ActiveReminderActionModal
          isOpen={Boolean(activeReminderModalItem)}
          onClose={() => setActiveReminderModalItem(null)}
          reminder={activeReminderModalItem}
          currentUser={user}
          isAdmin={isAdmin}
          allReminders={allReminderItems.map((i) => i.reminder).filter(Boolean)}
          onActivateInPlace={handleModalActivateInPlace}
          onCloseInPlace={handleModalCloseInPlace}
          onRescheduleInPlace={handleModalRescheduleInPlace}
        />
      ) : null}
    </div>
  )
}

export default AdminPanel
