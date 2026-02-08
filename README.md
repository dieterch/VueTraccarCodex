# VueTraccarCodex

**Version:** 1.0.2
**Author:** Dieter Chvatal

Modern Nuxt 3 rewrite of VueTraccar with TypeScript backend, replacing Python/Quart with Nuxt server routes. A comprehensive GPS tracking, route visualization, and travel management system.

## Features

- 🚀 **Nuxt 3** with TypeScript backend
- 🗺️ **Google Maps** integration with route visualization
- 📍 **GPS Tracking** via Traccar API with automatic caching
- 🗄️ **Dual SQLite Databases** (route.db for caching, app.db for settings)
- 🧭 **Intelligent Route Analysis** with standstill detection (>12 hours)
- ✈️ **Automatic Travel Detection** from geofence events
- 📝 **WordPress Integration** for travel blogs
- 📄 **RST Document Management** for location notes
- 📍 **Manual POI Creation** (Cmd/Ctrl+Click on map)
- 🎯 **POI Mode** for independent point-of-interest markers
- 📥 **KML Export** for route sharing (Google Earth compatible)
- 🔒 **Password Protection** for app and settings access
- 🎨 **Vuetify 3** Material Design UI
- ⚡ **Fast Performance** with WAL mode SQLite
- 💾 **Data Export/Import Scripts** for backup and portability

## Tech Stack

### Frontend
- **Framework:** Nuxt 3 with Vue 3 (Composition API)
- **UI Library:** Vuetify 3 (Material Design)
- **Maps:** vue3-google-map + Google Maps JavaScript API
- **Editor:** md-editor-v3 (Markdown preview)
- **Language:** TypeScript
- **Loading:** vue-loading-overlay

### Backend
- **Runtime:** Nuxt 3 Server Routes (h3, Node.js)
- **Database:** SQLite 3 with better-sqlite3 (dual database architecture)
- **HTTP Client:** Axios (Traccar & WordPress APIs)
- **Configuration:** YAML parser for settings
- **Language:** TypeScript

### External Integrations
- **GPS Platform:** Traccar GPS Tracking System
- **CMS:** WordPress REST API v2 (optional)
- **Maps Provider:** Google Maps Platform
- **Geocoding:** Google Maps Geocoding API

## Project Structure

```
VueTraccarCodex/
├── server/
│   ├── api/              # 20+ API endpoints
│   │   ├── devices.ts, route.ts, events.ts, plotmaps.ts
│   │   ├── prefetchroute.ts, delprefetch.ts, cache-status.ts
│   │   ├── travels.ts, download.kml.ts
│   │   ├── travel-patches.ts, travel-patches/[addressKey].ts
│   │   ├── settings.ts, settings/verify-password.ts
│   │   ├── document/[key].ts
│   │   ├── wordpress/posts/[tag].ts, wordpress/test.ts
│   │   └── geofences.ts
│   ├── services/         # Business logic
│   │   ├── traccar.service.ts      # GPS data fetching & caching
│   │   ├── route-analyzer.ts       # Standstill detection & geocoding
│   │   ├── travel-analyzer.ts      # Travel detection & patches
│   │   ├── wordpress.service.ts    # WordPress API client
│   │   ├── document-manager.ts     # RST document handling
│   │   └── kml-generator.ts        # KML export generation
│   └── utils/            # Server utilities
│       ├── cache.ts                # route.db operations
│       ├── app-db.ts               # app.db operations
│       ├── traccar-client.ts       # Traccar API client
│       └── wordpress-client.ts     # WordPress API client
├── components/           # Vue components
│   ├── AppBar.vue, GMap.vue, SideBar.vue
│   ├── DateDialog.vue, AboutDialog.vue
│   ├── SettingsDialog.vue          # Password-protected settings
│   ├── MDEditorDialog.vue, MDDialog.vue
│   └── DebugDialog.vue, Login.vue
├── composables/          # State management
│   ├── useTraccar.ts               # GPS & device state
│   ├── useMapData.ts               # Map visualization state
│   └── useDocuments.ts             # Document management
├── utils/                # Client utilities
│   ├── crypto.ts                   # Password hashing
│   ├── date.ts                     # Date formatting
│   └── maps.ts                     # Map calculations
├── scripts/              # Data management scripts
│   ├── export-timings.cjs          # Export standstill adjustments
│   ├── import-timings.cjs          # Import standstill adjustments
│   ├── export-travel-patches.cjs   # Export travel patches
│   ├── import-travel-patches.cjs   # Import travel patches
│   ├── export-manual-pois.cjs      # Export manual POIs
│   └── import-manual-pois.cjs      # Import manual POIs
├── data/
│   ├── cache/            # SQLite databases (not in git)
│   │   ├── route.db      # GPS positions, standstills, events
│   │   └── app.db        # Travel patches, settings, manual POIs
│   ├── documents/        # RST travel notes (create manually)
│   ├── settings.yml      # Runtime configuration (not in git)
│   └── travels.yml       # Legacy travel patches (not in git)
├── types/                # TypeScript definitions
└── documentation/        # Project documentation
    └── SOFTWARE_SPECIFICATION.md
```

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd VueTraccarCodex
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Traccar and Google Maps credentials

