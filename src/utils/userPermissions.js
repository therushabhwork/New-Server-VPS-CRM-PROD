/**
 * User permissions and access controls
 */

export const canExportQuotationsExcel = (user) => {
  if (!user || !user.email) return false
  const email = String(user.email).trim().toLowerCase()

  // Allowed emails for Parth and Rushabh
  const authorizedEmails = [
    'parth@support.com',
    'rushabh@support.com',
    'parth@swatiswitchgears.com',
    'rushabh.work51@gmail.com',
    'parthlumos21@gmail.com',
  ]

  if (authorizedEmails.includes(email)) return true

  // Pattern match for user emails belonging to Parth or Rushabh
  if (email.includes('parth') || email.includes('rushabh')) {
    return true
  }

  return false
}

