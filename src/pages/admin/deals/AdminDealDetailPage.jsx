import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FaBell,
  FaCalendarAlt,
  FaComments,
  FaEnvelope,
  FaExchangeAlt,
  FaFileAlt,
  FaFileUpload,
  FaHistory,
  FaMapMarkerAlt,
  FaPhone,
  FaTimes,
  FaUser,
  FaUserCog,
  FaInfoCircle,
  FaBuilding,
  FaClock,
  FaSyncAlt,
  FaCommentDots,
} from 'react-icons/fa'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AddReminderModal from '../../../components/common/AddReminderModal'
import AddRemarksModal from '../../../components/common/AddRemarksModal'
import Button from '../../../components/common/Button'
import Modal from '../../../components/common/Modal'
import Quotations from '../../quotations/Quotations'
import { useAuth } from '../../../context/AuthContext'
import { useData } from '../../../context/DataContext'
import { buildAdminManageDealUrl } from '../../../features/adminDeals/config/adminDealViews'
import { buildCrmDealActionUrl } from '../crm-actions/CRMActionPage'
import { authService } from '../../../services/authService'
import { customerService } from '../../../services/customerService'
import { remarkApi } from '../../../services/remarkApi'
import { getCrmOwnerDisplay } from '../../../features/users/crmUserDirectory'
import {
  ACCOUNT_CHANGE_STATUS_OPTIONS,
  getAccountChangeStatusOption,
} from '../../../features/adminAccounts/config/accountStages'
import {
  ACCOUNT_CATEGORY_OPTIONS,
  ACCOUNT_SOURCE_OPTIONS,
} from '../../../features/accounts/config/accountDropdownOptions'
import {
  CUSTOMER_QUOTATION_STATUS_OPTIONS,
  DEAL_LIFECYCLE_STATUS_OPTIONS,
} from '../../../features/adminDeals/config/dealUtils'
import { formatCurrency, formatDate, formatNumber } from '../../../utils/helpers'

import DealHeader from './components/DealHeader'
import DealSummaryStrip from './components/DealSummaryStrip'
import DealStageTimeline from './components/DealStageTimeline'
import InfoCard from './components/InfoCard'
import InfoFieldItem from './components/InfoFieldItem'
import DealQuickActionsCard from './components/DealQuickActionsCard'
import DealActivityUpdatesCard from './components/DealActivityUpdatesCard'

import './AdminDealDetailPage.css'

const normalizeSearchValue = (value) => String(value || '').trim().toLowerCase()

const DEAL_TYPE_OPTIONS = [
  { value: 'LUMOS', label: 'LUMOS' },
  { value: 'SWATI', label: 'SWATI' },
  { value: 'PURCHASE ENQUIRY', label: 'PURCHASE ENQUIRY' },
  { value: 'TENDER ENQUIRY', label: 'TENDER ENQUIRY' },
]

const DEAL_SOURCE_SELECT_OPTIONS = DEAL_TYPE_OPTIONS
const DEAL_SUBSOURCE_SELECT_OPTIONS = ACCOUNT_SOURCE_OPTIONS
const PRODUCT_CATEGORY_SELECT_OPTIONS = ACCOUNT_CATEGORY_OPTIONS

const MANAGE_DEAL_LIFECYCLE_STATUS_OPTIONS = DEAL_LIFECYCLE_STATUS_OPTIONS.map((option) => ({
  ...option,
  label: option.value === 'Convert To PO' ? 'PO Converted' : option.label,
}))

const HIDDEN_MANAGE_DEAL_STATUS_VALUES = new Set(['converted', 'closed', 'contacted', 'order_lost'])
const STATUS_OPTIONS = ACCOUNT_CHANGE_STATUS_OPTIONS.filter((option) => (
  !HIDDEN_MANAGE_DEAL_STATUS_VALUES.has(option.value)
)).map((option) => ({
  ...option,
  label: option.value === 'convert_to_po' ? 'PO Converted' : option.label,
}))

const toDateInputValue = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

const clampProbability = (value) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.max(0, Math.min(100, numericValue))
}

const calculateAging = (dateString) => {
  if (!dateString) return 'Not Available'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Not Available'
  const now = new Date()
  const diffTime = Math.max(0, now - date)
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`
  }
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'}`
  }
  const diffYears = Math.floor(diffDays / 365)
  return `${diffYears} year${diffYears === 1 ? '' : 's'}`
}

