# Krozenda — Backend API

Structure and configuration scaffold, mirroring `frontend/`'s module layout
and layer discipline. A handful of endpoints are real, working reference
implementations (auth session/refresh, three dashboard-summary endpoints) —
everything else (OTP, payments, logistics, commission engine, order state
machine) is deliberately out of scope for this pass; see "What's real vs.
scaffolded" below.

## Stack

Node.js + Express 5 + MongoDB (Mongoose), JavaScript end to end (ESM,
`"type": "module"`) — no TypeScript, matching the frontend. JWT access +
refresh tokens (own implementation, not a third-party auth provider — see
project context §4.3, §12). Zod for request validation. No ORM beyond
Mongoose; no additional framework.

## Setup

```bash
npm install
cp .env.example .env   # fill in at least MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm run dev             # nodemon, restarts on change
npm run seed:roles      # upserts the 13 roles (see "RBAC" below)
```

Other scripts: `npm start`, `npm run lint`, `npm run format`.

The app throws a clear error on boot (`src/config/env.js`) if a required
env var is missing — check `.env.example` for the full documented list and
which keys are required vs. optional. `GET /health` is unauthenticated and
returns `{ uptimeSeconds }` once the server is up.

> This scaffold was verified without a local MongoDB instance available
> (no `mongod`/Docker in the dev environment it was built in). Confirmed:
> env validation throws correctly on missing/present required keys, the
> entire module graph (all 6 modules, all middlewares, all models, all
> routes) imports and wires cleanly, and `connectDb()` correctly attempts
> and reports a Mongo connection failure. JWT sign/verify and the
> `requirePermission` RBAC gate were exercised standalone with a scratch
> script and confirmed correct (issued token → verified → permission
> check allowed/denied as expected). Run `npm run dev` against a real
> `MONGODB_URI` to confirm the DB-backed endpoints end to end.

## Folder conventions

```
src/
  config/         env.js, constants.js, db.js — no logic, just data/validation/connection
  lib/            logger, ApiError, ApiResponse, asyncHandler, jwt.js
  middlewares/    authenticate, requirePermission, validate, errorHandler, notFound, rateLimiter
  models/         Mongoose schemas — shared, cross-cutting (see "Models" below)
  integrations/   payment/logistics/notification/supplier-adapter interfaces + stubs
  routes/         central router — mounts each module under /api/v1/<prefix>
  modules/
    auth/
    user/
    seller/
    dropshipping-partner/
    admin/
    vendor-shared/    # shared by seller/ and dropshipping-partner/
  scripts/        one-off scripts (seedRoles.js)
  app.js          Express app assembly (middleware order, route mounting)
  server.js       entrypoint — connect DB, listen, graceful shutdown
```

Each module has the same internal shape:

```
modules/<name>/
  controllers/    req/res handlers — the only thing routes.js may import from
  services/       business logic + model queries — the only thing controllers/ may import from
  validators/     zod schemas validating incoming request body/params/query
  constants.js    module-local constants (permission keys, etc.)
  routes.js       this module's Express Router
```

### Models are shared, not module-owned

Unlike the frontend (where each module owns its own `schemas/`), the data
model here is cross-cutting by nature — project context §7 defines
collections like `users`, `sellers`, `orders`, `sub_orders` that multiple
modules read and write. Mongoose schemas live in `src/models/`, and any
module's `services/` layer imports the ones it needs from there (via
`src/models/index.js`). Don't redefine a schema inside a module.

### seller / dropshipping-partner / vendor-shared

Same reuse story as the frontend: Seller and Dropshipping Partner share
~70% of their surface. On the frontend that meant nesting shared routes
under two different path prefixes. On the backend it's simpler — the
frontend calls one flat path, `GET /vendor/dashboard-summary`, from both
surfaces, so `modules/vendor-shared/routes.js` is mounted once at
`/api/v1/vendor` (see `src/routes/index.js`), gated by
`requirePermission([SELLER_PERMISSIONS.ACCESS, DROPSHIPPING_PARTNER_PERMISSIONS.ACCESS], { mode: 'any' })`.
`modules/seller/` and `modules/dropshipping-partner/` exist with the full
folder shape for when a seller-only or partner-only endpoint is needed, but
currently mount empty routers.

