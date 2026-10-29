import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import OutlookEmailComposerModal from '../../components/integrations/OutlookEmailComposerModal'
import { dealApi } from '../../services/dealApi'

const DealEmailComposePage = () => {
  const navigate = useNavigate()
  const { dealId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || ''
  const [deal, setDeal] = useState(null)
  const [recipientEmail, setRecipientEmail] = useState(searchParams.get('to') || '')

  useEffect(() => {
    if (!dealId) return
    let isCancelled = false
    const fetchDeal = dealApi.getDealById || dealApi.getById
    if (typeof fetchDeal === 'function') {
      fetchDeal.call(dealApi, dealId)
        .then((data) => {
          if (!isCancelled && data) {
            setDeal(data)
            if (!recipientEmail) {
              const email = data.contactEmail || data.email || data.rawDeal?.contactEmail || data.rawDeal?.email || ''
              if (email) setRecipientEmail(email)
            }
          }
        })
        .catch((err) => {
          console.warn('Deal fetch for email compose warning:', err.message)
        })
    }
    return () => { isCancelled = true }
  }, [dealId, recipientEmail])

  const handleClose = () => {
    if (returnTo) {
      navigate(returnTo)
      return
    }
    navigate(-1)
  }

  const defaultSubject = searchParams.get('subject') || (deal ? `Deal Details - ${deal.name || deal.dealName || deal.title || 'Deal'}` : 'CRM Deal Message')

  return (
    <OutlookEmailComposerModal
      isOpen
      pageMode
      onClose={handleClose}
      recipientEmail={recipientEmail}
      targetType="deal"
      targetId={dealId}
      defaultSubject={defaultSubject}
      defaultMessage={searchParams.get('message') || ''}
      onSuccess={handleClose}
    />
  )
}

export default DealEmailComposePage
