import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaPlus } from 'react-icons/fa'
import { TaskStatusBadge } from '../common/TaskStatusBadge'
import { UserEmailBadge } from '../common/UserEmailBadge'

const KANBAN_COLUMNS = [
  { key: 'draft', label: 'Draft', color: '#64748b', bg: '#f1f5f9', matchStatuses: ['draft'] },
  { key: 'open', label: 'Pending', color: '#b45309', bg: '#fef3c7', matchStatuses: ['open', 'pending'] },
  { key: 'checking', label: 'Checking', color: '#b91c1c', bg: '#fee2e2', matchStatuses: ['checking'] },
  { key: 'in_progress', label: 'Processing', color: '#6d28d9', bg: '#ede9fe', matchStatuses: ['in_progress', 'processing'] },
  { key: 'completed', label: 'Completed', color: '#15803d', bg: '#dcfce7', matchStatuses: ['completed', 'closed', 'done'] },
]

export const WorkloadUserKanban = ({
  tasks = [],
  onStatusChange,
  onOpenTask,
  resolveAssigneeName = (email) => email,
  isAdmin = true,
}) => {
  const navigate = useNavigate()

  const handleDragStart = (e, taskItem) => {
    const taskId = String(taskItem.id || taskItem._id)
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (!taskId) return

    const matched = tasks.find((t) => String(t.id || t._id) === String(taskId))
    if (!matched) return

    const currentStatus = String(matched.status || 'open').toLowerCase()
    if (currentStatus === targetStatus) return

    if (onStatusChange) {
      onStatusChange(taskId, targetStatus)
    }
  }

  const handleOpenAdd = (statusKey) => {
    const target = isAdmin ? `/admin/tasks/add?status=${statusKey}` : `/tasks/add?status=${statusKey}`
    navigate(target)
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        paddingBottom: '0.5rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(190px, 1fr))',
          gap: '0.65rem',
          alignItems: 'start',
          minWidth: '980px',
        }}
      >
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => {
            if (!t || (!t.id && !t._id)) return false
            const st = String(t.status || 'open').toLowerCase().replace(/[\s-]+/g, '_')
            return (col.matchStatuses || [col.key]).includes(st)
          })

          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.65rem 0.75rem',
                minHeight: '340px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              {/* Column Header with Count Badge and + Add Icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.color }} />
                  <span style={{ fontWeight: '800', fontSize: '0.78rem', color: '#1e293b' }}>{col.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.08rem 0.35rem',
                      fontSize: '0.68rem',
                      fontWeight: '800',
                      color: '#475569',
                    }}
                  >
                    {colTasks.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenAdd(col.key)}
                    title={`Add Task to ${col.label}`}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#c60016',
                      fontSize: '0.68rem',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff' }}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>

              {/* Task Cards in Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {colTasks.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem 0.5rem',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '0.72rem',
                      fontStyle: 'italic',
                    }}
                  >
                    No tasks
                  </div>
                ) : (
                  colTasks.map((t) => {
                    const taskId = t.id || t._id
                    const assignees = Array.isArray(t.assignedToUserEmails) && t.assignedToUserEmails.length > 0
                      ? t.assignedToUserEmails
                      : (t.assignedTo ? [t.assignedTo] : [])

                    return (
                      <div
                        key={taskId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t)}
                        onClick={() => onOpenTask && onOpenTask(t)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '0.6rem 0.7rem',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                          cursor: 'grab',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 5px 12px rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none'
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.02)'
                        }}
                      >
                        <div style={{ fontWeight: '800', fontSize: '0.78rem', color: '#1e293b', marginBottom: '0.35rem', lineHeight: 1.25 }}>
                          {t.title}
                        </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem' }}>
                        <TaskStatusBadge value={t.priority} type="priority" />
                        {t.dueDate && (
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.45rem', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          {assignees.slice(0, 2).map((email) => (
                            <UserEmailBadge
                              key={email}
                              email={email}
                              name={resolveAssigneeName(email)}
                              size="small"
                            />
                          ))}
                          {assignees.length > 2 && (
                            <span style={{ fontSize: '0.66rem', fontWeight: '800', color: '#c60016' }}>
                              +{assignees.length - 2}
                            </span>
                          )}
                        </div>
                        {t.progress > 0 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#c60016' }}>
                            {t.progress}%
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

export default WorkloadUserKanban
