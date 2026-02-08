#!/usr/bin/env node

/**
 * Import Travel Patches Script
 *
 * Imports travel patch adjustments from a YML file into the database.
 * Handles conflicts by updating existing records (upsert).
 *
 * Usage:
 *   node scripts/import-travel-patches.cjs <input-file> [options]
 *
 * Options:
 *   --dry-run    Show what would be imported without making changes
 *   --merge      Merge with existing data (default)
 *   --replace    Delete all existing patches before import
 *
 * Example:
 *   node scripts/import-travel-patches.cjs travel-patches.yml
 *   node scripts/import-travel-patches.cjs travel-patches.yml --dry-run
 *   node scripts/import-travel-patches.cjs travel-patches.yml --replace
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Configuration
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0].startsWith('--')) {
    console.error('Error: Input file required\n');
    console.log('Usage: node scripts/import-travel-patches.cjs <input-file> [options]\n');
    console.log('Options:');
    console.log('  --dry-run    Show what would be imported without making changes');
    console.log('  --merge      Merge with existing data (default)');
    console.log('  --replace    Delete all existing patches before import');
    process.exit(1);
  }

  const inputFile = args[0];
  const inputPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.join(process.cwd(), inputFile);

  const dryRun = args.includes('--dry-run');
  const replaceMode = args.includes('--replace');

  console.log('Import Travel Patch Adjustments');
  console.log('================================\n');

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
    const importData = yaml.parse(fileContent);

    if (!importData || typeof importData !== 'object') {
      console.error('Error: Invalid YML format. Expected object with address keys.');
      process.exit(1);
    }

    // Convert YML object to array of patches
    const patches = [];
    for (const [addressKey, patchData] of Object.entries(importData)) {
      patches.push({
        address_key: addressKey,
        title: patchData.title === 'null' || patchData.title === null ? null : patchData.title,
        from_date: patchData.from === 'null' || patchData.from === null ? null : patchData.from,
        to_date: patchData.to === 'null' || patchData.to === null ? null : patchData.to,
        exclude: patchData.exclude === true ? 1 : 0
      });
    }

    console.log(`Found ${patches.length} patch(es) to import\n`);

    if (patches.length === 0) {
      console.log('Nothing to import.');
      return;
    }

    if (dryRun) {
      console.log('DRY RUN - No changes will be made\n');
      console.log('The following patches would be imported:');
      patches.forEach((patch, index) => {
        console.log(`  ${index + 1}. ${patch.address_key}`);
        if (patch.title) console.log(`     Title:   ${patch.title}`);
        if (patch.from_date) console.log(`     From:    ${patch.from_date}`);
        if (patch.to_date) console.log(`     To:      ${patch.to_date}`);
        if (patch.exclude === 1) console.log(`     Exclude: true`);
        if (index < patches.length - 1) console.log('');
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
        const deleteResult = db.prepare('DELETE FROM travel_patches').run();
        deletedCount = deleteResult.changes;
        console.log(`✓ Deleted ${deletedCount} existing patch(es)\n`);
      }

      // Prepare upsert statement
      const upsert = db.prepare(`
        INSERT INTO travel_patches (
          address_key,
          title,
          from_date,
          to_date,
          exclude,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(address_key) DO UPDATE SET
          title = excluded.title,
          from_date = excluded.from_date,
          to_date = excluded.to_date,
          exclude = excluded.exclude,
          updated_at = excluded.updated_at
      `);

      // Check if record exists (for counting)
      const checkExists = db.prepare('SELECT 1 FROM travel_patches WHERE address_key = ?');

      // Import each patch
      for (const patch of patches) {
        // Validate required fields
        if (!patch.address_key) {
          console.warn(`Warning: Skipping patch with missing address_key`);
          continue;
        }

        const exists = checkExists.get(patch.address_key);
        const now = new Date().toISOString();

        const result = upsert.run(
          patch.address_key,
          patch.title,
          patch.from_date,
          patch.to_date,
          patch.exclude,
          now,
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
      console.log(`  Deleted:  ${result.deletedCount} patch(es)`);
    }
    console.log(`  Inserted: ${result.insertedCount} new patch(es)`);
    console.log(`  Updated:  ${result.updatedCount} existing patch(es)`);
    console.log(`  Total:    ${result.insertedCount + result.updatedCount} patch(es) in database\n`);

  } catch (error) {
    console.error('Error during import:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
