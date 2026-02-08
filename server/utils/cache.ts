import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'
import type { RoutePosition, StandstillPeriod } from '~/types/traccar'

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(process.cwd(), 'data', 'cache', 'route.db')

    // Ensure the directory exists
    const dbDir = dirname(dbPath)
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    db = new Database(dbPath)

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL')

    initializeDatabase(db)
  }
  return db
}

function initializeDatabase(database: Database.Database) {
  // Create route_positions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS route_positions (
      id INTEGER PRIMARY KEY,
      device_id INTEGER NOT NULL,
      fix_time TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL NOT NULL,
      speed REAL NOT NULL,
      total_distance REAL NOT NULL,
      attributes TEXT NOT NULL
    )
  `)

  // Create standstill_periods table
  database.exec(`
    CREATE TABLE IF NOT EXISTS standstill_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      von TEXT NOT NULL,
      bis TEXT NOT NULL,
      period REAL NOT NULL,
      country TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      key TEXT NOT NULL UNIQUE
    )
  `)

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_device_time
    ON route_positions(device_id, fix_time)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_standstill_device
    ON standstill_periods(device_id)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_standstill_key
    ON standstill_periods(key)
  `)
}

export function saveRoutePositions(positions: RoutePosition[], deviceId: number) {
  const database = getDb()

  const insert = database.prepare(`
    INSERT OR REPLACE INTO route_positions
    (id, device_id, fix_time, latitude, longitude, altitude, speed, total_distance, attributes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = database.transaction((positions: RoutePosition[]) => {
    for (const pos of positions) {
      insert.run(
        pos.id,
        deviceId,
        pos.fixTime,
        pos.latitude,
        pos.longitude,
        pos.altitude,
        pos.speed,
        pos.totalDistance,
        JSON.stringify(pos.attributes)
      )
    }
  })

  insertMany(positions)
}

export function saveStandstillPeriods(periods: StandstillPeriod[], deviceId: number) {
  const database = getDb()

  const insert = database.prepare(`
    INSERT OR REPLACE INTO standstill_periods
    (device_id, von, bis, period, country, address, latitude, longitude, key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = database.transaction((periods: StandstillPeriod[]) => {
    for (const period of periods) {
      insert.run(
        deviceId,
        period.von,
        period.bis,
        period.period,
        period.country,
        period.address,
        period.latitude,
        period.longitude,
        period.key
      )
    }
  })

  insertMany(periods)
}

export function getRoutePositions(deviceId: number, from?: string, to?: string): RoutePosition[] {
  const database = getDb()

  let query = 'SELECT * FROM route_positions WHERE device_id = ?'
  const params: any[] = [deviceId]

  if (from) {
    query += ' AND fix_time >= ?'
    params.push(from)
  }

  if (to) {
    query += ' AND fix_time <= ?'
    params.push(to)
  }

  query += ' ORDER BY fix_time ASC'

  const rows = database.prepare(query).all(...params) as any[]

  return rows.map(row => ({
    id: row.id,
    deviceId: row.device_id,
    fixTime: row.fix_time,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    speed: row.speed,
    totalDistance: row.total_distance,
    attributes: JSON.parse(row.attributes)
  }))
}

export function getStandstillPeriods(deviceId: number): StandstillPeriod[] {
  const database = getDb()

  const rows = database.prepare(`
    SELECT * FROM standstill_periods
    WHERE device_id = ?
    ORDER BY von ASC
  `).all(deviceId) as any[]

  return rows.map(row => ({
    id: row.id,
    deviceId: row.device_id,
    von: row.von,
    bis: row.bis,
    period: row.period,
    country: row.country,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    key: row.key
  }))
}

export function getLastRoutePosition(deviceId: number): RoutePosition | null {
  const database = getDb()

  const row = database.prepare(`
    SELECT * FROM route_positions
    WHERE device_id = ?
    ORDER BY fix_time DESC
    LIMIT 1
  `).get(deviceId) as any

  if (!row) return null

  return {
    id: row.id,
    deviceId: row.device_id,
    fixTime: row.fix_time,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    speed: row.speed,
    totalDistance: row.total_distance,
    attributes: JSON.parse(row.attributes)
  }
}

export function hasCachedData(deviceId: number): boolean {
  const database = getDb()

  const result = database.prepare(`
    SELECT COUNT(*) as count FROM route_positions WHERE device_id = ?
  `).get(deviceId) as { count: number }

  return result.count > 0
}

export function clearCache(deviceId: number) {
  const database = getDb()

  database.prepare('DELETE FROM route_positions WHERE device_id = ?').run(deviceId)
  database.prepare('DELETE FROM standstill_periods WHERE device_id = ?').run(deviceId)
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