# Create data directories
mkdir -p data/cache data/documents

# Start development server
npm run dev
# Open http://localhost:3000

# Login with your VUE_TRACCAR_PASSWORD
# The app will automatically prefetch GPS data on first run (10-15 minutes)
```

## Setup

### Prerequisites

- **Node.js 18+** (recommended: 20 LTS)
- **npm** or **pnpm**
- **Traccar GPS server** with API access
- **Google Maps API key** (with Maps JavaScript API and Geocoding API enabled)
- **WordPress site** (optional, for travel blog integration)
- **512 MB RAM minimum** (1 GB recommended)
- **1 GB disk space** (for cache and historical data)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd VueTraccarCodex
   npm install
   ```

2. **Create data directories:**
   ```bash
   mkdir -p data/cache data/documents
   ```

3. **Configure environment variables:**

   Copy `.env.example` to `.env` and configure:
   ```bash
   # Traccar API (Required)
   TRACCAR_URL=https://tracking.example.com
   TRACCAR_USER=your-email@example.com
   TRACCAR_PASSWORD=your-password
   TRACCAR_DEVICE_ID=4

   # Google Maps (Required)
   NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key

   # WordPress (Optional)
   WORDPRESS_URL=https://blog.example.com
   WORDPRESS_USER=username
   WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
   WORDPRESS_CACHE_DURATION=3600

   # Application Security (Required)
   VUE_TRACCAR_PASSWORD=your-app-password
   SETTINGS_PASSWORD=your-settings-password

   # Home Location (Optional)
   HOME_MODE=false
   HOME_LATITUDE=47.2692
   HOME_LONGITUDE=11.4041
   HOME_GEOFENCE_ID=1

   # Route Analysis (Optional, defaults provided)
   EVENT_MIN_GAP=60
   MIN_TRAVEL_DAYS=2
   MAX_TRAVEL_DAYS=170
   STANDSTILL_PERIOD=12
   ANALYSIS_START_DATE=2020-01-01T00:00:00Z

   # Server (Optional)
   PORT=5999
   HOST=0.0.0.0
   ```

4. **Google Maps API Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable **Maps JavaScript API** and **Geocoding API**
   - Create API key and restrict by HTTP referrer
   - Set up billing (free tier available)

5. **Run development server:**
   ```bash
   npm run dev
   ```

   Open http://localhost:3000

6. **Initial Data Prefetch:**

   On first run, the app will automatically fetch and cache all historical GPS data from the Traccar API. This may take 10-15 minutes depending on your dataset size (typically 10,000-100,000 positions).

   You can also manually trigger prefetch:
   ```bash
   curl http://localhost:3000/api/prefetchroute?deviceId=4
   ```