const buildNormalizedDeal = ({ deal, accounts, customers, users, currentUser }) => {
  if (!deal) return null

  const userDirectory = users.reduce((lookup, entry) => {
    lookup[String(entry.id)] = entry.name
    return lookup
  }, {})

  const accountDirectory = accounts.reduce((lookup, account) => {
    if (account?.id) {
      lookup[String(account.id)] = account
    }
    return lookup
  }, {})

  const accountNameDirectory = accounts.reduce((lookup, account) => {
    const normalizedName = normalizeSearchValue(account?.name || account?.accountName || account?.customerName || '')
    if (normalizedName && !lookup[normalizedName]) {
      lookup[normalizedName] = account
    }
    return lookup
  }, {})

  const customerDirectory = customers.reduce((lookup, customer) => {
    if (customer?.id) {
      lookup[String(customer.id)] = customer
    }
    return lookup
  }, {})

  const linkedAccount = (
    accountDirectory[String(deal.accountId || deal.customerId || '')]
    || accountNameDirectory[normalizeSearchValue(deal.accountName || deal.companyName || deal.customerName || '')]
    || null
  )
  const linkedCustomer = customerDirectory[String(deal.customerId || '')] || null
  const ownerUserId = String(
    deal.ownerUserId
    || deal.ownerId
    || deal.assignedTo
    || deal.assignedUserId
    || deal.userId
    || ''
  )
  const ownerName = (
    deal.dealOwnerName
    || deal.dealOwner
    || deal.ownerName
    || deal.assignedUserName
    || userDirectory[ownerUserId]
    || currentUser?.name
    || 'Unassigned'
  )

  return {
    ...deal,
    id: deal.id,
    linkedAccountId: String(linkedAccount?.id || deal.accountId || ''),
    linkedAccountName: linkedAccount?.name || linkedAccount?.accountName || deal.linkedAccountName || deal.accountName || deal.customerName || deal.data?.linkedAccountName || deal.data?.accountName || deal.data?.customerName || deal.data?.data?.linkedAccountName || deal.data?.data?.accountName || deal.data?.data?.customerName || '',
    dealNumber: deal.dealNumber || '',
    dealName: deal.name || deal.dealName || deal.title || '',
    dealDate: deal.dealDate || deal.createdAt || '',
    dealValue: Number(deal.value || 0),
    dealScore: deal.dealScore,
    probability: Number(deal.probability || 0),
    addedBy: deal.createdBy || ownerName,
    lastUpdated: deal.updatedAt || deal.createdAt || '',
    customerName: deal.customerName || deal.linkedAccountName || deal.accountName || linkedCustomer?.customerName || linkedAccount?.customerName || linkedAccount?.name || '',
    customerNumber: deal.customerNumber || linkedCustomer?.customerNumber || linkedAccount?.accountNumber || '',
    dealType: deal.dealType || deal.customerCategory || linkedAccount?.accountCategory || deal.stage || '',
    dealStatus: deal.status || '',
    dealOwner: deal.dealOwnerDisplay || getCrmOwnerDisplay(ownerName) || ownerName,
    dealSource: deal.dealSource || deal.source || linkedAccount?.accountOwner || '',
    dealSubsource: deal.dealSubsource || deal.subsource || '',
    contactName: deal.contactPerson || linkedAccount?.contactPerson || '',
    phone: deal.contactMobile || deal.contactPhone || linkedAccount?.contactMobile || linkedAccount?.contactPhone || linkedAccount?.phone || '',
    email: deal.contactEmail || linkedAccount?.contactEmail || linkedAccount?.email || '',
    address: deal.address || linkedAccount?.address || linkedCustomer?.address || '',
    description: deal.description || deal.remark || '',
    poValue: deal.poValue,
    customerReferenceDate: deal.customerReferenceDate || '',
    productCategory: deal.productCategory || deal.customerCategory || linkedAccount?.accountCategory || '',
    customerReferenceNumber: deal.customerReferenceNumber || '',
    consultantName: deal.consultantName || linkedAccount?.consultantName || '',
    gstin: deal.gstin || linkedAccount?.gstin || '',
    projectName: deal.projectName || linkedAccount?.projectName || '',
    orderCustomerStatus: deal.orderCustomerStatus || '',
    jobNo: deal.jobNo || linkedAccount?.jobNo || '',
    quotationCustomerStatus: deal.quotationCustomerStatus || '',
    expectedClosureDate: deal.expectedClosureDate || deal.closeDate || '',
    actualClosureDate: deal.actualClosureDate || '',
  }
}

