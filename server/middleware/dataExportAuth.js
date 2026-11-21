const { AppError } = require('../utils/appError');

const isAuthorizedForDataExport = (user) => {
  if (!user) return false;
  const candidates = [
    user.name,
    user.username,
    user.email,
  ].map((v) => String(v || '').trim().toLowerCase());

  return candidates.some((val) =>
    val === 'keval v shah' ||
    val === 'keval v. shah' ||
    val === 'kevalvshah' ||
    val.startsWith('keval@') ||
    val === 'samir sheth' ||
    val === 'samir-sheth' ||
    val.startsWith('samirsheth@') ||
    val === 'parth crm support' ||
    val === 'parth-crm-support' ||
    val.startsWith('parth@') ||
    val === 'rushabh crm support' ||
    val === 'rushabh-crm-support' ||
    val.startsWith('rushabh@')
  );
};

const requireDataExportAuth = (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication is required.', 401));
  }

  if (!isAuthorizedForDataExport(req.user)) {
    return next(new AppError('Access denied: Centralized Data Export is restricted to authorized administrators.', 403));
  }

  next();
};

module.exports = {
  isAuthorizedForDataExport,
  requireDataExportAuth,
};
