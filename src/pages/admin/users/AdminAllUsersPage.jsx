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
      'Status': u.isOnline ? 'Online' : 'Offline',
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
            Company-wide employee directory with live online presence, account and deal statistics, and conversion rates.
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

      {/* Toolbar: Search & Presence Filter */}
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

          <div className="all-users-filter-pills">
            <button
              type="button"
              className={`all-users-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('all'); setPage(1); }}
            >
              All Users ({totalCount})
            </button>
            <button
              type="button"
              className={`all-users-filter-pill ${statusFilter === 'online' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('online'); setPage(1); }}
            >
              Online 🟢
            </button>
            <button
              type="button"
              className={`all-users-filter-pill ${statusFilter === 'offline' ? 'active' : ''}`}
              onClick={() => { setStatusFilter('offline'); setPage(1); }}
            >
              Offline ⚪
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          Showing {users.length} of {totalCount} employees
        </div>
      </div>

      {/* Users Performance Table */}
      <div className="all-users-table-card">
        <div className="all-users-table-responsive">
          <table className="all-users-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  Employee / Owner Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Role & Email</th>
                <th onClick={() => handleSort('isOnline')} style={{ cursor: 'pointer' }}>
                  Live Status {sortBy === 'isOnline' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('accountsCount')} style={{ cursor: 'pointer' }}>
                  Accounts {sortBy === 'accountsCount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('dealsCount')} style={{ cursor: 'pointer' }}>
                  Deals {sortBy === 'dealsCount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('convertedDealsCount')} style={{ cursor: 'pointer' }}>
                  Converted (Win Rate) {sortBy === 'convertedDealsCount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    Loading real-time performance roster...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No employees matched the selected search or filter.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="all-users-owner-cell">
                        <div className="all-users-avatar">
                          {(u.ownerName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="all-users-owner-name">{u.ownerName}</div>
                          {u.ownerCode && <div className="all-users-owner-code">Code: {u.ownerCode}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{u.role}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                    </td>
                    <td>
                      {u.isOnline ? (
                        <span className="all-users-badge-online">
                          <span className="all-users-dot-online" /> Online
                        </span>
                      ) : (
                        <span className="all-users-badge-offline">
                          <span className="all-users-dot-offline" /> Offline
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{u.accountsCount}</strong>
                    </td>
                    <td>
                      <strong>{u.dealsCount}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#16a34a' }}>
                        {u.convertedDealsCount}
                      </span>{' '}
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        ({u.winRate}%)
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      {u.lastActive ? formatDate(u.lastActive) : 'Never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="all-users-action-btn"
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                      >
                        View Details <FaExternalLinkAlt style={{ fontSize: '0.7rem', marginLeft: '0.2rem' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="all-users-pagination">
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
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
