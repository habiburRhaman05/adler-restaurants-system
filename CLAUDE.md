# Adler — Workforce/HR Scheduling System (Monorepo)

Full-stack workforce management system for "Adler": employee scheduling, availability, shift swaps, attendance (clock in/out), leave requests, and reports. Three apps in one repo:

| Folder | App | Stack | Status |
|---|---|---|---|
| `backend/` | REST API | Express 5 + TypeScript + Prisma 6 + PostgreSQL (Neon), Vercel serverless | Very mature — ~80 endpoints, 15+ modules, security-hardened |
| `dashboard-frontend/` | Admin dashboard (web) | React 19 + Vite 8 + TanStack Query 5 + Zustand + Tailwind 4 + shadcn/Radix | Mostly wired to real backend; Schedule/Plans pages were migrating off mocks |
| `mobile-apps/` | Employee app | Expo SDK 55 + expo-router + React Native 0.83 + NativeWind + TanStack Query + Zustand | Real screens exist; API layer historically mismatched real backend paths (see plan doc) |

## MUST-READ documents (already written — do NOT re-scan the codebase to rediscover this)

1. **[ADLER_FULL_SYSTEM_IMPLEMENTATION_PLAN.md](ADLER_FULL_SYSTEM_IMPLEMENTATION_PLAN.md)** — the master spec. File-verified audit of all three apps, every architectural conflict, phased roadmap, guardrails. Owner decisions recorded at top: **use `/schedule` UI (not `/plans` pages); use `/demand` page; remove workload fully.**
2. **[backend/implimated.md](backend/implimated.md)** (611 lines) — itemized build log of everything already implemented in the backend.
3. **[backend/API_Doc.md](backend/API_Doc.md)** (1108 lines) — endpoint documentation. **Never invent an endpoint — check here first; duplicating an existing endpoint under a new path is a real risk.**
4. **[dashboard-frontend/CLAUDE.md](dashboard-frontend/CLAUDE.md)** — detailed frontend architecture (feature folders, axios envelope, zod-validated services, mock server).
5. **[mobile-apps/AGENTS.md](mobile-apps/AGENTS.md)** — Expo has changed; consult https://docs.expo.dev/versions/v55.0.0/ before writing Expo code.

## Backend (`backend/`)

- **Run**: `npm run dev` (tsx watch, port 5000). Build for Vercel: `npm run build:vercel`. Migrate: `npm run migrate` (prisma db push). Seed: `npm run seed`.
- **Structure**: `src/modules/admin/*` and `src/modules/user/*` (user = employee/mobile). Each module = controller/service/route/validation. Routes aggregated in `src/routes/index.route.ts`, mounted under `/api/v1`.
- **Admin modules**: attendance, auth, availability, categories, demands, employees, leaves, overview, reports, schedule-swaps, scheduling, settings, shifts, swaps, workload.
- **User modules**: attendance, auth, availability, leaves, me, notifications, schedule-swaps, shifts, swaps.
- **Prisma**: multi-file schema in `prisma/schemas/*.prisma` (admin, user, attendance, availability, category, demand, staffingDemand, scheduling, shiftOffer, shiftOfferSwap, shiftSwap, leave, notification, ruleEngine, audit, enums).
- **Auth**: admin = cookie-based JWT; user/mobile = Bearer-token supported; forgot/reset-password already implemented for users.
- **Scheduling engine** (`src/modules/admin/scheduling/scheduling.service.ts`, 800+ lines): real greedy constraint-based auto-scheduler. Generates `Shift` rows from `StaffingDemand` + `AvailabilityMonth`, enforces L-GAV rules (daily/weekly hour caps, rest, overlap), supports publish/unpublish. This is what the dashboard Schedule page calls.
- **Known dualities (from the plan doc — don't add a third):**
  - Two demand models: `DemandWeek`/`DayDemand` (day-level, `/demands`) vs `StaffingDemand` on `WeeklyPlan` (slot-level, consumed by the scheduler). Owner chose the `/demand` page; workload to be removed.
  - Two swap systems: `swaps` (operates on `ShiftOffer`) vs `schedule-swaps` (operates on real scheduled `Shift`s).
- **Infra**: Cloudinary uploads, nodemailer + Resend email, BullMQ/Redis (Upstash), Stripe, Groq SDK, Puppeteer/PDFKit for PDFs, pino logging, rate limiting/helmet/HPP.

## Dashboard frontend (`dashboard-frontend/`)

See its own [CLAUDE.md](dashboard-frontend/CLAUDE.md) for full detail. Key points:
- `npm run dev` (Vite) + optional `npm run dev:server` (zero-dep mock API on :3001 backed by `db.json` — dev-only legacy; real work targets the real backend via `VITE_API_BASE_URL`).
- Feature-based layout: `src/features/<domain>/{api,hooks}` — zod-validated services + react-query hooks. Pages in `src/pages/*.page.tsx`, router in `src/lib/router.tsx`.
- Axios instance unwraps `{ success, message, data, statusCode }` envelope, cookie auth (`withCredentials`), auto-logout on 401.
- Lint is `oxlint`, not eslint.

## Mobile app (`mobile-apps/`)

- **Run**: `npm start` (Expo), `npm run android`, `npm run typecheck`. Mock server: `npm run mock`.
- expo-router file routes in `src/app/` (login, tabs, attendance, leaves, profile, settings). Features in `src/features/{attendance,auth,availability,leaves,schedule,swaps,shared}`.
- Auth tokens in `expo-secure-store`; styling via NativeWind (Tailwind 3 syntax).
- API base URL comes from `.env` / `app.json` extra — historically the endpoint paths didn't match the real backend (they were written for a mock json-server); the implementation plan §mobile maps every wrong path to the correct real one.
- `apk.md` / `eas.json` — EAS build config for APK distribution.

## Conventions & guardrails

- The plan doc's Section 13 guardrails are hard constraints. Extend/fix existing modules — **do not rebuild what already works**.
- Demo dashboard login (mock server): `admin@adler.ch` / `Admin@123`.
- Bengali ("Bangla") is used in commit messages/docs alongside English; the project owner is Habib.
- Git: main branch is `main`; history is shallow (project imported as "first commit").
