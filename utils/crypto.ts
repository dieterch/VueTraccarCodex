import CryptoJS from 'crypto-js'

/**
 * Hash a password using SHA-512
 */
export const hashPassword = (password: string): string => {
  return CryptoJS.SHA512(password).toString(CryptoJS.enc.Hex)
}

/**
 * Validate a password against a hash
 */
export const validatePassword = (password: string, hash: string): boolean => {
  const testHash = CryptoJS.SHA512(password).toString(CryptoJS.enc.Hex)
  return testHash === hash
}

/**
 * Set a cookie
 */
export const setCookie = (name: string, value: string, days: number = 7, path: string = '/'): void => {
  if (process.client) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}`
  }
}

/**
 * Get a cookie value
 */
export const getCookie = (name: string): string => {
  if (process.client) {
    return document.cookie.split('; ').reduce((r, v) => {
      const parts = v.split('=')
      return parts[0] === name ? decodeURIComponent(parts[1]) : r
    }, '')
  }
  return ''
}

/**
 * Delete a cookie
 */
export const deleteCookie = (name: string, path: string = '/'): void => {
  setCookie(name, '', -1, path)
}
