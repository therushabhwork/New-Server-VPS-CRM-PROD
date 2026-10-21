import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  FaUsers,
  FaSignal,
  FaBuilding,
  FaHandshake,
  FaCheckCircle,
  FaClock,
  FaArrowRight,
} from 'react-icons/fa'
import { formatCurrency } from '../../utils/helpers'
import './AdminAnalyticsGraphs.css'

const DONUT_COLORS = ['#16a34a', '#2563eb', '#dc2626']

const AdminAnalyticsGraphs = ({ analyticsData, loading = false }) => {
  const navigate = useNavigate()

  const summary = analyticsData?.summary || {
    totalUsers: 0,
    onlineUsers: 0,
    totalAccounts: 0,
    totalDeals: 0,
    convertedDeals: 0,
    pendingDeals: 0,
  }

  const accountsByUser = analyticsData?.accountsByUser || []
  const dealsByUser = analyticsData?.dealsByUser || []
  const dealStatusDistribution = analyticsData?.dealStatusDistribution || [
    { name: 'Converted Deals', value: summary.convertedDeals, fill: '#16a34a' },
    { name: 'Pending / Active Deals', value: summary.pendingDeals, fill: '#2563eb' },
    { name: 'Lost Deals', value: summary.lostDeals || 0, fill: '#dc2626' },
  ]
  const activityTrends = analyticsData?.activityTrends || []

  return (
    <section className="aag-container">
      {/* 6 Summary Cards */}
      <div className="aag-summary-grid">
        <div className="aag-summary-card">
          <div className="aag-summary-icon aag-summary-icon--users">
            <FaUsers />
          </div>
          <div className="aag-summary-content">
            <span className="aag-summary-label">Total Users</span>
            <span className="aag-summary-val">{summary.totalUsers}</span>
          </div>
        </div>

        <div className="aag-summary-card">
          <div className="aag-summary-icon aag-summary-icon--online">
            <FaSignal />
          </div>
          <div className="aag-summary-content">
            <span className="aag-summary-label">Online Users</span>
            <span className="aag-summary-val" style={{ color: '#16a34a' }}>
              {summary.onlineUsers}
            </span>
          </div>
        </div>

        <div className="aag-summary-card">
          <div className="aag-summary-icon aag-summary-icon--accounts">
            <FaBuilding />
          </div>
          <div className="aag-summary-content">
            <span className="aag-summary-label">Total Accounts</span>
            <span className="aag-summary-val">{summary.totalAccounts}</span>
          </div>
        </div>

        <div className="aag-summary-card">
          <div className="aag-summary-icon aag-summary-icon--deals">
            <FaHandshake />
          </div>
          <div className="aag-summary-content">
            <span className="aag-summary-label">Total Deals</span>
            <span className="aag-summary-val">{summary.totalDeals}</span>
          </div>
        </div>

        <div className="aag-summary-card">
          <div className="aag-summary-icon aag-summary-icon--won">
            <FaCheckCircle />
          </div>
          <div className="aag-summary-content">
            <span className="aag-summary-label">Converted Deals</span>
            <span className="aag-summary-val" style={{ color: '#059669' }}>
              {summary.convertedDeals}
            </span>
          </div>
        </div>

        <div className="aag-summary-card">
          <div className="aag-summary-icon aag-summary-icon--pending">
            <FaClock />
          </div>
          <div className="aag-summary-content">
            <span className="aag-summary-label">Pending Deals</span>
            <span className="aag-summary-val" style={{ color: '#d97706' }}>
              {summary.pendingDeals}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Interactive Recharts Graphs */}
      <div className="aag-graphs-grid">
        {/* Graph 1: Accounts Created by User */}
        <div className="aag-graph-card">
          <div className="aag-graph-card-header">
            <div>
              <h4 className="aag-graph-title">Accounts Created by User</h4>
              <span className="aag-graph-sub">Distribution of accounts per team owner</span>
            </div>
          </div>
          <div className="aag-graph-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={accountsByUser}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="userName" type="category" width={110} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip
                  formatter={(val) => [`${val} Accounts`, 'Count']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="count" name="Accounts" fill="#dc2626" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Deals Created by User */}
        <div className="aag-graph-card">
          <div className="aag-graph-card-header">
            <div>
              <h4 className="aag-graph-title">Deals Created by User</h4>
              <span className="aag-graph-sub">Deal count & revenue volume per user</span>
            </div>
          </div>
          <div className="aag-graph-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dealsByUser}
                margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="userName" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val, name, item) => [
                    `${val} Deals ${item.payload.value > 0 ? `(${formatCurrency(item.payload.value)})` : ''}`,
                    'Deals',
                  ]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="count" name="Deals" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 3: Converted vs Pending Deals */}
        <div className="aag-graph-card">
          <div className="aag-graph-card-header">
            <div>
              <h4 className="aag-graph-title">Converted vs Pending Deals</h4>
              <span className="aag-graph-sub">Company deal conversion health</span>
            </div>
          </div>
          <div className="aag-graph-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dealStatusDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {dealStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 4: User Activity Trends over Time */}
        <div className="aag-graph-card">
          <div className="aag-graph-card-header">
            <div>
              <h4 className="aag-graph-title">Activity Trends over Time</h4>
              <span className="aag-graph-sub">Accounts, deals, and conversions movement</span>
            </div>
          </div>
          <div className="aag-graph-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={activityTrends}
                margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorAccounts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1' }} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="accounts" name="Accounts" stroke="#dc2626" fillOpacity={1} fill="url(#colorAccounts)" />
                <Area type="monotone" dataKey="deals" name="Deals" stroke="#2563eb" fillOpacity={1} fill="url(#colorDeals)" />
                <Area type="monotone" dataKey="conversions" name="Conversions" stroke="#16a34a" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Prominent View All Users Banner */}
      <div className="aag-view-all-banner">
        <div className="aag-view-all-copy">
          <h4>All Registered Employees & Sales Performance Roster</h4>
          <p>
            Monitor real-time online/offline presence, total accounts, total deals, conversion rates, and individual performance for all employees.
          </p>
        </div>
        <button
          type="button"
          className="aag-view-all-btn"
          onClick={() => navigate('/admin/users')}
        >
          View All Users & Analytics <FaArrowRight />
        </button>
      </div>
    </section>
  )
}

export default AdminAnalyticsGraphs
