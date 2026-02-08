#!/usr/bin/env node

/**
 * Export Timings Adjustments Script
 *
 * Exports all standstill timing adjustments from the database to a JSON file.
 *
 * Usage:
 *   node scripts/export-timings.js [output-file]
 *
 * Example:
 *   node scripts/export-timings.js timings-export.json
 *   node scripts/export-timings.js (defaults to timings-export-[timestamp].json)
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
  const outputFile = args[0] || `timings-export-${timestamp}.json`;
  const outputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(DEFAULT_OUTPUT_DIR, outputFile);

  console.log('Export Timings Adjustments');
  console.log('==========================\n');

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

    // Query all standstill adjustments
    const query = `
      SELECT
        standstill_key,
        start_adjustment_minutes,
        end_adjustment_minutes,
        created_at,
        updated_at
      FROM standstill_adjustments
      ORDER BY id
    `;

    const adjustments = db.prepare(query).all();

    // Close database connection
    db.close();

    // Create export data structure
    const exportData = {
      exported_at: new Date().toISOString(),
      database: DB_PATH,
      count: adjustments.length,
      adjustments: adjustments
    };

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log(`✓ Successfully exported ${adjustments.length} timing adjustment(s)`);
    console.log(`✓ Output saved to: ${outputPath}\n`);

    // Display summary
    if (adjustments.length > 0) {
      console.log('Exported adjustments:');
      adjustments.forEach((adj, index) => {
        console.log(`  ${index + 1}. ${adj.standstill_key}: start=${adj.start_adjustment_minutes}min, end=${adj.end_adjustment_minutes}min`);
      });
    }

  } catch (error) {
    console.error('Error during export:', error.message);
    process.exit(1);
  }
}

main();
