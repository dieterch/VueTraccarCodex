# Database Export/Import Scripts

Helper scripts to export and import data between different instances of the application.

## Overview

These scripts allow you to:
- **Export** timing adjustments from the database to a JSON file
- **Import** timing adjustments from a JSON file into the database
- **Export** travel patch adjustments from the database to a YML file
- **Import** travel patch adjustments from a YML file into the database
- **Export** manual POIs from the database to a JSON file
- **Import** manual POIs from a JSON file into the database
- **Export** manual travels (and their positions) from the database to a JSON file
- **Import** manual travels (and their positions) from a JSON file into the database
- Transfer data between different application instances
- Backup and restore data

## Scripts

### export-timings.cjs

Exports all standstill timing adjustments from the database to a JSON file.

**Usage:**
```bash
node scripts/export-timings.cjs [output-file]
```

**Examples:**
```bash
# Export to a timestamped file (default)
node scripts/export-timings.cjs

# Export to a specific file
node scripts/export-timings.cjs my-timings.json

# Export to an absolute path
node scripts/export-timings.cjs /path/to/backup/timings.json
```

**Output Format:**
```json
{
  "exported_at": "2026-02-06T10:30:00.000Z",
  "database": "/path/to/app.db",
  "count": 5,
  "adjustments": [
    {
      "standstill_key": "marker406560077881",
      "start_adjustment_minutes": 0,
      "end_adjustment_minutes": 1440,
      "created_at": "2026-02-05 19:49:49",
      "updated_at": "2026-02-05 19:53:58"
    }
  ]
}
```

### export-travel-patches.cjs

Exports all travel patch adjustments from the database to a YML file in the same format as `data/travels.yml`.

**Usage:**
```bash
node scripts/export-travel-patches.cjs [output-file]
```

**Examples:**
```bash
# Export to default location (data/travel-patches.yml)
node scripts/export-travel-patches.cjs

# Export to a specific file
node scripts/export-travel-patches.cjs my-patches.yml

# Export to an absolute path
node scripts/export-travel-patches.cjs /path/to/backup/travel-patches.yml
```

**Output Format:**
```yaml
Mobilheimplatz 6237/113, 7141 Podersdorf am See, Austria:
  title: 2020 Ossiacher See, Bad Waltersdorf, Podersdorf am See, hohe Wand - Corona
  from: null
  to: null
  exclude: null
Camping Azzurro - Ledro, Via Alzer, 5, 38067 Pieve di Ledro TN, Italy:
  title: 2020 Camping Azzurro - Ledro See
  from: null
  to: '2020-08-01'
  exclude: null
332, 6210 Bradl, Austria:
  title: null
  from: null
  to: null
  exclude: true
```

### import-travel-patches.cjs

Imports travel patch adjustments from a YML file into the database.

**Usage:**
```bash
node scripts/import-travel-patches.cjs <input-file> [options]
```

**Options:**
- `--dry-run` - Show what would be imported without making changes
- `--merge` - Merge with existing data (default behavior)
- `--replace` - Delete all existing patches before import

**Examples:**
```bash
# Import and merge with existing data (default)
node scripts/import-travel-patches.cjs travel-patches.yml

# Preview import without making changes
node scripts/import-travel-patches.cjs travel-patches.yml --dry-run

# Replace all existing patches
node scripts/import-travel-patches.cjs travel-patches.yml --replace

# Import from an absolute path
node scripts/import-travel-patches.cjs /path/to/travel-patches.yml
```

**Input Format:**
The input YML file should match the format of `data/travels.yml`:
```yaml
Address Key 1:
  title: Travel title
  from: Start date (or null)
  to: End date (or null)
  exclude: true (or null)
Address Key 2:
  title: Another travel
  from: null
  to: '2020-08-01'
  exclude: null
```

### import-timings.cjs

Imports standstill timing adjustments from a JSON file into the database.

**Usage:**
```bash
node scripts/import-timings.cjs <input-file> [options]
```

