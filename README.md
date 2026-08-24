# VueTraccarCodex

Nuxt 3/Nitro application for Traccar-based travel analysis, map rendering, manual travel repair, WordPress-linked travel notes, and native mobile API access.

## Current Architecture

- Frontend: Nuxt 3, Vue 3 Composition API, Vuetify 3
- Backend: Nuxt/Nitro server routes under `server/api`
- Storage:
  - `data/cache/route.db` for cached Traccar route/events/standstill data
  - `data/app.db` for travel patches, manual POIs, manual travels, and repair data
  - `data/settings.yml` for frontend-editable public settings only
  - `data/documents/` for marker documents
- Maps:
  - Google Maps JavaScript API
  - Leaflet/OpenStreetMap adapter support in the frontend
- Auth:
  - Web: Authelia forward-auth plus app JWT cookie
  - Mobile: bearer access JWT plus rotating opaque refresh token

## Main Features

- Automatic travel detection from Traccar geofence events
- Route/standstill analysis with SQLite caching
- Google Maps visualization with standstill markers and route polylines
- WordPress post lookup by marker tag, for example `marker360417M56303`
- RST/Markdown-like marker document editing
- Manual POI creation and management
- Travel patch management for renamed/corrupted geocoding keys
- Manual travel reconstruction and repair editor
- JSON import/export from the manual travel editor
- KML export
- OpenAPI/Swagger UI at `/docs`
- Native iOS auth reference under `ios/`

## Quick Start

```bash
npm install
cp .env.example .env
mkdir -p data/cache data/documents
npm run dev
```

Development server defaults to `http://localhost:5999` via `nuxt.config.ts`.

Production build:

```bash
npm run build
npm run preview
```

## Required Environment

Start from `.env.example`. Do not commit real secrets.

### Core Traccar

```bash
TRACCAR_URL=https://tracking.example.com
TRACCAR_USER=your-traccar-user
TRACCAR_PASSWORD=<traccar-password>
TRACCAR_DEVICE_ID=4
TRACCAR_DEVICE_NAME=Device
```

### Google Maps

```bash
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=<google-maps-browser-key>
NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID=<google-maps-map-id>
```

The Google Maps key is a browser/public key by design. Restrict it in Google Cloud Console by HTTP referrer and enabled APIs. Do not treat it as a server secret.

### WordPress Optional

```bash
WORDPRESS_URL=
WORDPRESS_USER=
WORDPRESS_APP_PASSWORD=
WORDPRESS_CACHE_DURATION=3600
```

If `WORDPRESS_URL` is set in production, `WORDPRESS_USER` and `WORDPRESS_APP_PASSWORD` are required.

### Web Auth

```bash
JWT_SECRET=<strong-random-secret-min-32-chars>
JWT_TTL_SECONDS=3600
JWT_ISSUER=vue-traccar
JWT_AUDIENCE=vue-traccar-ui
AUTH_COOKIE_NAME=vt_auth
AUTH_COOKIE_SECURE=true
ADMIN_GROUP=admins
NUXT_PUBLIC_AUTHELIA_LOGOUT_URL=https://authelia.example.com/logout
```

### Mobile Auth

```bash
MOBILE_AUTH_USERNAME=
MOBILE_AUTH_PASSWORD_HASH=
MOBILE_AUTH_ROLE=user
MOBILE_JWT_TTL_SECONDS=900
MOBILE_REFRESH_TOKEN_TTL_SECONDS=2592000
MOBILE_REFRESH_TOKEN_HASH_SECRET=<strong-random-secret-min-32-chars>
```

Generate `MOBILE_AUTH_PASSWORD_HASH` with:

```bash
npm run mobile:hash -- --password "your-password"
```

### Production Secret Checks

In production, startup fails when required secrets are missing or weak:

