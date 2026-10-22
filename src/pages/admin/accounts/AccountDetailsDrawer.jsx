import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FaBell,
  FaEnvelope,
  FaExchangeAlt,
  FaExternalLinkAlt,
  FaFileAlt,
  FaRegStickyNote,
  FaRegSun,
  FaTrash,
  FaComments,
  FaHistory,
  FaSave,
  FaTimes,
} from 'react-icons/fa'
import {
  FiChevronDown,
  FiEdit2,
} from 'react-icons/fi'
import { HiOutlineStatusOnline } from 'react-icons/hi'
import Button from '../../../components/common/Button'
import Modal from '../../../components/common/Modal'
import { remarkApi } from '../../../services/remarkApi'
import ContactIntegrationActions from '../../../components/integrations/ContactIntegrationActions'
import { useData } from '../../../context/DataContext'
import { buildAdminDealDetailUrl } from '../../../features/adminDeals/config/adminDealViews'
import { useClickOutside } from '../../../hooks'
import { ACCOUNT_ACTION_DROPDOWN_LABEL, ACCOUNT_DRAWER_ACTIONS } from '../../../features/adminAccounts/config/accountActions'
import { ACCOUNT_CATEGORY_OPTIONS, ACCOUNT_SOURCE_OPTIONS, CUSTOMER_TYPE_OPTIONS, INDUSTRY_TYPE_OPTIONS, STATE_OPTIONS, sanitizeCustomerType } from '../../../features/accounts/config/accountDropdownOptions'
import { ACCOUNT_CHANGE_STATUS_OPTIONS, ACCOUNT_ORDER_STATUS_OPTIONS, ACCOUNT_QUOTATION_STATUS_OPTIONS, ACCOUNT_STATE_OPTIONS } from '../../../features/adminAccounts/config/accountStages'
import { buildAdminAccountActionUrl } from '../../../features/adminAccounts/utils/accountNavigation'
import { getAccountOwnerOptionLabel, getCachedAccountOwnerOptions, loadAccountOwnerOptions, filterAccountOwnerOptionsByVertical } from '../../../features/adminAccounts/utils/accountOwnerOptions'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import { useAuth } from '../../../context/AuthContext'
import AccountActionModal from './AccountActionModal'
import './MyGroupAccounts.css'
import './components/detail/AccountDetailRedesign.css'
import AccountPageHeader from './components/detail/AccountPageHeader'
import AccountProfileHeader from './components/detail/AccountProfileHeader'
import AccountSnapshotStrip from './components/detail/AccountSnapshotStrip'
import ContactAddressCard from './components/detail/ContactAddressCard'
import CustomerProjectCard from './components/detail/CustomerProjectCard'
import QuickActionsCard from './components/detail/QuickActionsCard'
import ActivityUpdatesCard from './components/detail/ActivityUpdatesCard'
import AdditionalInfoAccordion from './components/detail/AdditionalInfoAccordion'

const HIDDEN_ACCOUNT_ACTION_STAGE_VALUES = new Set(['converted', 'closed', 'contacted', 'order_lost'])
const ACCOUNT_INFORMATION_STAGE_OPTIONS = ACCOUNT_CHANGE_STATUS_OPTIONS
  .filter((option) => !HIDDEN_ACCOUNT_ACTION_STAGE_VALUES.has(option.value))
  .map((option) => ({
    value: option.stageKey,
    label: option.value === 'convert_to_po' ? 'PO Converted' : option.label,
  }))
const REASON_FOR_LOST_OPTIONS = [
  'Intense Competition',
  'On Hold',
  'Payment Terms not matching',
  'Delivery not matching',
  'Budgetory Offer',
].map((value) => ({ value, label: value }))
const toSelectOptions = (entries = []) => entries.map((entry) => (
  typeof entry === 'string' ? { value: entry, label: entry } : entry
))
const ACCOUNT_STATUS_OPTIONS = ACCOUNT_STATE_OPTIONS.map((value) => ({
  value: value.toLowerCase(),
  label: value,
}))
const getAccountStatusLabel = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  return ACCOUNT_STATUS_OPTIONS.find((option) => option.value === normalizedValue || option.label.toLowerCase() === normalizedValue)?.label || value
}
const getAllowedAccountInformationStage = (value) => (
  ACCOUNT_INFORMATION_STAGE_OPTIONS.some((option) => option.value === value) ? value : ''
)

const DEAL_TYPE_OPTIONS = [
  { value: 'LUMOS', label: 'LUMOS' },
  { value: 'SWATI', label: 'SWATI' },
  { value: 'PURCHASE ENQUIRY', label: 'PURCHASE ENQUIRY' },
  { value: 'TENDER ENQUIRY', label: 'TENDER ENQUIRY' },
]
const DEAL_SOURCE_OPTIONS = ['LUMOS', 'SWATI', 'PURCHASE ENQUIRY', 'TENDER ENQUIRY'].map(val => ({ value: val, label: val }))

