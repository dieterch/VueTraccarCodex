#!/usr/bin/env node

/**
 * Import Manual Travels Script
 *
 * Imports manual travels and their positions from a JSON file.
 *
 * Usage:
 *   node scripts/import-manual-travels.cjs <input-file> [options]
 *
 * Options:
 *   --dry-run    Show what would be imported without making changes
 *   --replace    Delete all existing manual travels before import
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0].startsWith('--')) {
    console.error('Error: Input file required\n');
    console.log('Usage: node scripts/import-manual-travels.cjs <input-file> [options]\n');
    console.log('Options:');
    console.log('  --dry-run    Show what would be imported without making changes');
    console.log('  --replace    Delete all existing manual travels before import');
    process.exit(1);
  }

  const inputFile = args[0];
  const inputPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.join(process.cwd(), inputFile);

  const dryRun = args.includes('--dry-run');
  const replaceMode = args.includes('--replace');

  console.log('Import Manual Travels');
  console.log('=====================\n');

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found at ${inputPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  console.log(`Database: ${DB_PATH}`);
  console.log(`Input:    ${inputPath}`);
  console.log(`Mode:     ${replaceMode ? 'REPLACE' : 'MERGE'}${dryRun ? ' (DRY RUN)' : ''}\n`);

  try {
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    const importData = JSON.parse(fileContent);

    const travelBundles = normalizeImport(importData);

    if (travelBundles.length === 0) {
      console.log('Nothing to import.');
      return;
    }

    if (dryRun) {
      console.log('DRY RUN - No changes will be made\n');
      console.log('The following manual travels would be imported:');
      travelBundles.forEach((bundle, index) => {
        console.log(`  ${index + 1}. ${bundle.travel.title} (${bundle.travel.from_date} → ${bundle.travel.to_date})`);
      });
      return;
    }

    const db = new Database(DB_PATH);

    const transaction = db.transaction(() => {
      if (replaceMode) {
        db.prepare('DELETE FROM manual_travel_positions').run();
        db.prepare('DELETE FROM manual_travels').run();
      }

      const upsertTravel = db.prepare(`
        INSERT INTO manual_travels (
          id, title, source_device_id, from_date, to_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          source_device_id = excluded.source_device_id,
          from_date = excluded.from_date,
          to_date = excluded.to_date,
          notes = excluded.notes
      `);

      const deletePositions = db.prepare('DELETE FROM manual_travel_positions WHERE travel_id = ?');
      const insertPosition = db.prepare(`
        INSERT INTO manual_travel_positions (
          id, travel_id, fix_time, latitude, longitude, speed, altitude, attributes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      travelBundles.forEach(bundle => {
      const travel = normalizeTravel(bundle.travel);
      if (!travel) return;
      const positions = normalizePositions(bundle.positions || []);

        upsertTravel.run(
          travel.id,
          travel.title,
          travel.source_device_id,
          travel.from_date,
          travel.to_date,
          travel.notes || null,
          travel.created_at || new Date().toISOString()
        );

        deletePositions.run(travel.id);

        positions.forEach(pos => {
          insertPosition.run(
            pos.id,
            travel.id,
            pos.fix_time,
            pos.latitude,
            pos.longitude,
            pos.speed || null,
            pos.altitude || null,
            pos.attributes ? JSON.stringify(pos.attributes) : null
          );
        });
      });
    });

    transaction();
    db.close();

    console.log(`✓ Imported ${travelBundles.length} manual travel(s)\n`);
  } catch (error) {
    console.error('Error during import:', error.message);
    process.exit(1);
  }
}

function normalizeImport(importData) {
  if (!importData) return [];

  if (importData.travel && Array.isArray(importData.positions)) {
    return [{
      travel: importData.travel,
      positions: importData.positions
    }];
  }

  if (Array.isArray(importData.travels)) {
    return importData.travels.map(bundle => ({
      travel: bundle.travel,
      positions: bundle.positions || []
    }));
  }

  return [];
}

function normalizeTravel(travel) {
  if (!travel) return null;
  return {
    id: travel.id,
    title: travel.title || travel.name || `Manual Travel ${travel.id}`,
    source_device_id: travel.source_device_id ?? travel.sourceDeviceId,
    from_date: travel.from_date || travel.fromDate,
    to_date: travel.to_date || travel.toDate,
    notes: travel.notes,
    created_at: travel.created_at || travel.createdAt
  };
}

function normalizePositions(positions) {
  return positions.map(pos => ({
    id: pos.id,
    fix_time: pos.fix_time || pos.fixTime,
    latitude: pos.latitude,
    longitude: pos.longitude,
    speed: pos.speed ?? null,
    altitude: pos.altitude ?? null,
    attributes: pos.attributes ?? pos.attributes
  }));
}

main();
