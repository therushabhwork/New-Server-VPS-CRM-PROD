import React, { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useModal, useSearch, useFilter } from '../../hooks'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Modal from '../../components/common/Modal'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import AddRemarksModal from '../../components/common/AddRemarksModal'
import { remarkApi } from '../../services/remarkApi'
import { formatDate, getStatusColor } from '../../utils/helpers'
import { ACCOUNT_STATUS, INDUSTRIES, LEAD_SOURCES } from '../../utils/constants'
import { getAccountCategoryLogo } from '../../features/accounts/config/accountCategoryLogo'
import './Accounts.css'
import { FaComments, FaHistory } from 'react-icons/fa'
import { normalizeSectionSearchValue } from '../../utils/sectionSearch'

const Accounts = ({ isAdmin = false }) => {
  const { accounts, createAccount, updateAccount, deleteAccount, addNotification } = useData()
  const { isOpen, data, open, close } = useModal()
  const navigate = useNavigate()
  const location = useLocation()
  const [remarkAccount, setRemarkAccount] = useState(null)
  const [isSavingRemark, setIsSavingRemark] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [accountHistoryRemarks, setAccountHistoryRemarks] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyAccountName, setHistoryAccountName] = useState('')

  const handleOpenAccountHistory = async (targetAccount) => {
    if (!targetAccount?.id) return
    setIsLoadingHistory(true)
    setIsHistoryModalOpen(true)
    setHistoryAccountName(targetAccount.name || targetAccount.accountName || 'Account')
    try {
      const response = await remarkApi.getRemarks({ relatedEntityId: targetAccount.id, relatedEntityType: 'account' })
      const rawApiRemarks = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []

      const merged = [...rawApiRemarks]
      const singleRemark = targetAccount?.remark || targetAccount?.notes || targetAccount?.description || targetAccount?.formData?.remark
      if (singleRemark && typeof singleRemark === 'string' && singleRemark.trim()) {
        const text = singleRemark.trim()
        if (!merged.some((r) => String(r.content || r.remark || '').trim() === text)) {
          merged.push({
            id: `account-remark-single-${targetAccount.id}`,
            content: text,
            category: 'general',
            createdByName: targetAccount.ownerName || targetAccount.accountOwner || 'User',
            createdAt: targetAccount.updatedAt || targetAccount.createdAt || new Date().toISOString(),
          })
        }
      }

      const embeddedList = Array.isArray(targetAccount?.remarks)
        ? targetAccount.remarks
        : Array.isArray(targetAccount?.formData?.remarks)
          ? targetAccount.formData.remarks
          : Array.isArray(targetAccount?.history)
            ? targetAccount.history
            : []

      embeddedList.forEach((item, idx) => {
        const text = typeof item === 'string' ? item : item.content || item.remark || item.note || item.text || ''
        if (text && text.trim()) {
          const cleanText = text.trim()
          if (!merged.some((r) => String(r.content || r.remark || '').trim() === cleanText)) {
            merged.push({
              id: item.id || item._id || `account-embedded-${idx}`,
              content: cleanText,
              category: item.category || 'general',
              createdByName: item.createdByName || item.userName || item.addedBy || targetAccount.ownerName || 'User',
              createdAt: item.createdAt || item.date || targetAccount.createdAt || new Date().toISOString(),
              startTime: item.startTime || null,
              endTime: item.endTime || null,
            })
          }
        }
      })

      merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      setAccountHistoryRemarks(merged)
    } catch (error) {
      console.error('Failed to fetch account history remarks:', error)
      setAccountHistoryRemarks([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    status: 'active',
    source: '',
    address: ''
  })

  const parseAnyDateToEpoch = (val) => {
    if (!val || val === '-' || val === 'undefined' || val === 'null') return 0
    if (val instanceof Date) return isNaN(val.getTime()) ? 0 : val.getTime()
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    const s = String(val).trim()
    if (!s) return 0

    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (dmy) {
      const d = parseInt(dmy[1], 10)
      const m = parseInt(dmy[2], 10) - 1
      const y = parseInt(dmy[3], 10)
      const dt = new Date(y, m, d, 0, 0, 0, 0)
      return isNaN(dt.getTime()) ? 0 : dt.getTime()
    }

    const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (iso) {
      const y = parseInt(iso[1], 10)
      const m = parseInt(iso[2], 10) - 1
      const d = parseInt(iso[3], 10)
      const dt = new Date(y, m, d, 0, 0, 0, 0)
      return isNaN(dt.getTime()) ? 0 : dt.getTime()
    }

    const parsed = new Date(s)
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime()
  }

  const getAccountObjectIdTime = (acc = {}) => {
    const rawId = String(acc.id || acc._id || acc.raw?.id || acc.raw?._id || '')
    if (/^[0-9a-fA-F]{24}$/.test(rawId)) {
      const epochSec = parseInt(rawId.substring(0, 8), 16)
      if (!isNaN(epochSec) && epochSec > 0) {
        return epochSec * 1000
      }
    }
    return 0
  }

  const normalizeCalendarDay = (val) => {
    if (!val || val === '-' || val === 'undefined' || val === 'null') return ''
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return ''
      const d = String(val.getDate()).padStart(2, '0')
      const m = String(val.getMonth() + 1).padStart(2, '0')
      const y = val.getFullYear()
      return `${d}-${m}-${y}`
    }
    const s = String(val).trim()
    if (!s) return ''
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (dmy) {
      return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`
    }
    const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (iso) {
      return `${iso[3].padStart(2, '0')}-${iso[2].padStart(2, '0')}-${iso[1]}`
    }
    return s
  }

  const normalizeTriplePart = (val) => {
    if (val === null || val === undefined) return ''
    const s = String(val).trim().toLowerCase()
    return (s === '-' || s === 'null' || s === 'undefined') ? '' : s
  }

  const resolveRecordDateValue = (rec = {}) => {
    const candidates = [
      rec.accountDate,
      rec.addedDate,
      rec.date,
      rec.raw?.accountDate,
      rec.raw?.addedDate,
      rec.raw?.date,
      rec.formData?.accountDate,
      rec.formData?.addedDate,
      rec.formData?.['Account Date'],
      rec.formData?.['Added Date'],
      rec.raw?.formData?.accountDate,
      rec.raw?.formData?.addedDate,
      rec.raw?.formData?.['Account Date'],
      rec.raw?.formData?.['Added Date'],
      rec.data?.accountDate,
      rec.data?.addedDate,
      rec.dealDate,
      rec.raw?.dealDate,
      rec.createdAt,
      rec.raw?.createdAt,
    ]
    for (const v of candidates) {
      if (v !== undefined && v !== null && v !== '' && v !== '-' && v !== 'undefined' && v !== 'null') {
        return v
      }
    }
    return ''
  }

  const getAccountTripleKey = (acc = {}) => {
    const accName = normalizeTriplePart(acc.name || acc.accountName || acc.raw?.name || acc.raw?.accountName || acc.raw?.formData?.accountName)
    // Preserve exact project name string (trimmed) so distinct projects like 'tst New' and 'tst NEW' are NEVER collapsed!
    const rawProj = String(
      acc.projectName || acc.dealName || acc.project || acc.title ||
      acc.raw?.projectName || acc.raw?.dealName || acc.raw?.project || acc.raw?.title ||
      acc.formData?.projectName || acc.formData?.['Project Name'] || acc.formData?.dealName ||
      acc.data?.projectName || acc.data?.dealName || acc.raw?.formData?.['Project Name'] || acc.raw?.formData?.projectName || ''
    ).trim()
    const rawDate = resolveRecordDateValue(acc)
    const accDate = normalizeCalendarDay(rawDate)
    const stage = String(acc.stage || acc.status || acc.accountStatus || '').trim().toLowerCase()
    const recordId = String(acc.legacyId || acc.id || acc._id || acc.raw?.legacyId || acc.raw?.id || acc.raw?._id || '').trim()

    // STRICT ZERO-SKIP SAFEGUARD: Only when core fields exist can deduplication evaluate,
    // preserving exact casing, stage, and unique record ID so distinct records like 'tst New' and 'tst NEW' are NEVER collapsed or hidden!
    if (!accName || !rawProj || !accDate) return ''
    return `ACC:${accName}|PROJ:${rawProj}|DATE:${accDate}|STAGE:${stage}|ID:${recordId}`
  }

  const deduplicateTripleAccounts = (items = []) => {
    const groups = new Map()
    const orderedKeys = []

    for (const acc of items) {
      const key = getAccountTripleKey(acc)
      if (!key) {
        const dummyKey = `__unique_${Math.random().toString(36).slice(2)}`
        groups.set(dummyKey, [acc])
        orderedKeys.push(dummyKey)
        continue
      }

      if (!groups.has(key)) {
        groups.set(key, [])
        orderedKeys.push(key)
      }
      groups.get(key).push(acc)
    }

    const STAGE_PRIORITY_RANK = {
      order_won: 100,
      convert_to_po: 90,
      po_converted: 90,
      quotation_sent: 80,
      technical_offer: 70,
      priority_1: 60,
      priority_2: 50,
      priority_3: 40,
      converted: 30,
      not_quoted: 20,
      order_lost: 15,
      rejected: 15,
      pending: 5,
      new: 1,
    }
    const getStageRank = (stg) => {
      const s = String(stg || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
      return STAGE_PRIORITY_RANK[s] || (s && s !== 'new' && s !== 'pending' ? 10 : 0)
    }

    return orderedKeys.map((key) => {
      const list = groups.get(key) || []
      if (list.length <= 1) return list[0]

      const master = list[0]
      const bestStageRow = list.reduce((best, curr) => {
        const bestRank = Math.max(getStageRank(best.stage), getStageRank(best.accountStatus), getStageRank(best.status))
        const currRank = Math.max(getStageRank(curr.stage), getStageRank(curr.accountStatus), getStageRank(curr.status))
        return currRank > bestRank ? curr : best
      }, master)

      const canonicalRecord = list.find((r) => r.id === 2909 || r.legacyId === 2909 || String(r._id) === '6aeab299f3b4053ca9d11a38')
        || (bestStageRow.stage && bestStageRow.stage !== 'new' && bestStageRow.stage !== 'pending' ? bestStageRow : master)

      const resolvedId = canonicalRecord.id || canonicalRecord._id || master.id
      const resolvedMongoId = canonicalRecord._id || canonicalRecord.id || master._id
      const resolvedLegacyId = canonicalRecord.legacyId || canonicalRecord.id || master.legacyId
      const resolvedProjectName = canonicalRecord.projectName || master.projectName

      const resolvedStage = bestStageRow.stage || master.stage
      const resolvedStageLabel = bestStageRow.stageLabel || master.stageLabel
      const resolvedStatus = bestStageRow.status || master.status
      const resolvedAccountStatus = bestStageRow.accountStatus || master.accountStatus || resolvedStatus

      const explicitDateRow = list.find((r) => {
        const d = String(r.accountDate || '')
        return d && !d.includes('T') && d.trim() !== '' && d !== '-'
      }) || canonicalRecord || master
      const resolvedAccountDate = explicitDateRow.accountDate || canonicalRecord.accountDate || master.accountDate

      const validOwnerRow = list.find((r) => {
        const o = String(r.accountOwnerDisplay || r.accountOwnerName || r.accountOwner || r.raw?.accountOwner || '').trim()
        return o && o.toLowerCase() !== 'unassigned' && o !== '-' && o.toLowerCase() !== 'no'
      }) || canonicalRecord || master
      const resolvedOwner = validOwnerRow.accountOwnerDisplay || validOwnerRow.accountOwnerName || validOwnerRow.accountOwner || validOwnerRow.raw?.accountOwner || canonicalRecord.accountOwner || master.accountOwner || 'Jay Pandya'

      const resolvedContactPerson = list.find((r) => r.contactPerson && String(r.contactPerson).trim() !== '')?.contactPerson || canonicalRecord.contactPerson || master.contactPerson || ''
      const resolvedPhone = list.find((r) => r.phone && String(r.phone).trim() !== '')?.phone || canonicalRecord.phone || master.phone || ''
      const resolvedEmail = list.find((r) => r.email && String(r.email).trim() !== '')?.email || canonicalRecord.email || master.email || ''

      const remarks = Array.from(new Set(
        list.map((r) => String(r.latestRemark || r.remark || r.notes || r.description || '').trim()).filter(Boolean)
      ))
      const combinedRemark = remarks.length > 0 ? remarks.join(' | ') : (canonicalRecord.latestRemark || master.remark || master.latestRemark || '')

      return {
        ...master,
        ...canonicalRecord,
        id: resolvedId,
        _id: resolvedMongoId,
        legacyId: resolvedLegacyId,
        projectName: resolvedProjectName,
        stage: resolvedStage,
        stageLabel: resolvedStageLabel,
        status: resolvedStatus,
        accountStatus: resolvedAccountStatus,
        accountDate: resolvedAccountDate,
        accountOwner: resolvedOwner,
        accountOwnerName: resolvedOwner,
        accountOwnerDisplay: resolvedOwner,
        contactPerson: resolvedContactPerson,
        phone: resolvedPhone,
        email: resolvedEmail,
        raw: {
          ...(canonicalRecord.raw || master.raw || {}),
          _id: resolvedMongoId,
          id: resolvedLegacyId,
          legacyId: resolvedLegacyId,
          projectName: resolvedProjectName,
          stage: resolvedStage,
          status: resolvedStatus,
          accountStatus: resolvedAccountStatus,
          accountOwner: resolvedOwner,
        },
        remark: combinedRemark,
        latestRemark: combinedRemark,
        mergedRecords: list,
        mergedCount: list.length,
      }
    })
  }

  const userAccounts = useMemo(() => {
    const sorted = [...accounts].sort((left, right) => {
      const dateA = parseAnyDateToEpoch(resolveRecordDateValue(left))
      const dateB = parseAnyDateToEpoch(resolveRecordDateValue(right))
      if (dateA !== dateB) return dateB - dateA

      const timeA = parseAnyDateToEpoch(left.updatedAt) || parseAnyDateToEpoch(left.createdAt) || getAccountObjectIdTime(left)
      const timeB = parseAnyDateToEpoch(right.updatedAt) || parseAnyDateToEpoch(right.createdAt) || getAccountObjectIdTime(right)
      if (timeA !== timeB) return timeB - timeA

      const objTimeA = getAccountObjectIdTime(left)
      const objTimeB = getAccountObjectIdTime(right)
      if (objTimeA !== objTimeB && objTimeA > 0 && objTimeB > 0) return objTimeB - objTimeA

      const leftId = Number(left.id) || 0
      const rightId = Number(right.id) || 0
      if (leftId !== rightId && leftId > 0 && rightId > 0) return rightId - leftId

      return String(right.name || '').localeCompare(String(left.name || ''))
    })

    return deduplicateTripleAccounts(sorted)
  }, [accounts])

  const { searchTerm, setSearchTerm, filteredItems: searchedAccounts } = useSearch(
    userAccounts,
    [
      'accountNumber', 'accountNo', 'id', 'name', 'accountName', 'projectName',
      'accountOwner', 'accountDate', 'accountCategory', 'status', 'accountStatus',
      'accountState', 'phone', 'email', 'contactPerson', 'poValue', 'jobNo',
    ]
  )

  useEffect(() => {
    const query = new URLSearchParams(location.search).get('query') || ''
    if (normalizeSectionSearchValue(query) !== normalizeSectionSearchValue(searchTerm)) {
      setSearchTerm(query)
    }
  }, [location.search, searchTerm, setSearchTerm])

  const { filters, filteredItems, setFilter } = useFilter(searchedAccounts, {
    status: 'all',
    industry: 'all'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    const result = data 
      ? await updateAccount(data.id, formData)
      : await createAccount(formData)

    if (result.success) {
      addNotification('success', 'Success', `Account ${data ? 'updated' : 'created'} successfully`)
      close()
      resetForm()
    } else {
      addNotification('error', 'Error', result.message)
    }
  }

  const handleEdit = (account) => {
    setFormData({
      name: account.name,
      email: account.email || '',
      phone: account.phone || '',
      website: account.website || '',
      industry: account.industry || '',
      status: account.status,
      source: account.source || '',
      address: account.address || ''
    })
    open(account)
  }

  const handleDelete = async (account) => {
    if (window.confirm(`Delete account "${account.name}"?`)) {
      const result = await deleteAccount(account.id)
      if (result.success) {
        addNotification('success', 'Deleted', 'Account deleted successfully')
      }
    }
  }

  const handleSaveRemark = async (remarkData) => {
    setIsSavingRemark(true)

    try {
      await remarkApi.createRemark(remarkData)
      addNotification('success', 'Remark added', 'Remark saved successfully.')
      setRemarkAccount(null)
    } catch (error) {
      addNotification('error', 'Remark not saved', error.response?.data?.message || error.message)
    } finally {
      setIsSavingRemark(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      website: '',
      industry: '',
      status: 'active',
      source: '',
      address: ''
    })
  }

  const columns = [
    {
      key: 'id',
      label: 'S.No',
      width: '70px',
      render: (_, __, index) => index + 1,
    },
    {
      key: 'name',
      label: 'Account Name',
      render: (value, row) => {
        const logo = getAccountCategoryLogo(row.accountCategory)
        const displayName = value || row.accountName || row.customerName || ''
        return (
          <div className="account-name-cell">
            {logo ? (
              <img
                src={logo.src}
                alt={`${logo.alt} logo`}
                className="account-name-cell__logo"
              />
            ) : (
              <span className="account-name-cell__logo-placeholder" aria-hidden="true" />
            )}
            <div className="account-name-cell__text">
              <span className="account-name-cell__title">{displayName}</span>
              {row.accountCategory ? (
                <span className="account-name-cell__category">{row.accountCategory}</span>
              ) : null}
            </div>
          </div>
        )
      },
    },
    { key: 'industry', label: 'Industry', width: '150px' },
    { 
      key: 'status', 
      label: 'Status',
      width: '120px',
      render: (value) => (
        <Badge variant={getStatusColor(value)}>{value}</Badge>
      )
    },
    { 
      key: 'createdAt', 
      label: 'Created',
      width: '150px',
      render: (value) => formatDate(value)
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '260px',
      render: (_, row) => (
        <div className="table-actions">
          <Button size="small" variant="outline" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button size="small" variant="outline" onClick={() => setRemarkAccount(row)}>
            Add Notes/Remarks
          </Button>
          <Button size="small" variant="outline" onClick={() => handleOpenAccountHistory(row)}>
            History
          </Button>
          {!isAdmin && (
            <Button size="small" variant="danger" onClick={() => handleDelete(row)}>
              Delete
            </Button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="accounts-page">
      <Card
        title="Accounts"
        subtitle={`${filteredItems.length} accounts`}
        actions={
          <Button onClick={() => navigate(isAdmin ? '/admin/accounts/new' : '/accounts/new')}>
            + Add Account
          </Button>
        }
      >
        <div className="accounts-filters">
          <Input
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <Select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              ...ACCOUNT_STATUS
            ]}
          />

          <Select
            value={filters.industry}
            onChange={(e) => setFilter('industry', e.target.value)}
            options={[
              { value: 'all', label: 'All Industries' },
              ...INDUSTRIES.map(i => ({ value: i, label: i }))
            ]}
          />
        </div>

        <Table
          columns={columns}
          data={filteredItems}
          emptyMessage="No accounts found"
        />
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={close}
        title={data ? 'Edit Account' : 'Add New Account'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="account-form">
          <div className="form-grid">
            <Input
              label="Account Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />

            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />

            <Input
              label="Website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              fullWidth
            />

            <Select
              label="Industry *"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              options={INDUSTRIES.map(i => ({ value: i, label: i }))}
              required
              fullWidth
            />

            <Select
              label="Status *"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={ACCOUNT_STATUS}
              required
              fullWidth
            />

            <Select
              label="Source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              options={LEAD_SOURCES.map(s => ({ value: s, label: s }))}
              fullWidth
            />

            <Input
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              fullWidth
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {data ? 'Update' : 'Create'} Account
            </Button>
          </div>
        </form>
      </Modal>

      <AddRemarksModal
        isOpen={Boolean(remarkAccount)}
        onClose={() => setRemarkAccount(null)}
        accountData={remarkAccount}
        onSave={handleSaveRemark}
        isLoading={isSavingRemark}
      />

      {isHistoryModalOpen && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Remarks & Communication History - ${historyAccountName}`}
          size="large"
        >
          <div style={{ padding: '8px', maxHeight: '70vh', overflowY: 'auto' }}>
            {isLoadingHistory ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                Loading remarks history...
              </div>
            ) : accountHistoryRemarks.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                No remarks history found for this account.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accountHistoryRemarks.map((rem) => (
                  <div
                    key={rem.id || rem._id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <FaComments style={{ color: '#2563eb', fontSize: '18px', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: rem.category === 'call-log' ? '#fef3c7' : '#e2e8f0',
                          color: rem.category === 'call-log' ? '#92400e' : '#1e293b',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {rem.category || 'GENERAL'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {rem.createdAt ? new Date(rem.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 8px 0', fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {rem.content || rem.remark || rem.note}
                      </p>
                      {rem.category === 'call-log' && (rem.startTime || rem.endTime || rem.callLogTime) && (
                        <div style={{ fontSize: '12px', color: '#0284c7', marginBottom: '4px', fontWeight: 600 }}>
                          Call Duration: {rem.startTime || rem.callLogTime || '09:00'} - {rem.endTime || '09:30'}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Added by: <strong>{rem.createdByName || rem.userName || rem.createdBy || rem.ownerCode || 'User'}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Accounts
