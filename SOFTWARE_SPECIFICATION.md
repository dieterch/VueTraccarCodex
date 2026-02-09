# VueTraccarNuxt - Software Specification Document

**Version:** 1.0.3
**Last Updated:** 2026-02-09
**Author:** Dieter Chvatal
**Project Type:** GPS Tracking and Travel Management System

---

## 1. Executive Summary

VueTraccarNuxt is a modern web application for GPS tracking, route visualization, and travel management. It integrates with Traccar GPS tracking systems, Google Maps, and WordPress to provide comprehensive travel analysis, standstill detection, and travel blog integration.

### Key Capabilities
- Real-time GPS tracking via Traccar API integration
- Intelligent route analysis with standstill detection
- Automatic travel period detection from geofence events
- Interactive Google Maps visualization
- WordPress blog integration for travel documentation
- RST document management for location notes
- Manual POI creation and management (Cmd/Ctrl+Click on map)
- Manual travel editor (manual reconstruction of historic trips)
- KML export for route sharing
- Admin-only settings management (JWT-based)
- Data export/import scripts for backup and portability
- Authelia forward-auth with JWT authorization for API calls

---

## 2. Technology Stack

### Frontend
- **Framework:** Nuxt 4 with Vue 3 (Composition API)
- **UI Library:** Vuetify 3 (Material Design)
- **Maps:** vue3-google-map + Google Maps JavaScript API
- **Editor:** md-editor-v3 (Markdown preview)
- **Language:** TypeScript

### Backend
- **Runtime:** Nuxt 4 Server Routes (Node.js)
- **Database:** SQLite 3 with better-sqlite3
- **HTTP Client:** Axios
- **Data Format:** YAML (configuration)
- **Language:** TypeScript

### External Integrations
- **GPS Platform:** Traccar GPS Tracking System
- **CMS:** WordPress REST API v2
- **Maps Provider:** Google Maps Platform
- **Geocoding:** Google Maps Geocoding API

---

## 3. System Architecture

### 3.1 Architecture Pattern
**Server-Side Rendered (SSR) with API-first Design**

```
┌─────────────────────────────────────────────────────────┐
│                    Client Browser                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │   Vue 3 Components + Vuetify UI                 │   │
│  │   • AppBar, GMap, SideBar, DateDialog          │   │
│  │   • SettingsDialog, AboutDialog, MDEditor      │   │
│  └─────────────────────────────────────────────────┘   │
│              ↕ (Composables: useTraccar, useMapData)    │
└─────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│              Nuxt 4 Server (Node.js)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  API Routes (14 endpoints)                      │   │
│  │  /api/devices, /api/route, /api/travels, etc.  │   │
│  └─────────────────────────────────────────────────┘   │
│              ↕ (Business Logic)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Services Layer                                  │   │
│  │  • TraccarService     • RouteAnalyzer           │   │
│  │  • TravelAnalyzer     • WordPressService        │   │
│  │  • DocumentManager    • KMLGenerator            │   │
│  └─────────────────────────────────────────────────┘   │
│              ↕ (Data Access)                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Data Layer                                      │   │
│  │  • SQLite (route.db, app.db)                    │   │
│  │  • YAML Config (settings.yml)                   │   │
│  │  • RST Files (documents/)                       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
        ↕ HTTP              ↕ HTTP            ↕ HTTP
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Traccar    │    │  WordPress   │    │ Google Maps  │
│   GPS API    │    │   REST API   │    │     API      │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 3.2 Database Architecture

**Two SQLite Databases:**

1. **route.db** (Route caching database)
   - GPS positions cache
   - Standstill periods
   - Geofence events
   - Optimized for read-heavy operations with WAL mode

2. **app.db** (Application database)
   - Travel patches configuration
   - Standstill timing adjustments
   - Manual POIs (user-created points of interest)
   - Manual travels (manually curated trips)
   - Manual travel positions (points for manual travels)
   - Settings storage
   - Application metadata

---

## 4. Core Features

### 4.1 GPS Tracking & Route Management

#### 4.1.1 Route Data Acquisition
- **Source:** Traccar GPS API
- **Caching Strategy:** Cache-first with incremental updates
- **Data Format:** Position arrays with timestamp, lat, lon, speed, altitude, attributes
- **Performance:**
  - Initial prefetch: 10-15 minutes for full historical data
  - Incremental updates: <2 seconds
  - Cached queries: <500ms

#### 4.1.2 Route Analysis
- **Haversine Distance Calculation:** Accurate distance computation between GPS coordinates
- **Standstill Detection:**
  - Threshold: >12 hours in same location
  - Radius: Configurable (default: ~100m)
  - Geocoding: Automatic reverse geocoding via Google Maps API
  - Address cleaning: Plus Code removal for clean display
- **Map Calculation:**
  - Automatic bounds calculation
  - Center point determination
  - Optimal zoom level computation
  - Polyline generation (chunked at 500 points)

#### 4.1.3 Data Structure
```typescript
interface Position {
  deviceId: number
  fixTime: string
  latitude: number
  longitude: number
  speed: number
  altitude: number
  attributes: Record<string, any>
}

interface StandstillPeriod {
  key: string                    // Unique identifier
  start: string                  // ISO timestamp
  end: string                    // ISO timestamp
  duration_hours: number
  latitude: number
  longitude: number
  address?: string               // Geocoded address
  country?: string
}
```

### 4.2 Travel Detection & Management

#### 4.2.1 Automatic Travel Detection
- **Source:** Geofence exit/return events from Traccar
- **Configuration:**
  - Home geofence ID (configurable)
  - Event minimum gap: 60 seconds (prevents duplicate events)
  - Minimum travel duration: 2 days
  - Maximum travel duration: 170 days
  - Standstill period threshold: 12 hours
  - Analysis start date: Configurable cutoff

#### 4.2.2 Travel Analysis Algorithm
1. Fetch geofence events from Traccar API
2. Identify exit events from home geofence
3. Match with subsequent return events
4. Filter by duration criteria
5. Calculate farthest standstill point
6. Apply manual patches from database
7. Return travel list with metadata

#### 4.2.3 Travel Patches System
**Purpose:** Override or exclude auto-detected travels

**Storage:**
- SQLite database (app.db, travel_patches table)

**Features:**
- Create/edit/delete patches via Settings UI
- Fuzzy address matching (strips Plus Codes)

**Data Structure:**
```typescript
interface TravelPatch {
  address_key: string           // Unique address identifier
  title?: string                // Custom travel title
  from_date?: string            // Override start date (ISO)
  to_date?: string              // Override end date (ISO)
  exclude?: boolean             // Exclude from travel list
  created_at?: string
  updated_at?: string
}
```

#### 4.2.4 Travel List Output
```typescript
interface Travel {
  id: string
  title: string
  von: string                   // Start timestamp
  bis: string                   // End timestamp
  km: number                    // Distance in km
  tage: number                  // Duration in days
  address: string               // Farthest standstill address
  country: string
  source?: 'auto' | 'manual'
  deviceId?: number
  notes?: string
  created_at?: string
}
```

**Manual Travels:**
- `source` is `manual`
- Standstill-derived fields (e.g., `address`, `country`) may be absent
- `notes` and `created_at` are provided from `manual_travels`

#### 4.2.5 Manual Travel Editor
- Manually reconstruct historical trips from raw GPS positions
- Map-based lasso selection for deleting or keeping points
- Manual travels are immutable once saved (delete/recreate only)
- Stored in `app.db` (`manual_travels`, `manual_travel_positions`)
- Displayed alongside auto travels with optional icon

### 4.3 Map Visualization

#### 4.3.1 Google Maps Integration
- **Library:** vue3-google-map
- **Map Controls:**
  - Zoom: Auto-calculated or manual
  - Center: Auto-calculated or manual
  - MapType: roadmap, satellite, hybrid, terrain
- **Markers:**
  - Standstill locations (red circular icons)
  - Numbered sequentially
  - Custom InfoWindows with WordPress content

#### 4.3.2 InfoWindow Content
- **Standstill Information:**
  - Duration (hours)
  - Address (cleaned, without Plus Code)
  - Country
  - GPS coordinates (DMS format)
  - Google Maps link
- **WordPress Integration:**
  - Fetch posts tagged with standstill key
  - Display title, excerpt, featured image
  - Markdown preview rendering
  - Link to full post

#### 4.3.3 Polyline Rendering
- **Color:** Configurable (default: blue)
- **Weight:** 3px
- **Chunking:** 500 points per LineString (performance optimization)
- **Data Source:** Cached GPS positions

### 4.4 WordPress Integration

#### 4.4.1 REST API Client
- **Authentication:** Username + Application Password
- **Endpoints Used:**
  - `/wp-json/wp/v2/posts?tags=<tag_id>`
  - `/wp-json/wp/v2/tags?slug=<slug>`
- **Home Mode URL Transformation:**
  - Converts external URLs to internal IPs when home_mode=true
  - Example: `https://blog.example.com` → `http://192.168.1.100`

#### 4.4.2 Tag-Based Content Loading
- **Tagging Convention:** Each standstill has unique key (e.g., `marker574701M41499`)
- **Workflow:**
  1. User clicks marker on map
  2. System queries WordPress for posts with standstill tag
  3. Display post title, excerpt, image in InfoWindow
  4. Cache response (1-hour TTL)

#### 4.4.3 Caching Strategy
- **In-Memory Cache:** Map<tag, posts[]>
- **TTL:** 3600 seconds (1 hour)
- **Cache Invalidation:** Time-based expiry

### 4.5 Document Management

#### 4.5.1 RST Document Storage
- **Format:** reStructuredText (.rst)
- **Location:** `data/documents/`
- **Naming:** `<standstill_key>.rst`
- **Purpose:** Private travel notes per location

#### 4.5.2 Document Operations
- **Load:** `GET /api/document/[key]`
- **Save:** `POST /api/document/[key]`
- **URL Transformation:** Same as WordPress (home mode support)

#### 4.5.3 Editor Integration
- **Component:** MDEditorDialog.vue
- **Features:**
  - Markdown preview (via md-editor-v3)
  - Syntax highlighting
  - Save/Cancel actions
  - Auto-transform URLs in content

### 4.6 KML Export

#### 4.6.1 Export Features
- **Route Path:** Polyline (LineString) chunked at 500 points
- **Standstill Markers:** Placemarks with detailed popup info
- **Styles:**
  - Route: Blue line, 3px width
  - Standstills: Red circular icon

#### 4.6.2 Marker Information
- **Priority for Naming:**
  1. WordPress post title (if tagged)
  2. Clean address (without Plus Code)
  3. Country name
  4. GPS coordinates (fallback)
- **Popup Content:**
  - Sequential number
  - Duration (hours)
  - Start/end timestamps
  - Address
  - Country
  - GPS coordinates

#### 4.6.3 Implementation
```typescript
interface KMLOptions {
  deviceName: string
  positions: Position[]
  standstills: StandstillPeriod[]
  color?: string
  weight?: number
}
```

### 4.7 Settings Management

#### 4.7.1 Settings Architecture
- **Primary Storage:** `data/settings.yml` (YAML, auto-created on first access)
- **Database Storage:** `app.db` (SQLite, travel_patches only)
- **Fallback:** Environment variables (.env)
- **Override Priority:** settings.yml > .env > defaults

#### 4.7.2 Settings Categories