const AdminDealDetailPage = () => {
  const { dealId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { deals, convertedDeals, accounts, addNotification, updateDeal, updateAccount, reminders, updateReminder, deleteReminder } = useData()
  const { user } = useAuth()
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false)
  const [isReminderOpen, setIsReminderOpen] = useState(false)
  const [isRemarksOpen, setIsRemarksOpen] = useState(false)
  const [isSavingRemark, setIsSavingRemark] = useState(false)
  const [probabilityDraft, setProbabilityDraft] = useState(0)
  const [isSavingProbability, setIsSavingProbability] = useState(false)

  const [editingFieldKey, setEditingFieldKey] = useState('')
  const [editValue, setEditValue] = useState('')
  const [isSavingField, setIsSavingField] = useState(false)
  const [inlineQuotationDeal, setInlineQuotationDeal] = useState(null)
  const [isDealHistoryModalOpen, setIsDealHistoryModalOpen] = useState(false)
  const [dealHistoryRemarks, setDealHistoryRemarks] = useState([])
  const [isLoadingDealHistory, setIsLoadingDealHistory] = useState(false)
  const setIsLoadingHistory = setIsLoadingDealHistory
  const [historyModalTitle, setHistoryModalTitle] = useState('')

  const availableUsers = useMemo(
    () => authService.getAvailableUsers().filter((entry) => entry.name !== 'System Administrator'),
    []
  )
  const customers = useMemo(() => customerService.getCustomers(), [])
  const sourceDeal = useMemo(() => {
    const foundInDeals = deals.find((entry) => (
      String(entry.id) === String(dealId)
      || String(entry.sourceDealId) === String(dealId)
      || String(entry.dealId) === String(dealId)
    ))
    if (foundInDeals) return foundInDeals

    const foundInConverted = (convertedDeals || []).find((entry) => (
      String(entry.id) === String(dealId)
      || String(entry.sourceDealId) === String(dealId)
      || String(entry.dealId) === String(dealId)
    ))
    if (foundInConverted) return foundInConverted

    const stateDeal = location.state?.dealSnapshot
    if (stateDeal && (
      String(stateDeal.id) === String(dealId)
      || String(stateDeal.sourceDealId) === String(dealId)
      || String(stateDeal.dealId) === String(dealId)
    )) {
      return stateDeal
    }

    return null
  }, [dealId, deals, convertedDeals, location.state])

  const deal = useMemo(
    () => buildNormalizedDeal({
      deal: sourceDeal,
      accounts,
      customers,
      users: availableUsers,
      currentUser: user,
    }),
    [accounts, availableUsers, customers, sourceDeal, user]
  )

  useEffect(() => {
    setProbabilityDraft(clampProbability(deal?.probability || 0))
  }, [deal?.id, deal?.probability])

  const fromPath = location.state?.fromPath || (user?.role === 'admin' ? '/admin/deals/view' : '/deals/view')

  const handleClose = () => {
    navigate(fromPath)
  }

  const handleOpenDealActionPage = (actionKey) => {
    if (!deal?.id) return
    const routeActionUrl = user?.role === 'admin' 
      ? buildCrmDealActionUrl(actionKey, deal.id, fromPath) 
      : `/crm-actions/${actionKey}?module=deal&dealId=${deal.id}&returnTo=${encodeURIComponent(fromPath)}`
    navigate(routeActionUrl)
  }

  const handleSendMail = () => handleOpenDealActionPage('send-mail')
  const handleUploadQuotation = () => handleOpenDealActionPage('upload-deal-quotation')
  const handleReassignDeal = () => handleOpenDealActionPage('re-assign-deal')

  const handleGenerateQuotation = () => {
    if (!deal) return
    const targetDeal = sourceDeal || deal
    const isAdminPortal = window.location.pathname.startsWith('/admin')
    navigate(isAdminPortal ? '/admin/quotations' : '/quotations', {
      state: {
        openGenerator: true,
        preselectedDeal: targetDeal,
        activeTab: 'deal',
        quotationContext: 'deal',
      },
    })
  }

  const handleSavedReminder = async (reminderData) => {
    await updateDeal(deal.sourceDealId || deal.source_deal_id || deal.id, {
      reminderDate: reminderData.reminderDate,
      reminderTime: reminderData.reminderTime,
      reminderMode: reminderData.reminderMode,
      reminderNote: reminderData.note.trim(),
    })
    setIsReminderOpen(false)
  }

  const [isChangeTypeOpen, setIsChangeTypeOpen] = useState(false)
  const [changeTypeValue, setChangeTypeValue] = useState('')

  const handleOpenChangeType = () => {
    if (!deal) return
    setChangeTypeValue(deal.dealType || '')
    setIsChangeTypeOpen(true)
  }

  const handleCloseChangeType = () => {
    setIsChangeTypeOpen(false)
    setChangeTypeValue('')
  }

  const handleSaveDealType = async (event) => {
    event.preventDefault()
    if (!deal?.id) return

    const nextDealType = String(changeTypeValue || '').trim()
    if (!nextDealType) {
      addNotification('error', 'Change Type', 'Please select a deal type.')
      return
    }

    setIsSavingProbability(true)
    const result = await updateDeal(deal.sourceDealId || deal.source_deal_id || deal.id, {
      dealType: nextDealType,
      customerCategory: nextDealType,
      updatedAt: new Date().toISOString(),
    })
    setIsSavingProbability(false)

    if (!result.success) {
      addNotification('error', 'Change Type', result.message || 'Unable to change deal type.')
      return
    }

    handleCloseChangeType()
    addNotification('success', 'Change Type', `Deal type changed to ${nextDealType}.`)
  }

  const fetchDealRemarks = useCallback(async () => {
    const targetDealId = deal?.sourceDealId || deal?.source_deal_id || deal?.dealId || deal?.id
    if (!targetDealId) return
    setIsLoadingDealHistory(true)
    try {
      const response = await remarkApi.getRemarks({ relatedEntityId: targetDealId, relatedEntityType: 'deal' })
      const rawApiRemarks = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []

      const merged = [...rawApiRemarks]
      const singleRemark = deal.remark || deal.notes || deal.description || deal.data?.remark
      if (singleRemark && typeof singleRemark === 'string' && singleRemark.trim()) {
        const text = singleRemark.trim()
        if (!merged.some((r) => String(r.content || r.remark || '').trim() === text)) {
          merged.push({
            id: `deal-remark-single-${targetDealId}`,
            content: text,
            category: 'general',
            createdByName: deal.addedBy || deal.dealOwner || deal.ownerName || 'User',
            createdAt: deal.lastUpdated || deal.dealDate || deal.createdAt || new Date().toISOString(),
          })
        }
      }

      const embeddedList = Array.isArray(deal.remarks)
        ? deal.remarks
        : Array.isArray(deal.data?.remarks)
          ? deal.data.remarks
          : Array.isArray(deal.history)
            ? deal.history
            : []

      embeddedList.forEach((item, idx) => {
        const text = typeof item === 'string' ? item : item.content || item.remark || item.note || item.text || ''
        if (text && text.trim()) {
          const cleanText = text.trim()
          if (!merged.some((r) => String(r.content || r.remark || '').trim() === cleanText)) {
            merged.push({
              id: item.id || item._id || `deal-embedded-${idx}`,
              content: cleanText,
              category: item.category || 'general',
              createdByName: item.createdByName || item.userName || item.addedBy || deal.dealOwner || 'User',
              createdAt: item.createdAt || item.date || deal.createdAt || new Date().toISOString(),
              startTime: item.startTime || null,
              endTime: item.endTime || null,
            })
          }
        }
      })

      merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      setDealHistoryRemarks(merged)
    } catch (error) {
      console.error('Failed to fetch deal history remarks:', error)
    } finally {
      setIsLoadingDealHistory(false)
    }
  }, [deal])

  useEffect(() => {
    if (deal?.id) {
      fetchDealRemarks()
    }
  }, [deal?.id, fetchDealRemarks])

  const dealReminders = useMemo(() => {
    const dId = String(deal?.id || deal?.sourceDealId || deal?.dealId || '')
    const dName = String(deal?.dealName || deal?.projectName || '').toLowerCase().trim()
    if (!dId && !dName) return []
    return (Array.isArray(reminders) ? reminders : [])
      .filter((r) => {
        const matchesId = (r.dealId && String(r.dealId) === dId) || (r.relatedEntityId && String(r.relatedEntityId) === dId)
        const matchesEntity = String(r.relatedEntityType || '').toLowerCase() === 'deal' && String(r.relatedEntityId || '') === dId
        const matchesName = dName && (
          (r.dealName && String(r.dealName).toLowerCase().trim() === dName) ||
          (r.contextLabel && String(r.contextLabel).toLowerCase().includes(dName))
        )
        return matchesId || matchesEntity || matchesName
      })
  }, [deal?.id, deal?.sourceDealId, deal?.dealId, deal?.dealName, deal?.projectName, reminders])

  const handleSaveRemark = async (remarkData) => {
    setIsSavingRemark(true)
    try {
      const targetDealId = deal.sourceDealId || deal.source_deal_id || deal.dealId || deal.id
      const payload = {
        ...remarkData,
        relatedEntityId: targetDealId,
        relatedEntityType: 'deal',
        accountId: deal.linkedAccountId || deal.accountId,
        dealId: targetDealId,
      }
      await remarkApi.createRemark(payload)

      // Also update latestRemark and remark in MongoDB deals and leads collections
      const remarkText = remarkData.content || remarkData.remark || ''
      if (remarkText) {
        await updateDeal(targetDealId, { latestRemark: remarkText, remark: remarkText })
        if (deal.linkedAccountId && updateAccount) {
          try {
            await updateAccount(deal.linkedAccountId, { latestRemark: remarkText, remark: remarkText })
          } catch (err) {
            console.warn('Sync remark to account error:', err)
          }
        }
      }

      addNotification('success', 'Remark added', 'Remark saved successfully in MongoDB.')
      setIsRemarksOpen(false)
      fetchDealRemarks()
    } catch (error) {
      addNotification('error', 'Remark not saved', error.response?.data?.message || error.message)
    } finally {
      setIsSavingRemark(false)
    }
  }

  const handleSaveRemarkField = async (fieldKey, value) => {
    const targetDealId = deal.sourceDealId || deal.source_deal_id || deal.dealId || deal.id
    const result = await updateDeal(targetDealId, { [fieldKey]: value })
    if (deal.linkedAccountId && updateAccount) {
      try {
        await updateAccount(deal.linkedAccountId, { [fieldKey]: value })
      } catch (err) {
        console.warn('Sync field error:', err)
      }
    }
    if (!result.success) {
      addNotification('error', 'Update Failed', result.message || 'Unable to update deal field.')
      throw new Error(result.message)
    }
    addNotification('success', 'Deal Updated', 'Field saved successfully in MongoDB.')
    return result
  }

  const handleQuickAction = (actionKey, item) => {
    if (actionKey === 'email') {
      handleSendMail()
    } else if (actionKey === 'callLog') {
      setIsRemarksOpen(true)
    } else if (actionKey === 'whatsapp') {
      const phoneClean = String(deal.phone || '').replace(/[^0-9]/g, '')
      if (phoneClean) {
        window.open(`https://wa.me/${phoneClean}`, '_blank', 'noopener,noreferrer')
      } else {
        addNotification('info', 'WhatsApp', 'No contact phone number available for this deal.')
      }
    } else if (actionKey === 'add-note-remarks') {
      setIsRemarksOpen(true)
    } else if (actionKey === 'add-reminder') {
      setIsReminderOpen(true)
    } else if (actionKey === 'change-status' || actionKey === 'converted-deal') {
      handleOpenDealActionPage('change-status')
    } else if (actionKey === 'add-document') {
      handleUploadQuotation()
    } else if (actionKey === 'acknowledge') {
      if (item?.id && updateReminder) {
        updateReminder(item.id, { isActivated: true, status: 'activated', activatedAt: new Date().toISOString() })
          .then(() => addNotification('success', 'Reminder Acknowledged', 'Reminder marked as reviewed.'))
          .catch((err) => console.error(err))
      }
    }
  }

  const handleViewQuotation = () => {
    const basePath = location.pathname.startsWith('/admin') ? '/admin/quotation-manager/view' : '/quotation-manager/view'
    const query = new URLSearchParams({
      tab: 'deals',
      accountId: deal.accountId || deal.id || '',
      accountName: deal.accountName || deal.linkedAccountName || deal.customerName || deal.data?.accountName || deal.data?.linkedAccountName || deal.data?.data?.accountName || '',
      accountNo: deal.accountNumber || deal.dealNumber || '',
    })
    navigate(`${basePath}?${query.toString()}`)
  }

  const actionsMenuItems = [
    { key: 'reminder', label: 'Add Reminder', icon: <FaBell />, accent: 'orange', onSelect: () => setIsReminderOpen(true) },
    { key: 'generateQuotation', label: 'Generate Quotation', icon: <FaFileAlt />, accent: 'green', onSelect: handleGenerateQuotation },
    { key: 'addRemarks', label: 'Add Notes/Remarks', icon: <FaCommentDots />, accent: 'purple', onSelect: () => setIsRemarksOpen(true) },
    { key: 'changeStatus', label: 'Change Status', icon: <FaSyncAlt />, accent: 'red', onSelect: () => handleOpenDealActionPage('change-status') },
    { key: 'viewQuotation', label: 'View Quotation', icon: <FaFileAlt />, accent: 'red', onSelect: handleViewQuotation },
    { key: 'uploadQuotation', label: 'Upload Quotation', icon: <FaFileUpload />, accent: 'red', onSelect: handleUploadQuotation },
    { key: 'changeType', label: 'Change Type', icon: <FaExchangeAlt />, accent: 'green', onSelect: handleOpenChangeType },
    { key: 'reassign', label: 'Re-Assign Deal', icon: <FaUserCog />, accent: 'slate', onSelect: handleReassignDeal },
    { key: 'sendMail', label: 'Send Mail', icon: <FaEnvelope />, accent: 'red', onSelect: handleSendMail },
  ]

  const handleActionsItemClick = (item) => {
    setIsActionsMenuOpen(false)
    item.onSelect()
  }

  const handleOpenDealHistory = async () => {
    const targetDealId = deal?.sourceDealId || deal?.source_deal_id || deal?.dealId || deal?.id
    if (!targetDealId) return
    setIsLoadingDealHistory(true)
    setIsDealHistoryModalOpen(true)
    setHistoryModalTitle(`Remarks & Communication History - ${deal.dealName || deal.projectName || 'Deal'}`)
    try {
      const response = await remarkApi.getRemarks({ relatedEntityId: targetDealId, relatedEntityType: 'deal' })
      const rawApiRemarks = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []

      const merged = [...rawApiRemarks]
      const singleRemark = deal.remark || deal.notes || deal.description || deal.data?.remark
      if (singleRemark && typeof singleRemark === 'string' && singleRemark.trim()) {
        const text = singleRemark.trim()
        if (!merged.some((r) => String(r.content || r.remark || '').trim() === text)) {
          merged.push({
            id: `deal-remark-single-${targetDealId}`,
            content: text,
            category: 'general',
            createdByName: deal.addedBy || deal.dealOwner || deal.ownerName || 'User',
            createdAt: deal.lastUpdated || deal.dealDate || deal.createdAt || new Date().toISOString(),
          })
        }
      }

      const embeddedList = Array.isArray(deal.remarks)
        ? deal.remarks
        : Array.isArray(deal.data?.remarks)
          ? deal.data.remarks
          : Array.isArray(deal.history)
            ? deal.history
            : []

      embeddedList.forEach((item, idx) => {
        const text = typeof item === 'string' ? item : item.content || item.remark || item.note || item.text || ''
        if (text && text.trim()) {
          const cleanText = text.trim()
          if (!merged.some((r) => String(r.content || r.remark || '').trim() === cleanText)) {
            merged.push({
              id: item.id || item._id || `deal-embedded-${idx}`,
              content: cleanText,
              category: item.category || 'general',
              createdByName: item.createdByName || item.userName || item.addedBy || deal.dealOwner || 'User',
              createdAt: item.createdAt || item.date || deal.createdAt || new Date().toISOString(),
              startTime: item.startTime || null,
              endTime: item.endTime || null,
            })
          }
        }
      })

      merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      setDealHistoryRemarks(merged)
    } catch (error) {
      console.error('Failed to fetch deal history remarks:', error)
      setDealHistoryRemarks([])
    } finally {
      setIsLoadingDealHistory(false)
    }
  }

  const handleStartEditing = (key, initialValue) => {
    setEditingFieldKey(key)
    setEditValue(initialValue !== undefined && initialValue !== null ? initialValue : '')
  }

  const handleCancelEditing = () => {
    setEditingFieldKey('')
    setEditValue('')
  }

  const handleSaveField = async (key) => {
    if (!deal?.id || isSavingField) return
    setIsSavingField(true)

    let updatePayload = { [key]: editValue }

    if (key === 'dealName') {
      updatePayload = { dealName: editValue, projectName: editValue, title: editValue, name: editValue }
    } else if (key === 'dealValue') {
      const val = editValue ? Number(editValue) : 0
      updatePayload = { dealValue: val, value: val, amount: val }
    } else if (key === 'dealScore' || key === 'poValue') {
      updatePayload[key] = editValue ? Number(editValue) : 0
    } else if (key === 'probability') {
      const prob = clampProbability(editValue)
      updatePayload = { probability: prob }
    } else if (key === 'dealDate') {
      updatePayload = { dealDate: editValue }
    } else if (key === 'expectedClosureDate') {
      updatePayload = { expectedClosureDate: editValue, expectedCloseDate: editValue, closeDate: editValue }
    } else if (key === 'actualClosureDate') {
      updatePayload = { actualClosureDate: editValue }
    } else if (key === 'dealStatus') {
      updatePayload = { dealStatus: editValue, status: editValue, stage: editValue }
    } else if (key === 'dealType') {
      updatePayload = { dealType: editValue, customerCategory: editValue }
    } else if (key === 'dealSource') {
      updatePayload = { dealSource: editValue, source: editValue }
    } else if (key === 'dealSubsource') {
      updatePayload = { dealSubsource: editValue, subsource: editValue }
    } else if (key === 'contactName') {
      updatePayload = { contactName: editValue, contactPerson: editValue }
    } else if (key === 'phone') {
      updatePayload = { phone: editValue, contactPhone: editValue, contactMobile: editValue }
    } else if (key === 'email') {
      updatePayload = { email: editValue, contactEmail: editValue }
    } else if (key === 'address') {
      updatePayload = { address: editValue }
    } else if (key === 'customerReferenceDate') {
      updatePayload = { customerReferenceDate: editValue, customerRefDate: editValue }
    } else if (key === 'customerReferenceNumber') {
      updatePayload = { customerReferenceNumber: editValue, customerRefNo: editValue }
    } else if (key === 'productCategory') {
      updatePayload = { productCategory: editValue }
    } else if (key === 'projectName') {
      updatePayload = { projectName: editValue }
    } else if (key === 'jobNo') {
      updatePayload = { jobNo: editValue }
    } else if (key === 'consultantName') {
      updatePayload = { consultantName: editValue }
    } else if (key === 'gstin') {
      updatePayload = { gstin: editValue }
    } else if (key === 'orderCustomerStatus') {
      updatePayload = { orderCustomerStatus: editValue }
    } else if (key === 'quotationCustomerStatus') {
      updatePayload = { quotationCustomerStatus: editValue }
    } else if (key === 'description') {
      updatePayload = { description: editValue, remark: editValue }
    }

    const targetDealId = deal.sourceDealId || deal.source_deal_id || deal.dealId || deal.id
    const result = await updateDeal(targetDealId, updatePayload)
    setIsSavingField(false)

    if (!result.success) {
      addNotification('error', 'Update Deal', result.message || 'Unable to update field.')
      return
    }

    addNotification('success', 'Update Deal', 'Deal updated successfully.')
    setEditingFieldKey('')
    setEditValue('')
  }

  if (!deal) {
    return (
      <div className="admin-deal-detail-page">
        <div className="admin-deal-detail-shell">
          <div className="admin-deal-detail-card">
            <div className="admin-deal-detail-toolbar">
              <h1>Deal Not Found</h1>
              <button type="button" className="admin-deal-detail-close" onClick={handleClose} aria-label="Close deal details">
                <FaTimes />
              </button>
            </div>
            <div className="admin-deal-detail-empty">
              The requested deal could not be found.
            </div>
            <div className="admin-deal-detail-actions">
              <Button type="button" variant="outline" onClick={handleClose}>
                Back To Deals
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const customerLabel = deal.customerName || ''
  const computedAging = calculateAging(deal.dealDate || deal.createdAt)

  // Card 1 — Contact Information Items
  const contactItems = [
    { key: 'contactName', label: 'Contact Name', value: deal.contactName, rawValue: deal.contactName, type: 'text', icon: <FaUser /> },
    { key: 'phone', label: 'Phone', value: deal.phone, rawValue: deal.phone, type: 'text', icon: <FaPhone /> },
    { key: 'email', label: 'Email', value: deal.email, rawValue: deal.email, type: 'text', icon: <FaEnvelope /> },
    { key: 'address', label: 'Address', value: deal.address, rawValue: deal.address, type: 'text', icon: <FaMapMarkerAlt /> },
  ]

  // Card 2 — Deal Information Items
  const dealInfoItems = [
    { key: 'description', label: 'Description', value: deal.description, rawValue: deal.description, type: 'text' },
    { key: 'productCategory', label: 'Product Category', value: deal.productCategory, rawValue: deal.productCategory, type: 'select', options: PRODUCT_CATEGORY_SELECT_OPTIONS },
    { key: 'projectName', label: 'Project Name', value: deal.projectName, rawValue: deal.projectName, type: 'text' },
    { key: 'jobNo', label: 'Job No.', value: deal.jobNo, rawValue: deal.jobNo, type: 'text' },
  ]

  // Card 3 — Tracking Information Items
  const trackingItems = [
    { key: 'lastUpdated', label: 'Last Updated', value: deal.lastUpdated ? formatDate(deal.lastUpdated, 'long') : '', readonly: true },
    { key: 'addedBy', label: 'Added By', value: deal.addedBy, readonly: true },
    { key: 'aging', label: 'Aging', value: computedAging, readonly: true },
    { key: 'dealSource', label: 'Deal Source', value: deal.dealSource, rawValue: deal.dealSource, type: 'select', options: DEAL_SOURCE_SELECT_OPTIONS },
  ]

  // Section 5 — Other Details Items (Structured in 3 Columns)
  const otherDetailsCol1 = [
    { key: 'poValue', label: 'PO Value', value: deal.poValue !== undefined && deal.poValue !== null ? formatCurrency(deal.poValue) : '', rawValue: deal.poValue, type: 'number' },
    { key: 'customerReferenceDate', label: 'Customer Ref. Date', value: deal.customerReferenceDate ? formatDate(deal.customerReferenceDate) : '', rawValue: toDateInputValue(deal.customerReferenceDate), type: 'date' },
    { key: 'projectNameOther', label: 'Project Name', value: deal.projectName, rawValue: deal.projectName, type: 'text', mappingKey: 'projectName' },
    { key: 'orderCustomerStatus', label: 'Status of Customer as per Order Received', value: deal.orderCustomerStatus, rawValue: deal.orderCustomerStatus, type: 'select', options: MANAGE_DEAL_LIFECYCLE_STATUS_OPTIONS },
  ]

  const otherDetailsCol2 = [
    { key: 'productCategoryOther', label: 'Product Category', value: deal.productCategory, rawValue: deal.productCategory, type: 'select', options: PRODUCT_CATEGORY_SELECT_OPTIONS, mappingKey: 'productCategory' },
    { key: 'customerReferenceNumber', label: 'Customer Ref. No.', value: deal.customerReferenceNumber, rawValue: deal.customerReferenceNumber, type: 'text' },
    { key: 'jobNoOther', label: 'Job No.', value: deal.jobNo, rawValue: deal.jobNo, type: 'text', mappingKey: 'jobNo' },
    { key: 'quotationCustomerStatus', label: 'Status of Customer as per Quotation Given', value: deal.quotationCustomerStatus, rawValue: deal.quotationCustomerStatus, type: 'select', options: CUSTOMER_QUOTATION_STATUS_OPTIONS },
  ]

  const otherDetailsCol3 = [
    { key: 'consultantName', label: 'Consultant Name', value: deal.consultantName, rawValue: deal.consultantName, type: 'text' },
    { key: 'gstin', label: 'GSTIN', value: deal.gstin, rawValue: deal.gstin, type: 'text' },
    { key: 'dealStatusOther', label: 'Customer Status', value: deal.dealStatus || 'NEW', rawValue: deal.dealStatus || 'new', type: 'select', options: STATUS_OPTIONS, mappingKey: 'dealStatus' },
  ]

  return (
    <>
      <div className="admin-deal-detail-page c-deal-detail-page">
        <div className="admin-deal-detail-shell c-deal-detail-shell">
          <article className="c-deal-main-container">
            {/* 1. COMPACT HEADER */}
            <DealHeader
              dealName={deal.dealName || deal.projectName || 'Deal Details'}
              dealNumber={deal.dealNumber}
              onBack={handleClose}
              onOpenHistory={handleOpenDealHistory}
              isActionsMenuOpen={isActionsMenuOpen}
              setIsActionsMenuOpen={setIsActionsMenuOpen}
              actionsMenuItems={actionsMenuItems}
              onActionsItemClick={handleActionsItemClick}
              onStartEditTitle={() => handleStartEditing('dealName', deal.dealName)}
              isEditingTitle={editingFieldKey === 'dealName'}
              titleEditValue={editValue}
              onChangeTitleEditValue={setEditValue}
              onSaveTitle={() => handleSaveField('dealName')}
              onCancelTitle={handleCancelEditing}
              isSavingTitle={isSavingField}
            />

            {/* 2. DEAL SUMMARY STRIP */}
            <DealSummaryStrip
              deal={deal}
              customerLabel={customerLabel}
              editingFieldKey={editingFieldKey}
              editValue={editValue}
              isSavingField={isSavingField}
              onStartEdit={handleStartEditing}
              onChangeEditValue={setEditValue}
              onSaveField={handleSaveField}
              onCancelEdit={handleCancelEditing}
              dealTypeOptions={DEAL_TYPE_OPTIONS}
              statusOptions={STATUS_OPTIONS}
              toDateInputValue={toDateInputValue}
            />

            {/* 3. DEAL SUMMARY / STAGE TIMELINE */}
            <DealStageTimeline deal={deal} />

            {/* 4. THREE-COLUMN INFORMATION AREA */}
            <section className="c-deal-info-grid" aria-label="Information cards">
              {/* Card 1: Contact Information */}
              <InfoCard title="Contact Information" icon={<FaUser />} className="c-deal-info-card-contact">
                {contactItems.map((item) => (
                  <InfoFieldItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={item.value}
                    rawValue={item.rawValue}
                    type={item.type}
                    icon={item.icon}
                    isEditing={editingFieldKey === item.key}
                    editValue={editValue}
                    isSaving={isSavingField}
                    onStartEdit={handleStartEditing}
                    onChangeEditValue={setEditValue}
                    onSave={handleSaveField}
                    onCancel={handleCancelEditing}
                  />
                ))}
              </InfoCard>

              {/* Card 2: Deal Information */}
              <InfoCard title="Deal Information" icon={<FaBuilding />} className="c-deal-info-card-deal">
                {dealInfoItems.map((item) => (
                  <InfoFieldItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={item.value}
                    rawValue={item.rawValue}
                    type={item.type}
                    options={item.options}
                    isEditing={editingFieldKey === item.key}
                    editValue={editValue}
                    isSaving={isSavingField}
                    onStartEdit={handleStartEditing}
                    onChangeEditValue={setEditValue}
                    onSave={handleSaveField}
                    onCancel={handleCancelEditing}
                  />
                ))}
              </InfoCard>

              {/* Card 3: Tracking Information */}
              <InfoCard title="Tracking Information" icon={<FaClock />} className="c-deal-info-card-tracking">
                {trackingItems.map((item) => (
                  <InfoFieldItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={item.value}
                    rawValue={item.rawValue}
                    type={item.type}
                    options={item.options}
                    readonly={item.readonly}
                    isEditing={editingFieldKey === item.key}
                    editValue={editValue}
                    isSaving={isSavingField}
                    onStartEdit={handleStartEditing}
                    onChangeEditValue={setEditValue}
                    onSave={handleSaveField}
                    onCancel={handleCancelEditing}
                  />
                ))}
              </InfoCard>
            </section>

            {/* 5. OTHER DETAILS SECTION */}
            <section className="c-deal-other-section" aria-label="Other details">
              <InfoCard title="Other Details" icon={<FaInfoCircle />} className="c-deal-other-card">
                <div className="c-deal-other-columns-layout">
                  {/* Column 1 */}
                  <div className="c-deal-other-column">
                    {otherDetailsCol1.map((item) => {
                      const actualKey = item.mappingKey || item.key
                      return (
                        <InfoFieldItem
                          key={item.key}
                          itemKey={actualKey}
                          label={item.label}
                          value={item.value}
                          rawValue={item.rawValue}
                          type={item.type}
                          options={item.options}
                          isEditing={editingFieldKey === actualKey}
                          editValue={editValue}
                          isSaving={isSavingField}
                          onStartEdit={handleStartEditing}
                          onChangeEditValue={setEditValue}
                          onSave={handleSaveField}
                          onCancel={handleCancelEditing}
                        />
                      )
                    })}
                  </div>

                  {/* Column 2 */}
                  <div className="c-deal-other-column">
                    {otherDetailsCol2.map((item) => {
                      const actualKey = item.mappingKey || item.key
                      return (
                        <InfoFieldItem
                          key={item.key}
                          itemKey={actualKey}
                          label={item.label}
                          value={item.value}
                          rawValue={item.rawValue}
                          type={item.type}
                          options={item.options}
                          isEditing={editingFieldKey === actualKey}
                          editValue={editValue}
                          isSaving={isSavingField}
                          onStartEdit={handleStartEditing}
                          onChangeEditValue={setEditValue}
                          onSave={handleSaveField}
                          onCancel={handleCancelEditing}
                        />
                      )
                    })}
                  </div>

                  {/* Column 3 */}
                  <div className="c-deal-other-column">
                    {otherDetailsCol3.map((item) => {
                      const actualKey = item.mappingKey || item.key
                      return (
                        <InfoFieldItem
                          key={item.key}
                          itemKey={actualKey}
                          label={item.label}
                          value={item.value}
                          rawValue={item.rawValue}
                          type={item.type}
                          options={item.options}
                          isEditing={editingFieldKey === actualKey}
                          editValue={editValue}
                          isSaving={isSavingField}
                          onStartEdit={handleStartEditing}
                          onChangeEditValue={setEditValue}
                          onSave={handleSaveField}
                          onCancel={handleCancelEditing}
                        />
                      )
                    })}
                  </div>
                </div>
              </InfoCard>
            </section>

            {/* 6. QUICK ACTIONS & ACTIVITY UPDATES SECTION */}
            <section className="c-deal-quick-activity-grid" aria-label="Quick Actions & Activity Updates">
              <DealQuickActionsCard
                deal={deal}
                reminders={dealReminders}
                onQuickAction={handleQuickAction}
                onActivateReminder={async (rem) => {
                  if (!rem?.id) return
                  try {
                    if (typeof updateReminder === 'function') {
                      await updateReminder(rem.id, { isActivated: true, status: 'activated', activatedAt: new Date().toISOString() })
                    }
                    addNotification('success', 'Reminder Activated', 'Reminder has been marked as active.')
                  } catch (err) {
                    console.error('Failed to activate reminder:', err)
                  }
                }}
                onCloseReminder={async (rem) => {
                  if (!rem?.id) return
                  try {
                    if (typeof updateReminder === 'function') {
                      await updateReminder(rem.id, { status: 'closed', closedAt: new Date().toISOString() })
                    } else if (typeof deleteReminder === 'function') {
                      await deleteReminder(rem.id)
                    }
                    addNotification('success', 'Reminder Closed', 'Reminder has been closed.')
                  } catch (err) {
                    console.error('Failed to close reminder:', err)
                  }
                }}
                onRefresh={fetchDealRemarks}
              />
              <DealActivityUpdatesCard
                deal={deal}
                remarks={dealHistoryRemarks}
                reminders={dealReminders}
              />
            </section>
          </article>
        </div>
      </div>

      {/* ADD NOTES / REMARKS MODAL */}
      <AddRemarksModal
        isOpen={isRemarksOpen}
        onClose={() => setIsRemarksOpen(false)}
        dealData={deal}
        accountData={deal}
        onSave={handleSaveRemark}
        onSaveAccountField={handleSaveRemarkField}
        isLoading={isSavingRemark}
      />

      {/* CHANGE TYPE MODAL */}
      <Modal
        isOpen={isChangeTypeOpen}
        onClose={handleCloseChangeType}
        title="Change Type"
        size="small"
      >
        <form className="admin-deal-detail-change-type-form" onSubmit={handleSaveDealType}>
          <label className="admin-deal-detail-change-type-field">
            <span>Deal Type</span>
            <select value={changeTypeValue} onChange={(event) => setChangeTypeValue(event.target.value)}>
              <option value="">Select deal type</option>
              {DEAL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-deal-detail-change-type-actions">
            <Button type="button" variant="outline" onClick={handleCloseChangeType} disabled={isSavingProbability}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSavingProbability}>
              {isSavingProbability ? 'Saving...' : 'Save Type'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD REMINDER MODAL */}
      <AddReminderModal
        isOpen={isReminderOpen}
        onClose={() => setIsReminderOpen(false)}
        contextLabel={`${deal?.dealName || deal?.dealNumber || 'Deal'} | ${deal?.dealNumber || ''}`}
        createdBy={user?.name}
        relatedEntityType="deal"
        relatedEntityId={deal?.id}
        assignedTo={deal?.assignedTo || deal?.ownerUserId || deal?.userId || user?.id}
        onSaved={handleSavedReminder}
      />

      {/* INLINE QUOTATIONS MODAL */}
      {inlineQuotationDeal && (
        <Quotations
          autoOpen={true}
          preselectedDeal={inlineQuotationDeal}
          onClose={() => setInlineQuotationDeal(null)}
        />
      )}

      {/* REMARKS & COMMUNICATION HISTORY MODAL */}
      {isDealHistoryModalOpen && (
        <Modal
          isOpen={isDealHistoryModalOpen}
          onClose={() => setIsDealHistoryModalOpen(false)}
          title={historyModalTitle}
          size="large"
        >
          <div style={{ padding: '8px', maxHeight: '70vh', overflowY: 'auto' }}>
            {isLoadingDealHistory ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                Loading deal history...
              </div>
            ) : dealHistoryRemarks.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                No remarks history found for this deal.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dealHistoryRemarks.map((rem) => (
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
    </>
  )
}

export default AdminDealDetailPage