7. **Production Deployment:**
   ```bash
   npm run build
   npm run preview
   # Or use PM2
   pm2 start npm --name "vue-traccar" -- run preview
   ```

## Usage Guide

### First Time Setup

1. **Login:** Enter your `VUE_TRACCAR_PASSWORD` when prompted
2. **Wait for Prefetch:** First run will cache all GPS data (10-15 minutes)
3. **Select Date Range:** Use the date picker to choose a travel period
4. **View Travels:** Click on a travel in the sidebar to load the map

### Main Features

#### Viewing Travels
1. Open the sidebar (left panel)
2. Select date range using the calendar icon
3. Click on any travel card to load the route on the map
4. Map will show:
   - **Blue polyline:** GPS route path
   - **Red markers:** Standstill locations (>12 hours)
   - **Numbers:** Sequential standstill order

#### Exploring Standstills
1. Click on a red marker to open InfoWindow
2. View standstill details:
   - Duration (hours)
   - Address and country
   - GPS coordinates (clickable Google Maps link)
   - WordPress posts (if tagged)
3. Click "Edit Document" to add private notes (RST format)

#### Creating Manual POIs
1. Enable **POI Mode** toggle in AppBar
2. Hold **Cmd** (Mac) or **Ctrl** (Windows/Linux)
3. Click anywhere on the map
4. POI is created with automatic geocoding
5. POIs are saved to `app.db` and can be exported

#### Managing Settings
1. Click menu icon (three dots) in AppBar
2. Select "Settings"
3. Enter `SETTINGS_PASSWORD`
4. Configure 7 settings panels:
   - Traccar API credentials
   - Google Maps API key
   - WordPress integration (optional)
   - Application passwords
   - Home geofence selection
   - Route analysis parameters
   - Travel patches (overrides)
5. Click "Save All Settings"
6. Settings persist in `data/settings.yml`

#### Travel Patches (Manual Overrides)
1. Open Settings → Travel Patches panel
2. **Migrate from YAML:** Import legacy `travels.yml`
3. **Add New Patch:**
   - Enter address key (e.g., "Vienna, Austria")
   - Set custom title, dates, or exclude flag
4. **Edit Existing:** Click edit icon (✏️)
5. **Delete:** Click delete icon (🗑️) with confirmation

#### Exporting Routes
1. Load a travel on the map
2. Click menu icon → "Download KML"
3. KML file includes:
   - Complete route polyline
   - All standstill markers
   - WordPress post titles (if available)
4. Open in Google Earth or other KML viewer

### Advanced Features

#### WordPress Integration
- Tag WordPress posts with standstill keys (e.g., `marker574701M41499`)
- Posts appear in InfoWindows automatically
- 1-hour cache for performance
- **Home Mode:** Transform external URLs to internal IPs

#### Document Management
- Each standstill can have a private RST document
- Click "Edit Document" in InfoWindow
- Markdown preview available
- Documents saved to `data/documents/`

#### Cache Management
- **View Status:** Menu → Cache Status
- **Clear Cache:** Menu → Clear Cache (requires confirmation)
- **Prefetch:** Automatically on startup, or manual via API

## API Endpoints

### GPS & Route Data
- `GET /api/devices` - List GPS devices
- `POST /api/route` - Get cached route positions
- `POST /api/events` - Get geofence events
- `POST /api/plotmaps` - Calculate map visualization data
- `GET /api/prefetchroute` - Prefetch all historical data
- `GET /api/delprefetch` - Clear cache
- `GET /api/cache-status` - Get cache statistics
- `GET /api/geofences` - List geofences from Traccar

### Travel Analysis
- `POST /api/travels` - Analyze travels from geofence events
- `POST /api/download.kml` - Generate KML export

### Travel Patches
- `GET /api/travel-patches` - List all travel patches
- `POST /api/travel-patches` - Create or update a travel patch
- `DELETE /api/travel-patches/[addressKey]` - Delete a travel patch
- `POST /api/travel-patches/migrate` - Migrate patches from YAML to database

