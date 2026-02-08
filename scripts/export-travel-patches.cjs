#!/usr/bin/env node

/**
 * Export Travel Patches Script
 *
 * Exports all travel patch adjustments from the database to a YML file
 * in the same format as data/travels.yml
 *
 * Usage:
 *   node scripts/export-travel-patches.cjs [output-file]
 *
 * Example:
 *   node scripts/export-travel-patches.cjs travel-patches.yml
 *   node scripts/export-travel-patches.cjs (defaults to data/travel-patches.yml)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Configuration
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
const DEFAULT_OUTPUT_FILE = path.join(__dirname, '..', 'data', 'travel-patches.yml');

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const outputFile = args[0] || DEFAULT_OUTPUT_FILE;
  const outputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(__dirname, '..', outputFile);

  console.log('Export Travel Patch Adjustments');
  console.log('================================\n');

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

    // Query all travel patches
    const query = `
      SELECT
        address_key,
        title,
        from_date,
        to_date,
        exclude
      FROM travel_patches
      ORDER BY address_key ASC
    `;

    const patches = db.prepare(query).all();

    // Close database connection
    db.close();

    if (patches.length === 0) {
      console.log('⚠ No travel patches found in database.');
      console.log('Nothing to export.');
      return;
    }

    // Convert database format to travels.yml format
    const travelPatchesYml = {};

    for (const patch of patches) {
      const addressKey = patch.address_key;

      travelPatchesYml[addressKey] = {
        title: patch.title || null,
        from: patch.from_date || null,
        to: patch.to_date || null,
        exclude: patch.exclude === 1 ? true : null
      };
    }

    // Convert to YAML format
    const yamlContent = yaml.stringify(travelPatchesYml, {
      nullStr: 'null',
      lineWidth: 0
    });

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(outputPath, yamlContent, 'utf-8');

    console.log(`✓ Successfully exported ${patches.length} travel patch(es)`);
    console.log(`✓ Output saved to: ${outputPath}\n`);

    // Display summary
    console.log('Exported patches:');
    patches.forEach((patch, index) => {
      console.log(`  ${index + 1}. ${patch.address_key}`);
      if (patch.title) console.log(`     Title:   ${patch.title}`);
      if (patch.from_date) console.log(`     From:    ${patch.from_date}`);
      if (patch.to_date) console.log(`     To:      ${patch.to_date}`);
      if (patch.exclude === 1) console.log(`     Exclude: true`);
      if (index < patches.length - 1) console.log('');
    });

  } catch (error) {
    console.error('Error during export:', error.message);
    process.exit(1);
  }
}

main();
