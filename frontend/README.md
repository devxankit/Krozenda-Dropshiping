# Krozenda — Web Frontend

Structure and configuration scaffold only. No features, forms, or business
logic are implemented yet — every page in `modules/*/pages/` is a template
demonstrating the layer pattern, not a real screen.

> **Interpretation note:** this scaffold was built without access to project
> context §14 (Frontend Architecture) — the source doc stops at §13. It
> follows the detailed task brief that was given directly instead. See
> "Decisions & interpretations" at the bottom of this file for everything
> that had to be inferred rather than specified.

## Stack

Vite + React 18, React Router v6, TanStack Query, Zustand, React Hook Form,
Zod, Axios, Tailwind CSS, react-icons. JavaScript end to end — no
TypeScript. Single app, structured so a module can be lifted into its own
package later (see "Adding a new module" below).

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_API_BASE_URL and VITE_APP_ENV at minimum
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`,
`npm run format`.

The app throws a clear error on boot (`src/config/env.js`) if a required
`VITE_*` key is missing — check `.env.example` for the full documented list
and which keys are currently required vs. optional.

## Folder conventions

```
src/
  config/       env.js, constants.js, routes.js — no logic, just data/validation
  lib/          axios instance, react-query client, token storage, auth store
  routes/       top-level router: lazy module loading, ProtectedRoute, RoleGuard
  components/
    ui/         presentational only — Button, Input, Table, etc. Tailwind only.
    layout/     Sidebar, Topbar, PageShell, Breadcrumb — app chrome.
  modules/
    auth/
    user/
    seller/
    dropshipping-partner/
    admin/
    vendor-shared/      # shared by seller/ and dropshipping-partner/
```

Each module (including `vendor-shared`) has the same internal shape:

```
modules/<name>/
  pages/          route-level components
  controllers/    hooks — the only thing pages/ may import from
  services/       axios calls — the only thing controllers/ may import from
  components/     module-local presentational components
  schemas/        zod runtime contracts for API responses
  constants.js    module-local constants (permission keys, etc.)
  routes.jsx      this module's nested <Routes> tree
