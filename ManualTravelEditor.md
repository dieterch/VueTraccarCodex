## IMPORTANT

This document must be read together with:
- SOFTWARE_SPECIFICATION.md

If there is a conflict:
- SOFTWARE_SPECIFICATION.md defines the system architecture
- This document defines the new feature

Proceed without asking questions.


# Spezifikation für „Manuelle Reise-Rekonstruktion“ (Manual Travel Editor)

## 🎯 Ziel

Diese Erweiterung für **VueTraccar** ermöglicht es, historische Reisen (z. B. aus dem Jahr 2019) aus den Rohdaten eines **sekundären Trackers (iPhone)** manuell zu rekonstruieren.

Der Fokus liegt bewusst auf **manueller Kuratierung** statt automatischer Analyse.

Die Erweiterung soll:

1. Rohdaten eines Traccar-Geräts für einen wählbaren Zeitraum laden
2. Eine interaktive Karten-basierte Bearbeitung (Selektion & Löschen von Punkten) erlauben
3. Das Ergebnis als *manuell rekonstruierte Reise* persistent speichern
4. Diese Reisen gleichwertig mit automatisch erkannten Reisen anzeigen
5. Export / Import (Backup & Restore) ermöglichen

---

## 🧠 Grundprinzip

- Manuelle Reisen sind **kein Sonderfall** der bestehenden Auto-Reisen
- Sie sind ein **eigener Travel-Typ** mit eigener Datenhaltung
- Nach dem Speichern sind sie **immutable** (nur löschen / neu anlegen)

```ts
type TravelSource = 'auto' | 'manual'
```

---

## 🧱 1. Datenbank-Erweiterung (SQLite – app.db)

### Tabelle: manual_travels

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

### Tabelle: manual_travel_positions

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

---

## 🛠 2. Backend API

### GET /api/manual-travels

Liste aller manuellen Reisen.

```json
[
  {
    "id": "uuid",
    "title": "Portugal & Spanien 2019",
    "source_device_id": 12,
    "from_date": "2019-03-01T00:00:00Z",
    "to_date": "2019-05-10T00:00:00Z",
    "notes": "Rekonstruiert aus iPhone-Tracking",
    "created_at": "2026-02-09T12:00:00Z"
  }
]
```

---

### GET /api/manual-travels/:id/positions

Alle Positionen einer manuellen Reise.

```json
[
  {
    "id": "uuid",
    "travel_id": "uuid",
    "fix_time": "2019-03-01T00:00:00Z",
    "latitude": 38.7223,
    "longitude": -9.1393,
    "speed": 0,
    "altitude": 12,
    "attributes": { "battery": 0.92 }
  }
]
```

---

### POST /api/manual-travels

Erstellt eine neue manuelle Reise.

```json
{
  "title": "Portugal & Spanien 2019",
  "source_device_id": 12,
  "from_date": "2019-03-01T00:00:00Z",
  "to_date": "2019-05-10T00:00:00Z",
  "notes": "Rekonstruiert aus iPhone-Tracking"
}
```

Antwort:

```json
{ "id": "uuid" }
```

---

### POST /api/manual-travels/:id/positions

Speichert die bereinigten Positionsdaten (ersetzt vorhandene Positionsdaten).

```json
{
  "positions": [
    {
      "id": "uuid",
      "fixTime": "2019-03-01T00:00:00Z",
      "latitude": 38.7223,
      "longitude": -9.1393,
      "speed": 0,
      "altitude": 12,
      "attributes": { "battery": 0.92 }
    }
  ]
}
```

---

### DELETE /api/manual-travels/:id

Löscht eine manuelle Reise inkl. Positionsdaten.

---

## 🧪 3. Workspace-Service (Server-seitig)

### ManualTravelWorkspaceService

Zweck: Temporärer Bearbeitungsraum vor Persistierung.

```ts
openWorkspace(deviceId, fromDate, toDate)
deleteSelectedPoints(pointIds)
keepSelectedPoints(pointIds)
resetWorkspace()
finalizeTravel(title, notes)
```

State:

```ts
type WorkspaceState = {
  rawPoints: Position[]
  currentPoints: Position[]
  selectedPointIds: string[]
}
```

### Workspace API Endpoints

Diese Endpoints sind implementiert, aber aktuell nicht vom Frontend verdrahtet:

- POST `/api/manual-travel-workspace/open`
```json
{ "deviceId": 12, "fromDate": "2019-03-01T00:00:00Z", "toDate": "2019-05-10T00:00:00Z" }
```

- POST `/api/manual-travel-workspace/delete`
```json
{ "workspaceId": "uuid", "pointIds": ["1","2"] }
```

- POST `/api/manual-travel-workspace/keep`
```json
{ "workspaceId": "uuid", "pointIds": ["1","2"] }
```

- POST `/api/manual-travel-workspace/reset`
```json
{ "workspaceId": "uuid" }
```

- POST `/api/manual-travel-workspace/finalize`
```json
{ "workspaceId": "uuid", "title": "Portugal & Spanien 2019", "notes": "..." }
```

---

## 🗺 4. Frontend – ManualTravelEditor.vue

### Props

```ts
(Dialog gesteuert über `manualtraveldialog`)
```

### UI-Elemente

- Google Map
- Zeitraum-Inputs (datetime-local)
- Lasso-Selektion
- Buttons:
  - Auswahl löschen
  - Auswahl behalten (invertieren)
  - Undo / Redo
  - Zurücksetzen
  - Speichern

---

## ✏️ 5. UX Flow

1. Nutzer wählt „Manual Travel” im Menü (Admin)
2. Gerät + Zeitraum auswählen
3. Daten werden geladen
4. Nutzer entfernt irrelevante Bewegungen (Lasso + löschen/halten)
5. Titel vergeben & speichern (manuelle Reise wird persistiert)
6. Reise erscheint in der Travel-Liste

---

## 📅 6. Integration in bestehende Travel-Liste

```ts
const allTravels = [...autoTravels, ...manualTravels]
  .sort(byStartDate)
```

Manuelle Reisen sollen **gleichwertig** dargestellt werden (Icon `mdi-hand` im Dropdown).

Zusatzfelder im Travel-Objekt:
```ts
{
  id: string
  source: 'auto' | 'manual'
  deviceId?: number
  notes?: string
  created_at?: string
}
```

---

## 📦 7. Export / Import

### Export

```json
{
  "meta": {
    "source": "manual",
    "created": "2026-02-09T12:00:00.000Z",
    "database": "/path/to/app.db",
    "count": 1
  },
  "travel": { ... },
  "positions": [ ... ]
}
```

### Import

- Validierung
- Persistierung
- Keine Abhängigkeit von Traccar

### Scripts

- Export: `node scripts/export-manual-travels.cjs [travel-id] [output-file]`
- Import: `node scripts/import-manual-travels.cjs <input-file> [--dry-run|--replace]`

---

## 🧪 8. Tests (Empfohlen)

### Backend
- CRUD manual_travels
- Positions Persistenz
- Export / Import

### Frontend
- Laden großer Tracks
- Lasso-Selektion
- Undo / Redo
- Speichern

---

## 📌 9. Nicht-Ziele

- Keine automatische Reise-Erkennung
- Keine Heuristiken
- Keine implizite Änderung bestehender Auto-Reisen

---

## 🏁 Zielzustand

- Historische Reisen (2019) sind sauber rekonstruiert
- Ergebnisse sind versionierbar, exportierbar und reproduzierbar
- Bestehende VueTraccar-Architektur bleibt stabil

---

**Dieses Dokument ist direkt für Codex CLI geeignet.**
