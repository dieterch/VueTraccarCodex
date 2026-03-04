import { isWeakJwtSecret } from '~/server/utils/mobile-auth'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const jwtSecret = String(config.jwtSecret || '')
  if (isWeakJwtSecret(jwtSecret)) {
    throw new Error(
      'Invalid JWT_SECRET for production. Configure a strong secret (min 32 chars, non-default).'
    )
  }
})
