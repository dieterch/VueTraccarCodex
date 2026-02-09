import { promises as fs } from 'fs'
import { getRequestIP } from 'h3'

type UserLogEntry = {
  user: string
  role: string
  action: 'login' | 'logout'
  ip?: string
}

const LOG_PATH = '/log/users.log'
const LOG_DIR = '/log'

export const logUserEvent = async (event: any, entry: UserLogEntry) => {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true })
    const timestamp = new Date().toISOString()
    const ip = entry.ip || getRequestIP(event) || ''
    const line = `${timestamp} action=${entry.action} user=${entry.user} role=${entry.role} ip=${ip}`.trim() + '\n'
    await fs.appendFile(LOG_PATH, line, 'utf8')
  } catch (error) {
    console.warn('Failed to write user log:', error)
  }
}
