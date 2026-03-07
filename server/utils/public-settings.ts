import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { createError } from 'h3'

export type SideTripDeviceSetting = {
  deviceId: number
  deviceName: string
  color: string
  lineWeight: number
  enabled: boolean
}

export type PublicSettings = {
  traccarDeviceId: number | null
  traccarDeviceName: string
  googleMapsMapId: string
  wordpressCacheDuration: number
  homeMode: boolean
  homeLatitude: string
  homeLongitude: string
  homeGeofenceId: number
  homeGeofenceName: string
  eventMinGap: number
  maxDays: number
  minDays: number
  standPeriod: number
  startDate: string
  sideTripEnabled: boolean
  sideTripDevices: SideTripDeviceSetting[]
  sideTripBufferHours: number
}

const PUBLIC_SETTINGS_KEYS = [
  'traccarDeviceId',
  'traccarDeviceName',
  'googleMapsMapId',
  'wordpressCacheDuration',
  'homeMode',
  'homeLatitude',
  'homeLongitude',
  'homeGeofenceId',
  'homeGeofenceName',
  'eventMinGap',
  'maxDays',
  'minDays',
  'standPeriod',
  'startDate',
  'sideTripEnabled',
  'sideTripDevices',
  'sideTripBufferHours'
] as const

const PUBLIC_SETTINGS_KEY_SET = new Set<string>(PUBLIC_SETTINGS_KEYS)

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const toOptionalInt = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const n = Number.parseInt(String(value), 10)
  if (!Number.isFinite(n)) {
    throw createError({ statusCode: 400, message: `Invalid integer for ${field}` })
  }
  return n
}

const toInt = (value: unknown, field: string) => {
  const n = Number.parseInt(String(value), 10)
  if (!Number.isFinite(n)) {
    throw createError({ statusCode: 400, message: `Invalid integer for ${field}` })
  }
  return n
}

const toBool = (value: unknown, field: string) => {
  if (typeof value !== 'boolean') {
    throw createError({ statusCode: 400, message: `Invalid boolean for ${field}` })
  }
  return value
}

const toStringValue = (value: unknown, field: string) => {
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, message: `Invalid string for ${field}` })
  }
  return value
}

const normalizeSideTripDevices = (value: unknown): SideTripDeviceSetting[] => {
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, message: 'Invalid array for sideTripDevices' })
  }

  return value.map((entry, index) => {
    if (!isObject(entry)) {
      throw createError({ statusCode: 400, message: `Invalid sideTripDevices[${index}]` })
    }

    const keys = Object.keys(entry)
    const allowed = new Set(['deviceId', 'deviceName', 'color', 'lineWeight', 'enabled'])
    for (const key of keys) {
      if (!allowed.has(key)) {
        throw createError({
          statusCode: 400,
          message: `Unknown field sideTripDevices[${index}].${key}`
        })
      }
    }

    return {
      deviceId: toInt(entry.deviceId, `sideTripDevices[${index}].deviceId`),
      deviceName: toStringValue(entry.deviceName, `sideTripDevices[${index}].deviceName`),
      color: toStringValue(entry.color, `sideTripDevices[${index}].color`),
      lineWeight: toInt(entry.lineWeight, `sideTripDevices[${index}].lineWeight`),
      enabled: toBool(entry.enabled, `sideTripDevices[${index}].enabled`)
    }
  })
}

const normalizePartialPublicSettings = (
  payload: unknown,
  options: { rejectUnknown: boolean }
): Partial<PublicSettings> => {
  if (!isObject(payload)) {
    throw createError({ statusCode: 400, message: 'Invalid settings payload' })
  }

  const data = payload as Record<string, unknown>
  const result: Partial<PublicSettings> = {}

  for (const [key, rawValue] of Object.entries(data)) {
    if (!PUBLIC_SETTINGS_KEY_SET.has(key)) {
      if (options.rejectUnknown) {
        throw createError({ statusCode: 400, message: `Unknown or forbidden field: ${key}` })
      }
      continue
    }

    switch (key) {
      case 'traccarDeviceId':
        result.traccarDeviceId = toOptionalInt(rawValue, key)
        break
      case 'traccarDeviceName':
      case 'googleMapsMapId':
      case 'homeLatitude':
      case 'homeLongitude':
      case 'homeGeofenceName':
      case 'startDate':
        result[key] = toStringValue(rawValue, key)
        break
      case 'wordpressCacheDuration':
      case 'homeGeofenceId':
      case 'eventMinGap':
      case 'maxDays':
      case 'minDays':
      case 'standPeriod':
      case 'sideTripBufferHours':
        result[key] = toInt(rawValue, key)
        break
      case 'homeMode':
      case 'sideTripEnabled':
        result[key] = toBool(rawValue, key)
        break
      case 'sideTripDevices':
        result.sideTripDevices = normalizeSideTripDevices(rawValue)
        break
      default:
        break
    }
  }

  return result
}