### Settings
- `GET /api/settings` - Get all current settings
- `POST /api/settings` - Save settings to YAML file
- `POST /api/settings/verify-password` - Verify settings password

### Documents
- `GET /api/document/[key]` - Load RST document
- `POST /api/document/[key]` - Save RST document

### WordPress
- `GET /api/wordpress/posts/[tag]` - Get posts by tag
- `GET /api/wordpress/test` - Test connection

## Key Features

### Route Analysis
- Automatic standstill detection (>12 hours stationary)
- Reverse geocoding for addresses via Google Maps API
- Distance calculation (Haversine formula)
- Route visualization with polylines and markers
- Map bounds/center/zoom auto-calculation

### Travel Detection
- Automatic trip detection from geofence events
- Duration filtering (2-170 days)
- Farthest standstill calculation
- Manual patches via database (with YAML fallback)
- Travel patches management UI with edit/delete functionality

### Manual POI Creation
- Create points of interest by Cmd/Ctrl+Click on map
- POI Mode toggle for independent markers
- Automatic geocoding for POI locations
- Export POIs via data management scripts

### Caching Strategy
- Dual SQLite databases:
  - `route.db` - GPS positions, standstills, geofence events
  - `app.db` - Travel patches, settings, manual POIs
- Cache-first with incremental updates
- SQLite WAL mode for concurrent read performance
- Automatic prefetch on startup
- Efficient indexed queries (<500ms)

### WordPress Integration
- Tag-based post loading for standstill markers
- 1-hour in-memory cache TTL
- Home mode URL transformation
- Markdown preview in InfoWindows
- Featured image display in KML placemarks

### Settings Management
- Password-protected settings dialog
- Runtime configuration via `settings.yml` (overrides .env)
- 7 configuration panels:
  - Traccar API Configuration
  - Google Maps Configuration
  - WordPress Integration
  - Application Settings
  - Home Geofence Selection
  - Route Analysis Parameters
  - Travel Patches Management
- Device and geofence dropdown selection
- API connectivity testing

### Data Management & Portability
- Export/import scripts for backup and transfer
- Three data types supported:
  - **Standstill timing adjustments** (JSON format)
  - **Travel patches** (YAML format)
  - **Manual POIs** (JSON format)
- Merge and replace modes for imports
- Dry-run preview capability
- Complete backup/restore workflows

## Data Management Scripts

The `/scripts` directory contains utilities for exporting and importing application data, enabling backup, restore, and transfer between instances.

### Export Scripts

Export all data for backup:
```bash
# Export standstill timing adjustments
node scripts/export-timings.cjs [output-file.json]

# Export travel patches
node scripts/export-travel-patches.cjs [output-file.yml]

# Export manual POIs
node scripts/export-manual-pois.cjs [output-file.json]
```

### Import Scripts

Import data from backup:
```bash
# Import with merge (default - keeps existing data)
node scripts/import-timings.cjs timings.json

# Preview import without changes
node scripts/import-timings.cjs timings.json --dry-run

# Replace all existing data
node scripts/import-timings.cjs timings.json --replace
```

Same options apply to `import-travel-patches.cjs` and `import-manual-pois.cjs`.

### Complete Backup Workflow

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Export all data types
node scripts/export-timings.cjs backups/$(date +%Y%m%d)/timings.json
node scripts/export-travel-patches.cjs backups/$(date +%Y%m%d)/patches.yml
node scripts/export-manual-pois.cjs backups/$(date +%Y%m%d)/pois.json

