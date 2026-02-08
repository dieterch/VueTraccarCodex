import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'

let appDb: Database.Database | null = null

function getAppDb(): Database.Database {
  if (!appDb) {
    const dbPath = join(process.cwd(), 'data', 'app.db')

    // Ensure the directory exists
    const dbDir = dirname(dbPath)
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    appDb = new Database(dbPath)

    // Enable WAL mode for better performance
    appDb.pragma('journal_mode = WAL')

    initializeAppDatabase(appDb)
  }
  return appDb
}

function initializeAppDatabase(database: Database.Database) {
  // Create travel_patches table
  database.exec(`
    CREATE TABLE IF NOT EXISTS travel_patches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address_key TEXT NOT NULL UNIQUE,
      title TEXT,
      from_date TEXT,
      to_date TEXT,
      exclude INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_travel_address
    ON travel_patches(address_key)
  `)

  // Create standstill_adjustments table
  database.exec(`
    CREATE TABLE IF NOT EXISTS standstill_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      standstill_key TEXT NOT NULL UNIQUE,
      start_adjustment_minutes INTEGER DEFAULT 0,
      end_adjustment_minutes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_standstill_key
    ON standstill_adjustments(standstill_key)
  `)

  // Create manual_pois table
  database.exec(`
    CREATE TABLE IF NOT EXISTS manual_pois (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poi_key TEXT NOT NULL UNIQUE,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp TEXT NOT NULL,
      device_id INTEGER NOT NULL,
      address TEXT,
      country TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_poi_key
    ON manual_pois(poi_key)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_poi_device
    ON manual_pois(device_id)
  `)
}

export function getTravelPatches(): any[] {
  const database = getAppDb()
  const rows = database.prepare(`
    SELECT * FROM travel_patches
    ORDER BY address_key ASC
  `).all()
  return rows as any[]
}

export function getTravelPatch(addressKey: string): any | null {
  const database = getAppDb()
  const row = database.prepare(`
    SELECT * FROM travel_patches WHERE address_key = ?
  `).get(addressKey)
  return row || null
}

export function saveTravelPatch(patch: {
  addressKey: string
  title?: string
  fromDate?: string
  toDate?: string
  exclude?: boolean
}): void {
  const database = getAppDb()

  const existing = getTravelPatch(patch.addressKey)

  if (existing) {
    database.prepare(`
      UPDATE travel_patches
      SET title = ?, from_date = ?, to_date = ?, exclude = ?, updated_at = CURRENT_TIMESTAMP
      WHERE address_key = ?
    `).run(
      patch.title || null,
      patch.fromDate || null,
      patch.toDate || null,
      patch.exclude ? 1 : 0,
      patch.addressKey
    )
  } else {
    database.prepare(`
      INSERT INTO travel_patches
      (address_key, title, from_date, to_date, exclude)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      patch.addressKey,
      patch.title || null,
      patch.fromDate || null,
      patch.toDate || null,
      patch.exclude ? 1 : 0
    )
  }
}

export function deleteTravelPatch(addressKey: string): void {
  const database = getAppDb()
  database.prepare('DELETE FROM travel_patches WHERE address_key = ?').run(addressKey)
}

export function getStandstillAdjustment(standstillKey: string): any | null {
  const database = getAppDb()
  const row = database.prepare(`
    SELECT * FROM standstill_adjustments WHERE standstill_key = ?
  `).get(standstillKey)
  return row || null
}

export function saveStandstillAdjustment(adjustment: {
  standstillKey: string
  startAdjustmentMinutes: number
  endAdjustmentMinutes: number
}): void {
  const database = getAppDb()

  const existing = getStandstillAdjustment(adjustment.standstillKey)

  if (existing) {
    database.prepare(`
      UPDATE standstill_adjustments
      SET start_adjustment_minutes = ?, end_adjustment_minutes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE standstill_key = ?
    `).run(
      adjustment.startAdjustmentMinutes,
      adjustment.endAdjustmentMinutes,
      adjustment.standstillKey
    )
  } else {
    database.prepare(`
      INSERT INTO standstill_adjustments
      (standstill_key, start_adjustment_minutes, end_adjustment_minutes)
      VALUES (?, ?, ?)
    `).run(
      adjustment.standstillKey,
      adjustment.startAdjustmentMinutes,
      adjustment.endAdjustmentMinutes
    )
  }
}

export function deleteStandstillAdjustment(standstillKey: string): void {
  const database = getAppDb()
  database.prepare('DELETE FROM standstill_adjustments WHERE standstill_key = ?').run(standstillKey)
}

export function deleteStandstillAdjustmentByKey(key: string): void {
  const database = getAppDb()
  database.prepare('DELETE FROM standstill_adjustments WHERE standstill_key = ?').run(key)
}

export function getAllManualPOIs(): any[] {
  const database = getAppDb()
  const rows = database.prepare(`
    SELECT * FROM manual_pois
    ORDER BY timestamp DESC
  `).all()
  return rows as any[]
}

export function getManualPOI(id: number): any | null {
  const database = getAppDb()
  const row = database.prepare(`
    SELECT * FROM manual_pois WHERE id = ?
  `).get(id)
  return row || null
}

export function saveManualPOI(poi: {
  poiKey: string
  latitude: number
  longitude: number
  timestamp: string
  deviceId: number
  address?: string
  country?: string
}): number {
  const database = getAppDb()

  const result = database.prepare(`
    INSERT INTO manual_pois
    (poi_key, latitude, longitude, timestamp, device_id, address, country)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    poi.poiKey,
    poi.latitude,
    poi.longitude,
    poi.timestamp,
    poi.deviceId,
    poi.address || null,
    poi.country || null
  )

  return result.lastInsertRowid as number
}

export function deleteManualPOI(id: number): void {
  const database = getAppDb()
  database.prepare('DELETE FROM manual_pois WHERE id = ?').run(id)
}

export function closeAppDatabase() {
  if (appDb) {
    appDb.close()
    appDb = null
  }
}
