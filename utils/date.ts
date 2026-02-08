/**
 * Format date for Traccar API (ISO format with time set to 00:00:00Z)
 */
export const tracdate = (date: Date): string => {
  return date.toISOString().split('T')[0] + 'T00:00:00Z'
}

/**
 * Format date to YYYY-MM-DD
 */
export const formatDate = (date: Date | string): string => {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  return date.toISOString().split('T')[0]
}

/**
 * Format datetime to readable format (YYYY-MM-DD HH:mm)
 */
export const formatDateTime = (date: Date | string): string => {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * Parse date string to Date object
 */
export const parseDate = (dateStr: string): Date => {
  return new Date(dateStr)
}