## Layer rules

Data flows in one direction: **routes → controllers → services → models**.

- **`routes.js`** — wires HTTP method + path + middleware chain
  (`authenticate`, `requirePermission`, `validate`) to a controller
  function. No logic beyond that wiring.
- **`controllers/`** — reads `req`, calls exactly one `services/` function,
  shapes the HTTP response via `ApiResponse`/thrown `ApiError`. Never
  imports `mongoose` or anything from `models/` directly — enforced by
  `eslint.config.js`, scoped to `src/modules/*/controllers/**`:
  ```js
  // inside any modules/*/controllers/*.js
  import { User } from '../../../models/index.js' // ESLint error
  ```
- **`services/`** — business logic and the only place a module queries a
  Mongoose model. Throws `ApiError` for domain failures (not found,
  forbidden, etc.) rather than returning `null`/`false` for the controller
  to interpret.
- **`validators/`** — zod schemas for request bodies/params/query, applied
  via the `validate()` middleware. The inbound mirror of the frontend's
  `schemas/` (which validates outbound API responses).
- **`models/`** — Mongoose schemas. No business logic; keep them to shape +
  minimal `enum`/`required` constraints.

Every module's dashboard endpoint (`routes.js` → `controllers/` →
`services/`) is the reference example — copy that shape when adding a real
endpoint.

## RBAC

Permissions are data (project context §2 — 13 roles, configurable
permissions), resolved once at login/refresh and embedded on the JWT access
token (`src/lib/jwt.js`) — `middlewares/requirePermission.js` just checks
that array against a route's required permission keys, exactly mirroring
the frontend's `RoleGuard`. Nothing in the middleware switches on a role
id. Each module owns its own permission key constants (e.g.
`modules/seller/constants.js` → `SELLER_PERMISSIONS.ACCESS`), and those
constants — not string literals — are what routes and the seed script use.

`src/models/Role.js` is the permissions-as-data store: `{ key, label,
surface, permissions: string[] }`. `npm run seed:roles` upserts all 13
roles from `config/constants.js` with a starter permission set (see the
script for the exact mapping) — this satisfies the Phase 0 exit criteria
("RBAC engine, permissions as data, 13 roles seeded"), but the mapping is a
starting point: an admin-editable permissions screen is real feature work,
not part of this scaffold.

## What's real vs. scaffolded

Working end-to-end (once pointed at a real MongoDB):

- `GET /health`
- `GET /api/v1/auth/session` (requires a valid access token)
- `POST /api/v1/auth/refresh-token` (re-resolves permissions from `Role`
  data on every refresh, not just re-signing old claims)
- `GET /api/v1/users/me/dashboard-summary`
- `GET /api/v1/vendor/dashboard-summary` (seller or partner)
- `GET /api/v1/admin/dashboard-summary`
- `npm run seed:roles`

Explicitly NOT built (structure only, or not present at all) — these are
real Phase 0/1 feature work, not configuration:

- Login, registration, OTP (SMS India Hub), email verification — there is
  no `POST /auth/login`. Test the endpoints above by signing a token
  yourself with `src/lib/jwt.js`'s secret, or build login next.
- Razorpay, Shiprocket, FCM, SMS India Hub, SMTP — only interface
  contracts + throwing stubs exist under `src/integrations/`, per project
  context §9/§12's "integration providers sit behind interfaces"
  obligation. No SDK is installed for any of them yet.
