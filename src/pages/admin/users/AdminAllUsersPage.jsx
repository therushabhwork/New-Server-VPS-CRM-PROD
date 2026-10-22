import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaSearch,
  FaFileExcel,
  FaUsers,
  FaArrowLeft,
  FaSync,
  FaExternalLinkAlt,
} from 'react-icons/fa'
import { analyticsApi } from '../../../services/analyticsApi'
import { downloadExcel, formatDate } from '../../../utils/helpers'
import { useAuth } from '../../../context/AuthContext'
import './AdminAllUsersPage.css'

const AdminAllUsersPage = () => {
  const navigate = useNavigate()
  const { socket } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await analyticsApi.getAllUsersPerformanceRoster({
        search,
        status: statusFilter,
        page,
        limit: 25,
        sortBy,
        sortOrder,
      })
      if (data && Array.isArray(data.users)) {
        setUsers(data.users)
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to load performance roster:', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Real-time socket listeners for live presence updates
  useEffect(() => {
    if (!socket) return

    const handleUserOnline = (onlineUser) => {
      setUsers((prev) =>
        prev.map((u) => {
          if (String(u.id) === String(onlineUser.id || onlineUser.userId)) {
            return { ...u, isOnline: true }
          }
          return u
        })
      )
    }

    const handleUserOffline = (offlineUser) => {
      setUsers((prev) =>
        prev.map((u) => {
          if (String(u.id) === String(offlineUser.id || offlineUser.userId)) {
            return { ...u, isOnline: false }
          }
          return u
        })
      )
    }

    const handleOnlineUsersList = (list) => {
      if (Array.isArray(list)) {
        const onlineIdSet = new Set(list.map((u) => String(u.id || u.userId)))
        setUsers((prev) =>
          prev.map((u) => ({
            ...u,
            isOnline: onlineIdSet.has(String(u.id)),
          }))
        )
      }
    }

    socket.on('user:online', handleUserOnline)
    socket.on('user:offline', handleUserOffline)
    socket.on('users:online', handleOnlineUsersList)

    return () => {
      socket.off('user:online', handleUserOnline)
      socket.off('user:offline', handleUserOffline)
      socket.off('users:online', handleOnlineUsersList)
    }
  }, [socket])

  const handleExportExcel = () => {
    const exportData = users.map((u, i) => ({
      'Sr No.': i + 1,
      'Owner Name': u.ownerName || '-',
      'Email': u.email || '-',
      'Role': u.role || '-',
      'Accounts Created': u.accountsCount || 0,
      'Deals Created': u.dealsCount || 0,
      'Converted Deals': u.convertedDealsCount || 0,
      'Win Rate %': `${u.winRate || 0}%`,
      'Last Active': u.lastActive ? formatDate(u.lastActive) : '-',
    }))
    downloadExcel(exportData, `CRM_All_Users_Performance_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(columnKey)
      setSortOrder('asc')
    }
    setPage(1)
  }

  return (
    <div className="all-users-page">
      {/* Header */}
      <div className="all-users-header">
        <div>
          <button
            type="button"
            className="all-users-page-btn"
            style={{ marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => navigate('/admin/monitoring')}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
          <h1 className="all-users-header-title">All Registered Users & Sales Performance</h1>
          <p className="all-users-header-subtitle">
            Company-wide employee directory with account and deal statistics and conversion rates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="all-users-page-btn"
            onClick={fetchUsers}
            title="Refresh Performance Roster"
          >
            <FaSync /> Refresh
          </button>
          <button
            type="button"
            className="all-users-export-btn"
            onClick={handleExportExcel}
          >
            <FaFileExcel /> Export to Excel
          </button>
        </div>
      </div>

      {/* Toolbar: Search */}
      <div className="all-users-toolbar">
        <div className="all-users-toolbar-left">
          <div className="all-users-search-wrap">
            <FaSearch className="all-users-search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, role..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="all-users-search-input"
            />
          </div>
        </div>

        <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
          Showing {users.length} of {totalCount} employees
        </div>
      </div>

      {/* Users Cards Grid */}
      <div className="all-users-cards-wrapper">
        <div className="all-users-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              Loading performance cards...
            </div>
          ) : users.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              No employees matched the selected search.
            </div>
          ) : (
            users.map((u, idx) => {
              const winRate = Number(u.winRate) || 0
              const barColor = winRate >= 70 ? '#15803d' : winRate >= 35 ? '#d97706' : '#c60016'
              return (
                <div
                  key={u.id}
                  className="all-users-card"
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1rem',
                    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#c60016', background: '#ffffff', border: '1px solid #fecdd3', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                      {(page - 1) * 25 + idx + 1}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginTop: '0.15rem' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #c60016 0%, #990011 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.82rem',
                        fontWeight: '800',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(198, 0, 22, 0.25)',
                      }}
                    >
                      {(u.ownerName || u.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: '800', color: '#1e293b' }}>
                          {u.ownerName || u.email?.split('@')[0]}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'capitalize' }}>
                          {u.role || 'User'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', wordBreak: 'break-all' }}>
                        {u.email}
                      </div>
                      {u.ownerCode && (
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '1px' }}>
                          Code: {u.ownerCode}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', background: '#f8fafc', padding: '0.55rem 0.5rem', borderRadius: '10px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Accounts</div>
                      <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.92rem' }}>{u.accountsCount || 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Deals</div>
                      <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.92rem' }}>{u.dealsCount || 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#15803d' }}>Won Deals</div>
                      <div style={{ fontWeight: '800', color: '#15803d', fontSize: '0.92rem' }}>{u.convertedDealsCount || 0}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.72rem' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Win Rate</span>
                      <span style={{ fontWeight: '800', color: barColor }}>{winRate}%</span>
                    </div>
                    <div style={{ height: '7px', borderRadius: '4px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(winRate, 100)}%`, height: '100%', background: barColor, borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '0.4rem' }}>
                    <button
                      type="button"
                      className="all-users-card-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.32rem 0.75rem',
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        borderRadius: '8px',
                        background: '#fff1f2',
                        border: '1px solid #fecdd3',
                        color: '#c60016',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                    >
                      View Details <FaExternalLinkAlt style={{ fontSize: '0.68rem' }} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        <div className="all-users-pagination" style={{ borderRadius: '12px', marginTop: '1rem', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="all-users-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="all-users-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminAllUsersPage
