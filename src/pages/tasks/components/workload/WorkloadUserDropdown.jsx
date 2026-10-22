import React, { useState, useRef, useEffect, useMemo } from 'react'
import { FaChevronDown, FaSearch, FaCheck } from 'react-icons/fa'

export const WorkloadUserDropdown = ({
  members = [],
  selectedUser,
  onSelectUser,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const q = searchQuery.toLowerCase().trim()
    return members.filter((m) => {
      const name = String(m.name || m.username || '').toLowerCase()
      const email = String(m.email || '').toLowerCase()
      const role = String(m.role || '').toLowerCase()
      const department = String(m.department || '').toLowerCase()
      return name.includes(q) || email.includes(q) || role.includes(q) || department.includes(q)
    })
  }, [members, searchQuery])

  const currentName = selectedUser?.name || selectedUser?.username || selectedUser?.email || 'Select User'
  const currentInitial = (currentName.charAt(0) || 'U').toUpperCase()

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.42rem 0.85rem',
          backgroundColor: '#ffffff',
          border: isOpen ? '1.5px solid #c60016' : '1.5px solid #cbd5e1',
          borderRadius: '10px',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(198, 0, 22, 0.12)' : '0 1px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease',
          minWidth: '220px',
          justifyContent: 'space-between',
        }}
        title="Select team member to view workload"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#c60016',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: '800',
              flexShrink: 0,
            }}
          >
            {currentInitial}
          </div>
          <div style={{ textAlign: 'left', minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: '700',
                color: '#1e293b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '150px',
              }}
            >
              {currentName}
            </div>
            {selectedUser?.role && (
              <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'capitalize' }}>
                {selectedUser.role}
              </div>
            )}
          </div>
        </div>
        <FaChevronDown
          style={{
            fontSize: '0.72rem',
            color: '#64748b',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '300px',
            backgroundColor: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.12)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Header & Search */}
          <div
            style={{
              padding: '0.65rem 0.75rem',
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: '#fafbfc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Team Members Directory
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#c60016', background: '#fee2e2', padding: '0.08rem 0.4rem', borderRadius: '8px' }}>
                {members.length}
              </span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <FaSearch style={{ position: 'absolute', left: '0.55rem', color: '#94a3b8', fontSize: '0.7rem' }} />
              <input
                type="text"
                placeholder="Search member name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.35rem 0.5rem 0.35rem 1.65rem',
                  fontSize: '0.76rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Members List */}
          <div
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '0.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
            }}
          >
            {filteredMembers.length === 0 ? (
              <div style={{ padding: '1.25rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.76rem' }}>
                No members found matching "{searchQuery}"
              </div>
            ) : (
              filteredMembers.map((m) => {
                const mName = m.name || m.username || m.email || 'Member'
                const mInitial = (mName.charAt(0) || 'U').toUpperCase()
                const isSelected = String(m.email || '').toLowerCase() === String(selectedUser?.email || '').toLowerCase()

                return (
                  <div
                    key={m.email || m.id || mName}
                    onClick={() => {
                      onSelectUser(m)
                      setIsOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#fef2f2' : 'transparent',
                      borderLeft: isSelected ? '3px solid #c60016' : '3px solid transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: isSelected ? '#c60016' : '#e2e8f0',
                          color: isSelected ? '#ffffff' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          flexShrink: 0,
                        }}
                      >
                        {mInitial}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: isSelected ? '800' : '700',
                            color: isSelected ? '#c60016' : '#1e293b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px',
                          }}
                        >
                          {mName}
                        </div>
                        <div
                          style={{
                            fontSize: '0.66rem',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px',
                          }}
                        >
                          {m.role || 'User'} &bull; {m.email}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <FaCheck style={{ color: '#c60016', fontSize: '0.72rem', flexShrink: 0 }} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkloadUserDropdown
