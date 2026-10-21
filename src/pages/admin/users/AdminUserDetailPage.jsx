import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FaArrowLeft,
  FaEnvelope,
  FaIdBadge,
  FaBuilding,
  FaHandshake,
  FaExternalLinkAlt,
  FaSignal,
} from 'react-icons/fa'
import { analyticsApi } from '../../../services/analyticsApi'
import DealPerformanceCard from '../../../components/dashboard/DealPerformanceCard'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import './AdminUserDetailPage.css'

const AdminUserDetailPage = () => {
  const { userId } = useParams()
  const navigate = useNavigate()

  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('accounts')

  useEffect(() => {
    let mounted = true
    const fetchDetails = async () => {
      try {
        setLoading(true)
        const res = await analyticsApi.getUserPerformanceDetails(userId)
        if (mounted && res) {
          setDetails(res)
        }
      } catch (err) {
        console.error('Failed to load user performance details:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (userId) fetchDetails()
    return () => { mounted = false }
  }, [userId])

  if (loading) {
    return (
      <div className="user-detail-page">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Loading employee details and performance analytics...
        </div>
      </div>
    )
  }

  if (!details || !details.user) {
    return (
      <div className="user-detail-page">
        <button
          type="button"
          className="all-users-page-btn"
          onClick={() => navigate('/admin/users')}
          style={{ width: 'fit-content' }}
        >
          <FaArrowLeft /> Back to All Users
        </button>
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>
          Employee details could not be found.
        </div>
      </div>
    )
  }

  const { user, summary, monthly, accounts = [], deals = [] } = details

  const userPerformanceData = {
    userId: user.id,
    ownerName: user.ownerName,
    role: user.role,
    isOnline: user.isOnline,
    summary,
    monthly,
  }

  return (
    <div className="user-detail-page">
      {/* Back button */}
      <div>
        <button
          type="button"
          className="all-users-page-btn"
          onClick={() => navigate('/admin/users')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <FaArrowLeft /> Back to All Users
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="user-detail-header-card">
        <div className="user-detail-profile-left">
          <div className="user-detail-avatar-large">
            {(user.ownerName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="user-detail-profile-info">
            <h2>{user.ownerName}</h2>
            <div className="user-detail-profile-meta">
              <span><FaIdBadge /> Role: {user.role}</span>
              {user.email && <span><FaEnvelope /> {user.email}</span>}
              {user.ownerCode && <span>Owner Code: {user.ownerCode}</span>}
              <span className={`deal-perf-presence-badge ${user.isOnline ? 'deal-perf-presence-badge--online' : 'deal-perf-presence-badge--offline'}`}>
                <span className={`deal-perf-presence-dot ${user.isOnline ? 'deal-perf-presence-dot--online' : 'deal-perf-presence-dot--offline'}`} />
                {user.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Accounts</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{accounts.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Deals</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb' }}>{summary?.totalDeals || deals.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Win Rate</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>{summary?.winRate || 0}%</div>
          </div>
        </div>
      </div>

      {/* User's Deal Performance Graph Card */}
      <DealPerformanceCard userPerformance={userPerformanceData} />

      {/* Associated Records Tabs: Accounts & Deals */}
      <div className="user-detail-tabs-section">
        <div className="user-detail-nav-tabs">
          <button
            type="button"
            className={`user-detail-nav-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <FaBuilding style={{ marginRight: '0.35rem' }} /> Associated Accounts ({accounts.length})
          </button>
          <button
            type="button"
            className={`user-detail-nav-btn ${activeTab === 'deals' ? 'active' : ''}`}
            onClick={() => setActiveTab('deals')}
          >
            <FaHandshake style={{ marginRight: '0.35rem' }} /> Associated Deals ({deals.length})
          </button>
        </div>

        {activeTab === 'accounts' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="user-detail-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Account Number</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                      No accounts found for this employee.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: 600 }}>{acc.accountName}</td>
                      <td>{acc.accountNumber || '-'}</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.5rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {acc.status}
                        </span>
                      </td>
                      <td>{acc.createdAt ? formatDate(acc.createdAt) : '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="user-detail-link-btn"
                          onClick={() => navigate(`/admin/accounts/my-accounts?accountId=${acc.id}`)}
                        >
                          View Account <FaExternalLinkAlt style={{ fontSize: '0.7rem' }} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="user-detail-table">
              <thead>
                <tr>
                  <th>Deal Title</th>
                  <th>Deal Number</th>
                  <th>Stage / Status</th>
                  <th>Value</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                      No deals found for this employee.
                    </td>
                  </tr>
                ) : (
                  deals.map((deal) => (
                    <tr key={deal.id}>
                      <td style={{ fontWeight: 600 }}>{deal.title}</td>
                      <td>{deal.dealNumber || '-'}</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {deal.stage}
                        </span>
                      </td>
                      <td>{deal.value ? formatCurrency(deal.value) : '-'}</td>
                      <td>{deal.createdAt ? formatDate(deal.createdAt) : '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="user-detail-link-btn"
                          onClick={() => navigate(`/admin/deals/view/${deal.id}`)}
                        >
                          View Deal <FaExternalLinkAlt style={{ fontSize: '0.7rem' }} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminUserDetailPage
