# dTraccarCodex – Feature Specification

## How to Use This Document with Codex
This document is structured into **3 incremental tasks**.

👉 IMPORTANT:
- Execute **one task at a time**
- After finishing each task, Codex should:
  - stop
  - ask for confirmation before continuing

---

# Task 1 – Live Mode (Long-Running Tracking)

## Goal
Enable a “Live Mode” that allows users to follow a vehicle over long trips (weeks to months), using efficient frontend caching and incremental updates.

## Instructions for Codex
1. Implement Live Mode toggle in AppBar
2. Implement IndexedDB cache
3. Implement incremental fetching (`fixTime > lastFetchTime`)
4. Implement polyline append (no full redraw)
5. Add polling (configurable interval)

## Important Constraints
- Must support months of data
- No full reloads
- Cache must be bounded

## Acceptance Criteria
- Live tracking works incrementally
- Cache is used and persists
- Performance remains stable

➡️ After completion: STOP and ask user before continuing to Task 2

---

# Task 2 – Selectable Map Provider

## Goal
Allow switching between Google Maps and OpenStreetMap.

## Instructions for Codex
1. Introduce MapAdapter abstraction
2. Implement:
   - GoogleMapsAdapter
   - LeafletAdapter (OSM)
3. Add AppBar selector
4. Persist selection in localStorage
5. Ensure Live Mode uses adapter (no provider-specific logic)

## Acceptance Criteria
- Map provider can be switched at runtime
- Live Mode works identically
- No duplicated logic

➡️ After completion: STOP and ask user before continuing to Task 3

---

# Task 3 – Travel Selection Improvement

## Goal
Improve dropdown UX with single and multiple selection modes.

## Instructions for Codex
1. Add “Multiple selection” checkbox
2. Default = single selection
3. Implement logic:
   - Single → only one selected
   - Multiple → toggle behavior
   - “Alle Reisen” is exclusive
4. Fix layout alignment:
   - “Alle Reisen” left aligned
   - “Multiple selection” on same row (right)

## Acceptance Criteria
- Single mode enforces one selection
- Multi mode works correctly
- UI is clean and aligned

➡️ After completion: STOP and confirm implementation

---

# End of Document
