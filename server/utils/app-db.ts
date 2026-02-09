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

  // Create manual_travels table
  database.exec(`
    CREATE TABLE IF NOT EXISTS manual_travels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_device_id INTEGER NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_manual_travels_device
    ON manual_travels(source_device_id)
  `)

  // Create manual_travel_positions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS manual_travel_positions (
      id TEXT PRIMARY KEY,
      travel_id TEXT NOT NULL,
      fix_time TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL,
      altitude REAL,
      attributes TEXT,
      FOREIGN KEY (travel_id) REFERENCES manual_travels(id)
    )
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_manual_travel_positions_travel
    ON manual_travel_positions(travel_id)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_manual_travel_positions_fix_time
    ON manual_travel_positions(fix_time)
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

export function getManualTravels(): any[] {
  const database = getAppDb()
  const rows = database.prepare(`
    SELECT * FROM manual_travels
    ORDER BY from_date ASC
  `).all()
  return rows as any[]
}

export function getManualTravel(id: string): any | null {
  const database = getAppDb()
  const row = database.prepare(`
    SELECT * FROM manual_travels WHERE id = ?
  `).get(id)
  return row || null
}

export function createManualTravel(travel: {
  id: string
  title: string
  sourceDeviceId: number
  fromDate: string
  toDate: string
  notes?: string
}): void {
  const database = getAppDb()
  database.prepare(`
    INSERT INTO manual_travels
    (id, title, source_device_id, from_date, to_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    travel.id,
    travel.title,
    travel.sourceDeviceId,
    travel.fromDate,
    travel.toDate,
    travel.notes || null
  )
}

export function deleteManualTravel(travelId: string): void {
  const database = getAppDb()
  const transaction = database.transaction(() => {
    database.prepare('DELETE FROM manual_travel_positions WHERE travel_id = ?').run(travelId)
    database.prepare('DELETE FROM manual_travels WHERE id = ?').run(travelId)
  })
  transaction()
}

export function getManualTravelPositions(travelId: string): any[] {
  const database = getAppDb()
  const rows = database.prepare(`
    SELECT * FROM manual_travel_positions
    WHERE travel_id = ?
    ORDER BY fix_time ASC
  `).all(travelId)
  return rows as any[]
}

export function replaceManualTravelPositions(travelId: string, positions: Array<{
  id: string
  fixTime: string
  latitude: number
  longitude: number
  speed?: number
  altitude?: number
  attributes?: string | null
}>): void {
  const database = getAppDb()
  const transaction = database.transaction(() => {
    database.prepare('DELETE FROM manual_travel_positions WHERE travel_id = ?').run(travelId)

    const insert = database.prepare(`
      INSERT INTO manual_travel_positions
      (id, travel_id, fix_time, latitude, longitude, speed, altitude, attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const pos of positions) {
      insert.run(
        pos.id,
        travelId,
        pos.fixTime,
        pos.latitude,
        pos.longitude,
        pos.speed ?? null,
        pos.altitude ?? null,
        pos.attributes ?? null
      )
    }
  })

  transaction()
}

export function closeAppDatabase() {
  if (appDb) {
    appDb.close()
    appDb = null
  }
}
