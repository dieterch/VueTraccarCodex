import { computed } from 'vue'

type AuthState = {
  authenticated: boolean
  user: string
  role: 'admin' | 'user'
  exp: number
}

const refreshTimer = { id: null as ReturnType<typeof setTimeout> | null }

const scheduleRefresh = (exp: number, refresh: () => Promise<void>) => {
  if (!process.client || !exp) return
  if (refreshTimer.id) {
    clearTimeout(refreshTimer.id)
  }
  const now = Math.floor(Date.now() / 1000)
  const secondsUntilRefresh = Math.max(exp - now - 300, 30)
  refreshTimer.id = setTimeout(() => {
    refresh().catch(() => {})
  }, secondsUntilRefresh * 1000)
}

export const useAuth = () => {
  const authState = useState<AuthState>('authState', () => ({
    authenticated: false,
    user: '',
    role: 'user',
    exp: 0
  }))
  const authReady = useState<boolean>('authReady', () => false)
  const authError = useState<string>('authError', () => '')

  const loadMe = async () => {
    const me = await $fetch('/api/auth/me')
    if (me.authenticated) {
      authState.value = {
        authenticated: true,
        user: me.user || '',
        role: me.role === 'admin' ? 'admin' : 'user',
        exp: me.exp || 0
      }
      scheduleRefresh(authState.value.exp, bootstrapAuth)
    } else {
      authState.value.authenticated = false
    }
  }

  const bootstrapAuth = async () => {
    try {
      authError.value = ''
      await $fetch('/api/auth/token', { method: 'POST' })
      await loadMe()
    } catch (error: any) {
      authError.value = error?.message || 'Authentication failed'
      authState.value.authenticated = false
    } finally {
      authReady.value = true
    }
  }

  const isAdmin = computed(() => authState.value.role === 'admin')

  return {
    authState,
    authReady,
    authError,
    bootstrapAuth,
    isAdmin
  }
}
