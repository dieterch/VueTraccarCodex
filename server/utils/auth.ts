import { SignJWT, jwtVerify } from 'jose'
import { getHeader, getCookie } from 'h3'

type AuthContext = {
  user: string
  role: 'admin' | 'user'
  groups: string[]
  exp: number
}

const toLower = (value: string) => value.trim().toLowerCase()

export const isAuthBypassEnabled = () => {
  const config = useRuntimeConfig()
  return config.authBypass === true && process.env.NODE_ENV !== 'production'
}

export const getAutheliaUser = (event: any) => {
  const user = getHeader(event, 'remote-user')
  const groupsHeader = getHeader(event, 'remote-groups')
  const groups = groupsHeader
    ? String(groupsHeader).split(',').map(toLower).filter(Boolean)
    : []

  return {
    user: user ? String(user) : '',
    groups
  }
}

export const resolveRole = (groups: string[]) => {
  const config = useRuntimeConfig()
  const adminGroup = String(config.adminGroup || 'admins').toLowerCase()
  return groups.map(toLower).includes(adminGroup) ? 'admin' : 'user'
}

export const issueJwt = async (payload: { user: string; groups: string[] }) => {
  const config = useRuntimeConfig()
  const secret = new TextEncoder().encode(String(config.jwtSecret))
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Number(config.jwtTtlSeconds || 3600)
  const role = resolveRole(payload.groups)

  const token = await new SignJWT({
    groups: payload.groups,
    role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.user)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer(String(config.jwtIssuer || 'vue-traccar'))
    .setAudience(String(config.jwtAudience || 'vue-traccar-ui'))
    .sign(secret)

  return { token, exp, role }
}

export const verifyJwt = async (token: string) => {
  const config = useRuntimeConfig()
  const secret = new TextEncoder().encode(String(config.jwtSecret))
  const { payload } = await jwtVerify(token, secret, {
    issuer: String(config.jwtIssuer || 'vue-traccar'),
    audience: String(config.jwtAudience || 'vue-traccar-ui')
  })

  return payload
}

export const getJwtFromCookie = (event: any) => {
  const config = useRuntimeConfig()
  const cookieName = String(config.authCookieName || 'vt_auth')
  const token = getCookie(event, cookieName)
  return token ? String(token) : ''
}

export const buildAuthContext = (payload: any): AuthContext => {
  const groups = Array.isArray(payload.groups) ? payload.groups.map(String) : []
  const role = payload.role === 'admin' ? 'admin' : 'user'
  return {
    user: String(payload.sub || ''),
    role,
    groups,
    exp: Number(payload.exp || 0)
  }
}
