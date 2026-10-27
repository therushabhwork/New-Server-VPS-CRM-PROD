import React from 'react'

const InfoCard = ({ title, icon, children, className = '', columns = 1 }) => {
  return (
    <div className={`c-deal-card ${className}`}>
      {title && (
        <div className="c-deal-card-header">
          {icon && <span className="c-deal-card-icon">{icon}</span>}
          <h3 className="c-deal-card-title">{title}</h3>
        </div>
      )}
      <div className={`c-deal-card-content c-deal-card-grid-${columns}`}>
        {children}
      </div>
    </div>
  )
}

export default React.memo(InfoCard)