- `JWT_SECRET`
- `MOBILE_REFRESH_TOKEN_HASH_SECRET`
- `TRACCAR_PASSWORD`
- `SETTINGS_PASSWORD`
- `WORDPRESS_USER` and `WORDPRESS_APP_PASSWORD` when `WORDPRESS_URL` is configured

## Authentication Model

### Web Flow

- Traefik/Authelia protects normal web routes.
- `/api/auth/token` exchanges trusted Authelia forward-auth identity headers for an app JWT cookie.
- `/api/auth/me` reports current auth state.
- `/api/auth/logout` clears the app cookie.
- Non-mobile `/api/*` routes keep existing web cookie behavior when no bearer token is present.

### Mobile Flow

- `POST /api/mobile/auth/login` validates configured mobile credentials and returns:
  - `accessToken` short-lived JWT, default max 15 minutes
  - `refreshToken` random opaque token, default 30 days
- `POST /api/mobile/auth/refresh` rotates refresh tokens and returns a new pair.
- `POST /api/mobile/auth/logout` revokes the refresh-token family.
- Refresh tokens are stored server-side only as HMAC hashes.
- Refresh-token reuse revokes the full token family.
- `/api/mobile/*` routes other than auth endpoints are bearer-only and never accept cookies.
- Existing `/api/*` routes accept a valid `Authorization: Bearer <accessToken>` and otherwise fall back to web/cookie behavior.

See `IOS-frontend.md` and `ios/README.md` for the native client reference.

## Settings Model

Frontend-editable settings are limited to:

- `GET /api/settings/public`
- `POST /api/settings/public`

These endpoints are admin-only and use a strict whitelist. Secret/internal fields are neither returned nor accepted.

Public editable fields:

- `traccarDeviceId`
- `traccarDeviceName`
- `googleMapsMapId`
- `wordpressCacheDuration`
- `homeMode`
- `homeLatitude`
- `homeLongitude`
- `homeGeofenceId`
- `homeGeofenceName`
- `eventMinGap`
- `maxDays`
- `minDays`
- `standPeriod`
- `startDate`
- `sideTripEnabled`
- `sideTripDevices`
- `sideTripBufferHours`

Server secrets must be configured through `.env` or deployment environment only.

## Manual Travel And Repair Editor

Open `Manuelle Reisen & Reparatur` from the app menu.

Supported workflows:

- Create a manual travel from raw Traccar positions.
- Repair a broken travel by loading an original route, importing points from another device, and adding manual points.
- Select points with the lasso and delete/keep selections.
- Shift date/time for selected manual repair points.
- Save repaired/manual travels into `manual_travels` and `manual_travel_positions`.
- Export a saved travel as JSON from the editor menu.
- Import a JSON file from the browser file picker.

Import behavior:

- Import creates a new travel; it does not overwrite or merge.
- Importing the same file twice creates duplicates.
- The original JSON file remains a backup artifact.
- Duplicate imports can be removed through the editor's delete action.

Detailed notes: `ManualTravelEditor.md`.

## API Documentation

- OpenAPI source: `public/openapi.yaml`
- Served spec: `/openapi.yaml`
- Swagger UI: `/docs`
- `/docs` is a normal web route and should remain protected by Authelia in production.

Key route groups:

- Auth: `/api/auth/*`
- Mobile auth: `/api/mobile/auth/*`
- Mobile bearer-only test route: `/api/mobile/ping`
- GPS/route: `/api/devices`, `/api/geofences`, `/api/events`, `/api/route`, `/api/plotmaps`
- Travels: `/api/travels`, `/api/download.kml`
- Manual travels: `/api/manual-travels/*`, `/api/manual-route`, `/api/manual-travel-workspace/*`
- Travel patches: `/api/travel-patches/*`
- Settings: `/api/settings/public`, `/api/side-trips/config`
- Manual POIs: `/api/manual-pois/*`
- Standstill adjustments: `/api/standstill-adjustments/*`
- Documents: `/api/document/{key}`
- WordPress: `/api/wordpress/*`