- Order lifecycle state machine (§6.2), commission engine (§6.5),
  multi-vendor cart splitting (§6.1), settlements, returns/RTO — none of
  this logic exists. `Order`/`SubOrder` models are minimal skeletons, just
  enough for the dashboard-summary count queries.
- Supplier adapters (§6.7) — interface + empty registry only; no supplier
  is confirmed yet (§13.2 item 5 is still open).

## Adding a new module

1. `src/modules/<name>/{controllers,services,validators}/`
2. `src/modules/<name>/constants.js` — at least a `<NAME>_PERMISSIONS`
   object.
3. `src/modules/<name>/routes.js` — `Router()`, wire
   `authenticate`/`requirePermission`/`validate` per route, export default.
4. Mount it in `src/routes/index.js`: `router.use('/<prefix>', <name>Routes)`.
5. If it needs new roles/permissions, extend `BASELINE_ROLE_PERMISSIONS` in
   `src/scripts/seedRoles.js` and re-run `npm run seed:roles`.
6. Build the `routes.js` → `controllers/` → `services/` trio first for one
   endpoint, even a throwaway one — it forces the layer boundary from day
   one, same as the frontend convention.

## Decisions & interpretations

Built to mirror `frontend/`'s module list and discipline, per the request
to set up the backend "the same module wise" and "best possible way" —
project context §14 covers frontend architecture only, there's no backend
equivalent section, so these choices were made directly rather than read
from a spec:

- **Module list** — `auth, user, seller, dropshipping-partner, admin,
vendor-shared`, identical to the frontend, for the obvious reason that
  the frontend's services already call a specific set of endpoints; this
  backend implements exactly those paths (see "What's real" above).
- **Models are shared (`src/models/`), not module-owned** — project
  context §7's data model is inherently cross-cutting (an `Order` isn't
  "owned" by the user module any more than by admin). Forcing models into
  per-module folders would fight that doc; a shared `models/` layer with
  module-level `services/` importing from it was the more honest
  structure. This is the one place backend and frontend module shape
  genuinely diverge, and it's called out here so it doesn't read as an
  inconsistency.
- **vendor-shared mounted flat, not nested under seller/partner** — the
  frontend nests (two path prefixes need to resolve to the same page
  component); the backend doesn't need to, because the frontend calls one
  shared path (`/vendor/dashboard-summary`) regardless of which surface
  it's rendering. Mounting it once, gated by either permission, is simpler
  and avoids two routers serving the same handler.
- **Auth has a real session/refresh pair, not just a stub** — the
  frontend's `src/lib/axios.js` interceptor already calls
  `POST /auth/refresh-token` on 401, so leaving that route unbuilt would
  make the frontend's own reference implementation dead code. Login/OTP
  are excluded (that's real feature work depending on SMS India Hub, per
  §4.4), but token issuance/verification/refresh — the part frontend
  already depends on — is real and working.
- **Dashboard-summary endpoints query real (mostly-empty) collections**,
  not hardcoded mock JSON — this is what "best possible way" meant for a
  backend reference example: demonstrating the service → model layer with
  actual `Mongoose` queries, not stub data, even though the counts will be
  zero against an empty database.
- **Express 5, not 4** — `npm install express` currently resolves to 5.x,
  which is now the stable default; kept as-is rather than pinning down to 4. The one behavior change relevant here: the previous 404 catch-all
  needed to use a middleware with no path pattern (`app.use(notFound)`)
  rather than `app.use('*', ...)`, since Express 5's path-to-regexp
  requires named wildcards.
- **ESLint 9 flat config, pinned to the 9.x line** — same reason as the
  frontend: `eslint-plugin-import` (needed for the layer-boundary rule)
  doesn't yet support ESLint 10.
- **No queue/worker infra for SMTP/notifications** — §4.5 explicitly asks
  for a queued sender, not synchronous sends. Noted as a comment in
  `src/integrations/notification/SmtpChannel.js` for whoever implements it;
  adding a queue dependency wasn't done here without being asked.
