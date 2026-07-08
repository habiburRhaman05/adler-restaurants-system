# Adler Frontend — Project Context

Workforce/HR management dashboard (employees, categories, plans, approvals, workload, reports) for "Adler". React 19 + Vite + TypeScript SPA with a zero-dependency mock API for local dev.

## Stack

- **Build/dev**: Vite 8, TypeScript 6 (project references: `tsconfig.app.json` / `tsconfig.node.json`)
- **UI**: React 19, Tailwind CSS 4 (`@tailwindcss/vite`), shadcn/ui-style components in `src/components/ui/*` built on Radix primitives, `lucide-react` icons
- **Routing**: `react-router-dom` v7, single router tree in [src/lib/router.tsx](src/lib/router.tsx)
- **Data fetching**: `@tanstack/react-query` v5 (+ devtools), Axios client with a response envelope
- **State**: `zustand` (only real global store is auth — [src/stores/auth.store.ts](src/stores/auth.store.ts))
- **Validation**: `zod` schemas colocated with each feature's API service, used to runtime-parse API responses
- **Forms**: `react-hook-form` + `@hookform/resolvers`
- **Lint**: `oxlint` (`npm run lint`), config in [.oxlintrc.json](.oxlintrc.json) — only `react/rules-of-hooks` and `react/only-export-components` are enforced

## Commands

```
npm run dev         # vite dev server (frontend)
npm run dev:server   # node server.mjs — mock API on :3001 (or $MOCK_API_PORT)
npm run build         # tsc -b && vite build
npm run lint          # oxlint
npm run preview
```

Both `dev` and `dev:server` must run concurrently (two terminals) for the app to have data.

## Architecture: feature-based, not layer-based

Code lives under `src/features/<domain>/` with a consistent shape per domain (auth, employees, categories, plans, approvals, workload, settings, overview):

```
features/<domain>/
  api/<domain>.service.ts   # zod schemas + typed CRUD functions calling apiClient
  hooks/use-<domain>.ts     # react-query hooks (useQuery/useMutation) wrapping the service
  schemas/                  # (auth only) schema/type separated from service
  components/               # (categories only) feature-owned UI, not shared
```

`src/components/` holds cross-page/presentational components grouped by page (employee, overview, plans, workload) plus `src/components/ui/` (generic design-system primitives — treat as vendored shadcn code, edit sparingly) and `src/components/layouts/` (AppLayout, Header, Sidebar, UserDropdown).

`src/pages/*.page.tsx` are route-level containers wired up in [src/lib/router.tsx](src/lib/router.tsx). Note: the `plans` routes are in flux — `PlansPage`/`PlanCreatePage`/`PlanDetailsPage`/`ManagePlansPage` under `src/pages/` are commented out in the router in favor of newer `src/components/plans/plans*.tsx` (PlanBuilder/PlanSummary/PlansPage index) mounted at `/dashboard/plans`, `/dashboard/plans/:id`, `/dashboard/plans/:id/summary`. Check the router before assuming which plans implementation is live.

## API layer

- [src/lib/axios.ts](src/lib/axios.ts): single axios instance, `withCredentials: true` (httpOnly cookie auth, no manual token attachment). Response interceptor unwraps the `{ success, message, data, statusCode }` envelope, throws `ApiError` on `success:false` or HTTP errors, and auto-logs-out + redirects to `/login` on 401 (dynamic-imports the auth store to dodge a circular dependency).
- [src/lib/api-client.ts](src/lib/api-client.ts): thin wrapper (`apiClient.get/post/put/patch/delete`) that unwraps `data` and optionally validates it against a Zod schema passed as `config.schema`.
- Every feature service builds its own Zod schema + calls `apiClient.*` with `{ schema }` — response shapes are trusted only after runtime validation, not just TS types.
- `VITE_API_BASE_URL` (see [.env.example](.env.example)) points at the API base. **Note**: `.env.example` defaults to `http://localhost:3000/api` but `server.mjs` listens on port **3001** by default — reconcile before assuming dev works out of the box.

## Mock API server ([server.mjs](server.mjs))

Zero-dependency Node `http` server, dev-only, backed by [db.json](db.json) (collections: `users`, `employees`, `categories`, `availability`, `plans`, `approvals`, `reports`, `workload-sheets`, `settings`). Persists writes back to `db.json` on disk — treat it as a real (if disposable) database, not a static fixture.

- Implements `/auth/login`, `/auth/register`, `/auth/me`, `/auth/logout` with a fake base64 JWT (`fakeToken`) — not cryptographically signed, dev-only.
- Generic REST for any other top-level key in `db.json`: `GET/POST /:collection`, `GET/PUT/PATCH/DELETE /:collection/:id`.
- Query support on list GET: `field=value`, `field_like=substr`, `q=` (full-text across string fields), `_sort`/`_order`, `_page`/`_limit`. List responses are `{ items, total, page, limit, totalPages }` matching `ListResponse<T>` in [src/types/index.ts](src/types/index.ts).
- `settings` is the one singular (non-array) resource.
- Demo login: `admin@adler.ch` / `Admin@123`.

## Auth

- [src/stores/auth.store.ts](src/stores/auth.store.ts): zustand store persisted to `localStorage` (`auth-storage`), but only `admin`/`isAuthenticated` are persisted — tokens are cookie-based, not in the store.
- [src/lib/protected-route.tsx](src/lib/protected-route.tsx): gates `/dashboard/*`, waits for `isHydrated` before rendering, enforces a 30-minute client-side inactivity timeout (`SESSION_TIMEOUT_MS`), supports an optional `requiredRole` prop (`admin` | `employee` from `UserRole`).

## Conventions observed

- Path alias `@/*` → `src/*` (configured in both `vite.config.ts` and tsconfig).
- Service files export a plain object of functions (`employeeService.getAll/getById/create/...`) rather than a class; hooks in `hooks/use-<domain>.ts` wrap these with react-query.
- Filenames mix `kebab-case.ts` and `<domain>.service.ts`/`.schema.ts` suffixes — follow whatever the neighboring file in that feature folder does.
- Some feature services include client-side utility functions alongside API calls (e.g. `employeeService.getStats`, `.filterEmployees`) — server does no aggregation, so stats/filtering for these are computed in the frontend from a full fetched list.

## Known rough edges (as of this writing)

- `router.tsx` has duplicate `profile` route entries and commented-out legacy plans routes — don't copy that pattern, and confirm with git history/user before deleting the commented block since it may be an in-progress migration.
- `.env.example` port (3000) doesn't match `server.mjs` default port (3001).
- `README.md` is empty.