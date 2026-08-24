# Manual Travel And Repair Editor

This document describes the current `ManualTravelEditor.vue` feature in VueTraccarCodex.

## Purpose

The editor supports two related workflows:

- Manual travel reconstruction from raw Traccar points.
- Repair of a broken automatically detected travel by combining original points, replacement-device points, and manually placed points.

Saved manual and repaired travels are persisted as normal manual travels. They are included in `/api/travels` with `source: "manual"` and can be selected/rendered like automatically detected travels.

## Data Model

Manual and repaired travels use these SQLite tables in `data/app.db`.

### `manual_travels`

```sql
CREATE TABLE manual_travels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_device_id INTEGER NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `manual_travel_positions`

```sql
CREATE TABLE manual_travel_positions (
  id TEXT PRIMARY KEY,
  travel_id TEXT NOT NULL,
  fix_time TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  speed REAL,
  altitude REAL,
  attributes TEXT,
  FOREIGN KEY (travel_id) REFERENCES manual_travels(id)
);
```

Repair points are identified through `attributes.source` values:

- `repair-original`
- `repair-replacement`
- `manual-repair`

The editor also detects saved repairs from notes containing `Repair mode:` or `Repair for`, and from titles beginning with `Reparatur -`.

## Backend Endpoints

Admin-only endpoints:

- `GET /api/manual-travels`
- `POST /api/manual-travels`
- `PATCH /api/manual-travels/{id}`
- `DELETE /api/manual-travels/{id}`
- `GET /api/manual-travels/{id}/positions`
- `POST /api/manual-travels/{id}/positions`
- `POST /api/manual-route`

Optional workspace endpoints are implemented but are not the primary frontend flow:

- `POST /api/manual-travel-workspace/open`
- `POST /api/manual-travel-workspace/delete`
- `POST /api/manual-travel-workspace/keep`
- `POST /api/manual-travel-workspace/reset`
- `POST /api/manual-travel-workspace/finalize`

## Frontend Workflow

Open the editor through `Manuelle Reisen & Reparatur`.

### Manual Mode

1. Select source device and time range.
2. Click `Daten laden`.
3. Use lasso selection to remove or keep route segments.
4. Optionally add notes/title.
5. Save the curated travel.

### Repair Mode

1. Switch to `Reparatur`.
2. Select the broken travel under `Kaputte Reise`.
3. Click `Vorlage laden` to load the original trace context.
4. Select a replacement device and replacement time range.
5. Load replacement points.
6. Use lasso selection on target or replacement layer.
7. Import selected replacement points into the repaired travel.
8. Add manual points where no replacement trace exists.
9. If needed, select manual repair points and shift their date/time.
10. Save the repaired travel.

Saved repairs remain in the same saved-travel menu as manual travels. Loading a saved repair automatically switches the editor back to repair mode.

## Selection And Editing

Supported editing actions:

- Lasso select points.
- Delete selected points.
- Keep selected points and discard the rest.
- Undo/redo local changes.
- Reset current workspace to loaded raw points.
- Reduce dense point sets.
- Add manual repair points by clicking on the map in manual point mode.
- Shift date/time for selected manual repair points.

## Browser JSON Export/Import

The editor menu includes browser-side JSON import/export.

### Export

Click the export icon beside a saved manual/repaired travel. The browser downloads a JSON file with:

```json
{
  "meta": {
    "source": "manual-travel-ui",
    "version": 1,
    "created": "2026-08-24T00:00:00.000Z",
    "count": 1
  },
  "travel": {
    "id": "uuid",
    "title": "Travel title",
    "source_device_id": 4,
    "from_date": "2026-01-01T00:00:00.000Z",
    "to_date": "2026-01-02T00:00:00.000Z",
    "notes": "..."
  },
  "positions": [
    {
      "id": "point-id",
      "travel_id": "uuid",
      "fix_time": "2026-01-01T12:00:00.000Z",
      "latitude": 47.0,
      "longitude": 11.0,
      "speed": 0,
      "altitude": 0,
      "attributes": {}
    }
  ]
}
```

### Import

Click `Import JSON` in the editor menu and select a JSON file from the local computer.

Import behavior:

- No special server directory is required.
- The browser reads the file and sends data through existing API endpoints.
- Import validates travel metadata and positions before writing.
- Import creates a new travel; it does not overwrite or merge existing data.
- Importing the same file twice creates duplicate travels.
- Duplicates can be removed through the delete icon in the saved-travel menu.

The importer accepts:

- Single-travel format: `{ "travel": {...}, "positions": [...] }`
- Multi-travel format: `{ "travels": [{ "travel": {...}, "positions": [...] }] }`

## Script Export/Import

Server-side scripts are still available for backups and migration:

```bash
node scripts/export-manual-travels.cjs [travel-id] [output-file.json]
node scripts/import-manual-travels.cjs <input-file.json> [--dry-run|--merge|--replace]
```

Use scripts for full server backups. Use browser import/export for quick transfer of one manually repaired travel from the UI.

## Non-Goals

- No automatic inference of missing route segments.
- No implicit overwrite on JSON import.
- No mutation of existing automatically detected travels.
- No secret handling in this editor.
