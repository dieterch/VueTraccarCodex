#!/usr/bin/env node

/**
 * Export Manual POIs Script
 *
 * Exports all manual POIs from the database to a JSON file.
 *
 * Usage:
 *   node scripts/export-manual-pois.cjs [output-file]
 *
 * Example:
 *   node scripts/export-manual-pois.cjs manual-pois-export.json
 *   node scripts/export-manual-pois.cjs (defaults to manual-pois-export-[timestamp].json)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..');

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputFile = args[0] || `manual-pois-export-${timestamp}.json`;
  const outputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(DEFAULT_OUTPUT_DIR, outputFile);

  console.log('Export Manual POIs');
  console.log('==================\n');

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  console.log(`Database: ${DB_PATH}`);
  console.log(`Output:   ${outputPath}\n`);

  try {
    // Open database connection
    const db = new Database(DB_PATH, { readonly: true });

    // Query all manual POIs
    const query = `
      SELECT
        id,
        poi_key,
        latitude,
        longitude,
        timestamp,
        device_id,
        address,
        country,
        created_at,
        updated_at
      FROM manual_pois
      ORDER BY timestamp DESC
    `;

    const pois = db.prepare(query).all();

    // Close database connection
    db.close();

    // Create export data structure
    const exportData = {
      exported_at: new Date().toISOString(),
      database: DB_PATH,
      count: pois.length,
      pois: pois
    };

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log(`✓ Successfully exported ${pois.length} manual POI(s)`);
    console.log(`✓ Output saved to: ${outputPath}\n`);

    // Display summary
    if (pois.length > 0) {
      console.log('Exported POIs:');
      pois.forEach((poi, index) => {
        const addressShort = poi.address ? poi.address.split(',')[0] : 'N/A';
        console.log(`  ${index + 1}. ${poi.country} - ${addressShort} (${poi.timestamp})`);
      });
    }

  } catch (error) {
    console.error('Error during export:', error.message);
    process.exit(1);
  }
}

main();
