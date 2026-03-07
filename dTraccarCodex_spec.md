# dTraccarCodex – Current Backend/Frontend Spec

## Scope
Nuxt 3 + Nitro application with authenticated `/api/*` backend, mobile bearer auth, and admin-managed public settings.

## Authentication Model

### Web flow
- Web authentication is handled via Authelia forward-auth headers through `/api/auth/token`.
- `/api/auth/token` issues the app JWT cookie after validating forwarded identity headers.
- Web API calls can use cookie auth as currently implemented by middleware.

### Mobile flow
- `POST /api/mobile/auth/login` is public and returns:
  - short-lived access JWT (`accessToken`, default 15m)
  - opaque refresh token (`refreshToken`, default 30d)
- `POST /api/mobile/auth/refresh` is public, rotates refresh token, and returns a new token pair.
- `POST /api/mobile/auth/logout` is public and revokes the refresh-token family.
- Refresh tokens are random opaque values; only HMAC hashes are stored server-side.
- Refresh-token reuse detection revokes the full token family and returns `401`.
- All other `/api/mobile/*` routes are bearer-only.
- Missing/invalid bearer on `/api/mobile/*` returns JSON:
  - `401 { "error": "unauthorized" }`

### General API behavior
- `/api/*` accepts valid bearer tokens.
- If bearer is missing on non-mobile routes, existing web cookie/auth behavior applies.

## Settings Model

### Public editable settings
- Endpoints:
  - `GET /api/settings/public`
  - `POST /api/settings/public`
- Admin-only access.
- Strict whitelist input validation on POST.
- Only safe/public fields are exposed and writable.

### Removed legacy endpoint
- Legacy `/api/settings` endpoints are removed.

### Secret/internal settings
- Never exposed through frontend settings endpoints.
- Managed only via environment/private runtime config.

## Public Settings Contract
Editable/returned fields on `/api/settings/public`:
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

## Production Secret Requirements
The server fails startup in production if required secrets are missing/weak.

Required:
- `JWT_SECRET`
- `MOBILE_REFRESH_TOKEN_HASH_SECRET`
- `TRACCAR_PASSWORD`
- `SETTINGS_PASSWORD`

Conditional:
- If `WORDPRESS_URL` is set, then also required:
  - `WORDPRESS_USER`
  - `WORDPRESS_APP_PASSWORD`

## OpenAPI
- Source: `public/openapi.yaml`
- Settings path documented as `/api/settings/public`.
- No `/api/settings` path in contract.

## Security Constraints
- No secrets in frontend settings UI.
- No secret serialization in `/api/settings/public` responses.
- No secret acceptance in `/api/settings/public` requests.

## Validation Baseline
- Build: `npm run build`
- Settings security tests: `node --test tests/settings-public.test.mjs`
