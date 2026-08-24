# dTraccarCodex Current Spec

## Scope

Nuxt 3 + Nitro application with authenticated `/api/*` backend, Authelia-protected web UI, mobile bearer auth, admin-managed public settings, and manual travel repair/import/export workflows.

## Authentication Model

### Web Flow

- Web authentication is handled by Authelia forward-auth in front of the app.
- `/api/auth/token` validates forwarded identity headers and issues the app JWT cookie.
- `/api/auth/me` returns the current app auth state.
- `/api/auth/logout` clears the app auth cookie.
- Normal web routes and `/docs` should remain protected by Authelia in production.

### Mobile Flow

- `POST /api/mobile/auth/login` is public and returns:
  - short-lived access JWT (`accessToken`, default 15m)
  - opaque refresh token (`refreshToken`, default 30d)
- `POST /api/mobile/auth/refresh` is public, rotates refresh token, and returns a new token pair.
- `POST /api/mobile/auth/logout` is public and revokes the refresh-token family.
- Refresh tokens are random opaque values; only HMAC hashes are stored server-side.
- Refresh-token reuse detection revokes the full token family and returns `401`.
- All other `/api/mobile/*` routes are bearer-only.
- Cookie auth is not accepted on protected `/api/mobile/*` routes.
- Missing/invalid bearer on `/api/mobile/*` returns JSON `401 { "error": "unauthorized" }`.

### General API Behavior

- Existing `/api/*` routes accept valid bearer tokens.
- If bearer is missing on non-mobile routes, existing web cookie/Authelia behavior applies.
- Invalid bearer returns JSON `401` rather than a browser redirect.

## Settings Model

### Public Editable Settings

Endpoints:

- `GET /api/settings/public`
- `POST /api/settings/public`

Rules:

- Admin-only access.
- Strict whitelist input validation on POST.
- Secret/internal fields are never serialized.
- Secret/internal fields are rejected when submitted.

Editable/returned fields:

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

### Removed Legacy Endpoint

- Legacy `/api/settings` endpoints are removed.
- OpenAPI must not document `/api/settings`.

### Secret/Internal Settings

- Never exposed through frontend settings endpoints.
- Managed only via `.env`, deployment environment, and server-side runtime config.
- Google Maps API key is a browser/public key and remains in `runtimeConfig.public`; restrict it by Google referrer/API settings.

## Manual Travel And Repair Model

### Persistence

Manual and repaired travels are stored in:

- `manual_travels`
- `manual_travel_positions`

Both appear in `/api/travels` as `source: "manual"`.

### Editor Behavior

- Manual mode creates curated travels from raw route points.
- Repair mode can load a broken travel, replacement-device points, and manually inserted points.
- Saved repairs are recognized by title/notes/position attributes and reopen in repair mode.
- Repair point sources are stored in `attributes.source`:
  - `repair-original`
  - `repair-replacement`
  - `manual-repair`

### Browser JSON Import/Export

- The editor can export one saved manual/repaired travel as JSON.
- The editor can import JSON from the local browser file picker.
- Import creates a new travel and does not overwrite or merge.
- Importing the same JSON twice creates duplicates.
- Server-side scripts remain available for full backup/restore.

## Production Secret Requirements

The server fails startup in production if required secrets are missing/weak.

Required:

- `JWT_SECRET`
- `MOBILE_REFRESH_TOKEN_HASH_SECRET`
- `TRACCAR_PASSWORD`
- `SETTINGS_PASSWORD`

Conditional:

- If `WORDPRESS_URL` is set:
  - `WORDPRESS_USER`
  - `WORDPRESS_APP_PASSWORD`

## OpenAPI

- Source: `public/openapi.yaml`
- Served at `/openapi.yaml`
- Swagger UI at `/docs`
- Settings path documented only as `/api/settings/public`.
- Mobile auth paths documented with access/refresh token schemas.

## Validation Baseline

- Build: `npm run build`
- All backend tests: `npm test`
- Focused settings tests: `node --test tests/settings-public.test.mjs`
- Focused mobile refresh tests: `node --test tests/mobile-refresh.test.mjs`