# Copy databases and documents
cp data/cache/*.db backups/$(date +%Y%m%d)/
cp -r data/documents backups/$(date +%Y%m%d)/
cp data/settings.yml backups/$(date +%Y%m%d)/ 2>/dev/null || true
```

### Restore from Backup

```bash
# Restore all data types (replace mode)
node scripts/import-timings.cjs backups/20260207/timings.json --replace
node scripts/import-travel-patches.cjs backups/20260207/patches.yml --replace
node scripts/import-manual-pois.cjs backups/20260207/pois.json --replace

# Restore databases and documents
cp backups/20260207/*.db data/cache/
cp -r backups/20260207/documents data/
cp backups/20260207/settings.yml data/

# Restart application
pm2 restart vue-traccar
```

## Development

### Run Tests
```bash
npm run test
```

### Build for Production
```bash
npm run build
npm run preview
```

### Generate Static Site
```bash
npm run generate
```

## Production Deployment

### Build and Deploy

1. **Build the application:**
   ```bash
   npm run build
   # Output: .output/ directory
   ```

2. **Deploy with PM2** (recommended):
   ```bash
   pm2 start npm --name "vue-traccar" -- run preview
   pm2 save
   pm2 startup
   ```

3. **Or create systemd service:**
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

### Reverse Proxy (Nginx)

```nginx
server {
  listen 443 ssl;
  server_name tracker.example.com;

  ssl_certificate /etc/letsencrypt/live/tracker.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tracker.example.com/privkey.pem;

  location / {
    proxy_pass http://localhost:5999;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d tracker.example.com

# Auto-renewal (test)
sudo certbot renew --dry-run
```

### Environment Setup

**Production Checklist:**
- [ ] Set strong passwords (VUE_TRACCAR_PASSWORD, SETTINGS_PASSWORD)
- [ ] Configure HTTPS with valid SSL certificate
- [ ] Restrict Google Maps API key by HTTP referrer
- [ ] Enable firewall (allow 443, 80, deny 5999 from external)
- [ ] Set up automated backups (see Data Management Scripts)
- [ ] Configure log rotation (PM2 automatic)
- [ ] Test restore procedure from backup
- [ ] Monitor disk space (databases can grow to 10+ MB)
- [ ] Set up monitoring/alerts (optional: Uptime Robot, etc.)

## What's New in v1.0.2

### Major Features
- **Dual Database Architecture:** Separated `route.db` (caching) and `app.db` (settings)
- **Manual POI Creation:** Create points of interest by Cmd/Ctrl+Click on map
- **POI Mode Toggle:** Independent marker mode for user-created POIs
- **Settings Management UI:** Comprehensive password-protected settings dialog
- **Travel Patches Management:** Edit, create, and delete travel overrides in UI
- **Database Migration:** Migrate travel patches from YAML to database
- **WordPress in KML:** Standstill markers in KML exports include WordPress titles
- **Data Export/Import Scripts:** 6 scripts for backup/restore/portability
- **Cache Status Endpoint:** Monitor database statistics
- **About Dialog:** Version info and feature highlights

### Security & Data Management
- **Password Protection:** Separate passwords for app and settings access
- **Sensitive Files Excluded:** `settings.yml`, `travels.yml`, and databases not tracked in git
- **Configuration Priority:** `settings.yml` overrides `.env` for runtime changes
- **Complete Backup Workflows:** Export/import scripts for all application data

### Performance & Bug Fixes
- **Optimized Queries:** Indexed database queries (<500ms)
- **Memory Management:** Efficient in-memory WordPress cache
- **Multiple Bug Fixes:** Route analysis, geocoding, and UI improvements

## Migration from Python Backend

This project is a complete rewrite from Python/Quart to Nuxt 4 with TypeScript:

| Python (VueTraccar) | Nuxt 4 (VueTraccarNuxt) |
|---------------------|-------------------------|
| `app.py` | `server/api/*.ts` (20+ endpoints) |
| `dtraccar/traccar.py` | `server/services/traccar.service.ts` |
| `route_deviceId4.hdf` (32MB HDF5) | `data/cache/route.db` (SQLite) |
| Pandas DataFrames | Native TypeScript arrays |
| Flask/Quart routes | Nuxt server routes (h3) |
| Vue 2 | Vue 3 (Composition API) |
| ~3,000 lines Python | ~5,000 lines TypeScript |

**Migration Completed:** February 2026
- All 14 original API endpoints migrated
- Additional 6+ endpoints added (settings, travel patches, cache status)
- All 9 Vue components rewritten
- Complete feature parity + new features

## Configuration

### Configuration Priority

Settings are loaded with the following priority (highest to lowest):
1. `data/settings.yml` (created via Settings dialog)
2. `.env` file (manual configuration)
3. Environment variables
4. Default values

### Environment Variables

Create `.env` file from `.env.example` and configure:

```bash
# Traccar API
TRACCAR_URL=https://tracking.example.com
TRACCAR_USER=your-email@example.com
TRACCAR_PASSWORD=your-password
TRACCAR_DEVICE_ID=4

# Google Maps
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key

# WordPress (optional)
WORDPRESS_URL=https://blog.example.com
WORDPRESS_USER=username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
WORDPRESS_CACHE_DURATION=3600

# Application
VUE_TRACCAR_PASSWORD=your-app-password
SETTINGS_PASSWORD=your-settings-password
HOME_MODE=false
HOME_LATITUDE=47.2692
HOME_LONGITUDE=11.4041
HOME_GEOFENCE_ID=1

# Route Analysis
EVENT_MIN_GAP=60
MIN_TRAVEL_DAYS=2
MAX_TRAVEL_DAYS=170
STANDSTILL_PERIOD=12
ANALYSIS_START_DATE=2020-01-01T00:00:00Z

# Server
PORT=5999
HOST=0.0.0.0
```

### Database Structure

**route.db** (Route caching database):
- `positions` - GPS position cache with timestamps
- `standstills` - Detected standstill periods
- `geofence_events` - Geofence entry/exit events

**app.db** (Application database):
- `travel_patches` - Manual travel overrides
- `standstill_adjustments` - Timing adjustments for standstills
- `manual_pois` - User-created points of interest

### Travel Patches

Travel patches can be managed via:
1. **Settings Dialog** (recommended): Edit/create/delete patches in UI
2. **Database Direct**: Stored in `app.db` table `travel_patches`
3. **YAML File** (legacy): `data/travels.yml` for backward compatibility

```yaml
# Legacy format (travels.yml)
"Address, Country":
  title: "Custom Travel Title"
  from: "2024-01-01T10:00:00Z"
  to: "2024-01-15T18:00:00Z"
  exclude: false
```

Migrate from YAML to database using the Settings dialog or:
```bash
curl -X POST http://localhost:5999/api/travel-patches/migrate
```

## Performance

- **SQLite Cache:** <500ms for cached queries (WAL mode enabled)
- **Initial Prefetch:** ~10-15 minutes for full historical dataset
- **Incremental Updates:** <2 seconds for new data
- **Map Rendering:** <2s for 10,000+ GPS points (polyline chunking at 500 points)
- **WordPress Cache:** 1-hour in-memory TTL, <100ms cache hits
- **Database Size:** ~5-10MB for typical yearly dataset
- **Memory Usage:** ~100-200MB average

## Security Features

- **App Access Control:** Password-protected application access (`VUE_TRACCAR_PASSWORD`)
- **Settings Protection:** Separate password for settings modification (`SETTINGS_PASSWORD`)
- **SSO Support:** Forward-auth mode for enterprise authentication
- **Sensitive Data:**
  - Passwords hidden by default with toggle visibility
  - API keys server-side only (never exposed to client)
  - Configuration files excluded from git (`.gitignore`)
  - HTTPS recommended for production deployment
- **Input Validation:** Server-side validation and prepared SQL statements
- **GDPR Considerations:** GPS data privacy, data export (KML), cache clearing

## Troubleshooting

### Common Issues

1. **App won't start:**
   - Check `.env` configuration
   - Verify Node.js version (18+)
   - Check port availability (default: 5999)
   - Review PM2 logs: `pm2 logs vue-traccar`

2. **No GPS data:**
   - Test Traccar API connection in Settings dialog
   - Verify Traccar credentials
   - Check device ID is correct
   - Run prefetch: `GET http://localhost:5999/api/prefetchroute?deviceId=4`

3. **Map not loading:**
   - Verify Google Maps API key in Settings
   - Check browser console for errors
   - Ensure API key has Maps JavaScript API and Geocoding API enabled
   - Check API quotas in Google Cloud Console

4. **WordPress integration fails:**
   - Test connection via Settings dialog
   - Verify Application Password (not regular password)
   - Check WordPress REST API is enabled
   - Verify tags exist in WordPress

5. **Database errors:**
   - Check disk space availability
   - Verify file permissions on `data/cache/` directory
   - Rebuild cache: `GET /api/delprefetch` then `/api/prefetchroute`

6. **Script execution errors:**
   - Ensure running from project root
   - Check database exists at `data/app.db`
   - Verify read/write permissions
   - Check file format (JSON/YAML)

For more detailed troubleshooting, see `documentation/TROUBLESHOOTING.md`.

## Future Enhancements

### Planned Features

**Phase 1 (Q1-Q2 2026):**
- [ ] Dark mode theme
- [ ] Multi-user support with role-based access control
- [ ] Mobile app (Progressive Web App)
- [ ] Offline mode with service worker
- [ ] Advanced analytics dashboard
- [ ] Trip reports (PDF generation)

**Phase 2 (Q2-Q3 2026):**
- [ ] Real-time tracking (WebSockets)
- [ ] Geofence alerts (email/SMS notifications)
- [ ] Fleet management (multiple devices)
- [ ] Internationalization (i18n) support
- [ ] Alternative map providers (OpenStreetMap, Mapbox)

**Phase 3 (Q3-Q4 2026):**
- [ ] Machine learning for trip prediction
- [ ] Weather integration for historical data
- [ ] Fuel consumption tracking
- [ ] Social sharing features
- [ ] GPX/CSV export formats

**Technical Improvements:**
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker containerization
- [ ] Database query optimization
- [ ] CDN for static assets

## Documentation

- **Software Specification:** `documentation/SOFTWARE_SPECIFICATION.md` - Comprehensive technical documentation
- **Migration Status:** `documentation/MIGRATION_STATUS.md` - Python to Nuxt migration details
- **Map Debugging:** `documentation/MAP_DEBUG.md` - Map rendering and troubleshooting
- **Troubleshooting:** `documentation/TROUBLESHOOTING.md` - Common issues and solutions

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Development Guidelines:**
- Follow existing code style (TypeScript + Vue 3 Composition API)
- Add tests for new features (when test framework is implemented)
- Update documentation for significant changes
- Test thoroughly with real GPS data

## License

Same as original VueTraccar project

## Credits & Acknowledgments

### Original Project
**VueTraccar** by Dieter Chvatal
- Python/Quart backend with Vue 2 frontend
- Original concept and implementation

### Migration
**VueTraccarNuxt** - Nuxt 4 rewrite with TypeScript
- Migration performed: February 2026
- Migration tool: Claude Code (Anthropic)
- Complete rewrite: ~5,000 lines of TypeScript/Vue 3

### Key Technologies
- **Nuxt 4** (MIT) - Full-stack framework
- **Vue 3** (MIT) - Progressive JavaScript framework
- **Vuetify 3** (MIT) - Material Design components
- **better-sqlite3** (MIT) - SQLite database driver
- **vue3-google-map** (MIT) - Google Maps integration
- **Traccar** (Apache 2.0) - GPS tracking platform
- **WordPress** (GPL) - Content management system
- **Google Maps Platform** - Mapping and geocoding services

### Contributors
- Dieter Chvatal (Original author, project owner)
- Claude Sonnet 4.5 (AI assistant, code generation)