**Options:**
- `--dry-run` - Show what would be imported without making changes
- `--merge` - Merge with existing data (default behavior)
- `--replace` - Delete all existing adjustments before import

**Examples:**
```bash
# Import and merge with existing data (default)
node scripts/import-timings.cjs timings-export.json

# Preview import without making changes
node scripts/import-timings.cjs timings-export.json --dry-run

# Replace all existing adjustments
node scripts/import-timings.cjs timings-export.json --replace

# Import from an absolute path
node scripts/import-timings.cjs /path/to/timings.json
```

### export-manual-pois.cjs

Exports all manual POIs (Points of Interest) from the database to a JSON file.

**Usage:**
```bash
node scripts/export-manual-pois.cjs [output-file]
```

**Examples:**
```bash
# Export to a timestamped file (default)
node scripts/export-manual-pois.cjs

# Export to a specific file
node scripts/export-manual-pois.cjs my-pois.json

# Export to an absolute path
node scripts/export-manual-pois.cjs /path/to/backup/manual-pois.json
```

**Output Format:**
```json
{
  "exported_at": "2026-02-07T13:58:00.000Z",
  "database": "/path/to/app.db",
  "count": 3,
  "pois": [
    {
      "id": 1,
      "poi_key": "manual_poi_12345",
      "latitude": 48.2082,
      "longitude": 16.3738,
      "timestamp": "2026-02-07T12:00:00.000Z",
      "device_id": 1,
      "address": "Stephansplatz, 1010 Wien, Austria",
      "country": "Austria",
      "created_at": "2026-02-07T12:00:00.000Z",
      "updated_at": "2026-02-07T12:00:00.000Z"
    }
  ]
}
```

### import-manual-pois.cjs

Imports manual POIs from a JSON file into the database.

**Usage:**
```bash
node scripts/import-manual-pois.cjs <input-file> [options]
```

**Options:**
- `--dry-run` - Show what would be imported without making changes
- `--merge` - Merge with existing data (default behavior)
- `--replace` - Delete all existing POIs before import

**Examples:**
```bash
# Import and merge with existing data (default)
node scripts/import-manual-pois.cjs manual-pois-export.json

# Preview import without making changes
node scripts/import-manual-pois.cjs manual-pois-export.json --dry-run

# Replace all existing POIs
node scripts/import-manual-pois.cjs manual-pois-export.json --replace

# Import from an absolute path
node scripts/import-manual-pois.cjs /path/to/manual-pois.json
```

**Input Format:**
The input JSON file should match the export format:
```json
{
  "exported_at": "2026-02-07T13:58:00.000Z",
  "database": "/path/to/app.db",
  "count": 3,
  "pois": [
    {
      "poi_key": "manual_poi_12345",
      "latitude": 48.2082,
      "longitude": 16.3738,
      "timestamp": "2026-02-07T12:00:00.000Z",
      "device_id": 1,
      "address": "Stephansplatz, 1010 Wien, Austria",
      "country": "Austria"
    }
  ]
}
```

### export-manual-travels.cjs

Exports manual travels and their positions from the database to a JSON file.

**Usage:**
```bash
node scripts/export-manual-travels.cjs [travel-id] [output-file]
```

**Examples:**
```bash
# Export all manual travels to a timestamped file (default)
node scripts/export-manual-travels.cjs

# Export a single travel by ID
node scripts/export-manual-travels.cjs 123e4567-e89b-12d3-a456-426614174000

# Export to a specific file
node scripts/export-manual-travels.cjs 123e4567-e89b-12d3-a456-426614174000 manual-travel.json
```

**Output Format (single travel):**
```json
{
  "meta": {
    "source": "manual",
    "created": "2026-02-09T12:00:00.000Z",
    "database": "/path/to/app.db",
    "count": 1
  },
  "travel": { "id": "uuid", "title": "Portugal & Spanien 2019" },
  "positions": [ { "id": "uuid", "fix_time": "2019-03-01T00:00:00Z" } ]
}
```

