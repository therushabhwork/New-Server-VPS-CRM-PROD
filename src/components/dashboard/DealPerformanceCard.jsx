import React, { useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { FaUserCheck, FaCalendarDay, FaCalendarAlt, FaCalendar } from 'react-icons/fa'
import { formatCurrency } from '../../utils/helpers'
import './DealPerformanceCard.css'

const CustomChartTooltip = ({ active, payload, label, selectedMetric = 'all' }) => {
  if (active && payload && payload.length) {
    const accountsItem = payload.find((p) => p.dataKey === 'accounts')
    const wonItem = payload.find((p) => p.dataKey === 'closedWon')
    const lostItem = payload.find((p) => p.dataKey === 'closedLost')
    const quotationsItem = payload.find((p) => p.dataKey === 'quotations')

    const accountsCount = accountsItem?.value ?? 0
    const wonCount = wonItem?.value ?? 0
    const lostCount = lostItem?.value ?? 0
    const quotationsCount = quotationsItem?.value ?? 0
    const wonVal = wonItem?.payload?.wonValue ?? 0
    const lostVal = lostItem?.payload?.lostValue ?? 0
    const totalDeals = wonCount + lostCount
    const winRate = totalDeals > 0 ? ((wonCount / totalDeals) * 100).toFixed(1) : '0.0'

    const showAccounts = selectedMetric === 'all' || selectedMetric === 'accounts'
    const showDeals = selectedMetric === 'all' || selectedMetric === 'deals'
    const showQuotations = selectedMetric === 'all' || selectedMetric === 'quotations'

    return (
      <div className="deal-perf-tooltip">
        <div className="deal-perf-tooltip-title">{label}</div>
        {showAccounts && (
          <div className="deal-perf-tooltip-row deal-perf-tooltip-row--accounts">
            <span>Accounts:</span>
            <span>{accountsCount}</span>
          </div>
        )}
        {showDeals && (
          <>
            <div className="deal-perf-tooltip-row deal-perf-tooltip-row--won">
              <span>Closed Won:</span>
              <span>{wonCount} {wonVal > 0 ? `(${formatCurrency(wonVal)})` : ''}</span>
            </div>
            <div className="deal-perf-tooltip-row deal-perf-tooltip-row--lost">
              <span>Closed Lost:</span>
              <span>{lostCount} {lostVal > 0 ? `(${formatCurrency(lostVal)})` : ''}</span>
            </div>
            <div className="deal-perf-tooltip-row deal-perf-tooltip-row--rate">
              <span>Deal Win Rate:</span>
              <span>{winRate}%</span>
            </div>
          </>
        )}
        {showQuotations && (
          <div className="deal-perf-tooltip-row deal-perf-tooltip-row--quotations">
            <span>Quotations:</span>
            <span>{quotationsCount}</span>
          </div>
        )}
      </div>
    )
  }
  return null
}

const DealPerformanceCard = ({ userPerformance }) => {
  const [timeframe, setTimeframe] = useState('monthly')
  const [selectedMetric, setSelectedMetric] = useState('all')

  if (!userPerformance) return null

  const {
    ownerName = 'User',
    role = 'Sales',
    isOnline = false,
  } = userPerformance

  const chartData = userPerformance[timeframe] || []

  return (
    <article className="deal-perf-card">
      <div className="deal-perf-header">
        <div className="deal-perf-header-left">
          <div className="deal-perf-meta-row">
            <span className="deal-perf-owner-badge" title="Owner Name">
              <FaUserCheck /> Owner Name: {ownerName}
            </span>
            <span className="deal-perf-role-badge">{role}</span>
            <span className={`deal-perf-presence-badge ${isOnline ? 'deal-perf-presence-badge--online' : 'deal-perf-presence-badge--offline'}`}>
              <span className={`deal-perf-presence-dot ${isOnline ? 'deal-perf-presence-dot--online' : 'deal-perf-presence-dot--offline'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <h3 className="deal-perf-title">Accounts, Deals & Quotations Performance — {ownerName}</h3>
        </div>

        {/* Dual Control Strips: Metric Filters & Timeframe Switcher */}
        <div className="deal-perf-controls-wrap">
          {/* Metric Selector Buttons */}
          <div className="deal-perf-metric-group" role="group" aria-label="Filter performance metric">
            <button
              type="button"
              className={`deal-perf-metric-btn ${selectedMetric === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('all')}
              title="Show All Metrics"
            >
              All
            </button>
            <button
              type="button"
              className={`deal-perf-metric-btn ${selectedMetric === 'accounts' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('accounts')}
              title="Filter by Accounts"
            >
              Accounts
            </button>
            <button
              type="button"
              className={`deal-perf-metric-btn ${selectedMetric === 'deals' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('deals')}
              title="Filter by Deals"
            >
              Deals
            </button>
            <button
              type="button"
              className={`deal-perf-metric-btn ${selectedMetric === 'quotations' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('quotations')}
              title="Filter by Quotations"
            >
              Quotations
            </button>
          </div>

          {/* Daily, Monthly, Yearly Timeframe Toggle Switcher */}
          <div className="deal-perf-timeframe-group" role="group" aria-label="Select timeframe">
            <button
              type="button"
              className={`deal-perf-timeframe-btn ${timeframe === 'daily' ? 'active' : ''}`}
              onClick={() => setTimeframe('daily')}
              title="View Daily Progression (Last 14 Days)"
            >
              <FaCalendarDay /> Daily
            </button>
            <button
              type="button"
              className={`deal-perf-timeframe-btn ${timeframe === 'monthly' ? 'active' : ''}`}
              onClick={() => setTimeframe('monthly')}
              title="View Monthly Progression (Last 12 Months)"
            >
              <FaCalendarAlt /> Monthly
            </button>
            <button
              type="button"
              className={`deal-perf-timeframe-btn ${timeframe === 'yearly' ? 'active' : ''}`}
              onClick={() => setTimeframe('yearly')}
              title="View Yearly Progression"
            >
              <FaCalendar /> Yearly
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-metric Recharts Bar Chart */}
      <div className="deal-perf-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <Tooltip content={<CustomChartTooltip selectedMetric={selectedMetric} />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
            />
            {(selectedMetric === 'all' || selectedMetric === 'accounts') && (
              <Bar
                name="Accounts"
                dataKey="accounts"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            )}
            {(selectedMetric === 'all' || selectedMetric === 'deals') && (
              <>
                <Bar
                  name="Closed Won"
                  dataKey="closedWon"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  name="Closed Lost"
                  dataKey="closedLost"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </>
            )}
            {(selectedMetric === 'all' || selectedMetric === 'quotations') && (
              <Bar
                name="Quotations"
                dataKey="quotations"
                fill="#ea580c"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

export default DealPerformanceCard
