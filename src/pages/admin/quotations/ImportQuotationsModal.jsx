import React, { useMemo } from 'react'
import Modal from '../../../components/common/Modal'
import Button from '../../../components/common/Button'

export const ImportQuotationsModal = ({
  isOpen,
  onClose,
  importPreviewQuotations = [],
  importExcelHeaders = [],
  importPreviewFilter = 'all',
  onFilterChange,
  isImporting = false,
  onConfirmImport,
}) => {
  if (!isOpen) return null

  const newCount = importPreviewQuotations.filter((r) => !r.isDuplicate).length
  const duplicateCount = importPreviewQuotations.filter((r) => r.isDuplicate).length

  const filteredRows = importPreviewQuotations.filter((row) => {
    if (importPreviewFilter === 'new') return !row.isDuplicate
    if (importPreviewFilter === 'duplicate') return row.isDuplicate
    return true
  })

  // Table-aligned preview columns starting with Old Quotation No., followed by remaining Excel columns
  const finalHeaders = useMemo(() => {
    const PRIORITY_HEADERS = [
      'Old Quotation No.',
      'Quotation Number',
      'Quotation Added By',
      'Quotation Date',
      'Company Name',
      'Quotation Total',
      'Status',
      'Project Name',
    ]

    const detected = (Array.isArray(importExcelHeaders) ? importExcelHeaders : [])
      .map((h) => String(h || '').trim())
      .filter(Boolean)

    const priorityLower = new Set(PRIORITY_HEADERS.map((h) => h.toLowerCase()))
    const extraHeaders = detected.filter((h) => !priorityLower.has(h.toLowerCase()))

    return [...PRIORITY_HEADERS, ...extraHeaders]
  }, [importExcelHeaders])

  const getCellValue = (row, header) => {
    if (!row) return ''

    if (header === 'Old Quotation No.') {
      return String(
        row['Old Quotation No.'] ||
        row.oldQuotationNumber ||
        row['Quotation Number'] ||
        row.quotationNumber ||
        row.num ||
        row['Quote Number'] ||
        '-'
      )
    }

    if (header === 'Quotation Number') {
      return String(
        row['Quotation Number'] ||
        row.quotationNumber ||
        row['Old Quotation No.'] ||
        row.oldQuotationNumber ||
        row.num ||
        '-'
      )
    }

    if (header === 'Quotation Added By') {
      return String(
        row['Quotation Added By'] ||
        row.quotationAddedBy ||
        row.quotationOwner ||
        row.ownerName ||
        row.owner ||
        '-'
      )
    }

    if (header === 'Quotation Date') {
      return String(
        row['Quotation Date'] ||
        row.quotationDate ||
        row['Old Quotation Date'] ||
        row.oldQuotationDate ||
        row.date ||
        '-'
      )
    }

    if (header === 'Company Name') {
      return String(
        row['Company Name'] ||
        row.companyName ||
        row.company ||
        row.customerName ||
        row.clientName ||
        '-'
      )
    }

    if (header === 'Quotation Total') {
      if (row['Quotation Total'] !== undefined && row['Quotation Total'] !== null && String(row['Quotation Total']).trim() !== '') {
        return String(row['Quotation Total'])
      }
      if (row.amount !== undefined && row.amount !== null && row.amount !== '') {
        const numVal = Number(row.amount)
        return Number.isFinite(numVal) ? `₹${numVal.toLocaleString('en-IN')}` : String(row.amount)
      }
      if (row.totalAmount !== undefined && row.totalAmount !== null && row.totalAmount !== '') {
        return String(row.totalAmount)
      }
      return '₹0'
    }

    if (header === 'Status') {
      return String(row['Status'] || row.status || 'Open')
    }

    if (header === 'Project Name') {
      return String(row['Project Name'] || row.projectName || row.project || '-')
    }

    if (row[header] !== undefined && row[header] !== null && String(row[header]).trim() !== '') {
      return String(row[header])
    }
    // Case-insensitive fallback lookup in row
    const targetLower = header.toLowerCase()
    const matchingKey = Object.keys(row).find((k) => k.toLowerCase() === targetLower)
    if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
      return String(row[matchingKey])
    }
    return ''
  }

  return (
    <div style={{ position: 'relative', zIndex: 99999 }}>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="xlarge"
        title={`Import Old Quotations Preview (${importPreviewQuotations.length} Records)`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a' }}>
          {/* Filter Pills and Total summary */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: importPreviewFilter === 'all' ? '#0284c7' : '#f8fafc',
                  color: importPreviewFilter === 'all' ? '#ffffff' : '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => onFilterChange('all')}
              >
                All ({importPreviewQuotations.length})
              </button>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: importPreviewFilter === 'new' ? '#16a34a' : '#f8fafc',
                  color: importPreviewFilter === 'new' ? '#ffffff' : '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => onFilterChange('new')}
              >
                New ({newCount})
              </button>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: importPreviewFilter === 'duplicate' ? '#ea580c' : '#f8fafc',
                  color: importPreviewFilter === 'duplicate' ? '#ffffff' : '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => onFilterChange('duplicate')}
              >
                Duplicates ({duplicateCount})
              </button>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Total detected records: <strong style={{ color: '#0f172a' }}>{importPreviewQuotations.length}</strong>
            </div>
          </div>

          {/* Dynamic Full-Fidelity Preview Table */}
          <div
            style={{
              maxHeight: '52vh',
              overflowY: 'auto',
              overflowX: 'auto',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                  <th style={{ padding: '10px 14px', borderBottom: '2px solid #cbd5e1', textAlign: 'left', fontWeight: 700, color: '#1e293b', width: '50px' }}>
                    #
                  </th>
                  <th style={{ padding: '10px 14px', borderBottom: '2px solid #cbd5e1', textAlign: 'left', fontWeight: 700, color: '#1e293b', minWidth: '130px' }}>
                    Duplicate Status
                  </th>
                  {finalHeaders.map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '2px solid #cbd5e1',
                        textAlign: 'left',
                        fontWeight: 700,
                        color: '#1e293b',
                        whiteSpace: 'nowrap',
                        minWidth: '120px',
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={finalHeaders.length + 2} style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '13px' }}>
                      No records in this tab.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={row._id || idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      }}
                    >
                      <td style={{ padding: '8px 14px', color: '#64748b', fontWeight: 500 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: row.isDuplicate ? '#ffedd5' : '#dcfce7',
                            color: row.isDuplicate ? '#c2410c' : '#15803d',
                            border: `1px solid ${row.isDuplicate ? '#fed7aa' : '#bbf7d0'}`,
                          }}
                        >
                          {row.importStatus}
                        </span>
                      </td>
                      {finalHeaders.map((header) => {
                        const cellVal = getCellValue(row, header)
                        const isPrimary =
                          header.toLowerCase().includes('quotation') ||
                          header.toLowerCase().includes('number') ||
                          header.toLowerCase().includes('total') ||
                          header.toLowerCase().includes('amount')
                        return (
                          <td
                            key={header}
                            style={{
                              padding: '8px 14px',
                              whiteSpace: 'nowrap',
                              maxWidth: '320px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: '#0f172a',
                              fontWeight: isPrimary ? 600 : 400,
                            }}
                            title={cellVal}
                          >
                            {cellVal || '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isImporting || importPreviewQuotations.length === 0}
              onClick={onConfirmImport}
            >
              {isImporting ? 'Importing...' : `Confirm & Import (${importPreviewQuotations.length} Quotations)`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ImportQuotationsModal