**Output Format (all travels):**
```json
{
  "meta": {
    "source": "manual",
    "created": "2026-02-09T12:00:00.000Z",
    "database": "/path/to/app.db",
    "count": 2
  },
  "travels": [
    {
      "travel": { "id": "uuid", "title": "Portugal & Spanien 2019" },
      "positions": [ { "id": "uuid", "fix_time": "2019-03-01T00:00:00Z" } ]
    }
  ]
}
```

### import-manual-travels.cjs

Imports manual travels and their positions from a JSON file into the database.

**Usage:**
```bash
node scripts/import-manual-travels.cjs <input-file> [options]
```

**Options:**
- `--dry-run` - Show what would be imported without making changes
- `--replace` - Delete all existing manual travels before import

**Examples:**
```bash
# Import and merge with existing data (default)
node scripts/import-manual-travels.cjs manual-travels-export.json

# Preview import without making changes
node scripts/import-manual-travels.cjs manual-travels-export.json --dry-run

# Replace all existing manual travels
node scripts/import-manual-travels.cjs manual-travels-export.json --replace
```

## Typical Workflows

### Backing Up Travel Patches

```bash
# Export current travel patches
cd /path/to/VueTraccarNuxt
node scripts/export-travel-patches.cjs data/travel-patches-backup-$(date +%Y%m%d).yml
```

### Backing Up Timing Adjustments

```bash
# Export current adjustments
cd /path/to/VueTraccarNuxt
node scripts/export-timings.cjs backup-$(date +%Y%m%d).json
```

### Transferring Travel Patches to Another Instance

**On source instance:**
```bash
# Export travel patches
node scripts/export-travel-patches.cjs travel-patches.yml

# Copy file to target instance (example using scp)
scp travel-patches.yml user@target-server:/path/to/target/instance/
```

**On target instance:**
```bash
# Preview what will be imported
node scripts/import-travel-patches.cjs travel-patches.yml --dry-run

# Import patches (merge with existing)
node scripts/import-travel-patches.cjs travel-patches.yml

# OR replace all existing patches
node scripts/import-travel-patches.cjs travel-patches.yml --replace
```

### Transferring Timing Adjustments to Another Instance

**On source instance:**
```bash
# Export adjustments
node scripts/export-timings.cjs timings-to-transfer.json

# Copy file to target instance (example using scp)
scp timings-to-transfer.json user@target-server:/path/to/target/instance/
```

**On target instance:**
```bash
# Preview what will be imported
node scripts/import-timings.cjs timings-to-transfer.json --dry-run

# Import adjustments (merge with existing)
node scripts/import-timings.cjs timings-to-transfer.json

# OR replace all existing adjustments
node scripts/import-timings.cjs timings-to-transfer.json --replace
```

### Backing Up Manual POIs

```bash
# Export current manual POIs
cd /path/to/VueTraccarNuxt
node scripts/export-manual-pois.cjs manual-pois-backup-$(date +%Y%m%d).json
```

### Transferring Manual POIs to Another Instance

**On source instance:**
```bash
# Export manual POIs
node scripts/export-manual-pois.cjs manual-pois.json

# Copy file to target instance (example using scp)
scp manual-pois.json user@target-server:/path/to/target/instance/
```

**On target instance:**
```bash
# Preview what will be imported
node scripts/import-manual-pois.cjs manual-pois.json --dry-run

# Import POIs (merge with existing)
node scripts/import-manual-pois.cjs manual-pois.json

# OR replace all existing POIs
node scripts/import-manual-pois.cjs manual-pois.json --replace
```

### Restoring from Backup

```bash
# Restore travel patches from backup
node scripts/import-travel-patches.cjs data/travel-patches-backup-20260206.yml --replace

# Restore timing adjustments from backup
node scripts/import-timings.cjs backup-20260206.json --replace

# Restore manual POIs from backup
node scripts/import-manual-pois.cjs manual-pois-backup-20260206.json --replace

# Restore manual travels from backup
node scripts/import-manual-travels.cjs manual-travels-backup-20260206.json --replace
```

## Data Structures

### Travel Patches

