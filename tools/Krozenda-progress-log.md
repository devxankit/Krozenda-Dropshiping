# KROZENDA — Progress Log

> Dated, append-only record of work completed. Newest entry on top. Each
> entry should say what changed, where, and which `Krozenda-phases.md`
> checklist item(s) it moves — update that file's checkboxes in the same
> pass as adding an entry here, don't let the two drift apart.

---

## 2026-08-01 — Frontend + backend scaffolding, phase tracking set up

**Frontend scaffold** (`frontend/`)

- Vite + React 18 + Tailwind CSS + react-router-dom v6 + @tanstack/react-query
  + zustand + react-hook-form + zod + axios.
- Full folder tree: `config/` (env validation, constants, route paths),
  `lib/` (axios instance w/ 401 refresh interceptor, query client, token
  storage, auth store), `routes/` (RBAC-aware — `ProtectedRoute`,
  `RoleGuard`), `components/ui` + `components/layout`, and all 6 modules
  (`auth`, `user`, `seller`, `dropshipping-partner`, `admin`,
  `vendor-shared`) with a reference dashboard page/controller/service trio
  each.
- `seller`/`dropshipping-partner` mount `vendor-shared`'s dashboard rather
  than duplicating it (their ~70% surface overlap).
- ESLint layer-boundary rule (axios import banned inside any module's
  `pages/`), Prettier.
- Verified: production build clean, dev server boots without error, ESLint
  clean, layer-boundary rule confirmed firing on a scratch test file
  (removed after verification).
- Full list of interpretation calls (no §14 Frontend Architecture spec was
  ever available) is in `frontend/README.md` → "Decisions & interpretations".
- Moves: Phase 0 "Design system + shared component library" (web half) to
  `[~]`; partial credit toward "Repo structure".

**Backend scaffold** (`backend/`)

- Node.js + Express 5 + MongoDB/Mongoose, ESM throughout. Mirrors the
  frontend's 6-module list and layer discipline
  (`routes.js → controllers/ → services/ → models/`).
- Real, working endpoints (not mocked): `GET /health`,
  `GET /api/v1/auth/session`, `POST /api/v1/auth/refresh-token` (re-resolves
  permissions from `Role` data on every refresh),
  `GET /api/v1/users/me/dashboard-summary`,
  `GET /api/v1/vendor/dashboard-summary` (seller or partner, one shared
  router), `GET /api/v1/admin/dashboard-summary`.
- RBAC engine: `Role` model (permissions-as-data), `requirePermission`
  middleware, `npm run seed:roles` script seeding all 13 roles with a
  starter permission map.
- Integration provider interfaces under `src/integrations/` for payment
  (Razorpay), logistics (Shiprocket), notification (FCM/SMS India
  Hub/SMTP), and supplier adapters — contracts + throwing stubs only, no
  SDKs installed, per the project context's "integration providers sit
  behind interfaces" obligation (§9/§12).
- ESLint layer-boundary rule (mongoose/model imports banned inside any
  module's `controllers/`), Prettier.
- Verified without a live MongoDB (none available in this dev environment
  — no `mongod`/Docker): every file syntax-checked clean; `env.js` throws
  correctly on missing required vars and passes with valid ones; the full
  module graph (all 6 modules, all middlewares, all models, all routes)
  imports and wires with zero errors; `connectDb()` correctly attempts and
  reports `ECONNREFUSED` against an unreachable Mongo, which is the
  expected failure mode, not a defect; JWT sign → verify → `requirePermission`
  allow/deny was exercised standalone with a scratch script and behaved
  correctly in both the allowed and denied case.
- Full list of interpretation calls is in `backend/README.md` → "Decisions
  & interpretations" — most notably: models are shared (`src/models/`) not
  module-owned, since the project context's data model (§7) is inherently
  cross-cutting; and `vendor-shared` is mounted flat at `/api/v1/vendor`
  rather than nested under `/seller` and `/partner` (the frontend nests,
  the backend doesn't need to, since the frontend calls one flat path from
  both surfaces).
- Moves: Phase 0 "RBAC engine" to `[~]` (data model + middleware + seed
  script done, not yet run against a live DB); "Auth service" to `[~]`
  (JWT/refresh only — no registration/login/OTP); "MongoDB schema for core
  collections" to `[~]` (5 of ~19 collections modelled, only what the
  reference endpoints needed).

**Tracking**

- Created `tools/Krozenda-phases.md` (checklist derived from project
  context §9) and `tools/Krozenda-progress-log.md` (this file) to keep an
  ongoing record of what's actually been built against the phase plan,
  since the original context doc has no §14 (Frontend Architecture) and
  nothing tracking delivery status.

---

<!--
Template for new entries — copy this block, fill in, newest on top:

## YYYY-MM-DD — <short summary>

**<Area>** (`<path>/`)

- What changed, specifically enough that someone skimming later knows what
  to go read (file paths, endpoint names, commands run).
- What was verified, and how (tests run, build/lint output, manual check).
- What's still open / explicitly not done in this pass.
- Moves: <Phase X item> to `[~]`/`[x]` — update the checkbox in
  Krozenda-phases.md too.
-->
