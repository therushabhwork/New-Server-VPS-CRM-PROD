import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaBell,
  FaBriefcase,
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardList,
  FaExternalLinkAlt,
  FaFileAlt,
  FaHandshake,
  FaHome,
  FaUser,
  FaUsers,
  FaComments,
  FaCheck,
  FaPlus,
  FaSyncAlt,
  FaTimes,
} from 'react-icons/fa'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import apiClient from '../../services/apiClient'
import { remarkApi } from '../../services/remarkApi'
import { customerService } from '../../services/customerService'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { filterCommunicationActivitiesForUser } from '../../utils/communicationActivityAccess'
import './UserDashboardPage.css'
import AnalyticsSection from '../../components/dashboard/AnalyticsSection'
import ActiveReminderActionModal from '../admin/reminders/ActiveReminderActionModal'

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

const UserDashboardPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    accounts,
    deals,
    tasks,
    notifications,
    supportRequests,
    reminders,
    quotations,
    activities,
    updateReminder,
    updateAccount,
    updateDeal,
    addNotification,
    refreshData,
  } = useData()
  const [todoReplies, setTodoReplies] = useState([])
  const [communicationRemarks, setCommunicationRemarks] = useState([])
  const customers = useMemo(() => customerService.getCustomers(), [])

  const fetchTodoReplies = useCallback(async () => {
    try {
      const res = await apiClient.get('/support-requests/todo/replies')
      setTodoReplies(Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []))
    } catch (error) {
      console.error('Failed to fetch todo replies:', error)
    }
  }, [])

  useEffect(() => {
    fetchTodoReplies()
    let isMounted = true
    remarkApi.getAllRemarks({ limit: 10 }).then((res) => {
      if (isMounted && Array.isArray(res)) {
        setCommunicationRemarks(filterCommunicationActivitiesForUser(res, user).slice(0, 10))
      }
    }).catch(() => {})
    return () => { isMounted = false }
  }, [fetchTodoReplies, user])

  const stats = useMemo(() => {
    const pendingTasks = tasks.filter((task) => task.status === 'pending')
    const openDeals = deals.filter((deal) => !['won', 'lost'].includes(String(deal.status || '').toLowerCase()))
    const openSupportRequests = supportRequests.filter((supportRequest) => String(supportRequest.status || '').toLowerCase() !== 'closed')

    return {
      accounts: accounts.length,
      deals: deals.length,
      dealValue: deals.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0),
      openDeals: openDeals.length,
      tasks: tasks.length,
      pendingTasks: pendingTasks.length,
      supportRequests: supportRequests.length,
      openSupportRequests: openSupportRequests.length,
      notifications: notifications.length,
      quotations: quotations.length,
    }
  }, [accounts, deals, notifications.length, quotations.length, supportRequests, tasks])

  const userIdentity = useMemo(() => [
    user?.id,
    user?.name,
    user?.username,
    user?.email,
  ].filter(Boolean).map((v) => String(v).trim().toLowerCase()), [user])

  const allReminderItems = useMemo(() => {
    const matchesUser = (assigned) => {
      if (!assigned) return false
      const norm = String(assigned).trim().toLowerCase()
      return userIdentity.some((id) => id === norm || norm.includes(id))
    }

    return (reminders || [])
      .filter((reminder) => String(reminder.status || '').toLowerCase() !== 'closed')
      .filter((reminder) => matchesUser(reminder.assignedTo) || matchesUser(reminder.createdBy) || !reminder.assignedTo)
      .map((reminder) => ({
        id: `reminder-${reminder.id}`,
        type: String(reminder.status || '').toLowerCase() === 'activated'
          ? 'REMINDER (ACTIVATED)'
          : (reminder.reminderMode ? `REMINDER (${reminder.reminderMode.toUpperCase()})` : 'REMINDER'),
        title: reminder.title || reminder.message || 'Reminder',
        meta: formatTodoDateTime(reminder.remindAt || reminder.reminderDate) || 'Today',
        message: reminder.message || reminder.note || '-',
        date: reminder.remindAt || reminder.reminderDate,
        reminder,
        onClick: () => navigate('/reminders/my', {
          state: {
            activeMyReminderTab: 'today',
            reminderId: reminder.id,
          },
        }),
      }))
      .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime())
  }, [navigate, reminders, userIdentity])

  const allTaskAndReplyItems = useMemo(() => {
    const matchesUser = (assigned) => {
      if (!assigned) return false
      const norm = String(assigned).trim().toLowerCase()
      return userIdentity.some((id) => id === norm || norm.includes(id))
    }

    const replyItems = (todoReplies || [])
      .map((reply, index) => {
        const requestId = reply.support_request_id || reply.supportRequestId || ''
        const matchedRequest = supportRequests.find((request) => (
          [request.id, request.mongoId, request._id, request.legacyId].some((value) => String(value || '') === String(requestId || ''))
        ))
        const targetRequestId = matchedRequest?.id || requestId
        return {
          id: `reply-${reply._id || reply.id || index}`,
          type: 'REPLY',
          title: reply.sender_email || reply.senderEmail || 'Support Reply',
          meta: formatTodoDateTime(reply.created_at || reply.createdAt),
          message: reply.message || '-',
          date: reply.created_at || reply.createdAt,
          onClick: () => navigate('/tickets', {
            state: {
              activeTab: 'replied',
              expandedTicketId: targetRequestId,
              supportRequestId: targetRequestId,
            },
          }),
        }
      })
      .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime())

    const taskItems = (tasks || [])
      .filter((task) => String(task.status || '').toLowerCase() === 'pending' || String(task.status || '').toLowerCase() === 'open')
      .filter((task) => matchesUser(task.assignedTo) || matchesUser(task.createdBy) || matchesUser(task.userEmail) || matchesUser(task.ownerUserId) || !task.assignedTo)
      .map((task) => {
        const timestamp = new Date(task.createdAt || task.created_at || task.dueDate || task.date || 0).getTime()
        return {
          id: `task-${task.id || task._id}`,
          type: 'TASK',
          title: task.title || task.name || 'Pending Task',
          meta: formatTodoDateTime(task.dueDate || task.createdAt) || 'Today',
          message: task.description || task.note || '-',
          date: task.createdAt || task.dueDate || task.createdAt,
          timestamp,
          task,
          onClick: () => navigate('/tasks/all'),
        }
      })

    const replyItemsWithTs = (replyItems || []).map((r) => ({
      ...r,
      timestamp: new Date(r.date || r.created_at || r.createdAt || 0).getTime(),
    }))

    return [...replyItemsWithTs, ...taskItems]
      .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
  }, [navigate, supportRequests, tasks, todoReplies, userIdentity])

  const [activeReminderModalItem, setActiveReminderModalItem] = useState(null)

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
    const enriched = {
      ...reminder,
      ownerName: reminder.ownerName || reminder.assignedTo || reminder.userName || user?.name || 'Unassigned',
      reminderDate: reminder.remindAt || reminder.reminderDate,
    }
    setActiveReminderModalItem(enriched)
  }, [user?.name])

  const handleDirectJumpToActivePage = useCallback((reminder, event) => {
    event?.stopPropagation()
    const owner = reminder?.ownerName || reminder?.assignedTo || reminder?.userName || user?.name || ''
    const reminderId = reminder?.id || reminder?.sourceId || ''
    const params = new URLSearchParams()
    if (owner && owner !== 'Unassigned') params.set('owner', owner)
    if (reminderId) params.set('reminderId', reminderId)
    const targetUrl = `/reminders/active${params.toString() ? `?${params.toString()}` : ''}`
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }, [user?.name])

  const handleModalActivateInPlace = useCallback(async (reminder) => {
    if (reminder?.sourceType === 'account' && reminder?.sourceId) {
      await updateAccount(reminder.sourceId, { reminderStatus: 'activated' })
    } else if (reminder?.sourceType === 'deal' && reminder?.sourceId) {
      await updateDeal(reminder.sourceId, { reminderStatus: 'activated' })
    } else if (reminder?.id) {
      await updateReminder(reminder.id, { status: 'activated' })
    }
    if (refreshData) {
      try {
        await refreshData()
      } catch (e) {}
    }
    if (addNotification) {
      addNotification('success', 'Reminder Activated', `Activated reminder for ${reminder.ownerName || 'team member'}.`)
    }
  }, [addNotification, refreshData, updateAccount, updateDeal, updateReminder])

  const handleModalCloseInPlace = useCallback(async (reminder) => {
    if (reminder?.sourceType === 'account' && reminder?.sourceId) {
      await updateAccount(reminder.sourceId, { reminderStatus: 'closed' })
    } else if (reminder?.sourceType === 'deal' && reminder?.sourceId) {
      await updateDeal(reminder.sourceId, { reminderStatus: 'closed' })
    } else if (reminder?.id) {
      await updateReminder(reminder.id, { status: 'closed' })
    }
    if (refreshData) {
      try {
        await refreshData()
      } catch (e) {}
    }
    if (addNotification) {
      addNotification('success', 'Reminder Closed', `Closed reminder for ${reminder.ownerName || 'team member'}.`)
    }
  }, [addNotification, refreshData, updateAccount, updateDeal, updateReminder])

  const handleModalRescheduleInPlace = useCallback(async (reminder, newDate) => {
    if (!newDate) return
    if (reminder?.id) {
      await updateReminder(reminder.id, { reminderDate: newDate, remindAt: newDate })
    }
    if (refreshData) {
      try {
        await refreshData()
      } catch (e) {}
    }
    if (addNotification) {
      addNotification('success', 'Reminder Rescheduled', `Reminder rescheduled to ${newDate}.`)
    }
  }, [addNotification, refreshData, updateReminder])

  const handleTodoReminderClose = async (reminder, event) => {
    event?.stopPropagation()
    await updateReminder(reminder.id, { status: 'closed' })
    navigate('/reminders/closed', {
      state: {
        reminderId: reminder.id,
      },
    })
  }

  const [todoFilter, setTodoFilter] = useState('all')

  const counts = useMemo(() => {
    return {
      all: allTaskAndReplyItems.length,
      task: allTaskAndReplyItems.filter((item) => item.type === 'TASK').length,
      reply: allTaskAndReplyItems.filter((item) => item.type === 'REPLY').length,
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
      return allTaskAndReplyItems.filter((item) => item.type === 'TASK')
    }
    if (todoFilter === 'reply') {
      return allTaskAndReplyItems.filter((item) => item.type === 'REPLY')
    }
    return allTaskAndReplyItems
  }, [allTaskAndReplyItems, todoFilter])

  const totalTodoPages = Math.ceil(displayedTodoItems.length / TODOS_PER_PAGE) || 1

  const paginatedTodoItems = useMemo(() => {
    const page = Math.min(Math.max(1, todoPage), totalTodoPages)
    const start = (page - 1) * TODOS_PER_PAGE
    return displayedTodoItems.slice(start, start + TODOS_PER_PAGE)
  }, [displayedTodoItems, todoPage, totalTodoPages])

  return (
    <div className="ud-page">
      {/* Welcome Section */}
      <div className="ud-welcome-section">
        <span className="ud-welcome-kicker">WELCOME,</span>
        <h1 className="ud-welcome-heading">{user?.name || 'Keval V Shah'}!</h1>
        <p className="ud-welcome-subtext">Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="ud-stats-grid">
        {/* Card 1: Accounts */}
        <div className="ud-stat-card ud-stat-card--accounts" onClick={() => navigate('/accounts/my-accounts')}>
          <div className="ud-stat-icon-wrapper ud-stat-icon-wrapper--red">
            <FaUsers />
          </div>
          <div className="ud-stat-content">
            <div className="ud-stat-num-row">
              <span className="ud-stat-number">{stats.accounts || 14}</span>
              <span className="ud-stat-badge ud-stat-badge--green">↗ +12%</span>
            </div>
            <span className="ud-stat-title">Accounts</span>
          </div>
          <div className="ud-stat-curve ud-stat-curve--red" />
        </div>

        {/* Card 2: Customer */}
        <div className="ud-stat-card ud-stat-card--customer" onClick={() => navigate('/customers/my-customers')}>
          <div className="ud-stat-icon-wrapper ud-stat-icon-wrapper--red">
            <FaUser />
          </div>
          <div className="ud-stat-content">
            <div className="ud-stat-num-row">
              <span className="ud-stat-number">0</span>
              <span className="ud-stat-badge ud-stat-badge--gray">0%</span>
            </div>
            <span className="ud-stat-title">Customers</span>
          </div>
          <div className="ud-stat-curve ud-stat-curve--red" />
        </div>

        {/* Card 3: Deals */}
        <div className="ud-stat-card ud-stat-card--deal" onClick={() => navigate('/deals/view')}>
          <div className="ud-stat-icon-wrapper ud-stat-icon-wrapper--red">
            <FaHandshake />
          </div>
          <div className="ud-stat-content">
            <div className="ud-stat-num-row">
              <span className="ud-stat-number">{stats.openDeals || 18}</span>
              <span className="ud-stat-badge ud-stat-badge--green">↗ +8%</span>
            </div>
            <span className="ud-stat-title">Deals</span>
          </div>
          <div className="ud-stat-curve ud-stat-curve--red" />
        </div>

        {/* Card 4: Quotation Manager */}
        <div className="ud-stat-card ud-stat-card--quotation" onClick={() => navigate('/quotation-manager/view')}>
          <div className="ud-stat-icon-wrapper ud-stat-icon-wrapper--red">
            <FaFileAlt />
          </div>
          <div className="ud-stat-content">
            <div className="ud-stat-num-row">
              <span className="ud-stat-number">{stats.quotations || 23}</span>
            </div>
            <span className="ud-stat-title">Quotation Manager</span>
          </div>
          <div className="ud-stat-curve ud-stat-curve--red" />
        </div>
      </div>

      {/* Side-by-Side Monitoring Grid: Left = To Do List & Reminders, Right = Communication Activity */}
      <div className="ud-dashboard-main-grid ud-monitoring-side-by-side" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '1.25rem', marginTop: '1.25rem', marginBottom: '1.25rem', alignItems: 'start' }}>
        {/* Left Column: Stacked To Do List & Dedicated Reminders */}
        <div className="ud-todo-full-container" style={{ margin: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card 1: To Do List */}
          <div className="ud-card ud-todo-card ud-todo-card--expansive" style={{ margin: 0 }}>
            <div className="ud-card-header ud-todo-header-expansive" style={{ padding: '0.85rem 1.15rem' }}>
              <div className="ud-card-header-left">
                <div className="ud-todo-header-icon-box" style={{ width: '2.3rem', height: '2.3rem', fontSize: '1.1rem', background: '#fff1f2', color: '#c60016', borderRadius: '10px' }}>
                  <FaClipboardList className="ud-card-header-icon" style={{ color: '#c60016' }} />
                </div>
                <div>
                  <div className="ud-todo-title-row">
                    <h3 style={{ fontSize: '1.05rem' }}>To Do List</h3>
                    <span className="ud-todo-count-badge">{counts.all} items</span>
                  </div>
                  <p className="ud-todo-subtitle" style={{ fontSize: '0.75rem' }}>Prioritized pending tasks and support replies</p>
                </div>
                <button
                  type="button"
                  className="ud-red-btn"
                  onClick={() => navigate('/tasks')}
                  style={{ marginLeft: '0.5rem', whiteSpace: 'nowrap' }}
                >
                  + Add Task
                </button>
              </div>

              <div className="ud-card-header-right">
                <div className="ud-todo-filter-tabs">
                  <button
                    type="button"
                    className={`ud-todo-tab ${todoFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setTodoFilter('all')
                      setTodoPage(1)
                    }}
                  >
                    All ({counts.all})
                  </button>
                  <button
                    type="button"
                    className={`ud-todo-tab ${todoFilter === 'task' ? 'active' : ''}`}
                    onClick={() => {
                      setTodoFilter('task')
                      setTodoPage(1)
                    }}
                  >
                    Tasks ({counts.task})
                  </button>
                  <button
                    type="button"
                    className={`ud-todo-tab ${todoFilter === 'reply' ? 'active' : ''}`}
                    onClick={() => {
                      setTodoFilter('reply')
                      setTodoPage(1)
                    }}
                  >
                    Replies ({counts.reply})
                  </button>
                </div>
              </div>
            </div>

            <div className="ud-todo-list ud-todo-list--expansive" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0.85rem 1rem', background: '#fdfcfb', maxHeight: '250px', overflowY: 'auto' }}>
              {paginatedTodoItems.length > 0 ? paginatedTodoItems.map((item) => {
                const isTask = Boolean(item.task || item.type?.toLowerCase().includes('task') || item.type?.toLowerCase().includes('reassignment'))
                if (isTask) {
                  return (
                    <div
                      key={item.id}
                      className="ud-todo-row ud-todo-row--task"
                      onClick={() => navigate('/tasks/all')}
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
                    className="ud-todo-row ud-todo-row--reply"
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
                        border: '2px solid #dc2626',
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
              }) : (
                <div className="ud-todo-empty-state">
                  <FaClipboardList className="ud-todo-empty-icon" />
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
          <div className="ud-card ud-reminders-card--expansive" style={{ margin: 0 }}>
            <div className="ud-card-header ud-todo-header-expansive" style={{ padding: '0.85rem 1.15rem' }}>
              <div className="ud-card-header-left">
                <div className="ud-todo-header-icon-box" style={{ width: '2.3rem', height: '2.3rem', fontSize: '1.1rem', background: '#fff1f2', color: '#c60016', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaBell style={{ color: '#c60016' }} />
                </div>
                <div>
                  <div className="ud-todo-title-row">
                    <h3 style={{ fontSize: '1.05rem' }}>Reminders</h3>
                    <span className="ud-todo-count-badge" style={{ background: '#fff1f2', color: '#c60016', borderColor: '#fecdd3' }}>{allReminderItems.length} items</span>
                  </div>
                  <p className="ud-todo-subtitle" style={{ fontSize: '0.75rem' }}>Active follow-ups & account/deal alerts</p>
                </div>
              </div>

              <div className="ud-card-header-right">
                <button
                  type="button"
                  className="ud-link-btn"
                  onClick={() => navigate('/reminders/my')}
                >
                  View All &rarr;
                </button>
                <button
                  type="button"
                  className="ud-red-btn"
                  onClick={() => navigate('/reminders/add')}
                >
                  + Add Reminder
                </button>
              </div>
            </div>

            <div className="ud-reminders-list--expansive" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0.85rem 1rem', background: '#fdfcfb', maxHeight: '280px', overflowY: 'auto' }}>
              {paginatedReminderItems.length > 0 ? (
                paginatedReminderItems.map((item) => {
                  const isActivated = isReminderItemActivated(item.reminder)
                  return (
                    <div
                      key={item.id}
                      className={`ud-todo-row ud-todo-row--${item.type.toLowerCase().replace(/[^a-z]/g, '')}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isActivated ? '#f0fdf4' : '#fffbeb',
                        border: isActivated ? '1px solid #bbf7d0' : '1px solid #fde68a',
                        minHeight: '44px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        <FaBell style={{ color: isActivated ? '#16a34a' : '#dc2626', fontSize: '1.15rem', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem', minWidth: 0, flex: 1 }}>
                          <span className="ud-reminder-card-meta" style={{ fontSize: '0.70rem', fontWeight: 600, color: isActivated ? '#15803d' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.reminder?.accountName || item.reminder?.dealName ? `${item.reminder.accountName || item.reminder.dealName} | ` : ''}{item.meta || 'Follow up'} {item.reminder?.ownerName ? `| ${item.reminder.ownerName}` : ''}
                          </span>
                          <span className="ud-reminder-card-title" style={{ fontSize: '0.77rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title || item.message}>
                            {item.title || item.message}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {isActivated ? (
                          <span
                            title="Reminder Activated"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: '#16a34a',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            <FaCheck style={{ fontSize: '0.65rem' }} /> Activated
                          </span>
                        ) : (
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
                            else navigate('/tasks')
                          }}
                          title="Create Task / Reschedule"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: isActivated ? '1.5px solid #16a34a' : '1.5px solid #ef4444',
                            background: '#ffffff',
                            color: isActivated ? '#16a34a' : '#dc2626',
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
                            border: isActivated ? '1.5px solid #16a34a' : '1.5px solid #ef4444',
                            background: '#ffffff',
                            color: isActivated ? '#16a34a' : '#dc2626',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                          }}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="ud-todo-empty-state">
                  <FaBell className="ud-todo-empty-icon" style={{ color: '#dc2626' }} />
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

        {/* Right: Communication Activity Section */}
        <div className="ud-card ud-communication-card" style={{ margin: 0, padding: '1.15rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box' }}>
          <div className="ud-card-header" style={{ padding: '0 0 0.75rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="ud-card-header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaComments className="ud-card-header-icon" style={{ color: '#c60016', fontSize: '1.2rem' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Communication Activity</h3>
            </div>
            <button
              type="button"
              className="ud-link-btn"
              onClick={() => navigate('/communication-activities')}
              style={{ background: 'none', border: 'none', color: '#c60016', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              View All &rarr;
            </button>
          </div>
          <div className="ud-card-body" style={{ padding: 0 }}>
            {communicationRemarks.length === 0 ? (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>
                No recent communication activities found.
              </div>
            ) : (
              <div className="ud-communication-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.35rem', maxHeight: '270px', overflowY: 'auto', paddingRight: '4px' }}>
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
      </div>

      {/* Analytics Section Component */}
      <AnalyticsSection
        accounts={accounts}
        deals={deals}
        customers={customers}
        quotations={quotations}
        activities={activities}
      />

      {activeReminderModalItem ? (
        <ActiveReminderActionModal
          isOpen={Boolean(activeReminderModalItem)}
          onClose={() => setActiveReminderModalItem(null)}
          reminder={activeReminderModalItem}
          currentUser={user}
          isAdmin={Boolean(user?.role === 'admin')}
          allReminders={reminders || []}
          onActivateInPlace={handleModalActivateInPlace}
          onCloseInPlace={handleModalCloseInPlace}
          onRescheduleInPlace={handleModalRescheduleInPlace}
        />
      ) : null}
    </div>
  )
}

export default UserDashboardPage
