const { AppError } = require('../utils/appError')

const isAuthorizedForDelete = (user) => {
  if (!user) return false
  const targetKeywords = ['keval', 'samir', 'parth', 'rushabh']
  const name = String(user.name || '').trim().toLowerCase()
  const username = String(user.username || '').trim().toLowerCase()
  const email = String(user.email || '').trim().toLowerCase()
  return targetKeywords.some((k) => name.includes(k) || username.includes(k) || email.includes(k))
}

const requireDeleteAuthorization = (req, _res, next) => {
  if (!isAuthorizedForDelete(req.user)) {
    return next(new AppError('Permission Denied: Only Keval V Shah, Samir Sheth, Parth, and Rushabh are authorized to delete records.', 403))
  }
  next()
}

const requirePermission = (...permissionKeys) => (req, _res, next) => {
  if (!req.user) {
    next(new AppError('Authentication is required.', 401))
    return
  }

  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    next()
    return
  }

  const permissions = req.user.permissions || {}
  const hasPermission = permissionKeys.some((key) => Boolean(permissions[key]))
  if (!hasPermission) {
    next(new AppError('You do not have permission to access this resource.', 403))
    return
  }

  next()
}

module.exports = {
  requirePermission,
  isAuthorizedForDelete,
  requireDeleteAuthorization,
}

