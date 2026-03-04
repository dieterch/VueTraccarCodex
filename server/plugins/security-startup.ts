import { isWeakJwtSecret } from '~/server/utils/mobile-auth'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const config = useRuntimeConfig()
  const jwtSecret = String(config.jwtSecret || '')
  if (isWeakJwtSecret(jwtSecret)) {
    throw new Error(
      'Invalid JWT_SECRET for production. Configure a strong secret (min 32 chars, non-default).'
    )
  }
})
