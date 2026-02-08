#!/usr/bin/env node

/**
 * Import Timings Adjustments Script
 *
 * Imports standstill timing adjustments from a JSON file into the database.
 * Handles conflicts by updating existing records (upsert).
 *
 * Usage:
 *   node scripts/import-timings.js <input-file> [options]
 *
 * Options:
 *   --dry-run    Show what would be imported without making changes
 *   --merge      Merge with existing data (default)
 *   --replace    Delete all existing adjustments before import
 *
 * Example:
 *   node scripts/import-timings.js timings-export.json
 *   node scripts/import-timings.js timings-export.json --dry-run
 *   node scripts/import-timings.js timings-export.json --replace
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
    console.log('Usage: node scripts/import-timings.js <input-file> [options]\n');
    console.log('Options:');
    console.log('  --dry-run    Show what would be imported without making changes');
    console.log('  --merge      Merge with existing data (default)');
    console.log('  --replace    Delete all existing adjustments before import');
    process.exit(1);
  }

  const inputFile = args[0];
  const inputPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.join(process.cwd(), inputFile);

  const dryRun = args.includes('--dry-run');
  const replaceMode = args.includes('--replace');

  console.log('Import Timings Adjustments');
  console.log('==========================\n');

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

    if (!importData.adjustments || !Array.isArray(importData.adjustments)) {
      console.error('Error: Invalid file format. Expected { adjustments: [...] }');
      process.exit(1);
    }

    const adjustments = importData.adjustments;
    console.log(`Found ${adjustments.length} adjustment(s) to import\n`);

    if (adjustments.length === 0) {
      console.log('Nothing to import.');
      return;
    }

    if (dryRun) {
      console.log('DRY RUN - No changes will be made\n');
      console.log('The following adjustments would be imported:');
      adjustments.forEach((adj, index) => {
        console.log(`  ${index + 1}. ${adj.standstill_key}: start=${adj.start_adjustment_minutes}min, end=${adj.end_adjustment_minutes}min`);
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
        const deleteResult = db.prepare('DELETE FROM standstill_adjustments').run();
        deletedCount = deleteResult.changes;
        console.log(`✓ Deleted ${deletedCount} existing adjustment(s)\n`);
      }

      // Prepare upsert statement
      const upsert = db.prepare(`
        INSERT INTO standstill_adjustments (
          standstill_key,
          start_adjustment_minutes,
          end_adjustment_minutes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(standstill_key) DO UPDATE SET
          start_adjustment_minutes = excluded.start_adjustment_minutes,
          end_adjustment_minutes = excluded.end_adjustment_minutes,
          updated_at = excluded.updated_at
      `);

      // Check if record exists (for counting)
      const checkExists = db.prepare('SELECT 1 FROM standstill_adjustments WHERE standstill_key = ?');

      // Import each adjustment
      for (const adj of adjustments) {
        // Validate required fields
        if (!adj.standstill_key) {
          console.warn(`Warning: Skipping adjustment with missing standstill_key`);
          continue;
        }

        const exists = checkExists.get(adj.standstill_key);
        const now = new Date().toISOString();

        const result = upsert.run(
          adj.standstill_key,
          adj.start_adjustment_minutes || 0,
          adj.end_adjustment_minutes || 0,
          adj.created_at || now,
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
      console.log(`  Deleted:  ${result.deletedCount} adjustment(s)`);
    }
    console.log(`  Inserted: ${result.insertedCount} new adjustment(s)`);
    console.log(`  Updated:  ${result.updatedCount} existing adjustment(s)`);
    console.log(`  Total:    ${result.insertedCount + result.updatedCount} adjustment(s) in database\n`);

  } catch (error) {
    console.error('Error during import:', error.message);
    process.exit(1);
  }
}

main();