Use `public/openapi.yaml` as the authoritative route contract.

## Data Management

Scripts are in `scripts/`; see `scripts/README.md` for full formats and options.

Export examples:

```bash
node scripts/export-timings.cjs backups/timings.json
node scripts/export-travel-patches.cjs backups/travel-patches.yml
node scripts/export-manual-pois.cjs backups/manual-pois.json
node scripts/export-manual-travels.cjs backups/manual-travels.json
```

Import examples:

```bash
node scripts/import-timings.cjs backups/timings.json --dry-run
node scripts/import-travel-patches.cjs backups/travel-patches.yml --merge
node scripts/import-manual-pois.cjs backups/manual-pois.json --replace
node scripts/import-manual-travels.cjs backups/manual-travels.json --merge
```

Recommended backup contents:

- Script exports for timings, travel patches, manual POIs, and manual travels
- `data/app.db`
- `data/cache/route.db` if you want to avoid rebuilding the route cache
- `data/documents/`
- Deployment `.env` from your secret store, not committed to git

## Project Layout

```text
server/api/                 Nitro API routes
server/middleware/auth.ts   API auth middleware
server/services/            Traccar, route, travel, WordPress services
server/utils/               SQLite, auth, settings utilities
server/plugins/             Startup security checks
components/                 Vue/Vuetify UI components
composables/                Shared frontend state and API orchestration
utils/                      Client utility functions
data/                       Local runtime data, not for secrets in git
public/openapi.yaml         OpenAPI contract served by /openapi.yaml
scripts/                    Import/export and helper scripts
ios/                        Swift mobile auth reference
```

## Commands

```bash
npm run dev
npm run build
npm run preview
npm test
npm run mobile:hash -- --password "your-password"
```

## Tests

Current backend tests use Node's built-in test runner:

```bash
npm test
node --test tests/settings-public.test.mjs
node --test tests/mobile-refresh.test.mjs
```

## Production Notes

- Run behind HTTPS.
- Keep Traefik/Authelia protection on normal web routes and `/docs`.
- Keep `/api/mobile/auth/*` reachable for native clients.
- Do not expose server ports directly to the public internet.
- Restrict the Google Maps browser key by referrer and API.
- Keep `.env`, `data/*.db`, and `data/settings.yml` out of git.
- Back up `data/app.db` and `data/documents/` before risky maintenance.

## Troubleshooting

No GPS data:

- Check `TRACCAR_URL`, `TRACCAR_USER`, `TRACCAR_PASSWORD`, and device ID.
- Test `/api/devices` and `/api/geofences` behind authenticated web flow.
- Rebuild cache with `/api/delprefetch` and `/api/prefetchroute` if required.

Map fails to load:

- Check browser console for Google Maps errors.
- Verify Maps JavaScript API is enabled.
- Verify referrer restrictions allow your deployment host.

Settings save fails:

- Confirm you are admin according to `ADMIN_GROUP` / Authelia groups.
- Only public settings fields are accepted by `/api/settings/public`.

Mobile login fails:

- Set `MOBILE_AUTH_USERNAME` and `MOBILE_AUTH_PASSWORD_HASH`.
- Generate the hash with `npm run mobile:hash`.
- Ensure `JWT_SECRET` and `MOBILE_REFRESH_TOKEN_HASH_SECRET` are strong in production.

Manual travel import creates duplicates:

- This is expected; imports are append-only.
- Delete duplicate entries from the editor menu.

## Related Documentation

- `dTraccarCodex_spec.md` - Current concise backend/frontend spec
- `SOFTWARE_SPECIFICATION.md` - Long-form system specification
- `ManualTravelEditor.md` - Manual travel and repair editor notes
- `IOS-frontend.md` - Native iOS frontend guide
- `ios/README.md` - Swift mobile auth reference
- `docs/security/auth-matrix-step1.md` - Auth audit snapshot
- `scripts/README.md` - Import/export script details
