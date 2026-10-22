const DASHBOARD_TABS_STORAGE_KEY = 'crm_admin_dashboard_tabs'
const DASHBOARD_TABS_EVENT = 'crm:dashboard-tabs-changed'

const DEFAULT_DASHBOARD_TABS = [
  {
    id: 'sales-swati',
    name: 'Sales Swati',
    viewKey: 'salesSwati',
    order: 1,
    locked: false,
    createdBy: 'system',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sales-lumos',
    name: 'Sales Lumos',
    viewKey: 'salesLumos',
    order: 2,
    locked: false,
    createdBy: 'system',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'my-crm',
    name: 'My CRM',
    viewKey: 'myCrm',
    order: 3,
    locked: false,
    createdBy: 'system',
    updatedAt: new Date().toISOString(),
  },
]

const normalizeTabs = (tabs = []) => (
  tabs
    .filter(Boolean)
    .filter((tab) => tab.id !== 'sales-dashboard' && tab.viewKey !== 'salesDashboard')
    .map((tab, index) => ({
      id: String(tab.id || `dashboard-tab-${index + 1}`),
      name: String(tab.name || `Dashboard ${index + 1}`).trim(),
      viewKey: String(tab.viewKey || 'salesSwati'),
      order: Number.isFinite(tab.order) ? tab.order : index + 1,
      locked: Boolean(tab.locked),
      createdBy: tab.createdBy || 'system',
      updatedAt: tab.updatedAt || new Date().toISOString(),
    }))
    .sort((left, right) => left.order - right.order)
    .map((tab, index) => ({
      ...tab,
      order: index + 1,
    }))
)

const readStorage = () => {
  try {
    const rawValue = localStorage.getItem(DASHBOARD_TABS_STORAGE_KEY)
    if (!rawValue) return normalizeTabs(DEFAULT_DASHBOARD_TABS)

    const parsedValue = JSON.parse(rawValue)
    if (Array.isArray(parsedValue) && parsedValue.length > 0) {
      const filtered = parsedValue.filter((tab) => tab.id !== 'sales-dashboard' && tab.viewKey !== 'salesDashboard')
      const migrated = filtered.map((tab) => {
        if (tab.id === 'sales-1-performance' || tab.viewKey === 'salesPerformanceA') {
          return { ...tab, id: 'sales-swati', name: 'Sales Swati', viewKey: 'salesSwati' }
        }
        if (tab.id === 'sales-2-performance' || tab.viewKey === 'salesPerformanceB') {
          return { ...tab, id: 'sales-lumos', name: 'Sales Lumos', viewKey: 'salesLumos' }
        }
        return tab
      })

      const hasSwati = migrated.some((t) => t.viewKey === 'salesSwati' || t.id === 'sales-swati')
      const hasLumos = migrated.some((t) => t.viewKey === 'salesLumos' || t.id === 'sales-lumos')
      if (!hasSwati) {
        migrated.unshift(DEFAULT_DASHBOARD_TABS[0])
      }
      if (!hasLumos) {
        migrated.splice(1, 0, DEFAULT_DASHBOARD_TABS[1])
      }
      return normalizeTabs(migrated)
    }
    return normalizeTabs(DEFAULT_DASHBOARD_TABS)
  } catch {
    return normalizeTabs(DEFAULT_DASHBOARD_TABS)
  }
}

const writeStorage = (tabs) => {
  const normalizedTabs = normalizeTabs(tabs)
  localStorage.setItem(DASHBOARD_TABS_STORAGE_KEY, JSON.stringify(normalizedTabs))
  window.dispatchEvent(new CustomEvent(DASHBOARD_TABS_EVENT, { detail: normalizedTabs }))
  return normalizedTabs
}

export const getDashboardTabs = () => readStorage()

export const saveDashboardTabs = (tabs) => writeStorage(tabs)

export const addDashboardTab = (tabDraft, user) => {
  const currentTabs = readStorage()
  const nextTabs = [
    ...currentTabs,
    {
      id: `dashboard-tab-${Date.now()}`,
      name: tabDraft.name,
      viewKey: tabDraft.viewKey,
      order: currentTabs.length + 1,
      locked: false,
      createdBy: user?.name || 'Unknown User',
      updatedAt: new Date().toISOString(),
    },
  ]
  return writeStorage(nextTabs)
}

export const updateDashboardTab = (tabId, updates) => {
  const currentTabs = readStorage()
  return writeStorage(currentTabs.map((tab) => (
    tab.id === tabId
      ? {
        ...tab,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      : tab
  )))
}

export const moveDashboardTab = (tabId, direction) => {
  const currentTabs = readStorage()
  const currentIndex = currentTabs.findIndex((tab) => tab.id === tabId)
  if (currentIndex === -1) return currentTabs

  const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= currentTabs.length) return currentTabs

  const nextTabs = [...currentTabs]
  const [currentTab] = nextTabs.splice(currentIndex, 1)
  nextTabs.splice(targetIndex, 0, currentTab)
  return writeStorage(nextTabs)
}

export const deleteDashboardTab = (tabId) => {
  const currentTabs = readStorage()
  if (currentTabs.length <= 1) return currentTabs

  const targetTab = currentTabs.find((tab) => tab.id === tabId)
  if (!targetTab || targetTab.locked) return currentTabs

  return writeStorage(currentTabs.filter((tab) => tab.id !== tabId))
}

export const subscribeDashboardTabs = (callback) => {
  const handleCustomEvent = (event) => {
    callback(normalizeTabs(event.detail))
  }

  const handleStorageEvent = (event) => {
    if (event.key === DASHBOARD_TABS_STORAGE_KEY) {
      callback(readStorage())
    }
  }

  window.addEventListener(DASHBOARD_TABS_EVENT, handleCustomEvent)
  window.addEventListener('storage', handleStorageEvent)

  return () => {
    window.removeEventListener(DASHBOARD_TABS_EVENT, handleCustomEvent)
    window.removeEventListener('storage', handleStorageEvent)
  }
}

export const DASHBOARD_TAB_TEMPLATES = [
  { value: 'salesSwati', label: 'Sales Swati' },
  { value: 'swatiGroup', label: 'Swati Group' },
  { value: 'salesLumos', label: 'Sales Lumos' },
  { value: 'userWisePerformance', label: 'All Users Deal Performance' },
  { value: 'allUsers', label: 'All Users (Everyone by Name)' },
  { value: 'salesPerformanceA', label: 'Sales 1 Performance' },
  { value: 'salesPerformanceB', label: 'Sales 2 Performance' },
  { value: 'myCrm', label: 'My CRM' },
]