```

### seller / dropshipping-partner / vendor-shared

Seller and Dropshipping Partner share roughly 70% of their surface (product,
order, and settlement views). That shared surface lives in
`modules/vendor-shared/`, not in either module individually.
`modules/seller/routes.jsx` and `modules/dropshipping-partner/routes.jsx`
both import `vendorSharedRoutes` from `modules/vendor-shared/routes.jsx` and
mount it under their own path prefix — see either file for the pattern. When
a seller-only or partner-only screen is needed, it goes in that module's own
`pages/`, `controllers/`, `services/`, next to a comment pointing back here;
it does not get copy-pasted into the other module.

## Layer rules

Data flows in one direction: **pages → controllers → services → axios**.

- **`pages/`** — route-level React components. Compose `controllers/` and
  `components/`. Never import `axios`, the shared `lib/axios` instance, or
  anything from a `services/` folder. This is enforced, not just documented
  — see `eslint.config.js`, scoped to `src/modules/*/pages/**`. Try it:
  ```js
  // inside any modules/*/pages/*.jsx
  import axios from 'axios' // ESLint error
  ```
- **`controllers/`** — hooks (`useXController`). Own TanStack Query
  (`useQuery`/`useMutation`), call `services/` functions, return plain data
  and handlers. No JSX.
- **`services/`** — one function per API call, built on the shared `api`
  instance from `src/lib/axios.js`. No React, no react-query. Parses the
  response through a `schemas/` zod schema before returning.
- **`schemas/`** — zod schemas as the runtime contract for what an endpoint
  returns. A malformed API response fails loudly in `services/`, not
  silently three layers up in a page.
- **`components/`** (module-local) and **`src/components/ui`** (global) —
  presentational only, Tailwind only, props in / JSX out. No data fetching.

Every module's `pages/DashboardPage.jsx` + `controllers/useDashboardController.js`
+ `services/dashboardService.js` (+ `schemas/dashboardSchema.js`) is the
reference example — copy that trio's shape when adding a real page.

## RBAC

Permissions are data, not `if (role === 'admin')` checks (project context
§2 — 13 roles, configurable permissions). `src/routes/RoleGuard.jsx` reads a
plain `permissions: string[]` off `src/lib/authStore.js` (a Zustand store)
and checks it against the permission keys a route declares — it never
switches on a role id. Each module owns its own permission key constants
(e.g. `modules/seller/constants.js` → `SELLER_PERMISSIONS.ACCESS`); the
top-level router (`src/routes/index.jsx`) imports those constants rather
than hardcoding strings.

## Adding a new module

1. `src/modules/<name>/{pages,controllers,services,components,schemas}/`
2. `src/modules/<name>/constants.js` — at least a `<NAME>_PERMISSIONS`
   object.
3. `src/modules/<name>/routes.jsx` — default-export a component rendering
   its own `<Routes>` tree (see `modules/admin/routes.jsx` for the minimal
   shape).
4. Add a path group to `src/config/routes.js`.
5. Lazy-import the module's `routes.jsx` in `src/routes/index.jsx` and mount
   it under `<ProtectedRoute>` / `<RoleGuard permissions={[...]}>` as
   needed.
6. Build the `pages/DashboardPage.jsx` → `controllers/` →
   `services/` → `schemas/` trio first, even for a throwaway page — it
   forces the layer boundary from day one.

## Decisions & interpretations

Project context §14 (Frontend Architecture) was not available — the
context doc (`tools/Krozenda-project-context.md`) ends at §13. Everything
below was inferred from the task brief and the rest of the context doc
(§1, §2, §6.2, §10, §12) rather than read from a spec:

- **Single app vs. monorepo** — single Vite app, per the stated default.
  Nothing here assumes a monorepo; each module's folder is self-contained
  enough to be lifted into its own package later.
- **JS vs. TS** — JavaScript, per the stated default. Zod schemas in
  `schemas/` are the runtime type contract in place of TypeScript types.
- **Folder tree (§14.2 — not available)** — designed from the rest of the
  brief: `config/`, `lib/`, `routes/`, `components/{ui,layout}`,
  `modules/{auth,user,seller,dropshipping-partner,admin,vendor-shared}`,
  each module having `pages/controllers/services/components/schemas/`.
- **Layer rules (§14.3 — not available)** — the pages → controllers →
  services → axios direction and "one axios instance, only in services/"
  rule were inferred from item 9 of the brief ("flags axios imports inside
  pages/") and standard practice; documented above and enforced by
  `eslint.config.js`.
- **vendor-shared / seller / dropshipping-partner reuse (§14.4 item 2)** —
  the brief said "create modules/vendor-shared/ and have both import from
  it," but item 8 also asked for one dashboard/controller/service reference
  example per module including seller and dropshipping-partner. Those two
  asks conflict (a second, module-local dashboard example would be exactly
  the duplication item 2 prohibits). Resolved by putting the one real
  dashboard example in `vendor-shared/`, and having seller's and
  dropshipping-partner's `routes.jsx` mount it directly — their own
  `pages/`, `controllers/`, `services/`, `schemas/` folders are present
  (per item 8's folder requirement) but intentionally empty aside from an
  explanatory placeholder, for when a seller-only or partner-only screen is
  actually needed.
- **Auth module's "dashboard" reference example** — auth doesn't have a
  natural dashboard; item 8 asked for one anyway, for every module
  including auth. Built as `DashboardPage.jsx` showing session status,
  explicitly commented as a layer-pattern template rather than a real
  screen — auth's real first pages are Login/Register.
- **`.env` values** — every `VITE_*` key is present but empty, per the
  brief. Which keys exist beyond the axios/Razorpay/Firebase basics
  structurally required by the requested lib layer and the confirmed tech
  stack (§3.1, §4) was inferred, not specified — extend `.env.example` and
  `src/config/env.js`'s `REQUIRED_KEYS` as real integrations get built.
- **Brand colors in `tailwind.config.js`** — placeholder values. Real brand
  colors/logo are a client-owned deliverable (§10); swap the `brand` scale
  once they arrive.
- **React 18 pin** — `npm create vite` currently scaffolds React 19 by
  default; downgraded to `^18.3.1` per the brief's explicit requirement.
- **Tailwind v3, not v4** — the installed toolchain defaults to Tailwind
  v4, which replaces `tailwind.config.js` theme extension with a CSS-based
  `@theme` block. Pinned to `^3.4.17` so the classic `tailwind.config.js` +
  `theme.extend` file the brief asked for (item 6) is the one that exists.
- **ESLint 9 flat config, pinned to the 9.x line** — `eslint-plugin-import`
  (needed for the layer-boundary rule) doesn't yet support ESLint 10, which
  is what a bare `eslint@latest` install resolves to.
