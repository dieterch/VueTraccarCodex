#!/usr/bin/env node

/**
 * Export Manual Travels Script
 *
 * Exports manual travels and their positions to a JSON file.
 *
 * Usage:
 *   node scripts/export-manual-travels.cjs [travel-id] [output-file]
 *
 * Examples:
 *   node scripts/export-manual-travels.cjs
 *   node scripts/export-manual-travels.cjs <travel-id>
 *   node scripts/export-manual-travels.cjs <travel-id> manual-travel.json
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..');

function main() {
  const args = process.argv.slice(2);
  const travelId = args[0] && !args[0].startsWith('--') ? args[0] : null;
  const outputArgIndex = travelId ? 1 : 0;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputFile = args[outputArgIndex] || `manual-travels-export-${timestamp}.json`;
  const outputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(DEFAULT_OUTPUT_DIR, outputFile);

  console.log('Export Manual Travels');
  console.log('=====================\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  console.log(`Database: ${DB_PATH}`);
  console.log(`Output:   ${outputPath}\n`);

  try {
    const db = new Database(DB_PATH, { readonly: true });

    const travelQuery = travelId
      ? 'SELECT * FROM manual_travels WHERE id = ?'
      : 'SELECT * FROM manual_travels ORDER BY from_date ASC';
    const travels = travelId
      ? db.prepare(travelQuery).all(travelId)
      : db.prepare(travelQuery).all();

    const positionQuery = db.prepare(`
      SELECT * FROM manual_travel_positions
      WHERE travel_id = ?
      ORDER BY fix_time ASC
    `);

    const travelExports = travels.map(travel => {
      const positions = positionQuery.all(travel.id).map(pos => ({
        id: pos.id,
        travel_id: pos.travel_id,
        fix_time: pos.fix_time,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: pos.speed,
        altitude: pos.altitude,
        attributes: pos.attributes ? safeParseJson(pos.attributes) : null
      }));

      return {
        travel,
        positions
      };
    });

    db.close();

    const meta = {
      source: 'manual',
      created: new Date().toISOString(),
      database: DB_PATH,
      count: travelExports.length
    };

    const exportData = travelId
      ? { meta, travel: travelExports[0]?.travel || null, positions: travelExports[0]?.positions || [] }
      : { meta, travels: travelExports };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log(`✓ Exported ${travelExports.length} manual travel(s)`);
    console.log(`✓ Output saved to: ${outputPath}\n`);
  } catch (error) {
    console.error('Error during export:', error.message);
    process.exit(1);
  }
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

main();