The export-travel-patches script works with the `travel_patches` table which has the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `address_key` | TEXT | Unique identifier for the address (location) |
| `title` | TEXT | Custom title/description for the travel |
| `from_date` | TEXT | Start date filter (ISO format) |
| `to_date` | TEXT | End date filter (ISO format) |
| `exclude` | INTEGER | Whether to exclude this location (1 = true, 0 = false) |
| `created_at` | TEXT | ISO timestamp of creation |
| `updated_at` | TEXT | ISO timestamp of last update |

**Note:** The export format matches the structure of `data/travels.yml` and can be used as a reference or backup.

### Timing Adjustments

The timing scripts work with the `standstill_adjustments` table which has the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `standstill_key` | TEXT | Unique identifier for the standstill period |
| `start_adjustment_minutes` | INTEGER | Minutes to adjust start time (negative = earlier, positive = later) |
| `end_adjustment_minutes` | INTEGER | Minutes to adjust end time (negative = earlier, positive = later) |
| `created_at` | TEXT | ISO timestamp of creation |
| `updated_at` | TEXT | ISO timestamp of last update |

### Manual POIs

The manual POI scripts work with the `manual_pois` table which has the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `poi_key` | TEXT | Unique identifier for the POI (e.g., "manual_poi_12345") |
| `latitude` | REAL | Latitude coordinate of the POI |
| `longitude` | REAL | Longitude coordinate of the POI |
| `timestamp` | TEXT | ISO timestamp when the POI was created/recorded |
| `device_id` | INTEGER | Device ID associated with the POI |
| `address` | TEXT | Full address of the POI location |
| `country` | TEXT | Country where the POI is located |
| `created_at` | TEXT | ISO timestamp of creation |
| `updated_at` | TEXT | ISO timestamp of last update |

**Note:** Manual POIs are independent points of interest created by users (e.g., via Cmd/Ctrl+Click on the map) and are not associated with device trips.

### Manual Travels

The manual travel scripts work with two tables: `manual_travels` and `manual_travel_positions`.

**manual_travels**

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT | UUID primary key |
| `title` | TEXT | Travel title |
| `source_device_id` | INTEGER | Source device ID |
| `from_date` | TEXT | Start timestamp (ISO) |
| `to_date` | TEXT | End timestamp (ISO) |
| `notes` | TEXT | Optional notes |
| `created_at` | TEXT | Creation timestamp |

**manual_travel_positions**

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT | UUID primary key |
| `travel_id` | TEXT | Foreign key to manual_travels |
| `fix_time` | TEXT | Timestamp of the position |
| `latitude` | REAL | Latitude |
| `longitude` | REAL | Longitude |
| `speed` | REAL | Speed |
| `altitude` | REAL | Altitude |
| `attributes` | TEXT | JSON attributes (string) |

## Merge vs Replace Mode

### Merge Mode (Default)
- Keeps existing records that aren't in the import file
- Updates existing records if the key matches (`standstill_key`, `address_key`, or `poi_key`)
- Adds new records from the import file
- **Use when:** You want to add/update specific records without losing others

### Replace Mode (`--replace`)
- Deletes ALL existing records first
- Then imports all records from the file
- **Use when:** You want to completely replace all data with the imported set

## Notes

- The database path is automatically set to `data/app.db` relative to the project root
- Import operations use transactions to ensure data consistency
- The `--dry-run` option is useful for previewing changes before committing them
- Timestamps are preserved during export/import when available
- The `updated_at` field is always set to the current time during import

## Requirements

- Node.cjs (version 14 or higher)
- better-sqlite3 package (already included in project dependencies)

## Troubleshooting

**Database not found:**
- Ensure you're running the scripts from the project root or scripts directory
- Check that the database exists at `data/app.db`

**Invalid file format:**
- Ensure JSON files have the correct structure (with `adjustments` or `pois` array as appropriate)
- Ensure YML files follow the expected format for travel patches
- Use the corresponding export script to create properly formatted files

**Permission errors:**
- Ensure you have read/write permissions for the database file
- Ensure you have write permissions for the output directory
