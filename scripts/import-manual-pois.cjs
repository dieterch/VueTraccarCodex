#!/usr/bin/env node

/**
 * Import Manual POIs Script
 *
 * Imports manual POIs from a JSON file into the database.
 * Handles conflicts by updating existing records (upsert).
 *
 * Usage:
 *   node scripts/import-manual-pois.cjs <input-file> [options]
 *
 * Options:
 *   --dry-run    Show what would be imported without making changes
 *   --merge      Merge with existing data (default)
 *   --replace    Delete all existing POIs before import
 *
 * Example:
 *   node scripts/import-manual-pois.cjs manual-pois-export.json
 *   node scripts/import-manual-pois.cjs manual-pois-export.json --dry-run
 *   node scripts/import-manual-pois.cjs manual-pois-export.json --replace
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0].startsWith('--')) {
    console.error('Error: Input file required\n');
    console.log('Usage: node scripts/import-manual-pois.cjs <input-file> [options]\n');
    console.log('Options:');
    console.log('  --dry-run    Show what would be imported without making changes');
    console.log('  --merge      Merge with existing data (default)');
    console.log('  --replace    Delete all existing POIs before import');
    process.exit(1);
  }

  const inputFile = args[0];
  const inputPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.join(process.cwd(), inputFile);

  const dryRun = args.includes('--dry-run');
  const replaceMode = args.includes('--replace');

  console.log('Import Manual POIs');
  console.log('==================\n');

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found at ${inputPath}`);
    process.exit(1);
  }

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  console.log(`Database: ${DB_PATH}`);
  console.log(`Input:    ${inputPath}`);
  console.log(`Mode:     ${replaceMode ? 'REPLACE' : 'MERGE'}${dryRun ? ' (DRY RUN)' : ''}\n`);

  try {
    // Read and parse input file
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    const importData = JSON.parse(fileContent);

    if (!importData.pois || !Array.isArray(importData.pois)) {
      console.error('Error: Invalid file format. Expected { pois: [...] }');
      process.exit(1);
    }

    const pois = importData.pois;
    console.log(`Found ${pois.length} POI(s) to import\n`);

    if (pois.length === 0) {
      console.log('Nothing to import.');
      return;
    }

    if (dryRun) {
      console.log('DRY RUN - No changes will be made\n');
      console.log('The following POIs would be imported:');
      pois.forEach((poi, index) => {
        const addressShort = poi.address ? poi.address.split(',')[0] : 'N/A';
        console.log(`  ${index + 1}. ${poi.country} - ${addressShort} (${poi.timestamp})`);
      });
      return;
    }

    // Open database connection
    const db = new Database(DB_PATH);

    // Start transaction
    const transaction = db.transaction(() => {
      let deletedCount = 0;
      let insertedCount = 0;
      let updatedCount = 0;

      // Delete all existing records if in replace mode
      if (replaceMode) {
        const deleteResult = db.prepare('DELETE FROM manual_pois').run();
        deletedCount = deleteResult.changes;
        console.log(`✓ Deleted ${deletedCount} existing POI(s)\n`);
      }

      // Prepare upsert statement
      const upsert = db.prepare(`
        INSERT INTO manual_pois (
          poi_key,
          latitude,
          longitude,
          timestamp,
          device_id,
          address,
          country,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(poi_key) DO UPDATE SET
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          timestamp = excluded.timestamp,
          device_id = excluded.device_id,
          address = excluded.address,
          country = excluded.country,
          updated_at = excluded.updated_at
      `);

      // Check if record exists (for counting)
      const checkExists = db.prepare('SELECT 1 FROM manual_pois WHERE poi_key = ?');

      // Import each POI
      for (const poi of pois) {
        // Validate required fields
        if (!poi.poi_key || !poi.latitude || !poi.longitude || !poi.timestamp || !poi.device_id) {
          console.warn(`Warning: Skipping POI with missing required fields (poi_key, lat, lng, timestamp, device_id)`);
          continue;
        }

        const exists = checkExists.get(poi.poi_key);
        const now = new Date().toISOString();

        const result = upsert.run(
          poi.poi_key,
          poi.latitude,
          poi.longitude,
          poi.timestamp,
          poi.device_id,
          poi.address || null,
          poi.country || null,
          poi.created_at || now,
          now
        );

        if (exists) {
          updatedCount++;
        } else {
          insertedCount++;
        }
      }

      return { deletedCount, insertedCount, updatedCount };
    });

    // Execute transaction
    const result = transaction();

    // Close database connection
    db.close();

    // Display results
    console.log('Import completed successfully:\n');
    if (replaceMode) {
      console.log(`  Deleted:  ${result.deletedCount} POI(s)`);
    }
    console.log(`  Inserted: ${result.insertedCount} new POI(s)`);
    console.log(`  Updated:  ${result.updatedCount} existing POI(s)`);
    console.log(`  Total:    ${result.insertedCount + result.updatedCount} POI(s) in database\n`);

  } catch (error) {
    console.error('Error during import:', error.message);
    process.exit(1);
  }
}

main();
