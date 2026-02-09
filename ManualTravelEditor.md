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
    "created_at": "2026-02-09T12:00:00Z"
  }
]
```

---

### GET /api/manual-travels/:id/positions

Alle Positionen einer manuellen Reise.

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

Speichert die bereinigten Positionsdaten.

---

### DELETE /api/manual-travels/:id

Löscht eine manuelle Reise inkl. Positionsdaten.

---

## 🧪 3. Workspace-Service (Server-seitig)

### ManualTravelWorkspaceService

Zweck: Temporärer Bearbeitungsraum vor Persistierung.

```ts
openWorkspace(deviceId, fromDate, toDate)
selectPoints(lassoCoords)
deleteSelectedPoints()
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

---

## 🗺 4. Frontend – MapEditor.vue

### Props

```ts
deviceId: number
fromDate: string
toDate: string
```

### UI-Elemente

- Google Map
- Zeitfenster-Overlay (Start / Ende verschiebbar)
- Lasso-Selektion
- Buttons:
  - Auswahl löschen
  - Auswahl behalten (invertieren)
  - Undo / Redo
  - Zurücksetzen
  - Speichern

---

## ✏️ 5. UX Flow

1. Nutzer wählt „Manuelle Reise anlegen"
2. Gerät + Zeitraum auswählen
3. Daten werden geladen
4. Nutzer entfernt irrelevante Bewegungen
5. Titel vergeben & speichern
6. Reise erscheint in der Travel-Liste

---

## 📅 6. Integration in bestehende Travel-Liste

```ts
const allTravels = [...autoTravels, ...manualTravels]
  .sort(byStartDate)
```

Manuelle Reisen sollen **gleichwertig** dargestellt werden (optional mit Icon 🖐).

---

## 📦 7. Export / Import

### Export

```json
{
  "meta": {
    "source": "manual",
    "created": "2026-02-09"
  },
  "travel": { ... },
  "positions": [ ... ]
}
```

### Import

- Validierung
- Persistierung
- Keine Abhängigkeit von Traccar

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

