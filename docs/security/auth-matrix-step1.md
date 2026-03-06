• Auth Matrix (actual code path)

  Enforcement references:

  - M1 = global middleware server/middleware/auth.ts (defineEventHandler)
  - A1 = mobile login handler server/api/mobile/auth/login.post.ts
  - W1 = auth token handler server/api/auth/token.post.ts

  Unauthorized behavior keys:

  - U-public: no auth required by middleware/handler.
  - U-web: expected “web flow” fallback; actual in app code is 401 (no redirect logic in app):
    invalid bearer -> 401 {"error":"unauthorized"} from M1; no bearer + missing/invalid cookie -> H3 401 error (Missing/Invalid auth token).
  - U-mobile: expected 401 JSON; actual: missing/invalid auth -> 401 {"error":"unauthorized"} from M1 (but valid cookie JWT is also accepted).
  - U-admin: expected 401 unauth + 403 non-admin; actual: M1 unauth behavior + route guard if (!auth || auth.role !== 'admin') throw 403.

  | Route | Method | Auth mode (actual) | Role (actual) | Enforcement (actual) | Unauthorized behavior (expected vs actual) |
  |---|---|---|---|---|---|
  | /api/mobile/auth/login | POST | public | none | A1 (username+password hash check, rate limit) | invalid creds -> 401
  {"error":"unauthorized"}; rate-limit -> 429 |
  | /api/mobile/ping | GET | mixed (bearer or cookie JWT) | none | M1 + handler server/api/mobile/ping.get.ts | U-mobile |
  | /api/auth/token | POST | cookie/authelia header-based (middleware bypassed) | none | M1 bypass /api/auth/*; W1 requires remote-user header |
  missing header -> H3 401 |
  | /api/auth/me | GET | public (middleware bypassed; optional cookie parsing) | none | M1 bypass + server/api/auth/me.get.ts | U-public (200
  {authenticated:false} if no/invalid cookie) |
  | /api/auth/logout | POST | public (middleware bypassed) | none | M1 bypass + server/api/auth/logout.post.ts | U-public |
  | /api/cache-status | GET | mixed | none | M1 + server/api/cache-status.get.ts | U-web |
  | /api/delprefetch | GET | mixed | none | M1 + server/api/delprefetch.get.ts | U-web |
  | /api/devices | GET | mixed | none | M1 + server/api/devices.get.ts | U-web |
  | /api/document/{key} | GET | mixed | none | M1 + server/api/document/[key].get.ts | U-web |
  | /api/document/{key} | POST | mixed | none | M1 + server/api/document/[key].post.ts | U-web |
  | /api/download.kml | POST | mixed | none | M1 + server/api/download.kml.post.ts | U-web |
  | /api/events | POST | mixed | none | M1 + server/api/events.post.ts | U-web |
  | /api/geofences | GET | mixed | none | M1 + server/api/geofences.get.ts | U-web |
  | /api/manual-pois | GET | mixed | none | M1 + server/api/manual-pois.get.ts | U-web |
  | /api/manual-pois | POST | mixed | none | M1 + server/api/manual-pois.post.ts | U-web |
  | /api/manual-pois/{id} | DELETE | mixed | none | M1 + server/api/manual-pois/[id].delete.ts | U-web |
  | /api/manual-route | POST | mixed | admin | M1 + admin guard in server/api/manual-route.post.ts | U-admin |
  | /api/manual-travel-workspace/open | POST | mixed | admin | M1 + admin guard in server/api/manual-travel-workspace/open.post.ts | U-admin |
  | /api/manual-travel-workspace/delete | POST | mixed | admin | M1 + admin guard in server/api/manual-travel-workspace/delete.post.ts | U-admin
  |
  | /api/manual-travel-workspace/keep | POST | mixed | admin | M1 + admin guard in server/api/manual-travel-workspace/keep.post.ts | U-admin |
  | /api/manual-travel-workspace/reset | POST | mixed | admin | M1 + admin guard in server/api/manual-travel-workspace/reset.post.ts | U-admin |
  | /api/manual-travel-workspace/finalize | POST | mixed | admin | M1 + admin guard in server/api/manual-travel-workspace/finalize.post.ts | U-
  admin |
  | /api/manual-travels | GET | mixed | admin | M1 + admin guard in server/api/manual-travels.get.ts | U-admin |
  | /api/manual-travels | POST | mixed | admin | M1 + admin guard in server/api/manual-travels.post.ts | U-admin |
  | /api/manual-travels/{id} | PATCH | mixed | admin | M1 + admin guard in server/api/manual-travels/[id].patch.ts | U-admin |
  | /api/manual-travels/{id} | DELETE | mixed | admin | M1 + admin guard in server/api/manual-travels/[id].delete.ts | U-admin |
  | /api/manual-travels/{id}/positions | GET | mixed | admin | M1 + admin guard in server/api/manual-travels/[id]/positions.get.ts | U-admin |
  | /api/manual-travels/{id}/positions | POST | mixed | admin | M1 + admin guard in server/api/manual-travels/[id]/positions.post.ts | U-admin |
  | /api/plotmaps | POST | mixed | none | M1 + server/api/plotmaps.post.ts | U-web |
  | /api/prefetchroute | GET | mixed | none | M1 + server/api/prefetchroute.get.ts | U-web |
  | /api/route | POST | mixed | none | M1 + server/api/route.post.ts | U-web |
  | /api/settings | GET | mixed | admin | M1 + admin guard in server/api/settings.get.ts | U-admin |
  | /api/settings | POST | mixed | admin | M1 + admin guard in server/api/settings.post.ts | U-admin |
  | /api/side-trips | POST | mixed | none | M1 + server/api/side-trips.post.ts | U-web |
  | /api/side-trips/config | GET | mixed | none | M1 + server/api/side-trips/config.get.ts | U-web |
  | /api/standstill-adjustments | GET | mixed | none | M1 + server/api/standstill-adjustments.get.ts | U-web |
  | /api/standstill-adjustments | POST | mixed | none | M1 + server/api/standstill-adjustments.post.ts | U-web |
  | /api/standstill-adjustments/{key} | DELETE | mixed | none | M1 + server/api/standstill-adjustments/[key].delete.ts | U-web |
  | /api/travel-patches | GET | mixed | none | M1 + server/api/travel-patches.get.ts | U-web |
  | /api/travel-patches | POST | mixed | none | M1 + server/api/travel-patches.post.ts | U-web |
  | /api/travel-patches/{addressKey} | DELETE | mixed | none | M1 + server/api/travel-patches/[addressKey].delete.ts | U-web |
  | /api/travels | POST | mixed | none | M1 + server/api/travels.post.ts | U-web |
  | /api/wordpress/posts/{tag} | GET | mixed | none | M1 + server/api/wordpress/posts/[tag].get.ts | U-web |
  | /api/wordpress/test | GET | mixed | none | M1 + server/api/wordpress/test.get.ts | U-web |

  ———

  Implementation vs OpenAPI: top 5 highest-risk discrepancies

  1. /api/mobile/* bearer-only contract is not actually enforced.

  - OpenAPI description says mobile routes require bearer.
  - Code in M1 accepts valid cookie JWT on /api/mobile/* too.
  - Risk: mobile namespace can be accessed via web cookie context unintentionally.

  2. Global OpenAPI security on /api/auth/logout is wrong.

  - OpenAPI inherits global bearerAuth|cookieAuth.
  - Code explicitly bypasses middleware for /api/auth/*; logout is callable without auth.
  - Risk: client expectations and generated SDK behavior mismatch.

  3. 401 response shape mismatch on most /api/* routes.

  - OpenAPI defines ErrorUnauthorized as { error: "unauthorized" }.
  - Code for missing/invalid cookie on non-mobile throws H3 createError (typically {statusCode, message...}), while invalid bearer returns
    {error}.
  - Risk: clients can’t reliably parse unauthorized responses.

  4. Missing 401 responses on many protected operations.

  - Most paths in OpenAPI do not declare 401, but M1 can return/throw 401 for all protected routes.
  - Risk: incomplete contract for consumers and autogenerated clients.

  5. Missing 403 documentation on several admin-guarded routes.

  - Admin enforced in code on /api/manual-route and all /api/manual-travel-workspace/*, plus /api/manual-travels/{id} DELETE.
  - OpenAPI lacks 403 responses for several of these operations.
  - Risk: non-admin callers see undocumented failures.

  ———

  Other missing/ambiguous OpenAPI auth rules

  - “cookie/authelia redirect” behavior is described, but app code itself never issues redirects; it throws/returns 401. Redirects are infra-
    dependent and not modeled per operation.
  - OpenAPI top-level security is broad and creates ambiguity for routes that are effectively public (/api/auth/me, /api/auth/logout, /api/auth/
    token with header-based auth).