const ACTION_ICONS = {
  'add-note-remarks': FaRegStickyNote,
  'add-reminder': FaBell,
  'change-status': FaRegSun,
  'add-document': FaFileAlt,
  're-assign-account': FaExchangeAlt,
  'generate-quotation': FaFileAlt,
  'view-quotations': FaFileAlt,
  'converted-deal': FaExchangeAlt,
  'view-linked-deal': FaExternalLinkAlt,
  'send-mail': FaEnvelope,
  'manage-account': HiOutlineStatusOnline,
  'delete-account': FaTrash,
}

const CARD_SECTIONS_CONFIG = [
  {
    key: 'accountOverview',
    title: 'Account Overview',
    isOverview: true,
    fields: [
      { key: 'status', label: 'Account Status', options: ACCOUNT_STATUS_OPTIONS },
      { key: 'accountDate', label: 'Account Date', type: 'date' },
      { key: 'mobile', label: 'Phone' },
      { key: 'state', label: 'State', options: STATE_OPTIONS },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'addedBy', label: 'Added By' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'lastUpdated', label: 'Last Updated', readOnly: true },
    ],
  },
  {
    key: 'customerInfo',
    title: 'Customer Information',
    fields: [
      { key: 'customerName', label: 'Customer Name' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'customerType', label: 'Customer Type', options: CUSTOMER_TYPE_OPTIONS },
      { key: 'industry', label: 'Industry', options: INDUSTRY_TYPE_OPTIONS },
      { key: 'accountSource', label: 'Account Source', options: ACCOUNT_SOURCE_OPTIONS },
      { key: 'city', label: 'City / Location' },
      { key: 'address', label: 'Address', multiline: true },
      { key: 'description', label: 'Description', multiline: true },
    ],
  },
  {
    key: 'dealInfo',
    title: 'Deal Information',
    fields: [
      { key: 'projectName', label: 'Deal Name' },
      { key: 'dealNumber', label: 'Deal ID', readOnly: true },
      { key: 'dealValue', label: 'Deal Value', type: 'number' },
      { key: 'probability', label: 'Probability (%)', type: 'number' },
      { key: 'dealOwner', label: 'Deal Owner' },
      { key: 'expectedClosureDate', label: 'Expected Closure', type: 'date' },
      { key: 'dealDate', label: 'Deal Date', type: 'date' },
      { key: 'dealCity', label: 'City' },
      { key: 'dealSource', label: 'Deal Source', options: DEAL_SOURCE_OPTIONS },
      { key: 'dealDescription', label: 'Description', multiline: true },
    ],
  },
  {
    key: 'orderQuotation',
    title: 'Order & Quotation Details',
    fields: [
      { key: 'statusAsPerOrderReceived', label: 'Status as per order received', options: toSelectOptions(ACCOUNT_ORDER_STATUS_OPTIONS) },
      { key: 'statusAsPerQuotationGiven', label: 'Status as per quotation given', options: toSelectOptions(ACCOUNT_QUOTATION_STATUS_OPTIONS) },
      { key: 'customerRefNo', label: 'Customer reference number' },
      { key: 'customerRefDate', label: 'Customer reference date', type: 'date' },
      { key: 'jobNo', label: 'Job number' },
      { key: 'consultantName', label: 'Consultant name' },
      { key: 'reasonForLost', label: 'Reason for lost', options: REASON_FOR_LOST_OPTIONS },
      { key: 'poValue', label: 'PO Value', type: 'number' },
    ],
  },
]

const flattenedAccountFields = CARD_SECTIONS_CONFIG.flatMap((section) => (
  section.fields.map((field) => ({ ...field, sectionKey: section.key }))
))

const formatCleanDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en-US', { month: 'short' })
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

const formatHeaderDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

const normalizeDateInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const formatDetailDate = (value, pattern = 'dd-MM-yyyy') => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  if (pattern === 'dd-MM-yyyy hh:mm a') {
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${day}-${month}-${year} ${time}`
  }

  return `${day}-${month}-${year}`
}

const getDisplayFieldValue = (field, value) => {
  if (field.key === 'projectName') {
    if (value === null || value === undefined) return '-'
    const cleanText = String(value).trim()
    if (!cleanText || cleanText.toLowerCase() === 'null' || cleanText.toLowerCase() === 'undefined') return '-'
    return cleanText
  }
  if (field.key === 'customerType') {
    return sanitizeCustomerType(value) || '-'
  }
  if (!value && value !== 0) return ''
  if (field.key === 'dealValue' || field.key === 'poValue') {
    const num = Number(value)
    if (!Number.isNaN(num) && num > 0) return formatCurrency(num)
  }
  if (field.key === 'probability' && value !== undefined && value !== null && String(value).trim() !== '') {
    return String(value).includes('%') ? value : `${value}%`
  }
  if (field.key === 'lastUpdated') return formatDetailDate(value, 'dd-MM-yyyy hh:mm a')
  if (field.type === 'date') return formatCleanDate(value)
  if (field.key === 'status') return getAccountStatusLabel(value)
  if (field.options) {
    const option = field.options.find((entry) => entry.value === value || entry.label === value)
    if (option) return option.label
  }
  return value
}

const getTodayInputValue = () => new Date().toISOString().slice(0, 10)

const resolveAddedByDisplay = (account = {}) => (
  account.addedByDisplay
  || account.raw?.addedByDisplay
  || account.raw?.addedByName
  || account.raw?.createdByUserName
  || account.raw?.createdByName
  || account.addedBy
  || ''
)

const buildInitialForm = (account, deal = {}) => ({
  accountNumber: account.accountNumber || '',
  accountName: account.name || account.accountName || '',
  company: account.raw?.company || account.company || '',
  industry: account.industryType || account.raw?.industry || '',
  accountCategory: account.accountCategory || account.customerType || '',
  accountSource: account.accountSource || account.source || '',
  status: String(account.raw?.status || account.status || '').trim().toLowerCase(),
  accountState: account.accountState || account.raw?.accountState || getAccountStatusLabel(account.raw?.status || account.status || ''),
  stage: getAllowedAccountInformationStage(account.stage || ''),
  accountDate: normalizeDateInput(account.accountDate || account.createdAt) || '',
  accountOwner: account.accountOwnerName || account.accountOwner || '',
  addedBy: resolveAddedByDisplay(account),
  lastUpdated: account.updatedAt || account.raw?.updatedAt || '',
  assignedUserId: account.raw?.assignedUserId || account.raw?.assignedTo || account.raw?.ownerId || '',
  contactPerson: account.contactPerson || '',
  designation: account.contactDesignation || account.designation || account.raw?.designation || '',
  customerType: sanitizeCustomerType(account.customerType) || '',
  mobile: account.contactMobile || account.phone || '',
  alternatePhone: account.alternatePhone || '',
  alternateEmail: account.alternateEmail || '',
  landline: account.landline || account.phone2 || account.raw?.landline || account.data?.landline || '',
  email: account.email || account.contactEmail || account.formData?.email || '',
  contactEmail: account.contactEmail || account.email || account.formData?.contactEmail || '',
  website: account.website || '',
  address: account.address || '',
  city: account.location || account.raw?.city || '',
  state: account.state || '',
  gstin: account.gstin || account.data?.gstin || account.raw?.gstin || account.raw?.data?.gstin || account.formData?.gstin || account.formData?.GSTIN || deal.gstin || '',
  stateCode: account.stateCode || account.data?.stateCode || account.raw?.stateCode || account.raw?.data?.stateCode || '',
  country: account.raw?.country || account.data?.country || '',
  pincode: account.raw?.pincode || account.raw?.pinCode || account.data?.pincode || '',
  projectName: [
    account.projectName,
    account.data?.projectName,
    account.raw?.projectName,
    account.formData?.projectName,
    account.formData?.formData?.projectName,
    account.raw?.formData?.formData?.projectName,
    account.dealName,
    account.data?.dealName,
    account.raw?.dealName,
    account.formData?.dealName,
    account.formData?.formData?.dealName,
    account.raw?.formData?.formData?.dealName,
    deal.projectName,
    deal.dealName
  ]
    .map((value) => {
      if (value === null || value === undefined) return ''
      const text = String(value).trim()
      return text && text !== '-' && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined' ? text : ''
    })
    .find(Boolean) || '',
  projectType: account.productCategory || account.data?.productCategory || account.raw?.projectType || deal.productCategory || '',
  projectLocation: account.projectLocation || account.data?.projectLocation || account.raw?.projectLocation || '',
  consultantName: account.consultantName || account.data?.consultantName || deal.consultantName || '',
  architectName: account.architectName || account.data?.architectName || account.raw?.architectName || '',
  pmcName: account.pmcName || account.data?.pmcName || account.raw?.pmcName || '',
  poValue: account.poValue || account.data?.poValue || account.raw?.poValue || account.raw?.data?.poValue || deal.poValue || '',
  statusAsPerOrderReceived: account.statusAsPerOrderReceived || account.data?.statusAsPerOrderReceived || account.raw?.statusAsPerOrderReceived || '',
  statusAsPerQuotationGiven: account.statusAsPerQuotationGiven || account.data?.statusAsPerQuotationGiven || account.raw?.statusAsPerQuotationGiven || '',
  reasonForLost: account.reasonForLost || account.data?.reasonForLost || account.raw?.reasonForLost || '',
  customerName: account.customerName || account.data?.customerName || account.raw?.customerName || deal.customerName || account.name || account.accountName || '',
  reminderDate: normalizeDateInput(account.reminderDate || account.data?.reminderDate) || getTodayInputValue(),
  reminderMode: account.reminderMode || account.data?.reminderMode || '',
  latestRemark: account.latestRemark || account.data?.latestRemark || account.remark || account.data?.remark || '',
  remark: account.remark || account.data?.remark || '',
  description: account.description || account.data?.description || account.raw?.description || '',
  jobNo: account.jobNo || account.data?.jobNo || account.raw?.jobNo || account.raw?.data?.jobNo || account.formData?.jobNo || account.formData?.['Job No'] || deal.jobNo || '',
  customerRefNo: account.customerRefNo || account.data?.customerRefNo || account.raw?.customerRefNo || account.raw?.data?.customerRefNo || deal.customerRefNo || '',
  customerRefDate: normalizeDateInput(account.customerRefDate || deal.customerRefDate) || '',
  dealName: account.dealName || deal.name || deal.dealName || '',
  dealNumber: deal.dealNumber || deal.dealId || account.dealNumber || account.dealId || account.convertedDealId || '',
  dealDate: normalizeDateInput(account.dealDate || deal.dealDate) || '',
  dealDescription: account.dealDescription || account.raw?.dealDescription || deal.description || deal.dealDescription || '',
  dealValue: account.dealValue || deal.value || deal.dealValue || '',
  dealCoOwners: account.dealCoOwners || account.raw?.dealCoOwners || deal.dealCoOwners || '',
  dealOwner: account.dealOwner || account.raw?.dealOwner || deal.ownerName || deal.dealOwner || '',
  dealCity: account.dealCity || account.raw?.dealCity || deal.city || deal.dealCity || '',
  customerQuotationStatus: account.customerQuotationStatus || account.raw?.customerQuotationStatus || deal.quotationCustomerStatus || '',
  customerOrderStatus: account.customerOrderStatus || account.raw?.customerOrderStatus || deal.orderCustomerStatus || '',
  expectedClosureDate: normalizeDateInput(account.expectedClosureDate || deal.expectedClosureDate || deal.closeDate) || '',
  dealSource: account.dealSource || deal.dealSource || '',
  dealType: account.dealType || deal.dealType || '',
  probability: account.probability || deal.probability || '',
  dealScore: account.dealScore || deal.dealScore || '',
})

const buildUpdatePayload = (form) => ({
  name: form.accountName,
  accountName: form.accountName,
  company: form.company,
  industry: form.industry,
  industryType: form.industry,
  accountCategory: form.accountCategory,
  accountSource: form.accountSource,
  source: form.accountSource,
  status: String(form.status || '').trim().toLowerCase(),
  accountStatus: getAccountStatusLabel(form.status),
  accountState: form.accountState,
  stage: form.stage,
  accountDate: form.accountDate,
  accountOwner: form.accountOwner,
  ownerName: form.accountOwner,
  addedBy: form.addedBy,
  addedByDisplay: form.addedBy,
  contactPerson: form.contactPerson,
  contactDesignation: form.designation,
  designation: form.designation,
  customerType: form.customerType || form.accountCategory,
  contactMobile: form.mobile,
  mobile: form.mobile,
  phone: form.mobile,
  alternatePhone: form.alternatePhone,
  alternateEmail: form.alternateEmail,
  landline: form.landline || '',
  phone2: form.landline || '',
  contactEmail: form.email || form.contactEmail || '',
  email: form.email || form.contactEmail || '',
  website: form.website,
  address: form.address,
  location: form.city,
  city: form.city,
  state: form.state,
  gstin: form.gstin,
  stateCode: form.stateCode,
  country: form.country,
  pincode: form.pincode,
  projectName: form.projectName,
  productCategory: form.projectType,
  projectType: form.projectType,
  projectLocation: form.projectLocation,
  consultantName: form.consultantName,
  architectName: form.architectName,
  pmcName: form.pmcName,
  poValue: form.poValue,
  statusAsPerOrderReceived: form.statusAsPerOrderReceived,
  statusAsPerQuotationGiven: form.statusAsPerQuotationGiven,
  reasonForLost: form.reasonForLost,
  reminderDate: form.reminderDate,
  reminderMode: form.reminderMode,
  latestRemark: form.latestRemark,
  remark: form.remark,
  notes: form.remark || form.description,
  description: form.description,
  jobNo: form.jobNo,
  customerRefNo: form.customerRefNo,
  customerRefDate: form.customerRefDate,
  customerName: form.customerName,
  dealDate: form.dealDate,
  dealName: form.projectName !== undefined && form.projectName !== null && String(form.projectName).trim() !== '' ? form.projectName : (form.dealName || ''),
  dealDescription: form.dealDescription,
  dealValue: form.dealValue,
  dealCoOwners: form.dealCoOwners,
  dealOwner: form.dealOwner,
  dealCity: form.dealCity,
  customerQuotationStatus: form.customerQuotationStatus,
  customerOrderStatus: form.customerOrderStatus,
  expectedClosureDate: form.expectedClosureDate,
  dealSource: form.dealSource,
  dealType: form.dealType,
  probability: form.probability,
  dealScore: form.dealScore,
})

const AccountDetailsDrawer = ({
  account,
  isOpen,
  onClose,
  boardStateQuery,
  onSaveAccount,
  onRefresh,
  onDeleteAccount,
  canEdit = false,
  actionItems = ACCOUNT_DRAWER_ACTIONS,
  hiddenFieldKeys = [],
  inline = false,
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { convertedDeals, convertAccountToDeal, addNotification, reminders, updateReminder, deleteReminder } = useData()
  const { user } = useAuth()
  
  const relatedConvertedDeals = useMemo(() => (
    (Array.isArray(convertedDeals) ? convertedDeals : [])
      .filter((entry) => String(entry.accountId || '') === String(account?.id || ''))
      .sort((left, right) => (
        new Date(right.convertedAt || right.createdAt || 0).getTime()
        - new Date(left.convertedAt || left.createdAt || 0).getTime()
      ))
  ), [account?.id, convertedDeals])

  const accountReminders = useMemo(() => {
    const accId = String(account?.id || '')
    const accName = String(account?.name || account?.accountName || '').toLowerCase().trim()
    if (!accId && !accName) return []
    return (Array.isArray(reminders) ? reminders : [])
      .filter((r) => {
        const matchesId = r.accountId && String(r.accountId) === accId
        const matchesEntity = String(r.relatedEntityType || '').toLowerCase() === 'account' && String(r.relatedEntityId || '') === accId
        const matchesName = accName && r.accountName && String(r.accountName).toLowerCase().trim() === accName
        return matchesId || matchesEntity || matchesName
      })
      .sort((a, b) => new Date(b.reminderDate || b.createdAt || 0) - new Date(a.reminderDate || a.createdAt || 0))
  }, [account?.id, account?.name, account?.accountName, reminders])
  
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [editingFieldKey, setEditingFieldKey] = useState('')
  const [form, setForm] = useState(() => account ? buildInitialForm(account, relatedConvertedDeals[0]) : {})
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [activeActionKey, setActiveActionKey] = useState(null)
  const [ownerOptions, setOwnerOptions] = useState(getCachedAccountOwnerOptions)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [accountHistoryRemarks, setAccountHistoryRemarks] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isSubmittingRemark, setIsSubmittingRemark] = useState(false)

  const fetchAccountRemarks = useCallback(async (acc) => {
    if (!acc?.id) return
    setIsLoadingHistory(true)
    try {
      const response = await remarkApi.getRemarks({ relatedEntityId: acc.id, relatedEntityType: 'account' })
      const rawApiRemarks = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []

      const merged = [...rawApiRemarks]
      const singleRemark = acc?.remark || acc?.notes || acc?.description || acc?.formData?.remark
      if (singleRemark && typeof singleRemark === 'string' && singleRemark.trim()) {
        const text = singleRemark.trim()
        if (!merged.some((r) => String(r.content || r.remark || '').trim() === text)) {
          merged.push({
            id: `account-remark-single-${acc.id}`,
            content: text,
            category: 'general',
            createdByName: acc.ownerName || acc.accountOwner || 'User',
            createdAt: acc.updatedAt || acc.createdAt || new Date().toISOString(),
          })
        }
      }

      const embeddedList = Array.isArray(acc?.remarks)
        ? acc.remarks
        : Array.isArray(acc?.formData?.remarks)
          ? acc.formData.remarks
          : Array.isArray(acc?.history)
            ? acc.history
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
              createdByName: item.createdByName || item.userName || item.addedBy || acc.ownerName || 'User',
              createdAt: item.createdAt || item.date || acc.createdAt || new Date().toISOString(),
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
  }, [])

  useEffect(() => {
    if (isOpen && account?.id) {
      fetchAccountRemarks(account)
    }
  }, [isOpen, account, fetchAccountRemarks])

  useEffect(() => {
    if (!isOpen || inline) return

    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, inline, onClose])

  const handleOpenAccountHistory = async () => {
    setIsHistoryModalOpen(true)
    if (account?.id) {
      fetchAccountRemarks(account)
    }
  }

  const handleInlineRemarkSubmit = async (text) => {
    if (!account?.id || !text || !text.trim()) return false
    setIsSubmittingRemark(true)
    try {
      const payload = {
        relatedEntityId: account.id,
        relatedEntityType: 'account',
        content: text.trim(),
        category: 'general',
        createdByName: user?.name || user?.username || 'User',
        createdBy: user?.id || user?._id || '',
      }
      await remarkApi.createRemark(payload)
      if (typeof addNotification === 'function') {
        addNotification('success', 'Remark Added', 'Remark has been saved successfully.')
      }
      await fetchAccountRemarks(account)
      if (typeof onRefresh === 'function') {
        onRefresh()
      }
      return true
    } catch (error) {
      console.error('Failed to submit inline remark:', error)
      if (typeof addNotification === 'function') {
        addNotification('error', 'Error', 'Failed to save remark.')
      }
      return false
    } finally {
      setIsSubmittingRemark(false)
    }
  }

  const handleActionSelect = (actionKey) => {
    const isNotQuotedAccount = account.stage === 'not_quoted' || account.status === 'Not Quoted' || account.stage === 'Not Quoted' || account.status === 'not_quoted' || account.accountStatus === 'not_quoted'
    const isBlocked = isNotQuotedAccount && (actionKey === 'generate-quotation' || actionKey === 'converted-deal' || actionKey === 'convert_to_po')

    if (isBlocked) {
      if (typeof addNotification === 'function') {
        addNotification('warning', 'Action Unavailable', 'This account is marked as Not Quoted. PO Conversion and Quotation Generation are disabled.')
      }
      return
    }

    if (actionKey === 'generate-quotation') {
      const isAdminPortalRoute = window.location.pathname.startsWith('/admin')
      navigate(isAdminPortalRoute ? '/admin/quotations' : '/quotations', {
        state: {
          openGenerator: true,
          preselectedAccountId: account.id,
          preselectedCustomer: account,
          quotationContext: 'account',
        },
      })
      return
    }

    if (actionKey === 'view-quotations') {
      const isAdminPortalRoute = window.location.pathname.startsWith('/admin')
      const targetPath = isAdminPortalRoute ? '/admin/quotation-manager/view' : '/quotation-manager/view'
      const accNo = encodeURIComponent(account.accountNumber || account.accountNo || '')
      const accName = encodeURIComponent(account.name || account.customerName || '')
      navigate(`${targetPath}?tab=accounts&accountNo=${accNo}&accountName=${accName}&accountId=${encodeURIComponent(account.id || '')}`)
      return
    }

    if (actionKey === 'send-mail') {
      setActiveActionKey('send-mail')
      return
    }

    if (actionKey === 'view-linked-deal') {
      if (linkedDealId) {
        navigate(buildAdminDealDetailUrl(linkedDealId), {
          state: {
            fromPath: `${location.pathname}${location.search || ''}`,
          },
        })
      } else {
        const convertedDeal = relatedConvertedDeals[0]
        if (convertedDeal) {
          handleOpenConvertedDeal(convertedDeal)
        }
      }
      return
    }

    if (actionKey === 'delete-account') {
      const AUTHORIZED_DELETE_ADMINS = ['parth', 'rushabh', 'samir', 'keval']
      const currentUserName = String(user?.name || user?.username || '').trim().toLowerCase()
      const currentUserEmail = String(user?.email || '').trim().toLowerCase()
      const isAuthorized = AUTHORIZED_DELETE_ADMINS.some((k) => currentUserName.includes(k) || currentUserEmail.includes(k))

      if (!isAuthorized) {
        if (typeof addNotification === 'function') {
          addNotification(
            'warning',
            'Permission Denied',
            'Only authorized administrators (Parth, Rushabh, Samir Sheth, Keval V Shah) can delete accounts. Admin can access this.'
          )
        } else {
          alert('Permission Denied: Only authorized administrators (Parth, Rushabh, Samir Sheth, Keval V Shah) can delete accounts. Admin can access this.')
        }
        return
      }

      if (typeof onDeleteAccount === 'function') {
        onDeleteAccount(account)
      }
      return
    }

    setActiveActionKey(actionKey)
  }

  const handleQuickAction = (actionKey) => {
    if (actionKey === 'email') {
      const email = form.email || account.email || form.contactEmail || account.contactEmail
      if (email) {
        window.open(`mailto:${email}`, '_blank')
      } else {
        if (typeof addNotification === 'function') {
          addNotification('warning', 'No Email', 'No email address available for this account.')
        }
      }
      return
    }

    if (actionKey === 'whatsapp') {
      const phone = form.mobile || account.mobile || account.phone
      if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '')
        window.open(`https://wa.me/${cleanPhone}`, '_blank')
      } else {
        if (typeof addNotification === 'function') {
          addNotification('warning', 'No Phone', 'No mobile number available for WhatsApp.')
        }
      }
      return
    }

    if (actionKey === 'callLog') {
      setActiveActionKey('add-note-remarks')
      return
    }

    if (actionKey === 'acknowledge') {
      const reviewPayload = {
        isReviewed: true,
        reviewedAt: new Date().toISOString(),
        reviewedByName: user?.name || user?.username || 'Current User',
      }
      if (typeof onSaveAccount === 'function') {
        onSaveAccount(account.id, reviewPayload)
      }
      if (typeof addNotification === 'function') {
        addNotification('success', 'Acknowledged', 'Account assignment marked as reviewed.')
      }
      return
    }

    handleActionSelect(actionKey)
  }

  const closeActions = useCallback(() => setIsActionsOpen(false), [])
  const actionsRef = useClickOutside(closeActions)
  const hiddenFieldKeySet = useMemo(() => new Set(hiddenFieldKeys), [hiddenFieldKeys])
  const visibleAccountFields = useMemo(
    () => flattenedAccountFields.filter((field) => !hiddenFieldKeySet.has(field.key)),
    [hiddenFieldKeySet]
  )

  useEffect(() => {
    if (account) {
      const deal = relatedConvertedDeals[0] || {}
      setForm(buildInitialForm(account, deal))
      setEditingSection(null)
      setEditingFieldKey('')
      setValidationError('')
      setActiveActionKey(null)
    }
  }, [account, relatedConvertedDeals])

  useEffect(() => {
    let isMounted = true

    loadAccountOwnerOptions()
      .then((options) => {
        if (isMounted) setOwnerOptions(options)
      })
      .catch(() => {
        if (isMounted) setOwnerOptions(getCachedAccountOwnerOptions())
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isOpen || inline) return

    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, inline, onClose])

  const headerFacts = useMemo(() => ([
    { label: 'Owner', value: account?.accountOwnerDisplay || account?.accountOwner || '-' },
    { label: 'Last Updated', value: formatHeaderDate(account?.updatedAt) },
  ]), [account])
  const isAdminPortal = location.pathname.startsWith('/admin')
  const activeVertical = (form.accountCategory || account?.accountCategory || account?.category || '').toUpperCase()
  const verticalLabel = activeVertical.includes('LUMOS') ? 'LUMOS' : 'SWATI'
  const resolvedDealNumber = (
    form.dealNumber ||
    account?.dealNumber ||
    account?.dealId ||
    relatedConvertedDeals[0]?.dealNumber ||
    relatedConvertedDeals[0]?.id ||
    ''
  )
  const linkedDealId = useMemo(() => {
    const convertedDeal = relatedConvertedDeals[0] || null
    return account?.dealId
      || convertedDeal?.sourceDealId
      || convertedDeal?.dealId
      || account?.convertedDealId
      || ''
  }, [account?.convertedDealId, account?.dealId, relatedConvertedDeals])
  const visibleActionItems = useMemo(() => {
    const alreadyConverted = Boolean(
      account?.isConverted
      || account?.dealId
      || account?.convertedDealId
      || relatedConvertedDeals.length > 0
    )

    return actionItems.filter((action) => (
      (action.key !== 'converted-deal' || !alreadyConverted)
      && (action.key !== 'view-linked-deal' || alreadyConverted)
    ))
  }, [account?.convertedDealId, account?.dealId, account?.isConverted, actionItems, relatedConvertedDeals.length])

  if (!isOpen || !account) return null

  const handleFieldChange = (key, value) => {
    setValidationError('')
    if (key === 'status') {
      const nextStatus = String(value || '').trim().toLowerCase()
      setForm((currentForm) => ({
        ...currentForm,
        status: nextStatus,
        accountState: getAccountStatusLabel(nextStatus),
      }))
      return
    }

    if (key === 'email' || key === 'contactEmail') {
      setForm((currentForm) => ({
        ...currentForm,
        email: value,
        contactEmail: value,
      }))
      return
    }

    if (key === 'projectName') {
      setForm((currentForm) => ({
        ...currentForm,
        projectName: value,
        dealName: value,
      }))
      return
    }

    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }))
  }

  const handleCancelEdit = () => {
    setForm(buildInitialForm(account))
    setEditingSection(null)
    setEditingFieldKey('')
    setValidationError('')
  }

  const handleSave = async () => {
    if (!onSaveAccount) return

    if (!String(form.accountName || '').trim()) {
      setValidationError('Account Name is required before saving.')
      return
    }

    setIsSaving(true)
    const selectedOwner = ownerOptions.find((owner) => owner.name === form.accountOwner)
    const updatePayload = {
      ...buildUpdatePayload(form),
      preserveStatus: true,
      skipAutoConvert: true,
      isSaveSettings: true,
      ...(selectedOwner ? {
        ownerId: selectedOwner.id,
        assignedUserId: selectedOwner.id,
      } : {}),
    }
    const result = await onSaveAccount(account.id, updatePayload)
    
    if (result?.success) {
      if (typeof onRefresh === 'function') {
        onRefresh()
      }
    }

    setIsSaving(false)

    if (result?.success) {
      setEditingSection(null)
      setEditingFieldKey('')
      setValidationError('')
    }
  }

  const handleFieldAutoSave = async (fieldKey, newValue) => {
    if (!onSaveAccount) return false
    const updatedForm = { ...form, [fieldKey]: newValue }
    setForm(updatedForm)

    const selectedOwner = ownerOptions.find((owner) => owner.name === updatedForm.accountOwner)
    const updatePayload = {
      ...buildUpdatePayload(updatedForm),
      preserveStatus: true,
      skipAutoConvert: true,
      isSaveSettings: true,
      ...(selectedOwner ? {
        ownerId: selectedOwner.id,
        assignedUserId: selectedOwner.id,
      } : {}),
    }

    const result = await onSaveAccount(account.id, updatePayload)
    if (result?.success) {
      if (typeof onRefresh === 'function') {
        onRefresh()
      }
      return true
    }
    return false
  }

  const handleOpenConvertedDeal = (convertedDeal) => {
    const sourceDealId = convertedDeal?.sourceDealId || ''
    const fromPath = `${location.pathname}${location.search || ''}`

    if (isAdminPortal && sourceDealId) {
      navigate(buildAdminDealDetailUrl(sourceDealId), {
        state: {
          fromPath,
        },
      })
      return
    }

    navigate(isAdminPortal ? '/admin/deals/search' : '/deals/search', {
      state: {
        ...(sourceDealId ? { editDealId: sourceDealId } : {}),
        quotationDealLookup: {
          dealNumber: convertedDeal?.dealNumber || convertedDeal?.title || convertedDeal?.name || '',
          projectName: convertedDeal?.projectName || '',
          companyName: convertedDeal?.accountName || convertedDeal?.customerName || '',
        },
      },
    })
  }

  const drawerContent = (
    <>
      <AccountPageHeader
        account={account}
        form={form}
        onClose={onClose}
        isSaving={isSaving}
        handleSave={handleSave}
        actions={visibleActionItems.map((act) => ({
          ...act,
          icon: ACTION_ICONS[act.key] || HiOutlineStatusOnline,
        }))}
        onActionSelect={handleActionSelect}
        onOpenHistory={handleOpenAccountHistory}
      />

      <main className={inline ? 'admin-accounts-fullpage-body' : 'admin-accounts-workspace-body'}>
        <div className="ad-redesign-root">
          {validationError ? (
            <div className="admin-accounts-workspace-validation" style={{ marginBottom: '1rem' }}>
              {validationError}
            </div>
          ) : null}

          {/* Section 1: Top Profile Header Card */}
          <AccountProfileHeader
            account={account}
            form={form}
            onAutoSave={handleFieldAutoSave}
            canEdit={canEdit !== false}
          />

          {/* Section 2: Account Details Snapshot Strip */}
          <AccountSnapshotStrip
            account={account}
            form={form}
            onAutoSave={handleFieldAutoSave}
            canEdit={canEdit !== false}
          />

          {/* Section 3: Two-Column Workspace Layout (1.4fr : 1fr) */}
          <div className="ad-workspace-grid">
            {/* Left Column (Primary Data & Commercials) */}
            <div className="ad-workspace-column">
              <ContactAddressCard
                account={account}
                form={form}
                onAutoSave={handleFieldAutoSave}
                canEdit={canEdit !== false}
              />
              <CustomerProjectCard
                account={account}
                form={form}
                deal={relatedConvertedDeals[0] || {}}
                onAutoSave={handleFieldAutoSave}
                canEdit={canEdit !== false}
              />
            </div>

            {/* Right Column (Interaction Suite & Timeline) */}
            <div className="ad-workspace-column">
              <QuickActionsCard
                account={account}
                form={form}
                reminders={accountReminders}
                onQuickAction={handleQuickAction}
                onActivateReminder={async (rem) => {
                  if (!rem?.id) return
                  try {
                    if (typeof updateReminder === 'function') {
                      await updateReminder(rem.id, { isActivated: true, status: 'activated', activatedAt: new Date().toISOString() })
                    }
                    if (typeof addNotification === 'function') {
                      addNotification('success', 'Reminder Activated', 'Reminder has been marked as active.')
                    }
                    if (typeof onRefresh === 'function') onRefresh()
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
                    if (typeof addNotification === 'function') {
                      addNotification('success', 'Reminder Closed', 'Reminder has been closed.')
                    }
                    if (typeof onRefresh === 'function') onRefresh()
                  } catch (err) {
                    console.error('Failed to close reminder:', err)
                  }
                }}
                onRefresh={async () => {
                  await fetchAccountRemarks(account)
                  if (typeof onRefresh === 'function') onRefresh()
                }}
              />
              <ActivityUpdatesCard account={account} remarks={accountHistoryRemarks} reminders={accountReminders} />
            </div>
          </div>

          {/* Section 4: Expandable Detailed Accordions */}
          <AdditionalInfoAccordion
            account={account}
            form={form}
            deal={relatedConvertedDeals[0] || {}}
            onAutoSave={handleFieldAutoSave}
            canEdit={canEdit !== false}
          />

          {/* Section 5: Linked Staged Deals */}
          {relatedConvertedDeals.length > 0 && (
            <section className="ad-card" style={{ marginTop: '1.25rem' }}>
              <div className="ad-card-header">
                <h3 className="ad-card-title">
                  <span>Linked Staged Deals</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-primary, #2563eb)', marginLeft: '8px' }}>
                    ({relatedConvertedDeals.length})
                  </span>
                </h3>
              </div>
              <div className="admin-accounts-converted-deals-list" style={{ marginTop: '0.75rem' }}>
                {relatedConvertedDeals.map((convertedDeal) => (
                  <button
                    key={convertedDeal.id}
                    type="button"
                    className="admin-accounts-converted-deal-card"
                    onClick={() => handleOpenConvertedDeal(convertedDeal)}
                  >
                    <div className="admin-accounts-converted-deal-card__title">
                      {convertedDeal.title || convertedDeal.name || convertedDeal.dealNumber || 'Untitled Deal'}
                    </div>
                    <div className="admin-accounts-converted-deal-card__meta">
                      <span>{convertedDeal.dealNumber || convertedDeal.id || '-'}</span>
                      <span>·</span>
                      <span>{convertedDeal.amount !== null && convertedDeal.amount !== undefined ? formatCurrency(convertedDeal.amount, convertedDeal.currency) : (convertedDeal.value ? formatCurrency(convertedDeal.value) : 'No value')}</span>
                      <span>·</span>
                      <span>{formatCleanDate(convertedDeal.convertedAt || convertedDeal.createdAt || '') || 'No conversion date'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <AccountActionModal
        account={account}
        actionKey={activeActionKey}
        onClose={() => setActiveActionKey(null)}
        onSaved={async () => {
          if (typeof onRefresh === 'function') {
            await onRefresh()
          }
          setActiveActionKey(null)
        }}
      />

      {isHistoryModalOpen && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Remarks & Communication History - ${account.name || account.accountName || 'Account'}`}
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
    </>
  )

  if (inline) {
    return (
      <div className="admin-accounts-fullpage-root">
        {drawerContent}
      </div>
    )
  }

  const drawerNode = (
    <div
      className="admin-accounts-drawer-layer admin-accounts-workspace-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Account details workspace"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="admin-accounts-workspace admin-accounts-workspace--modal"
        onClick={(e) => e.stopPropagation()}
      >
        {drawerContent}
      </section>
    </div>
  )

  return createPortal(drawerNode, document.body)
}

export default AccountDetailsDrawer