**1. Traccar API Configuration**
- URL (e.g., https://tracking.example.com)
- Username (email)
- Password (visible)
- Device ID (dropdown selection)

**2. Google Maps Configuration**
- API Key (visible)
- Map ID (optional)

**3. WordPress Integration**
- WordPress URL
- Username
- Application Password (visible)
- Cache duration (seconds)

**4. Application Settings**
- Legacy app/settings password fields (not used for auth)
- Home mode (boolean toggle)
- Home latitude/longitude
- Analysis parameters

**5. Home Geofence**
- Geofence ID (dropdown selection)
- Geofence name

**6. Route Analysis Parameters**
- Event minimum gap (60s)
- Minimum travel days (2)
- Maximum travel days (170)
- Standstill period threshold (12 hours)
- Analysis start date

**7. Travel Patches Management**
- List all patches
- Add new patch
- Edit existing patch
- Delete patch
- Migrate from YAML

#### 4.7.3 Settings UI Features
- **Access Control:** Admin-only (JWT-based)
- **Field Types:**
  - Text inputs (URLs, usernames, secrets)
  - Number inputs (durations, thresholds)
  - Boolean toggles (switches)
  - Datetime pickers
  - Dropdowns (device/geofence selection)
- **Validation:**
  - Reject empty strings on save
  - Format validation (URLs, emails)
- **User Feedback:**
  - Loading states
  - Success/error alerts
  - Confirmation dialogs (delete operations)

#### 4.7.4 Settings Persistence Flow
1. User opens Settings dialog (admin-only)
2. System loads current settings from /api/settings (creates settings.yml if missing)
3. System fetches dropdowns (devices, geofences)
4. User modifies settings
5. User clicks "Save All Settings"
6. System posts to /api/settings
7. Server writes to data/settings.yml
8. On next app restart, settings.yml values override .env

### 4.8 Security Features

#### 4.8.1 Authentication
- **SSO Support:** Authelia forward-auth
- **API Authorization:** Short-lived JWT cookie for `/api/*`
- **Role Enforcement:** Admin role required for Settings endpoints and UI

#### 4.8.2 Sensitive Data Protection
- **Secrets Visibility:** Settings secrets are visible to admins; HTTPS required in production
- **Git Ignore:**
  - `data/settings.yml`
  - `data/cache/*.db`
  - Backup files (*~, *.bak)
- **Server-Side Validation:** Input validation with empty-string rejection

#### 4.8.3 Configuration Security
- **Environment Variables:** Never committed to git
- **YAML Files:** Excluded from version control
- **Database Files:** Local only, not tracked

---

## 5. API Specification

### 5.0 Authentication Endpoints

#### POST /api/auth/token
**Description:** Issue JWT from Authelia forward-auth headers
**Response:**
```typescript
{
  authenticated: boolean
  user: string
  role: 'admin' | 'user'
  exp: number
}
```

#### GET /api/auth/me
**Description:** Return current JWT auth status
**Response:**
```typescript
{
  authenticated: boolean
  user?: string
  role?: 'admin' | 'user'
  exp?: number
}
```

#### POST /api/auth/logout
**Description:** Clear JWT auth cookie
**Response:**
```typescript
{
  success: boolean
}
```

### 5.1 GPS & Route Endpoints

#### GET /api/devices
**Description:** List available GPS devices from Traccar
**Response:**
```typescript
{
  success: boolean
  devices: Array<{
    id: number
    name: string
    status: string
    lastUpdate: string
  }>
}
```

#### POST /api/route
**Description:** Get cached route positions for date range
**Request Body:**
```typescript
{
  deviceId: number
  von: string        // ISO date
  bis: string        // ISO date
}
```
**Response:**
```typescript
{
  success: boolean
  positions: Position[]
}
```

#### POST /api/events
**Description:** Get geofence events for analysis
**Request Body:**
```typescript
{
  deviceId: number
  von: string
  bis: string
}
```
**Response:**
```typescript
{
  success: boolean
  events: GeofenceEvent[]
}
```

#### POST /api/plotmaps
**Description:** Calculate map visualization data
**Request Body:**
```typescript
{
  deviceId: number
  von: string
  bis: string
  travelSource?: 'auto' | 'manual'
  travelId?: string
}
```
**Response:**
```typescript
{
  success: boolean
  bounds: { north: number, south: number, east: number, west: number }
  center: { lat: number, lng: number }
  zoom: number
  markers: StandstillPeriod[]
  polyline: Position[]
}
```

#### GET /api/prefetchroute
**Description:** Prefetch all historical data from Traccar
**Query Params:** deviceId
**Response:**
```typescript
{
  success: boolean
  message: string
  count: number
}
```

#### GET /api/delprefetch
**Description:** Clear cache database
**Response:**
```typescript
{
  success: boolean
  message: string
}
```

#### GET /api/cache-status
**Description:** Get cache statistics
**Response:**
```typescript
{
  success: boolean
  route_db: {
    exists: boolean
    size_mb: number
    positions_count: number
  }
  app_db: {
    exists: boolean
    size_mb: number
    travel_patches_count: number
  }
}
```

### 5.2 Travel Analysis Endpoints

#### POST /api/travels
**Description:** Analyze and list travels from geofence events
**Request Body:**
```typescript
{
  deviceId: number
  von: string
  bis: string
}
```
**Response:**
```typescript
{
  success: boolean
  travels: Travel[]
}
```

#### POST /api/download.kml
**Description:** Generate KML file for route export
**Request Body:**
```typescript
{
  deviceId: number
  von: string
  bis: string
  travelSource?: 'auto' | 'manual'
  travelId?: string
}
```
**Response:** KML file (application/vnd.google-earth.kml+xml)

### 5.2.1 Manual Travel Endpoints

#### GET /api/manual-travels
**Description:** List all manual travels
**Response:**
```typescript
Array<{
  id: string
  title: string
  source_device_id: number
  from_date: string
  to_date: string
  notes?: string
  created_at: string
}>
```

#### POST /api/manual-travels
**Description:** Create a manual travel (metadata only)
**Request Body:**
```typescript
{
  title: string
  source_device_id: number
  from_date: string
  to_date: string
  notes?: string
}
```
**Response:**
```typescript
{ id: string }
```

#### GET /api/manual-travels/[id]/positions
**Description:** List positions for a manual travel
**Response:**
```typescript
Array<{
  id: string
  travel_id: string
  fix_time: string
  latitude: number
  longitude: number
  speed?: number
  altitude?: number
  attributes?: Record<string, any> | null
}>
```

#### POST /api/manual-travels/[id]/positions
**Description:** Replace positions for a manual travel
**Request Body:**
```typescript
{
  positions: Array<{
    id?: string
    fixTime: string
    latitude: number
    longitude: number
    speed?: number
    altitude?: number
    attributes?: Record<string, any>
  }>
}
```
**Response:**
```typescript
{ success: boolean }
```

#### DELETE /api/manual-travels/[id]
**Description:** Delete manual travel and its positions
**Response:**
```typescript
{ success: boolean }
```

#### POST /api/manual-travel-workspace/open
**Description:** Open a manual travel workspace (optional server-side workflow)
**Request Body:**
```typescript
{
  deviceId: number
  fromDate: string
  toDate: string
}
```
**Response:**
```typescript
{
  success: boolean
  workspaceId: string
  points: Position[]
}
```

#### POST /api/manual-travel-workspace/delete
**Description:** Delete selected points in workspace
**Request Body:**
```typescript
{
  workspaceId: string
  pointIds: string[]
}
```
**Response:**
```typescript
{ success: boolean; points: Position[] }
```

#### POST /api/manual-travel-workspace/keep
**Description:** Keep selected points in workspace
**Request Body:**
```typescript
{
  workspaceId: string
  pointIds: string[]
}
```
**Response:**
```typescript
{ success: boolean; points: Position[] }
```

#### POST /api/manual-travel-workspace/reset
**Description:** Reset workspace to original points
**Request Body:**
```typescript
{
  workspaceId: string
}
```
**Response:**
```typescript
{ success: boolean; points: Position[] }
```

#### POST /api/manual-travel-workspace/finalize
**Description:** Finalize workspace and persist manual travel
**Request Body:**
```typescript
{
  workspaceId: string
  title: string
  notes?: string
}
```
**Response:**
```typescript
{ success: boolean; id: string }
```

### 5.3 Travel Patches Endpoints

#### GET /api/travel-patches
**Description:** List all travel patches
**Response:**
```typescript
{
  success: boolean
  patches: TravelPatch[]
}
```

#### POST /api/travel-patches
**Description:** Create or update a travel patch
**Request Body:**
```typescript
{
  address_key: string
  title?: string
  from_date?: string
  to_date?: string
  exclude?: boolean
}
```
**Response:**
```typescript
{
  success: boolean
  message: string
}
```

#### DELETE /api/travel-patches/[addressKey]
**Description:** Delete a travel patch
**Response:**
```typescript
{
  success: boolean
  message: string
}
```

### 5.4 Settings Endpoints

#### GET /api/settings
**Description:** Get all current settings (admin-only)
**Response:**
```typescript
{
  success: boolean
  settings: {
    traccarUrl: string
    traccarUser: string
    traccarPassword: string
    traccarDeviceId: number
    traccarDeviceName: string
    googleMapsApiKey: string
    googleMapsMapId: string
    wordpressUrl: string
    wordpressUser: string
    wordpressAppPassword: string
    wordpressCacheDuration: number
    vueTraccarPassword: string
    settingsPassword: string
    homeMode: boolean
    homeLatitude: string
    homeLongitude: string
    homeGeofenceId: number
    homeGeofenceName: string
    eventMinGap: number
    minDays: number
    maxDays: number
    standPeriod: number
    startDate: string
    sideTripEnabled: boolean
    sideTripDevices: Array<any>
    sideTripBufferHours: number
  }
}
```

#### GET /api/side-trips/config
**Description:** Get side trip configuration (auth required, user-safe subset of settings)
**Response:**
```typescript
{
  success: boolean
  settings: {
    sideTripEnabled: boolean
    sideTripDevices: Array<any>
    sideTripBufferHours: number
  }
}
```

#### POST /api/settings
**Description:** Save all settings to YAML file (admin-only, rejects empty strings)
**Request Body:** Same as GET response
**Response:**
```typescript
{
  success: boolean
  message: string
}
```

### 5.5 Document Endpoints

#### GET /api/document/[key]
**Description:** Load RST document for standstill
**Response:**
```typescript
{
  success: boolean
  content: string
}
```

#### POST /api/document/[key]
**Description:** Save RST document
**Request Body:**
```typescript
{
  content: string
}
```
**Response:**
```typescript
{
  success: boolean
  message: string
}
```

### 5.6 WordPress Endpoints

#### GET /api/wordpress/posts/[tag]
**Description:** Get WordPress posts by tag slug
**Response:**
```typescript
{
  success: boolean
  posts: Array<{
    id: number
    title: { rendered: string }
    excerpt: { rendered: string }
    featured_media_url?: string
    link: string
  }>
}
```

#### GET /api/wordpress/test
**Description:** Test WordPress API connection
**Response:**
```typescript
{
  success: boolean
  message: string
  site_name?: string
}
```

#### GET /api/geofences
**Description:** List geofences from Traccar
**Response:**
```typescript
{
  success: boolean
  geofences: Array<{
    id: number
    name: string
    area: string
  }>
}
```

---

## 6. Data Models

### 6.1 Database Schema

#### Route Database (route.db)

**Table: positions**
```sql
CREATE TABLE positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  fix_time TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  speed REAL,
  altitude REAL,
  attributes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_time ON positions(device_id, fix_time);
CREATE INDEX idx_fix_time ON positions(fix_time);
```

**Table: standstills**
```sql
CREATE TABLE standstills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  device_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_hours REAL NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT,
  country TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_standstill_key ON standstills(key);
CREATE INDEX idx_device_standstill ON standstills(device_id, start_time);
```

**Table: geofence_events**
```sql
CREATE TABLE geofence_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  geofence_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_time TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_geofence ON geofence_events(device_id, geofence_id, event_time);
```

#### Application Database (app.db)

**Table: travel_patches**
```sql
CREATE TABLE travel_patches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address_key TEXT UNIQUE NOT NULL,
  title TEXT,
  from_date TEXT,
  to_date TEXT,
  exclude INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_address_key ON travel_patches(address_key);
```

**Table: standstill_adjustments**
```sql
CREATE TABLE standstill_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  standstill_key TEXT UNIQUE NOT NULL,
  start_adjustment_minutes INTEGER DEFAULT 0,
  end_adjustment_minutes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_standstill_key ON standstill_adjustments(standstill_key);
```

**Table: manual_pois**
```sql
CREATE TABLE manual_pois (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poi_key TEXT UNIQUE NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp TEXT NOT NULL,
  device_id INTEGER NOT NULL,
  address TEXT,
  country TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_poi_key ON manual_pois(poi_key);
CREATE INDEX idx_device_poi ON manual_pois(device_id, timestamp);
```

### 6.2 Configuration Files

#### settings.yml
```yaml
traccarUrl: "https://tracking.example.com"
traccarUser: "user@example.com"
traccarPassword: "plain-text-password"
traccarDeviceId: 4
traccarDeviceName: "Family Tracker"
googleMapsApiKey: "AIza..."
googleMapsMapId: "abcd1234"
wordpressUrl: "https://blog.example.com"
wordpressUser: "username"
wordpressAppPassword: "xxxx xxxx xxxx xxxx"
wordpressCacheDuration: 3600
vueTraccarPassword: "legacy_app_password"
settingsPassword: "legacy_settings_password"
homeMode: false
homeLatitude: "47.2692"
homeLongitude: "11.4041"
homeGeofenceId: 1
homeGeofenceName: "Home"
eventMinGap: 60
minDays: 2
maxDays: 170
standPeriod: 12
startDate: "2020-01-01T00:00:00Z"
sideTripEnabled: false
sideTripDevices: []
sideTripBufferHours: 6
```

---

## 7. User Interface

### 7.1 Component Hierarchy

```
App.vue
├── AppBar.vue (Top navigation)
│   ├── Device selector
│   ├── Menu button
│   │   ├── About
│   │   ├── Settings
│   │   └── Cache status
│   └── Distance display
├── SideBar.vue (Travel list)
│   └── DateDialog.vue (Date range picker)
├── GMap.vue (Google Maps)
│   ├── Markers (standstills)
│   └── Polylines (route)
├── SettingsDialog.vue (Configuration)
│   ├── Traccar settings
│   ├── Google Maps settings
│   ├── WordPress settings
│   ├── Application settings
│   ├── Home geofence
│   ├── Route analysis params
│   └── Travel patches management
├── AboutDialog.vue (Version info)
├── MDEditorDialog.vue (Document editor)
├── MDDialog.vue (Markdown preview)
├── DebugDialog.vue (Developer tools)
└── Login.vue (Legacy, unused)
```

### 7.2 Key UI Features

#### 7.2.1 AppBar
- **Device Selector:** Dropdown to switch between GPS devices
- **Menu:** Access to about and exports; admin-only items (POI Mode, Settings, Debug, Prefetch)
- **Distance Display:** Current route distance in km
- **Responsive:** Mobile-friendly hamburger menu

#### 7.2.2 SideBar (Travel List)
- **Travel Cards:**
  - Title (custom or auto-generated)
  - Date range (von - bis)
  - Distance (km)
  - Duration (days)
  - Farthest address
- **Date Range Picker:** Filter travels by date
- **Click to Load:** Select travel to render on map
- **Collapsible:** Toggle sidebar visibility

#### 7.2.3 Map (GMap)
- **Interactive Controls:**
  - Zoom in/out
  - Map type selector
  - Street view
  - Fullscreen toggle
- **Markers:**
  - Red circles for standstills
  - Numbered sequentially
  - Custom InfoWindows
- **Polylines:**
  - Blue route path
  - Smooth rendering via chunking
- **Context Menu:**
  - Download as KML
  - View raw data
  - Edit document

#### 7.2.4 InfoWindow
- **Standstill Details:**
  - Duration (hours)
  - Address (cleaned)
  - Country
  - GPS coordinates (clickable Google Maps link)
- **WordPress Content:**
  - Featured image
  - Post title (as link)
  - Excerpt (Markdown rendered)
- **Actions:**
  - Edit document (opens MDEditorDialog)
  - View full post

#### 7.2.5 Settings Dialog
- **7 Expansion Panels:**
  1. Traccar API Configuration
  2. Google Maps Configuration
  3. WordPress Integration
  4. Application Settings
  5. Home Geofence
  6. Route Analysis Parameters
  7. Travel Patches Management
- **Access Control:** Admin-only (JWT-based)
- **Secrets Visibility:** Secrets are displayed in plain text
- **Travel Patches Panel:**
  - Add new patch form
  - Patch list with edit/delete
  - Visual indicators (icons, colors)
  - Confirmation dialogs

#### 7.2.6 About Dialog
- **Information:**
  - App name and version
  - Last commit date
  - Key features list (admin-only)
  - Data management scripts list (admin-only)
  - Technology stack
- **Links:**
  - GitHub repository
  - Documentation
  - Report issues

#### 7.2.7 Document Editor (MDEditorDialog)
- **Features:**
  - RST/Markdown editing
  - Live preview
  - Syntax highlighting
  - Save/Cancel buttons
- **URL Transformation:** Auto-converts external URLs when home_mode=true

### 7.3 Responsive Design
- **Desktop:** Full sidebar, expanded AppBar
- **Tablet:** Collapsible sidebar, compact AppBar
- **Mobile:** Drawer navigation, bottom sheet for travel list

### 7.4 Loading States
- **Global Loader:** vue-loading-overlay
- **Component Loaders:** Vuetify progress circular
- **Skeleton Screens:** Map loading placeholder

---

## 8. Business Logic

### 8.1 Services Layer

#### 8.1.1 TraccarService
**File:** `server/services/traccar.service.ts`

**Responsibilities:**
- Fetch GPS positions from Traccar API
- Cache positions in SQLite
- Incremental updates (fetch only new data)
- Device management
- Geofence event fetching

**Key Methods:**
```typescript
async getPositions(deviceId, from, to): Promise<Position[]>
async prefetchAllPositions(deviceId): Promise<number>
async getDevices(): Promise<Device[]>
async getGeofences(): Promise<Geofence[]>
async getEvents(deviceId, from, to): Promise<GeofenceEvent[]>
async clearCache(): Promise<void>
```

**Caching Strategy:**
1. Check SQLite cache for date range
2. If cache hit, return cached data
3. If cache miss or partial:
   - Fetch missing data from Traccar API
   - Store in SQLite
   - Return combined result

#### 8.1.2 RouteAnalyzer
**File:** `server/services/route-analyzer.ts`

**Responsibilities:**
- Analyze GPS positions for standstills
- Calculate distances (Haversine formula)
- Reverse geocoding (Google Maps API)
- Map bounds/center/zoom calculation
- Polyline generation

**Key Methods:**
```typescript
async analyzeRoute(positions): Promise<{
  standstills: StandstillPeriod[]
  bounds: Bounds
  center: LatLng
  zoom: number
  polyline: Position[]
}>

detectStandstills(positions, thresholdHours): StandstillPeriod[]
calculateDistance(lat1, lon1, lat2, lon2): number
async reverseGeocode(lat, lon): Promise<{address, country}>
calculateBounds(positions): Bounds
```

**Standstill Detection Algorithm:**
1. Iterate through positions
2. Identify continuous stationary periods (speed < 1 km/h)
3. Calculate duration
4. Filter by threshold (12 hours)
5. Reverse geocode center point
6. Return standstill periods

#### 8.1.3 TravelAnalyzer
**File:** `server/services/travel-analyzer.ts`

**Responsibilities:**
- Analyze geofence events for travel periods
- Load travel patches from database
- Calculate farthest standstill
- Apply manual overrides
- Generate travel list

**Key Methods:**
```typescript
async analyzeTravels(deviceId, from, to): Promise<Travel[]>
async loadTravelPatches(): Promise<TravelPatch[]>
matchTravelPatch(address): TravelPatch | null
calculateFarthestStandstill(standstills, home): StandstillPeriod
```

**Travel Detection Algorithm:**
1. Fetch geofence exit events
2. Match with return events (same geofence)
3. Validate:
   - Gap between events > eventMinGap (60s)
   - Duration > minTravelDays (2 days)
   - Duration < maxTravelDays (170 days)
4. Get standstills for date range
5. Find farthest standstill from home
6. Load travel patches
7. Apply patches (title override, exclude, date override)
8. Return travel list sorted by date

#### 8.1.4 WordPressService
**File:** `server/services/wordpress.service.ts`

**Responsibilities:**
- Fetch WordPress posts by tag
- Tag ID lookup
- URL transformation (home mode)
- In-memory caching (1-hour TTL)

**Key Methods:**
```typescript
async getPostsByTag(tagSlug): Promise<WordPressPost[]>
async testConnection(): Promise<boolean>
transformUrls(content, homeMode): string
```

**Caching Strategy:**
- In-memory Map: `<tagSlug, {posts, timestamp}>`
- TTL: 3600 seconds
- Cache invalidation: Time-based expiry

#### 8.1.5 DocumentManager
**File:** `server/services/document-manager.ts`

**Responsibilities:**
- Load RST documents from filesystem
- Save documents
- URL transformation for home mode
- Error handling (file not found)

**Key Methods:**
```typescript
async loadDocument(key): Promise<string>
async saveDocument(key, content): Promise<void>
transformUrls(content, homeMode): string
```

#### 8.1.6 KMLGenerator
**File:** `server/services/kml-generator.ts`

**Responsibilities:**
- Generate KML XML for route export
- Create styles (route, standstills)
- Build folders (Route Path, Standstill Locations)
- Chunk polylines (500 points)
- Fetch WordPress titles for standstills

**Key Methods:**
```typescript
generateKML(options: KMLOptions): string
createStyle(id, color, weight): string
createPlacemark(standstill, index, wpTitle?): string
chunkPositions(positions, chunkSize): Position[][]
```

### 8.2 Utility Functions

#### 8.2.1 Cache Utility
**File:** `server/utils/cache.ts`

**Responsibilities:**
- SQLite database abstraction (route.db)
- Schema initialization
- CRUD operations for positions, standstills, events

**Key Methods:**
```typescript
initRouteDatabase(): Database
getPositions(deviceId, from, to): Position[]
savePositions(positions): void
getStandstills(deviceId, from, to): StandstillPeriod[]
saveStandstills(standstills): void
getGeofenceEvents(deviceId, from, to): GeofenceEvent[]
saveGeofenceEvents(events): void
clearCache(): void
getCacheStats(): { positions: number, standstills: number }
```

#### 8.2.2 App Database Utility
**File:** `server/utils/app-db.ts`

**Responsibilities:**
- SQLite database abstraction (app.db)
- Schema initialization
- CRUD operations for travel patches, settings

**Key Methods:**
```typescript
initAppDatabase(): Database
getTravelPatches(): TravelPatch[]
getTravelPatch(addressKey): TravelPatch | null
saveTravelPatch(patch): void
deleteTravelPatch(addressKey): void
getSettings(): Record<string, any>
saveSettings(settings): void
```

#### 8.2.3 Traccar Client
**File:** `server/utils/traccar-client.ts`

**Responsibilities:**
- HTTP client for Traccar API
- Authentication (Basic Auth)
- Error handling

**Key Methods:**
```typescript
async getPositions(deviceId, from, to): Promise<Position[]>
async getDevices(): Promise<Device[]>
async getGeofences(): Promise<Geofence[]>
async getEvents(deviceId, from, to, type): Promise<Event[]>
```

#### 8.2.4 WordPress Client
**File:** `server/utils/wordpress-client.ts`

**Responsibilities:**
- HTTP client for WordPress REST API
- Authentication (Application Password)
- URL transformation

**Key Methods:**
```typescript
async getPosts(params): Promise<WordPressPost[]>
async getTags(slug): Promise<WordPressTag[]>
async getSiteInfo(): Promise<any>
```

---

## 9. Configuration Management

### 9.1 Environment Variables (.env)

**Traccar Settings:**
```
TRACCAR_URL=https://tracking.example.com
TRACCAR_USER=user@example.com
TRACCAR_PASSWORD=password
TRACCAR_DEVICE_ID=4
TRACCAR_DEVICE_NAME=Family Tracker
```

**Google Maps Settings:**
```
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your-map-id
```

**WordPress Settings:**
```
WORDPRESS_URL=https://blog.example.com
WORDPRESS_USER=username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
WORDPRESS_CACHE_DURATION=3600
```

**Application Settings:**
```
VUE_TRACCAR_PASSWORD=app_password # legacy, not used for auth
SETTINGS_PASSWORD=Admin2024       # legacy, not used for auth
HOME_MODE=false
HOME_LATITUDE=47.2692
HOME_LONGITUDE=11.4041
HOME_GEOFENCE_ID=1
HOME_GEOFENCE_NAME=Home
```

**Route Analysis Settings:**
```
EVENT_MIN_GAP=60
MIN_DAYS=2
MAX_DAYS=170
STAND_PERIOD=12
START_DATE=2020-01-01T00:00:00Z
```

**Auth Settings:**
```
JWT_SECRET=change-me
JWT_TTL_SECONDS=3600
JWT_ISSUER=vue-traccar
JWT_AUDIENCE=vue-traccar-ui
AUTH_COOKIE_NAME=vt_auth
AUTH_COOKIE_SECURE=true
ADMIN_GROUP=admins
AUTH_BYPASS=false
AUTH_BYPASS_ROLE=admin
NUXT_PUBLIC_AUTHELIA_LOGOUT_URL=https://authelia.example.com/logout
```

**Server Settings:**
```
PORT=5999
HOST=0.0.0.0
```

### 9.2 Runtime Configuration

**File:** `nuxt.config.ts`

**Settings Loading:**
1. Read `data/settings.yml` at startup
2. Override `process.env` with YAML values
3. Pass to Nuxt runtime config
4. Make available to server/client

**Runtime Config Structure:**
```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only
    traccarUrl: process.env.TRACCAR_URL,
    traccarUser: process.env.TRACCAR_USER,
    traccarPassword: process.env.TRACCAR_PASSWORD,
    traccarDeviceId: parseInt(process.env.TRACCAR_DEVICE_ID),
    // ... all settings
    public: {
      // Client-accessible
      googleMapsApiKey: process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      autheliaLogoutUrl: process.env.NUXT_PUBLIC_AUTHELIA_LOGOUT_URL
    }
  }
})
```

### 9.3 Settings Persistence

**Workflow:**
1. User modifies settings in SettingsDialog
2. POST to `/api/settings` with new values
3. Server validates settings
4. Server writes to `data/settings.yml`
5. On next restart, YAML values override .env

**YAML Structure:**
```yaml
# This file overrides .env settings
# Generated by SettingsDialog

# Traccar Configuration
traccarUrl: "https://tracking.example.com"
traccarUser: "user@example.com"
# ... all settings
```

---

## 10. Performance Optimization

### 10.1 Database Optimization

**SQLite Configuration:**
- **WAL Mode:** Write-Ahead Logging for concurrent reads
- **Pragma Settings:**
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = -64000; -- 64MB
  PRAGMA temp_store = MEMORY;
  ```
- **Indexes:**
  - `idx_device_time` on (device_id, fix_time)
  - `idx_fix_time` on (fix_time)
  - `idx_standstill_key` on (key)
  - `idx_address_key` on (address_key)

### 10.2 Caching Strategies

**Three-Tier Caching:**

1. **SQLite Cache (Route Data):**
   - Persistent storage
   - Fast queries (<500ms)
   - Incremental updates

2. **In-Memory Cache (WordPress):**
   - 1-hour TTL
   - Map<tag, {posts, timestamp}>
   - Reduces API calls by ~95%

3. **Browser Cache:**
   - Service worker (future)
   - LocalStorage for settings
   - Session storage for map state

### 10.3 Map Rendering Optimization

**Polyline Chunking:**
- Chunk size: 500 points per LineString
- Reduces DOM nodes
- Improves rendering performance
- Maintains visual quality

**Marker Clustering:**
- Future enhancement
- Cluster standstills when zoomed out
- Expand on zoom in

### 10.4 API Optimization

**Batch Operations:**
- Prefetch all positions on startup (one-time)
- Incremental updates (fetch only new data)
- Bulk insert to SQLite (transactions)

**Request Throttling:**
- Debounce map updates (500ms)
- Throttle geocoding requests (1 per second)
- Rate limit WordPress API (respect server limits)

### 10.5 Bundle Size Optimization

**Code Splitting:**
- Lazy load components (dialogs)
- Dynamic imports for heavy libraries
- Tree-shaking unused code

**Asset Optimization:**
- Minimize Vuetify imports (use tree-shaking)
- Compress images (WebP format)
- Defer non-critical JavaScript

**Build Output:**
- Gzip compression: 13.5 MB → 3.78 MB
- Brotli compression: 3.78 MB → ~2.5 MB (future)

---

## 11. Error Handling

### 11.1 API Error Handling

**Strategy:** Try-catch with graceful degradation

**Example:**
```typescript
try {
  const positions = await traccarService.getPositions(deviceId, from, to)
  return { success: true, positions }
} catch (error) {
  console.error('Failed to fetch positions:', error)
  return {
    success: false,
    error: 'Unable to fetch GPS data. Check Traccar connection.',
    positions: []
  }
}
```

**Error Types:**
- **Network Errors:** Display retry button
- **Authentication Errors:** Redirect to settings
- **Data Errors:** Show empty state with message
- **Server Errors:** Log to console, show generic error

### 11.2 Database Error Handling

**SQLite Errors:**
- **Database Locked:** Retry with exponential backoff
- **Disk Full:** Alert user, suggest clearing cache
- **Corrupt Database:** Recreate schema, refetch data

**Example:**
```typescript
try {
  db.prepare('INSERT INTO positions ...').run(data)
} catch (error) {
  if (error.code === 'SQLITE_BUSY') {
    await sleep(100)
    return retry()
  }
  throw error
}
```

### 11.3 Client-Side Error Handling

**Vue Error Boundary:**
```typescript
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error:', err, info)
  // Show error toast
  // Log to error tracking service (future)
}
```

**Async Error Handling:**
```typescript
async function loadTravels() {
  try {
    loading.value = true
    error.value = null
    const result = await $fetch('/api/travels', { method: 'POST', body })
    travels.value = result.travels
  } catch (err) {
    error.value = 'Failed to load travels. Please try again.'
    console.error(err)
  } finally {
    loading.value = false
  }
}
```

### 11.4 User Feedback

**Error Messages:**
- **User-Friendly:** Avoid technical jargon
- **Actionable:** Suggest next steps
- **Contextual:** Explain what went wrong

**Examples:**
- ❌ "API request failed with status 401"
- ✅ "Authentication failed. Please check your Traccar username and password in Settings."

**UI Indicators:**
- **Toast/Snackbar:** Temporary messages (errors, success)
- **Alert Dialogs:** Critical errors requiring acknowledgment
- **Inline Errors:** Form validation errors
- **Empty States:** No data available

---

## 12. Testing Strategy

### 12.1 Unit Testing (Future)

**Framework:** Vitest

**Coverage:**
- Utility functions (crypto, date, maps)
- Service classes (pure logic)
- Composables (state management)

**Example:**
```typescript
describe('Haversine Distance', () => {
  it('calculates distance between two points', () => {
    const distance = calculateDistance(47.26, 11.40, 48.13, 11.57)
    expect(distance).toBeCloseTo(97.5, 1) // ~97.5 km
  })
})
```

### 12.2 Integration Testing (Future)

**Framework:** Playwright or Cypress

**Scenarios:**
- Login flow
- Load travels from sidebar
- Render map with markers
- Click marker, view InfoWindow
- Edit document, save
- Download KML
- Change settings

### 12.3 End-to-End Testing

**Manual Testing Checklist:**

1. **Authentication:**
   - [ ] Login with correct password
   - [ ] Login with wrong password (should fail)
   - [ ] Logout

2. **Travel Loading:**
   - [ ] Load travels list
   - [ ] Filter by date range
   - [ ] Click travel to render map

3. **Map Visualization:**
   - [ ] Route polyline displays correctly
   - [ ] Standstill markers appear
   - [ ] InfoWindows show correct data
   - [ ] WordPress content loads

4. **Document Management:**
   - [ ] Open document editor
   - [ ] Edit and save document
   - [ ] Cancel without saving

5. **Settings:**
   - [ ] Open settings dialog
   - [ ] Change settings and save
   - [ ] Restart app, verify settings persisted

6. **KML Export:**
   - [ ] Download KML file
   - [ ] Open in Google Earth
   - [ ] Verify route and markers

7. **Travel Patches:**
   - [ ] Add new patch
   - [ ] Edit existing patch
   - [ ] Delete patch
   - [ ] Verify patches apply to travels

### 12.4 Performance Testing

**Metrics:**
- **Initial Load:** <3 seconds
- **Map Render:** <2 seconds (10,000 points)
- **Travel Analysis:** <5 seconds
- **Cache Query:** <500ms
- **Settings Save:** <1 second

**Load Testing:**
- Test with large datasets (>100,000 positions)
- Test with many standstills (>1,000)
- Test concurrent requests

---

## 13. Deployment

### 13.1 Build Process

**Development:**
```bash
npm install
npm run dev
# Access: http://localhost:3000
```

**Production Build:**
```bash
npm run build
npm run preview
# Or use PM2/systemd
```

**Build Output:**
- `.output/` directory
- Standalone Node.js server
- Static assets pre-rendered

### 13.2 Environment Setup

**Requirements:**
- Node.js 18+
- npm or pnpm
- SQLite3 (bundled with better-sqlite3)
- 512 MB RAM minimum
- 1 GB disk space (for cache)

**File Structure:**
```
VueTraccarNuxt/
├── .env (not committed)
├── data/
│   ├── cache/
│   │   ├── route.db (auto-created)
│   │   └── app.db (auto-created)
│   ├── settings.yml (auto-created)
│   └── documents/ (create manually)
├── .output/ (build output)
└── ... source files
```

### 13.3 Server Configuration

**Reverse Proxy (Nginx):**
```nginx
server {
  listen 443 ssl;
  server_name tracker.example.com;

  location / {
    proxy_pass http://localhost:5999;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

**Process Manager (PM2):**
```bash
pm2 start npm --name "vue-traccar" -- run preview
pm2 save
pm2 startup
```

**Systemd Service:**
```ini
[Unit]
Description=VueTraccarNuxt
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/VueTraccarNuxt
ExecStart=/usr/bin/npm run preview
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### 13.4 SSL/TLS

**Certificate:** Let's Encrypt via Certbot
```bash
certbot --nginx -d tracker.example.com
```

**Auto-Renewal:**
```bash
certbot renew --dry-run
```

### 13.5 Backup Strategy

**Critical Data:**
- `data/settings.yml`
- `data/cache/route.db`
- `data/cache/app.db`
- `data/documents/`

**Recommended Backup Method (Using Scripts):**
```bash
#!/bin/bash
# Backup using data management scripts
DATE=$(date +%Y%m%d)
mkdir -p backups/$DATE

# Export application data
node scripts/export-timings.cjs backups/$DATE/timings.json
node scripts/export-travel-patches.cjs backups/$DATE/patches.yml
node scripts/export-manual-pois.cjs backups/$DATE/pois.json
node scripts/export-manual-travels.cjs backups/$DATE/manual-travels.json

# Copy databases and documents
cp data/cache/*.db backups/$DATE/
cp -r data/documents backups/$DATE/
cp data/settings.yml backups/$DATE/

# Archive and compress
tar -czf "backup-$DATE.tar.gz" backups/$DATE
# Upload to S3/Backblaze/etc
```

**Alternative Backup Method (File-based):**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf "backup-$DATE.tar.gz" data/
# Upload to S3/Backblaze/etc
```

**Restoration (Using Scripts):**
```bash
# Extract backup
tar -xzf backup-20260207.tar.gz

# Restore application data
node scripts/import-timings.cjs backups/20260207/timings.json --replace
node scripts/import-travel-patches.cjs backups/20260207/patches.yml --replace
node scripts/import-manual-pois.cjs backups/20260207/pois.json --replace
node scripts/import-manual-travels.cjs backups/20260207/manual-travels.json --replace

# Restore databases and documents
cp backups/20260207/*.db data/cache/
cp -r backups/20260207/documents data/
cp backups/20260207/settings.yml data/

# Restart app
pm2 restart vue-traccar
```

**Alternative Restoration (File-based):**
```bash
tar -xzf backup-20260205.tar.gz
# Restart app
pm2 restart vue-traccar
```

---

## 14. Maintenance & Support

### 14.1 Monitoring

**Health Checks:**
- Endpoint: `GET /api/health` (future)
- Check: Database connectivity, API access
- Frequency: Every 5 minutes

**Logging:**
- Server logs: `console.log` → PM2 logs
- Error logs: `console.error` → PM2 error logs
- View logs: `pm2 logs vue-traccar`

**Metrics (Future):**
- Request rate
- Response times
- Cache hit rate
- Database size growth

### 14.2 Updates

**Dependency Updates:**
```bash
npm outdated
npm update
npm audit fix
```

**Major Version Upgrades:**
- Review changelog
- Test in development
- Deploy to staging
- Deploy to production

**Database Migrations:**
- Create migration scripts
- Version schema
- Backup before migration
- Test rollback procedure

### 14.3 Data Management Scripts

The `/scripts` directory contains utility scripts for exporting and importing application data, enabling data portability between instances and providing backup/restore capabilities.

#### 14.3.1 Overview

**Purpose:**
- Backup and restore application data
- Transfer data between different instances
- Migrate data during upgrades
- Data portability and disaster recovery

**Script Categories:**
1. **Timing Adjustments** - Export/import standstill timing modifications
2. **Travel Patches** - Export/import travel configuration overrides
3. **Manual POIs** - Export/import user-created points of interest
4. **Manual Travels** - Export/import manual travel data (metadata + positions)

**Technology:**
- Runtime: Node.js (CommonJS)
- Database: better-sqlite3
- Format: JSON (timings, manual POIs, manual travels), YAML (travel patches)

#### 14.3.2 Timing Adjustment Scripts

**export-timings.cjs**

Exports all standstill timing adjustments from the database to a timestamped JSON file.

```bash
# Export to timestamped file (default)
node scripts/export-timings.cjs

# Export to specific file
node scripts/export-timings.cjs my-timings.json

# Export to absolute path
node scripts/export-timings.cjs /path/to/backup/timings.json
```

**Output Format:**
```json
{
  "exported_at": "2026-02-07T13:58:00.000Z",
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

**import-timings.cjs**

Imports standstill timing adjustments from JSON file into the database.

```bash
# Import and merge with existing data (default)
node scripts/import-timings.cjs timings-export.json

# Preview import without making changes
node scripts/import-timings.cjs timings-export.json --dry-run

# Replace all existing adjustments
node scripts/import-timings.cjs timings-export.json --replace
```

**Options:**
- `--dry-run` - Preview changes without committing
- `--merge` - Merge with existing data (default)
- `--replace` - Delete all existing data before import

#### 14.3.3 Travel Patch Scripts

**export-travel-patches.cjs**

Exports travel patch adjustments to a standalone YAML file for backup/transfer.

```bash
# Export to default location (data/travel-patches.yml)
node scripts/export-travel-patches.cjs

# Export to specific file
node scripts/export-travel-patches.cjs my-patches.yml

# Export to absolute path
node scripts/export-travel-patches.cjs /path/to/backup/travel-patches.yml
```

**Output Format:**
```yaml
Mobilheimplatz 6237/113, 7141 Podersdorf am See, Austria:
  title: 2020 Ossiacher See, Bad Waltersdorf, Podersdorf am See
  from: null
  to: null
  exclude: null
Camping Azzurro - Ledro, Via Alzer, 5, 38067 Pieve di Ledro TN, Italy:
  title: 2020 Camping Azzurro - Ledro See
  from: null
  to: '2020-08-01'
  exclude: null
```

**import-travel-patches.cjs**

Imports travel patch adjustments from YAML file into the database.

```bash
# Import and merge with existing data
node scripts/import-travel-patches.cjs travel-patches.yml

# Preview import without making changes
node scripts/import-travel-patches.cjs travel-patches.yml --dry-run

# Replace all existing patches
node scripts/import-travel-patches.cjs travel-patches.yml --replace
```

#### 14.3.4 Manual POI Scripts

**export-manual-pois.cjs**

Exports all manual POIs (user-created points of interest) to JSON file.

```bash
# Export to timestamped file (default)
node scripts/export-manual-pois.cjs

# Export to specific file
node scripts/export-manual-pois.cjs my-pois.json
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

**import-manual-pois.cjs**

Imports manual POIs from JSON file into the database.

```bash
# Import and merge with existing data
node scripts/import-manual-pois.cjs manual-pois-export.json

# Preview import without making changes
node scripts/import-manual-pois.cjs manual-pois-export.json --dry-run

# Replace all existing POIs
node scripts/import-manual-pois.cjs manual-pois-export.json --replace
```

#### 14.3.5 Manual Travel Scripts

**export-manual-travels.cjs**

Exports manual travels and their positions to JSON.

```bash
# Export all manual travels
node scripts/export-manual-travels.cjs

# Export a specific travel by ID
node scripts/export-manual-travels.cjs <travel-id>

# Export to a specific file
node scripts/export-manual-travels.cjs <travel-id> manual-travel.json
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

**import-manual-travels.cjs**

Imports manual travels and their positions from JSON.

```bash
# Import and merge with existing data
node scripts/import-manual-travels.cjs manual-travels-export.json

# Preview import without making changes
node scripts/import-manual-travels.cjs manual-travels-export.json --dry-run

# Replace all existing manual travels
node scripts/import-manual-travels.cjs manual-travels-export.json --replace
```
#### 14.3.6 Common Workflows

**Complete Backup:**
```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Export all data types
node scripts/export-timings.cjs backups/$(date +%Y%m%d)/timings.json
node scripts/export-travel-patches.cjs backups/$(date +%Y%m%d)/patches.yml
node scripts/export-manual-pois.cjs backups/$(date +%Y%m%d)/pois.json
node scripts/export-manual-travels.cjs backups/$(date +%Y%m%d)/manual-travels.json

# Archive databases and documents
cp data/cache/*.db backups/$(date +%Y%m%d)/
cp -r data/documents backups/$(date +%Y%m%d)/
```

**Transfer to Another Instance:**
```bash
# On source instance
node scripts/export-timings.cjs timings-transfer.json
node scripts/export-travel-patches.cjs patches-transfer.yml
node scripts/export-manual-pois.cjs pois-transfer.json
node scripts/export-manual-travels.cjs manual-travels-transfer.json

# Copy to target instance (example using scp)
scp *-transfer.* user@target-server:/path/to/target/instance/

# On target instance
node scripts/import-timings.cjs timings-transfer.json
node scripts/import-travel-patches.cjs patches-transfer.yml
node scripts/import-manual-pois.cjs pois-transfer.json
node scripts/import-manual-travels.cjs manual-travels-transfer.json
```

**Restore from Backup:**
```bash
# Restore all data types (replace mode)
node scripts/import-timings.cjs backups/20260207/timings.json --replace
node scripts/import-travel-patches.cjs backups/20260207/patches.yml --replace
node scripts/import-manual-pois.cjs backups/20260207/pois.json --replace
node scripts/import-manual-travels.cjs backups/20260207/manual-travels.json --replace
```

#### 14.3.7 Merge vs Replace Modes

**Merge Mode (Default):**
- Keeps existing records not in import file
- Updates existing records if key matches
- Adds new records from import file
- **Use when:** Adding/updating specific records without losing others

**Replace Mode (`--replace`):**
- Deletes ALL existing records first
- Imports all records from file
- **Use when:** Complete replacement with imported dataset

#### 14.3.8 Data Structures

**Standstill Adjustments Table:**
```sql
CREATE TABLE standstill_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  standstill_key TEXT UNIQUE NOT NULL,
  start_adjustment_minutes INTEGER DEFAULT 0,
  end_adjustment_minutes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Manual POIs Table:**
```sql
CREATE TABLE manual_pois (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poi_key TEXT UNIQUE NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp TEXT NOT NULL,
  device_id INTEGER NOT NULL,
  address TEXT,
  country TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Manual Travels Table:**
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

**Manual Travel Positions Table:**
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

#### 14.3.9 Script Usage Notes

**Requirements:**
- Node.js 14+
- better-sqlite3 package (included in project dependencies)
- Database path: `data/app.db` (relative to project root)

**Features:**
- Transactional operations (atomic commits)
- Timestamp preservation during export/import
- Validation of required fields
- Clear error messages
- Progress indicators

**Best Practices:**
- Always use `--dry-run` first to preview changes
- Create backups before using `--replace` mode
- Verify export file contents before importing
- Keep backup files in version control (git LFS) or cloud storage
- Test restore procedures regularly

### 14.4 Troubleshooting

**Common Issues:**

1. **App won't start:**
   - Check `.env` configuration
   - Verify Node.js version
   - Check port availability
   - Review error logs

2. **No GPS data:**
   - Test Traccar API connection
   - Verify credentials
   - Check device ID
   - Run prefetch: `GET /api/prefetchroute`

3. **Map not loading:**
   - Verify Google Maps API key
   - Check browser console
   - Ensure API key has Maps JavaScript API enabled

4. **WordPress integration fails:**
   - Test connection: `GET /api/wordpress/test`
   - Verify Application Password
   - Check WordPress REST API enabled
   - Verify tag exists

5. **Database errors:**
   - Check disk space
   - Verify file permissions
   - Rebuild cache: `GET /api/delprefetch` then `/api/prefetchroute`

6. **Script execution errors:**
   - Ensure running from project root or scripts directory
   - Check database exists at `data/app.db`
   - Verify read/write permissions
   - Check file format (JSON for timings/POIs, YAML for patches)
   - Review error messages for validation failures

### 14.5 Documentation

**User Guide (Future):**
- Getting started
- Feature walkthroughs
- Screenshots/videos
- FAQ

**Developer Guide (This Document):**
- Architecture overview
- API reference
- Code conventions
- Contribution guidelines

**API Documentation (Future):**
- OpenAPI/Swagger spec
- Interactive API explorer
- Code examples

---

## 15. Security Considerations

### 15.1 Authentication & Authorization

**Current Implementation:**
- App-level password (VUE_TRACCAR_PASSWORD)
- Settings-level password (SETTINGS_PASSWORD)
- SSO forward-auth support (authenticated flag)

**Future Enhancements:**
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-user support
- OAuth2 integration

### 15.2 Data Protection

**Sensitive Data:**
- Passwords (Traccar, WordPress, app)
- API keys (Google Maps)
- GPS coordinates (personal location data)

**Protection Measures:**
- Environment variables (not committed)
- `.gitignore` for config files
- HTTPS for all traffic
- Database encryption (future)

### 15.3 API Security

**Traccar API:**
- Basic Auth over HTTPS
- Credentials stored server-side only
- Never exposed to client

**WordPress API:**
- Application Password (not user password)
- HTTPS required
- Read-only access preferred

**Google Maps API:**
- API key restrictions (HTTP referrers)
- Usage quotas
- Billing alerts

### 15.4 Input Validation

**Server-Side:**
- Validate all API inputs
- Sanitize SQL queries (prepared statements)
- Escape HTML output

**Client-Side:**
- Form validation (Vuetify rules)
- Type checking (TypeScript)
- XSS prevention (Vue auto-escaping)

### 15.5 GDPR Compliance

**Considerations:**
- GPS data is personal data
- Inform users of data collection
- Provide data export (KML)
- Provide data deletion (cache clear)
- Privacy policy (future)

---

## 16. Future Enhancements

### 16.1 Planned Features

**Phase 1 (Q1 2026):**
- [ ] Multi-user support with RBAC
- [ ] Mobile app (React Native)
- [ ] Offline mode (Progressive Web App)
- [ ] Advanced analytics dashboard

**Phase 2 (Q2 2026):**
- [ ] Real-time tracking (WebSockets)
- [ ] Geofence alerts (email/SMS)
- [ ] Trip reports (PDF generation)
- [ ] Fleet management (multiple devices)

**Phase 3 (Q3 2026):**
- [ ] Machine learning (trip prediction)
- [ ] Weather integration
- [ ] Fuel consumption tracking
- [ ] Social sharing

### 16.2 Technical Improvements

**Performance:**
- [ ] Server-side rendering (SSR) optimization
- [ ] Service worker (offline caching)
- [ ] Database query optimization
- [ ] CDN for static assets

**Developer Experience:**
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker containerization

**UI/UX:**
- [ ] Dark mode
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Internationalization (i18n)
- [ ] Mobile-responsive improvements

### 16.3 Integration Opportunities

**Third-Party Services:**
- [ ] OpenStreetMap (alternative to Google Maps)
- [ ] Mapbox (custom map styling)
- [ ] Weather APIs (weather conditions during travel)
- [ ] Fuel price APIs (cost tracking)
- [ ] Hotel/POI APIs (travel recommendations)

**Export Formats:**
- [ ] GPX export (standard GPS format)
- [ ] CSV export (for analysis in Excel)
- [ ] JSON export (for developers)
- [ ] PDF reports (printable summaries)

---

## 17. Change Log

### Version 1.0.3 (2026-02-09)

**Major Changes:**
- ✅ Manual travel editor with map-based lasso selection
- ✅ Manual travel persistence in `app.db` (`manual_travels`, `manual_travel_positions`)
- ✅ Manual travel API endpoints and workspace endpoints
- ✅ Manual travel export/import scripts
- ✅ Manual travels integrated into travel list, map rendering, and KML export

### Version 1.0.2 (2026-02-08)

**Major Changes:**
- ✅ JWT auth with Authelia forward-auth
- ✅ Admin-only Settings UI and endpoints
- ✅ Settings secrets visible in UI (TLS required in production)
- ✅ Removed settings password verification and YAML migration endpoint
- ✅ Admin-only menu items and About dialog sections

### Version 1.0.0 (2026-02-07)

**Major Changes:**
- ✅ Separated databases (route.db for caching, app.db for settings)
- ✅ Removed sensitive files from git tracking (settings.yml, databases)
- ✅ Added travel patch editing functionality (✏️ edit button)
- ✅ Settings management UI for all configuration
- ✅ WordPress integration for standstill markers in KML
- ✅ KML export with standstill locations
- ✅ Manual POI creation (Cmd/Ctrl+Click on map)
- ✅ POI Mode toggle for independent point-of-interest markers
- ✅ Data management scripts for export/import:
  - export/import-timings.cjs (standstill adjustments)
  - export/import-travel-patches.cjs (travel configuration)
  - export/import-manual-pois.cjs (user-created POIs)
- ✅ About dialog with version info
- ✅ Cache status endpoint (GET /api/cache-status)
- ✅ Multiple bug fixes and optimizations

**Migration from Python:**
- Complete rewrite from Python/Quart to Nuxt 4/TypeScript
- Replaced 32MB HDF5 file with SQLite databases
- Replaced Pandas DataFrames with native TypeScript arrays
- All 14 API endpoints implemented
- All 9 Vue components migrated
- All business logic services ported

**Files Modified/Created:**
- 60+ TypeScript/Vue files
- ~5,000 lines of code
- Complete documentation suite

---

## 18. Credits & License

### 18.1 Original Project
**VueTraccar** by Dieter Chvatal
Python/Quart backend with Vue 2 frontend

### 18.2 Migration
**VueTraccarNuxt** migrated to Nuxt 4 with TypeScript
Migration performed with **Claude Code** (Anthropic)
Date: February 2026

### 18.3 Key Contributors
- Dieter Chvatal (Original author, project owner)
- Claude Sonnet 4.5 (AI assistant, code generation)

### 18.4 License
Same as original VueTraccar project
(Specify license: MIT, GPL, etc. - not provided in repository)

### 18.5 Dependencies
See `package.json` for full list. Key dependencies:
- Nuxt 4 (MIT)
- Vue 3 (MIT)
- Vuetify 3 (MIT)
- better-sqlite3 (MIT)
- vue3-google-map (MIT)
- axios (MIT)
- YAML (ISC)

### 18.6 External Services
- **Traccar:** Open-source GPS tracking platform (Apache 2.0)
- **Google Maps:** © Google LLC (Commercial license required)
- **WordPress:** Open-source CMS (GPL)

---

## 19. Appendix

### 19.1 Glossary

**Terms:**
- **Standstill:** Period where GPS device is stationary for >12 hours
- **Geofence:** Virtual boundary around a geographic area
- **Travel Patch:** Manual override for auto-detected travel periods
- **Plus Code:** Google's geocoding system (e.g., "2HCR+WM")
- **KML:** Keyhole Markup Language (XML format for geographic data)
- **RST:** reStructuredText (markup language for documentation)
- **WAL:** Write-Ahead Logging (SQLite journaling mode)
- **SSR:** Server-Side Rendering (Nuxt feature)
- **TTL:** Time To Live (cache expiration)

### 19.2 Acronyms

- **API:** Application Programming Interface
- **CMS:** Content Management System
- **GPS:** Global Positioning System
- **HTTP:** Hypertext Transfer Protocol
- **JSON:** JavaScript Object Notation
- **REST:** Representational State Transfer
- **SQL:** Structured Query Language
- **UI:** User Interface
- **URL:** Uniform Resource Locator
- **XML:** Extensible Markup Language
- **YAML:** YAML Ain't Markup Language

### 19.3 References

**Documentation:**
- [Nuxt 4 Docs](https://nuxt.com/)
- [Vue 3 Docs](https://vuejs.org/)
- [Vuetify 3 Docs](https://vuetifyjs.com/)
- [Traccar API Docs](https://www.traccar.org/api-reference/)
- [WordPress REST API](https://developer.wordpress.org/rest-api/)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [better-sqlite3 Docs](https://github.com/WiseLibs/better-sqlite3/wiki)

**Resources:**
- GitHub Repository: (Add URL)
- Live Demo: (Add URL)
- Issue Tracker: (Add URL)
- Documentation Wiki: (Add URL)

---

**Document End**

---

## Document Information

**Generated:** 2026-02-07
**Last Updated:** 2026-02-07
**Format:** Markdown
**Version:** 1.0.1
**Author:** Claude Sonnet 4.5 (based on git commits and project analysis)
**Word Count:** ~13,000 words
**Page Count:** ~65 pages (printed)

This specification document provides comprehensive coverage of the VueTraccarNuxt application, from architecture to deployment. It serves as both technical documentation for developers and reference material for stakeholders.
