# iOS Frontend (SwiftUI) for VueTraccarCodex Backend

This guide creates a native iOS app in Xcode that uses the existing Nuxt backend APIs.  
Scope is intentionally practical: travel selection, map rendering, manual travels loading, and offline cache for the currently selected travel.

## 1. Target Architecture

- Frontend: `SwiftUI` + `MapKit`
- Networking: `URLSession` with `Codable`
- Persistence: `Core Data` (offline cache)
- Concurrency: `async/await` + `actor` for API client
- Backend: existing Nuxt server routes (`/api/...`)

## 2. Xcode Project Setup

1. Create a new project:
- Xcode: `File -> New -> Project -> iOS App`
- Product Name: `VueTraccarIOS`
- Interface: `SwiftUI`
- Language: `Swift`

2. Deployment target:
- iOS 16+ (recommended)

3. Add config files:
- `Config/Debug.xcconfig`
- `Config/Release.xcconfig`

Example `Debug.xcconfig`:

```xcconfig
API_BASE_URL = http://192.168.15.198:5999
REQUEST_TIMEOUT_SECONDS = 30
AUTH_MODE = cookie
```

4. In project build settings:
- Assign Debug/Release `.xcconfig` files to matching configurations.

## 3. Suggested Folder Layout

```text
VueTraccarIOS/
  App/
    VueTraccarIOSApp.swift
    AppEnvironment.swift
  Domain/
    Models/
      Travel.swift
      ManualTravel.swift
      RoutePoint.swift
      SideTrip.swift
      POI.swift
    Repositories/
      TravelRepository.swift
      MapRepository.swift
  Data/
    Network/
      ApiClient.swift
      Endpoints.swift
      DTOs.swift
    Persistence/
      CoreDataStack.swift
      CachedTravelSnapshot.swift
      TravelCacheStore.swift
  Features/
    Travels/
      TravelsView.swift
      TravelsViewModel.swift
    Map/
      MapView.swift
      MapViewModel.swift
    ManualTravel/
      ManualTravelListView.swift
      ManualTravelViewModel.swift
  Shared/
    UI/
    Utils/
```

## 4. Backend API Contract Mapping

Use these existing endpoints as-is:

- `POST /api/travels` -> load detected travels
- `POST /api/plotmaps` -> load route map data + distances
- `GET /api/manual-travels` -> load saved manual travels
- `GET /api/manual-pois` -> load manual POIs
- `POST /api/manual-route` -> load route for manual editor period
- `POST /api/events` -> load events by period/device

Notes:
- Keep request DTOs on iOS aligned to current Nuxt payloads.
- Keep response DTOs tolerant (`Optional` fields) for backward compatibility.

## 5. Networking Layer

`Data/Network/ApiClient.swift`:

```swift
import Foundation

actor ApiClient {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, timeout: TimeInterval = 30) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = timeout
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        self.session = URLSession(configuration: config)
    }

    func request<T: Decodable, B: Encodable>(
        _ path: String,
        method: String = "POST",
        body: B? = nil
    ) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200...299).contains(http.statusCode) else {
            throw NSError(domain: "ApiError", code: http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
```

For `GET` endpoints, call with `body: Optional<String>.none` and `method: "GET"` (or overload method).

## 6. Domain Model Basics

Example model definitions:

```swift
import Foundation
import CoreLocation

struct Travel: Identifiable, Hashable {
    let id: String
    let title: String
    let deviceId: Int
    let from: Date
    let to: Date
}

struct RoutePoint: Hashable {
    let coordinate: CLLocationCoordinate2D
    let timestamp: Date?
}

struct SideTrip: Hashable {
    let id: String
    let points: [RoutePoint]
}
```

## 7. Offline Cache (Current Travel)

Cache only what user currently views.

Cache key:
- `deviceId + from + to + selectedTravelIdsHash`

Cache payload:
- selected travel metadata
- base route polyline points
- side trip polylines
- POIs
- summed distance
- fetched timestamp

TTL:
- 7 days (default)

Fallback behavior:
1. Try backend call.
2. On network/backend error, read latest cache for current key.
3. If cache exists, render it and show offline banner.

Pseudo-flow in repository:

```swift
func loadMapData(selection: TravelSelection) async throws -> MapData {
    do {
        let fresh = try await remote.loadMapData(selection: selection)
        try cache.save(fresh, key: selection.cacheKey)
        return fresh
    } catch {
        if let cached = try cache.load(key: selection.cacheKey), !cached.isExpired {
            return cached.mapData
        }
        throw error
    }
}
```

## 8. UI Flow

Main screens:

1. `TravelsView`
- load travels from `/api/travels`
- multi-select with checkboxes
- include `All` option

2. `MapView`
- renders selected travels
- shows summed distance from returned map data
- shows offline state if fallback cache was used

3. `ManualTravelListView`
- loads `/api/manual-travels`
- “Load” action fetches manual route for selected period via `/api/manual-route`

## 9. Authentication

Default:
- Reuse existing cookie/session model.
- Use `HTTPCookieStorage.shared`.
- If app needs login bootstrap, call backend auth endpoint first (same as web flow).

If cookie auth is blocked by infrastructure later:
- Add token mode as phase 2 fallback.

## 10. Testing Checklist

Unit tests:
- DTO decoding with optional/missing fields
- travel distance sum logic
- cache key generation and TTL

Integration tests:
- successful `/api/travels` + `/api/plotmaps`
- backend unavailable -> cached map data returned

UI tests:
- select multiple travels and verify total distance text updates
- open manual travel list and load one manual travel

## 11. Rollout Plan

Phase 1:
- Read-only travels + map + offline cache for current travel

Phase 2:
- Manual travel load/edit flow

Phase 3:
- Feature parity with web UI where needed

## 12. Acceptance Criteria

- iOS app builds and runs in simulator and iPhone device.
- Can load travels and map data from Nuxt backend.
- Can display cached current travel when backend is unreachable.
- Multi-travel selection works with correct summed distance.
- Manual travels can be listed and loaded.

## 13. Nuxt Backend Compatibility Notes

- Keep backend endpoints stable; iOS uses same API paths as web.
- Do not reintroduce global prefetch for all devices in manual flow.
- Ensure distance value used in iOS comes from actual plotted map response data.

