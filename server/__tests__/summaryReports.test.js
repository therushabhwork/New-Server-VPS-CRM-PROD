describe('Admin Summary Reports & Normalization Logic', () => {
  const normalizeLabel = (val) => String(val || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ')

  const computeMatchesPeriod = (rawDate, period, customStart, customEnd) => {
    if (period === 'All Time') return true
    if (!rawDate) return false
    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime())) return false

    const now = new Date()
    if (period === 'Daily' || period === 'Today') {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      )
    }
    if (period === 'Yearly' || period === 'This Year') {
      return date.getFullYear() === now.getFullYear()
    }
    if (period === 'Custom' || period === 'Custom Date Range') {
      if (!customStart || !customEnd) return true
      const start = new Date(customStart)
      start.setHours(0, 0, 0, 0)
      const end = new Date(customEnd)
      end.setHours(23, 59, 59, 999)
      return date >= start && date <= end
    }
    // Default Monthly
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    )
  }

  test('Daily period matches today and rejects past/future dates', () => {
    const today = new Date().toISOString()
    const yesterday = new Date(Date.now() - 86400000 * 2).toISOString()

    expect(computeMatchesPeriod(today, 'Daily')).toBe(true)
    expect(computeMatchesPeriod(yesterday, 'Daily')).toBe(false)
  })

  test('Monthly period matches dates in current month', () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5).toISOString()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 2, 5).toISOString()

    expect(computeMatchesPeriod(thisMonth, 'Monthly')).toBe(true)
    expect(computeMatchesPeriod(lastMonth, 'Monthly')).toBe(false)
  })

  test('Custom date range matches within inclusive boundaries', () => {
    const customStart = '2026-10-01'
    const customEnd = '2026-10-15'

    expect(computeMatchesPeriod('2026-10-05T10:00:00', 'Custom', customStart, customEnd)).toBe(true)
    expect(computeMatchesPeriod('2026-10-20T10:00:00', 'Custom', customStart, customEnd)).toBe(false)
    expect(computeMatchesPeriod('2026-09-25T10:00:00', 'Custom', customStart, customEnd)).toBe(false)
  })

  test('Deduplication by record id ensures no repeated records', () => {
    const records = [
      { id: 'rec-1', name: 'Alpha', accountOwner: 'Atish Shah', stage: 'new' },
      { id: 'rec-1', name: 'Alpha Duplicate', accountOwner: 'Atish Shah', stage: 'new' },
      { id: 'rec-2', name: 'Beta', accountOwner: 'Jay Pandya', stage: 'converted' },
    ]

    const seen = new Set()
    const deduplicated = records.filter((r) => {
      const id = r.id || r._id
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })

    expect(deduplicated).toHaveLength(2)
    expect(deduplicated.map((r) => r.id)).toEqual(['rec-1', 'rec-2'])
  })

  test('Owner matrix row totals and grand totals reconcile perfectly', () => {
    const activeStatuses = ['New', 'Follow-up', 'Converted']
    const owners = ['Atish Shah', 'Keval V Shah']

    const matrixRows = owners.map((ownerName) => ({
      ownerName,
      counts: { New: 0, 'Follow-up': 0, Converted: 0 },
      total: 0,
    }))

    // Simulate records
    const records = [
      { ownerName: 'Atish Shah', status: 'New' },
      { ownerName: 'Atish Shah', status: 'Follow-up' },
      { ownerName: 'Keval V Shah', status: 'Converted' },
      { ownerName: 'Keval V Shah', status: 'New' },
      { ownerName: 'Keval V Shah', status: 'New' },
    ]

    records.forEach((rec) => {
      const row = matrixRows.find((r) => r.ownerName === rec.ownerName)
      if (row && row.counts[rec.status] !== undefined) {
        row.counts[rec.status] += 1
        row.total += 1
      }
    })

    const grandTotalCounts = activeStatuses.reduce((lookup, status) => {
      lookup[status] = matrixRows.reduce((sum, row) => sum + row.counts[status], 0)
      return lookup
    }, {})
    const grandTotalAll = matrixRows.reduce((sum, row) => sum + row.total, 0)

    expect(matrixRows[0].total).toBe(2)
    expect(matrixRows[1].total).toBe(3)
    expect(grandTotalCounts.New).toBe(3)
    expect(grandTotalCounts['Follow-up']).toBe(1)
    expect(grandTotalCounts.Converted).toBe(1)
    expect(grandTotalAll).toBe(5)
    expect(records.length).toBe(grandTotalAll)
  })
})
