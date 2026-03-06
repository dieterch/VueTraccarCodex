import { isWeakJwtSecret } from '~/server/utils/mobile-auth'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const config = useRuntimeConfig()
  const requiredSecrets = [
    { key: 'JWT_SECRET', value: config.jwtSecret },
    { key: 'SETTINGS_PASSWORD', value: config.settingsPassword },
    { key: 'TRACCAR_PASSWORD', value: config.traccarPassword }
  ]

  if (String(config.wordpressUrl || '').trim().length > 0) {
    requiredSecrets.push(
      { key: 'WORDPRESS_USER', value: config.wordpressUser },
      { key: 'WORDPRESS_APP_PASSWORD', value: config.wordpressAppPassword }
    )
  }

  const missing = requiredSecrets
    .filter((item) => String(item.value || '').trim().length === 0)
    .map((item) => item.key)

  if (missing.length > 0) {
    throw new Error(`Missing required production secrets: ${missing.join(', ')}`)
  }

  const jwtSecret = String(config.jwtSecret || '')
  if (isWeakJwtSecret(jwtSecret)) {
    throw new Error(
      'Invalid JWT_SECRET for production. Configure a strong secret (min 32 chars, non-default).'
    )
  }
})