export const normalizeStrictPublicSettingsPayload = (payload: unknown) => {
  return normalizePartialPublicSettings(payload, { rejectUnknown: true })
}

export const normalizeLegacyPublicSettingsPayload = (payload: unknown) => {
  return normalizePartialPublicSettings(payload, { rejectUnknown: false })
}

const buildPublicSettingsFromSource = (source: Record<string, unknown>, config: ReturnType<typeof useRuntimeConfig>): PublicSettings => ({
  traccarDeviceId: toOptionalInt(source.traccarDeviceId ?? config.traccarDeviceId, 'traccarDeviceId'),
  traccarDeviceName: String(source.traccarDeviceName ?? config.traccarDeviceName ?? ''),
  googleMapsMapId: String(source.googleMapsMapId ?? config.public.googleMapsMapId ?? ''),
  wordpressCacheDuration: toInt(source.wordpressCacheDuration ?? config.wordpressCacheDuration ?? 3600, 'wordpressCacheDuration'),
  homeMode: Boolean(source.homeMode ?? config.homeMode ?? false),
  homeLatitude: String(source.homeLatitude ?? config.homeLatitude ?? ''),
  homeLongitude: String(source.homeLongitude ?? config.homeLongitude ?? ''),
  homeGeofenceId: toInt(source.homeGeofenceId ?? config.homeGeofenceId ?? 1, 'homeGeofenceId'),
  homeGeofenceName: String(source.homeGeofenceName ?? config.homeGeofenceName ?? ''),
  eventMinGap: toInt(source.eventMinGap ?? config.eventMinGap ?? 60, 'eventMinGap'),
  maxDays: toInt(source.maxDays ?? config.maxDays ?? 170, 'maxDays'),
  minDays: toInt(source.minDays ?? config.minDays ?? 2, 'minDays'),
  standPeriod: toInt(source.standPeriod ?? config.standPeriod ?? 12, 'standPeriod'),
  startDate: String(source.startDate ?? config.startDate ?? ''),
  sideTripEnabled: Boolean(source.sideTripEnabled ?? false),
  sideTripDevices: Array.isArray(source.sideTripDevices) ? normalizeSideTripDevices(source.sideTripDevices) : [],
  sideTripBufferHours: toInt(source.sideTripBufferHours ?? 6, 'sideTripBufferHours')
})

const getSettingsPath = () => join(process.cwd(), 'data', 'settings.yml')

export const loadSettingsYaml = async (): Promise<Record<string, unknown>> => {
  try {
    const content = await readFile(getSettingsPath(), 'utf-8')
    const parsed = parseYaml(content)
    return isObject(parsed) ? parsed : {}
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

export const writeSettingsYaml = async (data: Record<string, unknown>) => {
  await writeFile(getSettingsPath(), stringifyYaml(data), 'utf-8')
}

export const getPublicSettings = async () => {
  const config = useRuntimeConfig()
  const data = await loadSettingsYaml()
  return buildPublicSettingsFromSource(data, config)
}

export const savePublicSettings = async (
  payload: Partial<PublicSettings>,
  options: { preserveUnknownSettings: boolean }
) => {
  const config = useRuntimeConfig()
  const currentYaml = await loadSettingsYaml()
  const currentPublic = buildPublicSettingsFromSource(currentYaml, config)
  const nextPublic = { ...currentPublic, ...payload }

  const nextYaml: Record<string, unknown> = options.preserveUnknownSettings
    ? { ...currentYaml, ...nextPublic }
    : { ...nextPublic }

  await writeSettingsYaml(nextYaml)
  return nextPublic
}
