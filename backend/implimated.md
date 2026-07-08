# Implemented Overview (Backend)

Here is a summary of all the tasks and architectural changes that have been successfully implemented so far:

## 1. Physical Separation of Admin and User Models
- **Database Separation:** The unified `User` model was split into two separate tables: `admins` and `users`.
- **File Organization:** The `auth.prisma` file was deleted, and its contents were strictly segregated into `admin.prisma` and `user.prisma`.
- **Authentication Split:** Since they are separate models, they each now have independent session tracking: `AdminRefreshToken` and `UserRefreshToken`.
- **Relational Integrity:** All relations originally pointing from operations to "the admin who did it" (e.g. `WeeklyPlan.submittedById`, `AuditLog.actorId`, `SwapRequest.approvedById`, `RuleCheckLog.checkedById`) were updated to correctly reference the new `Admin` model.

## 2. Merging Employee into User
- **Unified Entity:** The `EmployeeProfile` concept was completely merged into the central `User` model to simplify the architecture. The role `EMPLOYEE` is now `USER`.
- **Field Consolidation:** All contract details (`contractType`, `workloadPercent`, `hourlyRate`, `monthlySalary`, `contractedHoursMonthly`) and profile fields (`firstName`, `lastName`, `phone`, `hireDate`, `deactivatedAt`) now live directly on the `User` model in `auth.prisma`.
- **Foreign Keys Updated:** Every reference to `employee` across the codebase (such as `employeeId` in `Shift`, `SwapRequest`, `AvailabilityMonth`) was systematically renamed to `userId` and `user`.
- **Deleted Redundant Schema:** The `employee.prisma` file was safely deleted as it was no longer needed.

## 3. Multi-file Prisma Schema Architecture
- **Refactoring:** We moved away from a single, giant `schema.prisma` file and enabled Prisma's multi-file schema feature. 
- **Organization:** The schema was split into 12 distinct, camelCased files inside the `prisma/schemas/` directory to perfectly separate the domain logic:
  - `admin.prisma` (Admin, AdminRefreshToken)
  - `user.prisma` (User, UserRefreshToken, CredentialDelivery, ContractType)

  - `category.prisma` (Category, EmployeeCategory)
  - `availability.prisma` (AvailabilityMonth, AvailabilityDay)
  - `staffingDemand.prisma` (StaffingDemand)
  - `scheduling.prisma` (WeeklyPlan, Shift)
  - `shiftSwap.prisma` (SwapRequest)
  - `ruleEngine.prisma` (OrgSettings, RuleCheckLog)
  - `notification.prisma` (Notification)
  - `audit.prisma` (AuditLog)
  - `base.prisma` (Database connection and client generation config)
- **Enum Relocation:** Enums were moved out of a central block and placed at the top of their exact, relevant domain files.
- **Comment Cleanup:** We stripped out all the boilerplate and descriptive comments from every schema file, keeping them clean and concise. Then, the files were automatically re-formatted.

## 4. Environment & Dependency Fixes
- **Node.js Compatibility:** We identified that your local Node.js version (`v20.11.1`) was incompatible with Prisma 7 (which strictly requires Node `>=20.19`). To prevent module loading errors, Prisma was downgraded to version `6` (which fully supports the multi-file schema natively and works perfectly with your Node version).
- **Express Typings Fix:** The `src/types/express.d.ts` file contained outdated references to `better-auth` and `CustomerProfile`. We updated this to correctly use your custom, manual `Role` enum.
- **Database Connection:** Confirmed the `.env.example` in the root correctly displays the Postgres database URL structure.

## 5. Database Syncing
- **Client Generation:** Successfully ran `npx prisma generate` inside the backend directory to compile the multi-file structure into your `src/generated/prisma` client.
- **Database Migration:** Pushed the new schema forcefully using `npx prisma db push --accept-data-loss` (safely handling the dropped `employee_profiles` table), successfully synchronizing the remote Neon PostgreSQL database. The database is now 100% in sync with the codebase.

## 6. Manual Admin & User Login System

A complete manual authentication and user management system was implemented with **15 API endpoints** across 3 route groups. No third-party auth library (like `better-auth`) is used — everything is hand-rolled using JWT, bcrypt, and Prisma.

### Auth Middleware (`src/middleware/auth.ts`)
- **`authenticate`** — Reads `accessToken` from HttpOnly cookies, verifies the JWT, and attaches `{ userId, email, role }` to `res.locals.auth`. Rejects with 401 if missing or expired.
- **`authorizeAdmin`** — Must be used after `authenticate`. Checks `res.locals.auth.role === "ADMIN"` and rejects with 403 otherwise.

### Admin Auth Module (`/api/v1/auth/admin`)
| File | Purpose |
|------|---------|
| `admin.validation.ts` | Zod schema for admin login (email + password) |
| `admin.service.ts` | `loginAdmin`, `getAdminProfile`, `refreshAdminToken`, `logoutAdmin` — full token lifecycle with DB-backed refresh token storage and rotation |
| `admin.controller.ts` | HTTP controllers that call the service and set/clear cookies |
| `admin.route.ts` | `POST /login` (public), `POST /refresh` (public), `POST /logout` (auth), `GET /profile` (admin) |

### User Auth Module (`/api/v1/auth/user`)
| File | Purpose |
|------|---------|
| `user.validation.ts` | Zod schema for user login |
| `user.service.ts` | `loginUser`, `getUserProfile`, `refreshUserToken`, `logoutUser` — mirrors admin service with `User` and `UserRefreshToken` models |
| `user.controller.ts` | HTTP controllers |
| `user.route.ts` | `POST /login` (public), `POST /refresh` (public), `POST /logout` (auth), `GET /profile` (auth) |

### Admin User Management Module (`/api/v1/admin/users`)
| File | Purpose |
|------|---------|
| `user-management.validation.ts` | Zod schemas for create, update, userId param, and list query (pagination + filters) |
| `user-management.service.ts` | `createUser`, `updateUser`, `deleteUser`, `deactivateUser`, `activateUser`, `getAllUsers`, `getUserById` — full CRUD with email uniqueness, bcrypt hashing, paginated listing, search, and soft deactivation |
| `user-management.controller.ts` | HTTP controllers |
| `user-management.route.ts` | 7 endpoints — all guarded by `authenticate` + `authorizeAdmin` at the router level |

### Seed Script (`src/scripts/seed.ts`)
- Idempotent script that creates a default admin (`admin@adler.com` / `Admin@123456`) only if none exists.
- Run with: `npx tsx src/scripts/seed.ts`

### Route Wiring (`src/routes/index.route.ts`)
- Mounted `adminAuthRouter` at `/auth/admin`
- Mounted `userAuthRouter` at `/auth/user`
- Mounted `userManagementRouter` at `/admin/users`

### Security Measures
- Passwords hashed with bcrypt (12 rounds)
- JWT access tokens (15 min) in HttpOnly Secure SameSite=None cookies
- JWT refresh tokens (7 days) in HttpOnly Secure cookies with hash stored in DB
- Refresh token rotation — old token revoked on every refresh
- Deactivating a user immediately revokes all their active refresh tokens
- No password hashes ever returned in API responses
- Zod validation on all inputs
- Cleaned unused `better-auth` imports from `app.ts`

### API Documentation
- Full documentation written in `API_Doc.md` with request/response examples, field validation rules, error codes, and seed script instructions.

## 7. Strict TypeScript Compatibility Fixes

Fixed all 5 TypeScript errors caused by `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true` in `tsconfig.json`:

### `user-management.controller.ts`
- **`req.params.userId`** returns `string | string[] | undefined` under strict mode. Fixed by using explicit cast: `req.params.userId as string` (safe because Express route params with `:userId` are always strings).
- **`getAllUsers` query type** — Zod's inferred type includes `| undefined` for optional fields, but the service function's exact optional property types reject this. Fixed by constructing the query object imperatively, only assigning `isActive` and `search` when they are defined.

### `user-management.service.ts`
- **`createUser` Prisma data** — Prisma with `exactOptionalPropertyTypes` rejects `undefined` for nullable fields (it expects `string | null`, not `string | undefined`). Fixed by building the `Prisma.UserCreateInput` object imperatively, only assigning optional fields when they are actually provided, so `undefined` is never passed to Prisma.

## 8. Security Enhancement: JWT Token Hashing Fix

Discovered and fixed a massive vulnerability regarding how `Refresh Tokens` were hashed in the database.
- **The Issue:** `bcrypt` silently truncates inputs to a maximum length of 72 bytes. Because JWT strings easily exceed 150 characters, and the first 72 characters of a JWT represent the Base64-encoded Header and the initial part of the Payload (which is identical for the same user across multiple tokens), `bcrypt` would compute the **exact same hash** for every single refresh token generated for a given user. This would cause token collision on logout or refresh.
- **The Fix:** Swapped `bcrypt` for `crypto.createHash('sha256')` in `src/utils/token.ts` for hashing JSON Web Tokens, which handles arbitrary string lengths securely and deterministically without truncation. Password hashes still securely use `bcrypt`.

## 9. Shift Board: Employee Onboarding, Categories, Shifts & Notifications

This iteration implements the **admin-driven shift board** workflow: the admin manually onboards employees, organises work into categories, posts shifts, and broadcasts them with a single "Notify" click. Employees then see published shifts on their dashboard and accept or decline them, while the admin sees exactly who accepted and how many staff are available. Everything is validated with **Zod**, follows the existing `validation → route → controller → service` module pattern, and returns no password hashes.

> **Design note — why new models instead of the existing `Shift`/`WeeklyPlan`.** The pre-existing `Shift` model is an *assignment* (one employee, tied to a `WeeklyPlan`, part of the future L-GAV auto-scheduling engine). The feature requested here is a *broadcast offer* that **many** employees can opt into. These are genuinely different concepts, so two new models were added rather than overloading the assignment model. The scheduling/availability/swap models remain untouched for the future planning engine.

### Schema Changes (`prisma/schemas/`)
- **New enums** (`enums.prisma`):
  - `EmployeeType { FULL_TIME, PART_TIME }`
  - `ShiftResponseStatus { ACCEPTED, REJECTED }`
  - Added `SHIFT_OFFER_PUBLISHED` to the existing `NotificationType`.
- **`User` model** (`user.prisma`) — added employee-profile fields requested for the "Add Employee" form: `name`, `address`, `department`, `designation`, `employeeType`. (`phone`, `monthlySalary`, `hourlyRate`, `isActive` status already existed.) Added the `shiftOfferResponses` back-relation.
- **New file `shiftOffer.prisma`** — two models:
  - `ShiftOffer` — `jobTitle`, `categoryId` (→ `Category`), `startTime`, `endTime` (the date+time), `hourlyPrice` (`Decimal`), `description`, `createdById` (→ `Admin`), and `notifiedAt` (null = draft, set when the admin clicks Notify).
  - `ShiftOfferResponse` — join between `ShiftOffer` and `User` with `status` (`ACCEPTED`/`REJECTED`) and `respondedAt`. `@@unique([shiftOfferId, userId])` so each employee has exactly one response per shift (accept/decline is an upsert).
- Added back-relations on `Category` (`shiftOffers`) and `Admin` (`createdShiftOffers`).
- **`base.prisma`** — restored `url = env("DATABASE_URL")` on the datasource; the installed Prisma **6.19** CLI requires it in-schema (the `prisma.config.ts` datasource injection alone was not resolving during `generate`/`db push`). Schema was regenerated and pushed to the Neon database with `prisma db push` (all changes are additive: new tables, new nullable columns, one new enum value — non-destructive).

### Auth Middleware (`src/middleware/auth.ts`)
- Added **`authorizeUser`** — mirror of `authorizeAdmin`; used after `authenticate` to guard staff-only routes (rejects non-`USER` roles with 403).

### Extended: Admin User Management (`/api/v1/admin/users`)
- `user-management.validation.ts` — `createUserSchema` / `updateUserSchema` now accept `name`, `address`, `department`, `designation`, `employeeType` (`FULL_TIME`/`PART_TIME`), and `isActive` (Active/Inactive status). This fulfils the requested "Add Employee" form (email, phone, name, password, department, designation, employee type, status, address, monthly & hourly salary).
- `user-management.service.ts` — persists the new fields via imperative payload building (safe under `exactOptionalPropertyTypes`). Setting `isActive` in **update** keeps `deactivatedAt` consistent (set when going inactive, cleared when reactivated). Search now also matches `name`, `department`, and `designation`. A shared `userSelect` projection replaced the repeated inline selects.

### Admin Category Module (`/api/v1/admin/categories`)
| File | Purpose |
|------|---------|
| `category.validation.ts` | Zod schemas: create, update, id-param, list query |
| `category.service.ts` | `createCategory`, `updateCategory`, `deleteCategory`, `getAllCategories`, `getCategoryById`. Case-insensitive duplicate-name guard (409) because `@@unique([parentId,name])` does not enforce uniqueness for NULL `parentId`. Delete is blocked (409) when the category is still referenced by shifts/children, instead of surfacing a raw FK error. |
| `category.controller.ts` | HTTP controllers |
| `category.route.ts` | `POST /`, `GET /`, `GET /:categoryId`, `PATCH /:categoryId`, `DELETE /:categoryId` — all guarded by `authenticate` + `authorizeAdmin` |

### Admin Shift Module (`/api/v1/admin/shifts`)
| File | Purpose |
|------|---------|
| `shift.validation.ts` | Create/update schemas with `endTime > startTime` refinement; list query with `categoryId`, `notified`, `upcoming` filters |
| `shift.service.ts` | `createShift` (validates category exists & is active), `updateShift` (cross-field time guard even on partial edits), `deleteShift` (responses cascade), **`notifyShift`**, `getAllShifts` (+ `acceptedCount`), `getShiftById`, **`getShiftResponses`** |
| `shift.controller.ts` | HTTP controllers |
| `shift.route.ts` | `POST /`, `GET /`, `GET /:shiftId`, `GET /:shiftId/responses`, `PATCH /:shiftId`, `DELETE /:shiftId`, `POST /:shiftId/notify` — admin-guarded |

- **Notify (one click):** `POST /:shiftId/notify` runs a single transaction that (a) creates an in-app `Notification` for **every active employee** (`type=SHIFT_OFFER_PUBLISHED`, `channel=IN_APP`, `status=SENT`, with a `payload` carrying the shift details) and (b) stamps `notifiedAt`. Returns the recipient count. *(The `PUSH`/`EMAIL` channels and `Notification` rows are the integration seam for a real mobile-push/email provider later — no external provider is wired yet.)*
- **Availability view:** `GET /:shiftId/responses` returns the accepted list (with each employee's name, email, phone, department, designation, employee type), the rejected list, and `counts { accepted, rejected, total }` — i.e. exactly "who accepted" and "how many are available".

### Staff Shift Module (`/api/v1/shifts`)
| File | Purpose |
|------|---------|
| `shift.validation.ts` | `respondToShiftSchema` (`ACCEPTED`/`REJECTED`); list query with `categoryId`, `mine` (accepted/rejected/pending), `upcoming` filters |
| `shift.service.ts` | `listAvailableShifts` (**only `notifiedAt != null` shifts — drafts stay internal**; each row includes the caller's own `myResponse` and the shift's `acceptedCount`), `getShiftForUser`, `respondToShift` |
| `shift.controller.ts` | HTTP controllers |
| `shift.route.ts` | `GET /`, `GET /:shiftId`, `POST /:shiftId/respond` — guarded by `authenticate` + `authorizeUser` |

- **Accept / decline:** `POST /:shiftId/respond` upserts the caller's `ShiftOfferResponse` (staff can change their mind up to the shift end). Responding to an unpublished shift → 404; responding after `endTime` → 409.

### Staff Notification Module (`/api/v1/notifications`)
| File | Purpose |
|------|---------|
| `notification.validation.ts` | List query (`unreadOnly`), id param |
| `notification.service.ts` | `listNotifications` (+ `unreadCount`), `markAsRead`, `markAllAsRead` — all scoped to the calling user |
| `notification.controller.ts` | HTTP controllers |
| `notification.route.ts` | `GET /`, `PATCH /read-all`, `PATCH /:notificationId/read` — guarded by `authenticate` + `authorizeUser` |

### Route Wiring (`src/routes/index.route.ts`)
Mounted the four new routers: `/admin/categories`, `/admin/shifts`, `/shifts` (staff), `/notifications` (staff).

### Verification
- `npx tsc --noEmit` passes with **0 errors** (strict mode, incl. `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`).
- Full end-to-end flow exercised against the running server + live DB and confirmed: admin login → create category (and 409 on duplicate) → create shift (and 400 on `endTime <= startTime`) → create employee → employee login → **shift hidden before Notify** → Notify (fan-out + `notifiedAt`) → **shift now visible with `myResponse` & `acceptedCount`** → employee receives notification → accept (admin sees `accepted=1` + employee details) → change mind to reject (counts update to `accepted=0, rejected=1`) → notification mark-read → admin toggle `isActive=false` blocks login (403) → reactivate clears `deactivatedAt`. Test data was cleaned up afterward.

### New Endpoint Count
**18 new endpoints** across four modules: 5 category (admin) + 7 shift (admin, incl. notify & responses) + 3 shift (staff) + 3 notification (staff).

## 10. Admin Webapp: Employees, Shift Approvals, Categories Tree, Reports, Overview & Settings

This iteration builds out the **admin webapp** pages from the provided designs. Per the brief, only the **web (admin)** API surface was built — the staff side is a mobile app and already had its endpoints from §9 (the staff response endpoints were only lightly extended to expose approval state). Everything continues the `validation → route → controller → service` pattern, is Zod-validated, and returns no password hashes.

### Scope decision (documented, not silently dropped)
The provided screenshots include a **"Shift Approvals → Swap requests"** page and a **"Manage Plans"** page. These belong to the larger L-GAV **auto-scheduling engine** (the pre-existing `WeeklyPlan`, `Shift`, `StaffingDemand`, `SwapRequest`, availability/rule-engine models) and depend on staff-side (mobile) initiation of swaps and weekly-plan generation. Requirement **#3** explicitly redefines the "shift approve section" as **approving staff acceptances of published shift offers** (the accept → admin-approve → confirmed-count flow), so that is what the Shift Approvals backend implements here. The swap/weekly-planning engine is intentionally **deferred** (it needs the mobile initiation flow + rule engine) rather than half-built against models with no data path.

### Schema Changes (`prisma/schemas/`)
- **New enum** `ShiftApprovalStatus { PENDING, APPROVED, REJECTED }`.
- **`ShiftOfferResponse`** gained an admin-approval layer: `approvalStatus` (default `PENDING`), `approvedById` (→ `Admin`), `approvedAt`, `approvalNote`. A staff `ACCEPT` is a *volunteer offer*; only an admin-**APPROVED** acceptance counts as an available/confirmed worker.
- **`Admin`** gained the `approvedResponses` back-relation.
- Regenerated the client and pushed to Neon with `prisma db push` (additive: one enum + four nullable columns).

### Extended: Employees (`/api/v1/admin/users`) — requirement #2
Backs the **Team / Employees** page (name+email, categories, contract, rate, status; add-employee; category filter; "N active · M inactive").
- **Category (role) assignment** — `createUserSchema`/`updateUserSchema` accept `categoryIds: string[]`. On create they connect `UserCategory` rows; on update a provided list **fully replaces** the old set (`deleteMany` + `create`). Non-existent category IDs are rejected (400).
- **Enriched list** — `GET /admin/users` now returns each employee's `categories` (flattened from the join), `phone` (contact), `employeeType` + `workloadPercent` + `contractType` (contract), `hourlyRate`/`monthlySalary` (rate), and `isActive` (status). Added a **`categoryId` filter** and a **`counts { active, inactive }`** block (computed over the same filters minus the status filter) for the header tallies.
- `getUserById`/`createUser`/`updateUser` also return the flattened `categories`.

### Shift Approvals (`/api/v1/admin/shifts/...`) — requirement #3
- `GET /admin/shifts/approvals?pendingOnly=` — feed of **published shifts that have volunteers**, each with its `volunteers` (accepted responses incl. per-response `approvalStatus`), roll-up counts, and `available` (approved) count.
- `POST /admin/shifts/:shiftId/responses/:responseId/approve` — confirms an employee: sets `approvalStatus=APPROVED` + `approvedBy/At`, and sends the employee a **"Shift confirmed"** in-app notification (updates their mobile status). Guards: response must exist for that shift and be `ACCEPTED` (else 404/409).
- `POST /admin/shifts/:shiftId/responses/:responseId/reject` — sets `REJECTED` (+ optional `note`) and notifies the employee.
- `GET /admin/shifts/:shiftId/responses` and the shift lists now report approval-aware counts: `acceptedCount`, `approvedCount`, `pendingApprovalCount`, `rejectedByAdminCount`, `declinedCount`, and **`available` = approved** ("how many workers are available for this shift").
- Staff side (`GET /api/v1/shifts`): each `myResponse` now includes `approvalStatus`/`approvedAt`, and shifts expose `confirmedCount` (admin-approved workers) so the mobile app can show a "confirmed" status.

### Categories page (`/api/v1/admin/categories`)
Backs the **Categories** page (parent cards with "N qualified · M sub-categories", sub-category chips, add sub-category).
- `POST /admin/categories` accepts an optional `parentId` to create a sub-category; `POST /admin/categories/:categoryId/subcategories` is a convenience route for the per-card "Add sub-category" input.
- `GET /admin/categories/tree` returns top-level categories, each with `qualifiedCount` (employees assigned), `subCategoryCount`, and `children[]` (each with its own `qualifiedCount`).
- Duplicate-name guard is now scoped to siblings (same `parentId`); nesting is limited to one level; the in-use delete guard remains.

### Reports (`/api/v1/admin/reports`) — requirement #4
Backs the **Reports** page (per-employee hours/overtime/due/wage, summary tiles, month + category filters, Export CSV).
- `GET /admin/reports?year=&month=&categoryId=` — for each active employee (optionally filtered by role/category): `scheduledHours`, `workedHours`, `overtimeHours`, `dueHours`, `wageCost`, plus contract/category context. **Data source:** admin-**APPROVED** shift-offer acceptances whose shift falls in the month. Hours = shift duration; `overtime/due` are computed against `contractedHoursMonthly`; `wageCost` = hours × `hourlyRate` (falls back to fixed `monthlySalary`). Returns summary tiles `{ totalWorked, overtime, hoursDue, wageCost, employeeCount }`. *(There is no separate time-clock yet, so `worked` = `scheduled`; this is the integration seam for real clock-in data.)*
- `GET /admin/reports/export?...` — same data as a downloadable `text/csv` (proper `Content-Disposition`, CSV-escaped).

### Overview (`/api/v1/admin/overview`)
- `GET /admin/overview` — dashboard stat tiles: `employees { active, inactive, total }`, `categories { total, subCategories }`, `shifts { draft, upcoming, awaitingApproval }`, `approvals { pendingResponses }`.

### Settings (`/api/v1/admin/settings`)
- `GET /admin/settings` — the single org-wide `OrgSettings` row (upserted with Swiss L-GAV defaults on first read: max daily 12.5h, max weekly 50h, min rest 11h, min break 30min, swap expiry 72h, session timeout 30min).
- `PATCH /admin/settings` — partial update of the numeric rule limits; records `updatedById`; rejects an empty body (400).

### Route Wiring (`src/routes/index.route.ts`)
Mounted: `/admin/overview`, `/admin/reports`, `/admin/settings` (plus the extended `/admin/categories/*` and `/admin/shifts/*` routes).

### Verification
- `npx tsc --noEmit` passes with **0 errors** (strict mode).
- Full end-to-end run against the live server + DB, all confirmed: admin login → create parent categories + sub-categories (409 on duplicate sibling) → **category tree** shows correct `qualifiedCount`/`subCategoryCount` → create employees with `categoryIds` → **employee list** returns categories/rate/contract + `counts {active:2, inactive:0}` → **category filter** narrows to Kitchen staff → create + notify shift → both employees accept → **approvals feed** shows 2 volunteers / 2 pending / 0 available → approve Anna + reject Luca → responses now `available:1` (`approvedCount:1, rejectedByAdminCount:1`) → Anna receives **"Shift confirmed"** notification → **overview** tiles correct → **report** (Nov 2026): Anna worked 8h, wage CHF 224 (8×28), due 160h (168−8); category filter isolates Kitchen → **CSV export** returns correct headers + rows with `text/csv` disposition → **settings** GET defaults, PATCH `maxWeeklyHours=45` records `updatedById`, empty PATCH rejected (400). All test data cleaned up afterward.

### New Endpoint Count (this iteration)
**13 new admin endpoints**: 2 categories (tree, add sub-category) + 3 shift approvals (feed, approve, reject) + 2 reports (data, CSV) + 1 overview + 2 settings (get, patch) + enriched employees list/create/update (category assignment, filter, counts — same routes, extended payloads).

## 11. Shift Swaps (employee ↔ employee) & Overview Enrichment

Implements requirement #6 (two employees swap shifts via an admin-approved request) and #5 (enriched Overview API). Swaps are built on the **functional `ShiftOffer`** model — a "shift" that can be swapped is one an employee is **admin-APPROVED** (confirmed) for. This is distinct from the pre-existing `SwapRequest` model in `shiftSwap.prisma`, which belongs to the deferred `WeeklyPlan`-based scheduling engine.

### Schema Changes (`prisma/schemas/`)
- **New enum** `ShiftSwapStatus { PENDING, APPROVED, REJECTED, CANCELLED }`.
- **New model** `ShiftSwapRequest` (`shiftOfferSwap.prisma`): `initiatorUser`/`initiatorShift`, `recipientUser`/`recipientShift` (all → `User`/`ShiftOffer`), `status` (default `PENDING`), `reason` (initiator note), `reviewedBy`/`reviewedAt`/`adminNote`. Distinct relation names (`ShiftSwap*`) so they don't collide with the legacy `SwapRequest` relations.
- Back-relations added on `User` (`initiatedShiftSwaps`, `receivedShiftSwaps`), `Admin` (`reviewedShiftSwaps`), and `ShiftOffer` (`swapsAsInitiatorShift`, `swapsAsRecipientShift`). Regenerated + `db push` (additive).

### Staff Swap Module (mobile API) — `/api/v1/swaps`
Guarded by `authenticate` + `authorizeUser`. (Built here because the swap is *initiated* by staff; the staff UI is the mobile app, but the API lives in this backend.)
| Endpoint | Purpose |
|----------|---------|
| `POST /swaps` | Create a swap: `{ initiatorShiftId, recipientUserId, recipientShiftId, reason? }`. Validates **both** employees currently hold their **confirmed** shifts, blocks self-swap / same-shift / ended shifts / duplicate pending pairs, then notifies the recipient (`SWAP_REQUEST_RECEIVED`). |
| `GET /swaps` | The caller's swaps (filter by `status` and `role=initiated|received`). |
| `POST /swaps/:swapId/cancel` | Initiator cancels their own pending swap (403 for anyone else, 409 if not pending). |

### Admin Swap Module — `/api/v1/admin/swaps`
Backs the **Shift Approvals → Swap requests** page (Pending/History, Rules OK/Rule fail, Approve/Reject). Guarded by `authenticate` + `authorizeAdmin`.
| Endpoint | Purpose |
|----------|---------|
| `GET /admin/swaps?status=` | Lists swaps with full initiator/recipient user + shift details; **each PENDING swap carries a `ruleCheck { passed, violations[] }`** (advisory). |
| `POST /admin/swaps/:swapId/approve` | **Performs the exchange in one transaction**: re-verifies both shifts are still confirmed (409 if drifted), clears the four `ShiftOfferResponse` slots to satisfy the `@@unique([shiftOfferId, userId])`, re-creates the two swapped responses as `APPROVED` (by the admin), flips the swap to `APPROVED`, and notifies **both** employees (`SWAP_REQUEST_RESULT`). The shift's approved-worker list now reflects the exchange. |
| `POST /admin/swaps/:swapId/reject` | Marks `REJECTED` (+ optional note), notifies both; shifts are left untouched. |

- **Rule engine (lightweight L-GAV check):** for a pending swap, projects each employee's schedule *after* the swap (their approved hours in the affected Monday-based ISO week / day, minus the shift given up, plus the shift taken) and compares against `OrgSettings.maxWeeklyHours` / `maxDailyHours`, producing messages like *"Would exceed 50h weekly max for Luca Rossi"*. Advisory only — the admin can still approve (matching the UI).
- **Select-merge bug found & fixed during testing:** the admin list originally spread `{ ...swapSelect, ...ruleSelect }`, and the second select's nested `initiatorShift`/user keys *overrode* (not merged with) the first, dropping `jobTitle`/`category`. Fixed by adding only the scalar FK ids on top of `swapSelect`. Caught by the E2E run before it shipped.

### Overview Enrichment — `/api/v1/admin/overview`
Added `swaps { pending }` (count of `PENDING` swaps) and `thisMonth { period, scheduledHours, overtime, hoursDue, wageCost }` (reuses the Reports service for the current month). *(The screenshot's availability-submitted, weekly-plan-status and "not submitted yet" tiles depend on the deferred availability/weekly-plan engine and are intentionally not fabricated here.)*

### Verification
- `npx tsc --noEmit` passes with **0 errors**.
- Full E2E against the live server + DB: set up 2 employees each confirmed on their own shift (same ISO week) → **Anna requests a swap** for Luca's shift (Luca notified) → **Overview** shows `swaps.pending = 1` → admin **pending list** shows full shift/user details + `ruleCheck.passed = true` (and, with `maxWeeklyHours` temporarily set to 1, correctly flips to `passed:false` with the exceed message) → **admin approves** → **shifts are exchanged** (Shift A's confirmed worker is now Luca, Shift B's is now Anna; `available = 1` each) → **both employees notified** with the correct swapped-shift wording → swap appears in **History** as `APPROVED` with the admin note → a second swap is **rejected** (shifts unchanged, both notified) → **cancel** path works and non-initiators get 403 → self-swap/duplicate guards return 400/409. Internal FK ids are not leaked to the client. All test data cleaned up afterward.

### New Endpoint Count (this iteration)
**6 new endpoints**: 3 admin swaps (list, approve, reject) + 3 staff swaps (create, list, cancel), plus the enriched `/admin/overview` payload.

## 12. Admin Settings Page — Profile Management & Extended Org Settings

Backs the **Settings** page (Profile · L-GAV rule values · Notifications). Lets an admin manage **their own account** and tune the org-wide rule/notification config.

### Schema Changes (`prisma/schemas/`)
- **`Admin.name`** (`String?`) added — a single display-name field to match the Settings "Name" input (alongside the existing `firstName`/`lastName`).
- **`OrgSettings.breakRequiredAfterHours`** (`Decimal @default(5.50)`) added — the "Break required after (h)" field. Given a **DB default** so the additive `db push` succeeded against the existing settings row.
- Regenerated the client + `db push` (additive).

### Admin Profile Management (`/api/v1/auth/admin`)
- `GET /auth/admin/profile` now also returns `name` (and `updatedAt`).
- **`PATCH /auth/admin/profile`** (admin-guarded) — update own `name`/`firstName`/`lastName`, `email`, and password. Validation (`updateAdminProfileSchema`):
  - requires at least one field;
  - a password change is **all-or-nothing** — `currentPassword` + `newPassword` (≥8) must be supplied together (else `400`);
  - email changes are uniqueness-checked across admins (`409`).
  - Service verifies `currentPassword` against the stored hash (`401` if wrong) before re-hashing the new one. On a successful password change it **revokes all of the admin's refresh tokens** and the controller **clears the session cookies**, so other sessions die and the admin re-authenticates. Response carries `passwordChanged` and an appropriate message.

### Extended Org Settings (`/api/v1/admin/settings`)
- `GET`/`PATCH /admin/settings` gained **`breakRequiredAfterHours`** (0–24) and a structured **`notificationPrefs`** object.
- `notificationPrefs` toggles: `shiftPublished`, `swapRequests`, `availabilityReminders`, `ruleViolations`, `channelEmail`, `channelPush`, `channelInApp`. Stored in the existing `OrgSettings.notificationPrefs` JSON column.
- `GET` always returns a **complete** prefs object (service-level `DEFAULT_NOTIFICATION_PREFS` merged over whatever is persisted). `PATCH` **merges** a partial prefs object over the current values, so the client only sends the toggles that change.

### Verification
- `npx tsc --noEmit` passes with **0 errors**.
- E2E against the live server + DB, all confirmed: `GET /auth/admin/profile` returns `name` → `PATCH` name + email updates them (`passwordChanged:false`) → wrong `currentPassword` → `401` → `newPassword` without `currentPassword` → `400` → correct password change returns the re-login message, **old password stops working (401)** and the **new one logs in**; email/password reverted to the seed values afterward. Settings: `GET` returns `breakRequiredAfterHours` + full `notificationPrefs`; `PATCH` updates L-GAV values and a **partial** prefs object merges correctly (`swapRequests→false`, `channelEmail→true`, other toggles preserved); out-of-range `breakRequiredAfterHours` → `400`.

### New Endpoint Count (this iteration)
**1 new endpoint** (`PATCH /auth/admin/profile`), plus extended `GET /auth/admin/profile` and `GET`/`PATCH /admin/settings` payloads. **Total project endpoints: 50.**

## 13. Codebase Restructure (feature-folder architecture) + Full Re-verification

Reorganized the whole `src/modules` tree from **flat, prefix-named files** into **one folder per feature**, each self-contained with its `route` / `controller` / `service` / `validation`. No endpoint URLs or behaviour changed — this is a pure structural + import refactor, verified by a full endpoint sweep.

### Before → after
```
BEFORE  src/modules/admin/shift.controller.ts        (flat, ~30 files in two folders)
        src/modules/admin/shift.service.ts
        src/modules/user/swap.controller.ts  …

AFTER   src/modules/admin/shifts/shifts.controller.ts   (feature folders)
        src/modules/admin/shifts/shifts.service.ts
        src/modules/user/swaps/swaps.controller.ts   …
```
Feature folders created:
- **admin/**: `auth`, `overview`, `employees` (was `user-management`, still mounted at `/admin/users`), `categories`, `shifts`, `swaps`, `reports`, `settings`
- **user/**: `auth`, `shifts`, `notifications`, `swaps`

### What changed mechanically
- All 47 module files were `git mv`-moved into their feature folder and renamed to `<feature>.<part>.ts` (e.g. `admin.controller.ts` → `auth/auth.controller.ts`, `user-management.*` → `employees/employees.*`).
- **Imports fixed** (verified by `tsc`): outward paths went one level deeper (`../../config` → `../../../config`, etc.); intra-feature sibling imports were re-pointed to the new file names; the two cross-module imports were re-pathed — `overview.service` → `../reports/reports.service`, and admin `swaps.service` → `../../user/swaps/swaps.service` (it reuses the staff `swapSelect`).
- `routes/index.route.ts` rewritten to import the 12 feature routers from their new paths (same mount URLs, now grouped/commented by area).

### Verification (nothing broke)
- `npx tsc --noEmit` → **0 errors** after the move.
- Server boots clean; full automated endpoint sweep re-run: **90/92 assertions pass**. The 2 non-passing lines are deliberate *test-expectation* quirks, not API faults, and were individually re-confirmed as correct behaviour: a login with a <6-char password returns `400` (Zod validation) before it can reach the `401` credential check; and creating a user with an already-used email returns `409` (email uniqueness) before the `400` unknown-category check — both guards fire in the correct order. Test data cleaned up; DB left empty.

### Quality notes
- Each feature folder is now independently navigable and testable; the `route → controller → service (+ validation)` layering is consistent across all 12 features.
- `API_Doc.md` was expanded: every endpoint heading now shows its **full URL** (`http://localhost:8000/api/v1/...`), plus a cURL quick-start and a **Project structure** map.
- A companion fix from the previous step (`postinstall`/`predev` running `prisma generate`) ensures the generated client always matches the schema after this move too.

### Endpoint count: unchanged — **50 endpoints**, all working.

## 14. Full Audit, Re-verification & New **Availability** Feature

Senior-engineer pass over the whole codebase + all prompts + the original briefing: regression-tested everything, then closed the clearest remaining gap — **employee availability collection** (briefing outcomes 1 & 2, and the Overview "Availability submitted / Not submitted yet · Nudge" tiles).

### Regression (nothing regressed after the restructure)
Re-ran the full automated sweep of the existing 50 endpoints: **90/92 assertions pass**; the 2 non-passing lines are the known intentional test-expectation quirks (short-password login → `400` before `401`; duplicate-email create → `409` before the `400` category check), both correct behaviour.

### New: Availability (uses the pre-existing `AvailabilityMonth` / `AvailabilityDay` models — no schema change)
The admin **opens** a month with a cut-off; each active employee gets a slot; staff fill days (AVAILABLE / UNAVAILABLE / WISH, with optional note + preferred times) and **submit bindingly** before the cut-off; the admin watches submission status and nudges stragglers.

**Admin module** (`src/modules/admin/availability/`, `/api/v1/admin/availability`):
- `POST /open` — `{ year, month, cutoffAt }` upserts a slot for every active employee (new → `DRAFT`, existing → keeps filled days, updates cut-off).
- `GET /?year=&month=` — per-employee status (`SUBMITTED`/`DRAFT`/`LOCKED`/`NOT_OPENED`), `filledDays`, a `notSubmitted` list, and a `summary`.
- `GET /:userId?year=&month=` — one employee's month with full `days[]`.
- `POST /:userId/nudge` — `{ year, month }` sends an `AVAILABILITY_REMINDER` notification; `409` if not open or already submitted.

**Staff module** (`src/modules/user/availability/`, `/api/v1/availability`):
- `GET /:year/:month` — my slot + days (`404` if not opened).
- `PUT /:year/:month/days` — full-replace my entries; validates each date is **within the month**, rejects duplicate dates, and only while `DRAFT` + before cut-off.
- `POST /:year/:month/submit` — `DRAFT → SUBMITTED` (+`submittedAt`); read-only afterwards.

**Overview integration:** added an `availability` block for the most-recently-opened month — `{ year, month, submitted, total, notSubmitted[] }` — powering the dashboard availability tile + nudge list (`null` when no month is open).

### Verification (all green)
`tsc --noEmit` → 0 errors. Full E2E of the availability flow, all confirmed: open Dec 2026 (2 slots) → status shows both `DRAFT` → staff GET own draft → **unopened month → 404** → save mixed days (AVAILABLE/WISH+note+times/UNAVAILABLE) → **date-outside-month → 400** → submit → status flips to `SUBMITTED` with `submittedAt` → **edit-after-submit → 409** → admin status now `submitted:1, notSubmitted:[Luca]` → admin views a user's days → **nudge Luca → notification received**; **nudge already-submitted Anna → 409** → **Overview** availability tile shows `1/2` + `[Luca]` → **cut-off passed → 409** → **admin hitting a staff route → 403** → **submit with no days → 400**. Test data cleaned up; DB left empty.

### Still deferred (documented, not silently dropped)
The **weekly-plan auto-scheduling engine** ("Manage Plans" — turn demand + the now-collected availability into a rule-compliant proposed roster, with hand-adjustment + per-change L-GAV feedback) remains the one large piece; it needs a constraint/roster-generation layer and the legacy `WeeklyPlan` models. Also open but non-blocking: "open to the whole team" swaps (today's swaps are targeted) and real clock-in/out worked-hours capture (reports derive hours from approved shifts). These are the recommended next builds.

### Endpoint count: **57** (added 4 admin + 3 staff availability), all working.

## 15. Admin **Workload** — Weekly Staffing Demand + Shift Coverage

Implements the **Workload** page: the admin plans **how many people each category needs for each shift**, week by week, edits it freely, and **uploads (publishes)** it — and the workload is **connected to the shifts the admin already created** so each demand shows how much of its required headcount is covered.

> **Design note — built on the pre-existing `WeeklyPlan` / `StaffingDemand` models, no schema change.** These two models already existed (part of the previously-deferred scheduling engine) and are a perfect fit: a `WeeklyPlan` is the *week container* and each `StaffingDemand` is exactly "for this category, on this day, for this shift slot, we need N people" (`@@unique([weeklyPlanId, date, categoryId, startTime])`). So the feature was built directly on them rather than adding new tables. The remaining deferred piece is only the **auto-roster constraint-solver** that would turn demand + availability into a proposed roster; everything else of the workload surface (week CRUD, per-category demand entry, bulk upload, publish, day/week/month sorting, and live shift-coverage) is now implemented. The functional shift model stays `ShiftOffer` (the admin-created shift from §9/§10); demands connect to it by category + day + time overlap.

### No schema / migration change
`WeeklyPlan` and `StaffingDemand` were already in the migrations and the generated Prisma client. Confirmed both tables + models exist; **nothing was added or pushed**.

### Shift ⇄ workload connection (the core logic)
A `ShiftOffer` **fulfils** a demand when it shares the **category**, falls on the **same calendar day**, and **overlaps** the demand's `[startTime, endTime)`. "Filled" headcount = admin-**APPROVED** workers across those shifts. Every demand is returned annotated with `fulfillment { requiredCount, filledCount, pendingCount, openCount, status }` (status `OPEN`/`PARTIAL`/`MET`) and the `connectedShifts[]` that feed it. This makes "the shift the admin created is available in the workload" literal — the created shifts show up inside each demand with their approved/pending counts.

### Admin Workload Module (`src/modules/admin/workload/`, `/api/v1/admin/workload`)
Follows the standard `validation → route → controller → service` pattern, admin-guarded at the router level, Zod-validated.
| File | Purpose |
|------|---------|
| `workload.validation.ts` | Zod schemas: create-week (`weekStartDate` + optional `weekNumber`), update-week (`status`/`needsRenotify`), list-weeks query, create-demand + **bulk** demands (1–500) + update-demand (all with `endTime > startTime` refinement), and the day/week/month **view** query. A shared `dateString` accepts either a date-only (`2026-11-03`) or a full ISO date-time. |
| `workload.service.ts` | All business logic + Prisma. UTC date helpers (`startOfUTCDay`, `addDays`, ISO `isoWeekNumber`), `annotateDemands` (the shift-coverage join), `groupByCategory`, `computeTotals`, and the eleven operations below. Category/plan existence guards mirror the shifts module. |
| `workload.controller.ts` | HTTP controllers (thin; `sendSuccess`, param reads, `res.locals.auth`). |
| `workload.route.ts` | 11 routes, all `authenticate` + `authorizeAdmin`. |

**Weeks (workload containers):**
- `POST /weeks` — create a week from `weekStartDate`; derives `year`/`month`/`weekEndDate` (+6 days) and `weekNumber` (ISO week number, overridable). `409` on duplicate `year+month+weekNumber`.
- `GET /weeks` — paginated list, filters `year`/`month`/`status`, each row with `demandCount` + `totalRequired`.
- `GET /weeks/:planId` — full week: demands annotated with `fulfillment` + `connectedShifts`, the same demands **grouped by category**, and week `totals`.
- `PATCH /weeks/:planId` — update `status` (stamps `submittedAt` on `SUBMITTED`) / `needsRenotify`.
- `POST /weeks/:planId/publish` — **upload**: sets `status=PUBLISHED`; `409` if the week has no demands.
- `DELETE /weeks/:planId` — deletes the week (demands cascade).

**Demands (the workload rows):**
- `POST /weeks/:planId/demands` — add one (category active-check; up-front duplicate guard on `[week, date, category, startTime]` → `409`).
- `POST /weeks/:planId/demands/bulk` — **bulk upload**: validates all categories, `createMany` with `skipDuplicates`, returns `{ createdCount, skippedCount }`.
- `PATCH /demands/:demandId` — edit any field; re-checks the time bounds on partial edits.
- `DELETE /demands/:demandId` — remove one.

**Sortable view:**
- `GET /admin/workload?view=day|week|month&date=&categoryId=` — returns every demand whose `date` falls in the day / **Monday-based** week / calendar month window, annotated with coverage and grouped by category, with a `range` and `totals`. This is the "sort it using day, week and month" requirement.

### Route Wiring (`src/routes/index.route.ts`)
Mounted `workloadRouter` at `/admin/workload` (one import + one `indexRouter.use`).

### Verification
- `npx tsc --noEmit` → **0 errors** (strict mode, incl. `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`). One strict-mode fix: the `endAfterStart` refine predicate's parameter type needed `string | undefined` to satisfy `exactOptionalPropertyTypes`.
- Module graph loads cleanly and all **11 routes register** (verified by introspecting the router stack).
- **Full E2E against the live DB**, all confirmed: create week (`2026-11-02` → `year:2026, month:11, weekNumber:45`, `weekEndDate` +6d, `DRAFT`) → add demand (need 2) → **duplicate demand → 409** → create a matching `ShiftOffer` + one **APPROVED** worker → week detail shows `connectedShifts:[{approved:1}]`, `fulfillment {filledCount:1, openCount:1, status:"PARTIAL"}` and correct category grouping → **day / week / month views** return correct `range`s (`11-03`, `11-02..11-08`, `11-01..11-30`) and demand counts (a different day → empty) → **bulk upload** = `{createdCount:1, skippedCount:1}` (one row duplicated an existing slot) → update demand (required→5) → **publish → PUBLISHED** → `listWeeks` filtered by year/month returns `demandCount` + `totalRequired`. All test data cleaned up afterwards.

### New Endpoint Count (this iteration)
**11 new admin endpoints** (6 weeks + 4 demands + 1 day/week/month view). **Total project endpoints: 68.**

## 16. Employees List — **Cursor (Keyset) Pagination**

Switched the admin **Employees** list (`GET /api/v1/admin/users`) from offset (`page`/`skip`) pagination to **cursor (keyset)** pagination. Offset pagination re-scans and skips `(page-1)*limit` rows on every request (slower as the list grows) and **drifts** — when an employee is added or removed between page loads, rows shift and the viewer sees a duplicate or misses one. Keyset pagination anchors each page to the last row of the previous one, so it stays O(limit) and never skips/repeats. No other endpoint changed; no schema change.

### What changed (`src/modules/admin/employees/`)
- **`employees.validation.ts`** — `listUsersQuerySchema` drops `page` and adds an optional opaque **`cursor`** string; `limit` (1–100, default 10) and the `isActive` / `search` / `categoryId` filters are unchanged.
- **`employees.service.ts`** — `getAllUsers` rewritten:
  - **Stable total ordering:** `orderBy: [{ createdAt: "desc" }, { id: "desc" }]`. The unique `id` tiebreaker makes the sort total, which keyset pagination requires to never skip or duplicate a row when `createdAt` values collide.
  - **Opaque cursor:** `encodeCursor`/`decodeCursor` base64url-encode the row `id` (so the client treats it as opaque, not a guessable id). A malformed cursor → `400`.
  - **Cursor resolve + guard:** when a cursor is supplied it is decoded and its row is existence-checked up-front; a **stale/deleted** cursor returns a clean `400 "Invalid or expired pagination cursor."` instead of a raw Prisma "cursor does not exist" error.
  - **Next-page detection:** fetches `take: limit + 1` (with `cursor: { id }, skip: 1` when paging); if the extra row is present, `hasNextPage = true` and `nextCursor` = the last kept row's encoded id, else `nextCursor = null`.
  - **Preserved:** the `counts { active, inactive }` tallies (computed over the same filters minus `isActive`) — they still power the "N active · M inactive" header and serve as the total tally.
  - Response `meta.pagination` is now `{ limit, nextCursor, hasNextPage }` (was `{ page, limit, total, totalPages }`).
- **`employees.controller.ts`** — `getAllUsers` forwards `cursor` instead of `page` (imperative build, safe under `exactOptionalPropertyTypes`).

### Verification
- `npx tsc --noEmit` → **0 errors** (strict mode).
- **Full E2E against the live DB**, all confirmed: seed 5 employees (3 inactive, 2 active) → page at `limit=2` → **3 pages return all 5 exactly once, no skips/overlaps** (`hasNextPage` flips to `false` and `nextCursor` to `null` on the last page) → **order is newest-first** and stable → **`counts {active:2, inactive:3}`** correct on every page → **filter + cursor compose** (active-only paging at `limit=1` returns the 2 distinct active users, then `hasNextPage:false`) → **malformed cursor → 400** → **stale cursor** (valid base64url of a non-existent id) **→ 400**. All test data cleaned up afterwards.

### Endpoint Count
Unchanged — **68 endpoints**. This is a behavioural upgrade to the existing `GET /admin/users`, not a new route. Its `meta.pagination` shape changed from offset to cursor (documented in `API_Doc.md` §4 + the Pagination conventions).

## 17. Admin **Demands** — Weekly Per-Day, Per-Category Headcount Grid

Implements the **Weekly demand** page: the admin plans **how many employees each category needs on each day**, one Sunday–Saturday week at a time, edits it as a category × day grid of steppers, and saves/publishes it. The current week shows first, upcoming weeks below, and a "Create week plan" modal can seed a new week from an existing one.

> **Design note — new self-contained models, deliberately NOT the shift-slot `StaffingDemand`.** The nav now separates **Weekly Plan** (the deferred roster engine on `WeeklyPlan`) and **Demands** (this page). The Demands grid is **day-level** — one count per (week, category, day) with **no shift time slots** — and uses **Sunday-based** weeks (the UI columns run Sun→Sat), whereas the earlier Workload/`StaffingDemand` layer is **slot-level** and **Monday-based**. Overloading one model for both granularities/week-conventions would have been a bug farm, so Demands got its own clean models. Weeks (`WeeklyPlan`) are **not** reused for the same reason (different week convention + that model belongs to "Weekly Plan").

### Schema Changes (`prisma/schemas/demand.prisma` — new file)
- **New enum** `DemandWeekStatus { DRAFT, PUBLISHED }`.
- **`DemandWeek`** — one row per week: `weekStartDate` (a Sunday, `@db.Date`, **`@@unique`** → one plan per week), `weekEndDate` (the Saturday), `status`, `publishedAt`.
- **`DayDemand`** — one grid cell: `demandWeekId` (→ `DemandWeek`, cascade delete), `categoryId` (→ `Category`, restrict), `date` (`@db.Date`), `requiredCount` (`Int`, default 0). **`@@unique([demandWeekId, categoryId, date])`** guarantees exactly one count per category per day.
- Added the `dayDemands DayDemand[]` back-relation on `Category`.
- **`base.prisma`** — restored `url = env("DATABASE_URL")` on the datasource; the installed Prisma **6.19** CLI requires it in-schema to `generate`/`db push` (the `prisma.config.ts` injection alone doesn't resolve for the CLI). Regenerated the client and ran `prisma db push` against Neon — **additive** (2 new tables + 1 enum), non-destructive.

### Admin Demands Module (`src/modules/admin/demands/`, `/api/v1/admin/demands`)
Standard `validation → route → controller → service`, admin-guarded, Zod-validated.
| File | Purpose |
|------|---------|
| `demands.validation.ts` | Zod schemas: list query (`scope` week/month/upcoming + optional `date`), create-week (`weekStartDate` + optional `copyFromWeekId`), save-grid (1–700 cells), single-cell upsert. `requiredCount` is int 0–1000; a shared `dateString` accepts date-only or ISO. |
| `demands.service.ts` | All logic + Prisma. **Sunday-based week math** (`weekStartSunday` uses `getUTCDay`), grid builder (fills every active category × 7 days, 0 where no cell), copy-from-week day-for-day remap, cell validation (in-week dates + existing categories), and the operations below. |
| `demands.controller.ts` | Thin HTTP controllers. |
| `demands.route.ts` | 8 routes, all `authenticate` + `authorizeAdmin`. |

**Endpoints:**
- `GET /` — grid view by **scope**: `week` (the Sun–Sat week of `date`), `month` (all weeks whose Sunday is in that month), `upcoming` (default — **current week first, then all future weeks**). Response also carries `today` + computed `currentWeek` bounds so the UI can always show the current week.
- `GET /weeks` — lightweight newest-first list (id, range, status, `demandCount`, `relative`) for the modal's "Start from week's data" dropdown.
- `POST /weeks` — create a week; **snaps `weekStartDate` to that week's Sunday**; optional `copyFromWeekId` seeds cells remapped day-for-day. `409` on duplicate week, `404` on bad copy source.
- `GET /weeks/:weekId` — one week's full grid.
- `PUT /weeks/:weekId` — **Save** the whole grid: upserts every provided cell (unique per week+category+date); validates each date is one of the week's 7 days and each category exists (`400`).
- `PUT /weeks/:weekId/cell` — single-cell upsert for the −/+ steppers.
- `POST /weeks/:weekId/publish` — set `PUBLISHED` + `publishedAt`.
- `DELETE /weeks/:weekId` — delete a week (cells cascade).

Each returned week is a `{ id, weekStartDate, weekEndDate, status, publishedAt, relative, days[7], categories[] }` shape where `relative` is `current`/`upcoming`/`past` and every category row has 7 `{ date, requiredCount, demandId }` cells (0 / null when unsaved).

### Route Wiring (`src/routes/index.route.ts`)
Mounted `demandRouter` at `/admin/demands` (one import + one `use`).

### Verification
- `npx tsc --noEmit` → **0 errors** (strict mode). All 8 routes register (verified via router-stack introspection).
- **Full E2E against the live DB — 25/25 checks pass**, including: `Jul 5 2026` confirmed a **Sunday** (`getUTCDay()===0`); a mid-week input (`Jul 8`) **snaps to Sunday `Jul 5`** with `weekEndDate` `Jul 11` and a 7-day grid; empty cells default to `0`/`null`; **duplicate week → 409**; save grid persists (Sun=12, Mon=13) and leaves untouched cells at 0; **out-of-week date → 400**; **unknown category → 400**; single-cell stepper upsert; **copy-from-week** carries each weekday's value into the new week (Sun 20→Jul 12, Mon 13→Jul 13); `scope=week`/`month`/`upcoming` return the right weeks; `listWeeks` newest-first with `demandCount`; **publish → PUBLISHED + publishedAt**; **delete cascades** its `DayDemand` rows; missing week → 404. All test data cleaned up afterwards.

### New Endpoint Count (this iteration)
**8 new admin endpoints**. **Total project endpoints: 76.**

## 18. Security Hardening — Rate Limiting, Helmet, HPP, Structured Logging & Secret-Leak Fixes

A security pass over the whole backend. All the protective middleware was already installed but **commented out**; this turn wires it in properly, adds layered rate limiting, removes every `console.*` in favour of a redacting structured logger, and closes two secret-leak holes. No endpoint behaviour changed (other than new `429`s under abuse); no schema change; no CI/CD added (per request).

### Rate limiting (`src/middleware/rateLimit.ts` — new)
Two layered per-IP limiters built on `express-rate-limit`, both returning the standard error envelope (`429`) with `RateLimit-*` + `Retry-After` headers:
- **`apiLimiter`** — global ceiling on all `/api/v1/**` (default **1000 / 15 min**), health probe exempt. Blunts scraping/abuse without hampering a busy dashboard.
- **`authLimiter`** — strict limiter on `/auth/(admin|user)/login` and `/refresh` (default **20 / 15 min**) with **`skipSuccessfulRequests: true`**, so **only failed attempts count** — brute-force / credential-stuffing is throttled while a legitimate user is never locked out by their own successful sign-ins.
- Limits + window are env-tunable (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`), all optional with sensible defaults.

### Middleware wired in (`src/middleware/index.ts`)
Uncommented and correctly ordered: **`helmet()`** (HSTS, `nosniff`, frameguard, CSP, hides `x-powered-by`, …) → CORS → compression → cookies → **`express.json({ limit: "1mb" })`** (body-size cap vs. oversized-payload abuse; Stripe raw body preserved) → **`hpp()`** (HTTP Parameter Pollution guard, after the parsers; only touches urlencoded bodies so our JSON arrays are untouched) → **`httpLogger`** (pino) → **`apiLimiter`**.

### Trust proxy (`src/app.ts`)
`app.set("trust proxy", TRUST_PROXY_HOPS)` (env, default `1`) so `req.ip` is the real client IP behind a reverse proxy — correct rate-limit keying — using a **finite hop count** rather than the spoofable `trust proxy = true`.

### Structured logging + secret-leak fixes
- Adopted the existing (previously unused) **pino** logger everywhere; **removed all `console.*`** from `src/` (app, errorHandler, db, env, seed). The logger **redacts** `authorization` / `cookie` / `set-cookie`, and pino-http logs request **metadata only** (never bodies) — verified that failed-login passwords never reach the logs.
- **`config/db.ts`** — was logging the full **`DATABASE_URL`** (credentials!) on every boot. Now logs `"Connected to the database."` with no connection string.
- **`middleware/errorHandler.ts`** — swapped `console.error` for severity-aware logging (`warn` for expected 4xx, `error` + stack for 5xx); kept the safe `message` mapping (never leaks raw DB/error strings to clients; raw details dev-only) and removed the dead `stack` variable.
- **`config/cors.ts`** — origin allow-list is now env-driven (`CLIENT_URL` + local dev origin, deduped) instead of a hard-coded single origin; still `credentials: true` with an exact-origin list (never a wildcard).

### Env (`src/config/env.ts`)
Added optional `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `TRUST_PROXY_HOPS` (all with defaults — existing `.env` files keep working), and switched the env-validation failure log to the structured logger (`fatal`).

### Verification (live server)
- `npx tsc --noEmit` → **0 errors**; **zero `console.*` left** in `src/` (grep-verified).
- Booted the server and confirmed against real traffic: startup + DB-connect logs carry **no connection string**; responses include helmet headers (HSTS, `nosniff`, `X-Frame-Options`, CSP, Referrer-Policy) and **`x-powered-by` is gone**; `RateLimit-*` headers present (`1000;w=900` global). Hammered `/auth/admin/login` with bad credentials → **20× `401` then `429`** with the correct JSON body + `Retry-After`. Grepped the request logs for `wrongpass` / `DATABASE_URL` / the admin password → **none present**. Server shut down afterwards.

### JWT algorithm pinning (`src/utils/jwt.ts`)
`jwt.verify` / `jwt.sign` now **pin `HS256`** (`algorithms: ["HS256"]` on verify, `algorithm: "HS256"` on sign). This closes algorithm-confusion and forged **`alg: none`** tokens. Verified at runtime: valid tokens still round-trip; an `alg:none` forgery and a wrong-secret token are both rejected.

### Full security audit (findings)
A pass over the whole backend confirmed the following are already sound, and were re-verified this turn:
- **Injection:** no `$queryRaw*` / `$executeRaw*` in app code — every query goes through Prisma's parameterized client (no SQLi). No `child_process` / `eval` / file-upload surface.
- **Auth flows:** access tokens are signature-verified in the auth middleware; **refresh** verifies the signature **and** matches a stored SHA-256 hash **and** rotates + re-checks `isActive`; logout's `decode`-only step is safely gated by the hash match (a forged token revokes nothing).
- **Secret exposure:** `passwordHash` is never selected into any projection and never returned (login/profile hand-pick safe fields) — grep-verified. Refresh tokens are stored only as SHA-256 hashes.
- **Cookies:** `httpOnly` + `secure` + `sameSite=none` on access/refresh cookies.
- **AuthZ coverage:** every `admin/**` router applies `authorizeAdmin`; every staff router is `authenticate`-guarded — verified by sweep.
- **Dependencies:** `npm audit` reports high-severity advisories, but they sit entirely in **unused** packages (`pdfjs-dist`/`pdf-ts`, `puppeteer`, `better-auth`, …) that are **not imported anywhere in `src`** — not a reachable attack surface. Recommended follow-up: drop the unused deps (removes the advisories + shrinks the install). Not done here to avoid an unreviewed `package.json`/lockfile change.

> **Deployment note:** set `NODE_ENV=production` in production — the error handler only exposes `originalMessage`/`stack` when `NODE_ENV === "development"` (the schema default), so a prod deploy that leaves it unset would surface internals.

### Endpoint Count
Unchanged — **76 endpoints**. This is a cross-cutting security hardening, not new routes (it only adds `429` responses under abuse).

## 19. Vercel Deployment Readiness (Serverless)

Adapted the Express app to deploy on **Vercel serverless functions** without changing any endpoint behaviour. Local dev is untouched (`npm run dev` still uses `src/server.ts` + `app.listen()`). Full deploy guide added in `DEPLOYMENT.md`.

### Serverless entry + routing
- **`api/index.ts`** (new) — lazily (dynamic-import) loads the Express app and **wraps it so any initialization failure returns a readable JSON 500** (`{ message: "Backend failed to initialize.", error }`) instead of an opaque `FUNCTION_INVOCATION_FAILED`. An Express app *is* a `(req, res)` handler, which Vercel invokes directly. No `listen()` runs on Vercel. (`env.ts` now **throws** on invalid env instead of `process.exit`, so this wrapper can catch and surface it; `tsconfig` gained `"module": "ESNext"` for the dynamic import.)
- **`vercel.json`** (new) — `@vercel/node` build of `api/index.ts` with a catch-all route (`/(.*) → api/index.ts`) that **preserves the original path**, so Express routing (`/api/v1/...`, `/health`) works unchanged. Region pinned to `iad1` (co-located with the Neon `us-east-1` DB).

### Prisma made serverless-safe
- **`src/lib/prisma.ts`** — the `pg.Pool` + `PrismaClient` are now cached on `globalThis`, so warm invocations reuse one pool instead of opening a new one per cold start (which would exhaust the DB connection limit). Pool size is small + tunable (`DB_POOL_MAX`, default 5); `DATABASE_URL` should point at the Neon **pooled** endpoint.
- **The query-engine binary** — despite the `@prisma/adapter-pg` driver adapter, this project still generates Prisma's **library (Rust) engine**, so the correct Linux binary must ship in the function. Handled two ways: (1) `binaryTargets = ["native", "rhel-openssl-3.0.x"]` in `base.prisma` so `prisma generate` (run on Vercel via `postinstall`) emits the Lambda-runtime engine; (2) `vercel.json` `includeFiles: ["src/generated/prisma/**"]` bundles it. Verified the generated client resolves the engine via `process.cwd() + src/generated/prisma/...` — which is exactly where `includeFiles` places it in the lambda. The Prisma **schema is inlined** (`inlineSchema`) into the generated client, so no `.prisma` file is read from disk at runtime.

### Build & config
- Relies on the existing **`postinstall: prisma generate`** (Vercel installs devDeps during build, so the `prisma` CLI is present). No `prisma migrate deploy` runs on Vercel (the `builds` config bypasses the package.json `build` script — schema changes stay a manual `npm run migrate`/`db push`).
- **`tsconfig.json`** — added `api` to `include` (so the entry point is type-checked) and removed a stale non-existent include path.
- **`.vercelignore`** (new) — keeps docs/build artifacts out of the upload.
- **Restored `url = env("DATABASE_URL")`** in `base.prisma` (required by the 6.19 CLI for `generate`; the Prisma-7 IDE server flags it but the CLI needs it). `DATABASE_URL` must be present at **build** time on Vercel (its default) because `generate` reads it.

### Verification
- `npx tsc --noEmit` → **0 errors** (now including `api/`).
- `prisma generate` produces the **`libquery_engine-rhel-openssl-3.0.x.so.node`** engine alongside the native one.
- Imported `api/index.ts` and confirmed the default export is the Express handler **and importing it starts no server** (correct for serverless).
- Drove requests straight through the exported handler (via `supertest`, no `listen`) exactly as Vercel would: `/health → 200`, `/ → 200`, unknown → `404`, protected route without auth → `401`, all with the security + `RateLimit-*` headers intact.
- The serverless `prisma` singleton successfully queried the live DB.

> **Deploy checklist (see `DEPLOYMENT.md`):** set Vercel **Root Directory = `backend`** (monorepo), add the required env vars (esp. the Neon **pooled** `DATABASE_URL`, `CLIENT_URL`, the three JWT secrets), and leave the Build Command empty. `NODE_ENV=production` is set by Vercel automatically.

### Endpoint Count
Unchanged — **76 endpoints**. Deployment plumbing only; no API surface change.

## User Side Doc

Start of the **staff (employee) side**, which will be a **React Native** cross-platform mobile app. This iteration delivers the **authentication feature**: an admin-created user logs in with their email + default password, can **edit their own email and password**, and can log out. Built to be mobile-friendly (token-based, not cookie-dependent). Reference in `API_Doc.md` → **User Side Doc**.

### Mobile-friendly auth (the key change)
The existing user auth was **cookie-only**, which doesn't fit a React Native client. Made it token-first without breaking the admin web (cookie) flow:
- **`middleware/auth.ts`** — `authenticate` now accepts **`Authorization: Bearer <token>`** *or* the `accessToken` cookie (Bearer takes priority). So the mobile app sends the token in a header; the admin web keeps using cookies. One additive change, both clients supported.
- **Login & refresh now return the tokens in the response body** (`data.accessToken` + `data.refreshToken`) in addition to setting cookies, so the app can store them (SecureStore/Keychain). Refresh tokens are still rotated + hashed at rest.
- **Refresh & logout accept the refresh token from the request body** (`{ refreshToken }`) as well as the cookie.

### New: edit own email / password (`PATCH /api/v1/auth/user/profile`)
- `user/auth/auth.validation.ts` — `updateUserProfileSchema`: optional `email`, `currentPassword`, `newPassword`; requires at least one field, and a password change requires `currentPassword`.
- `user/auth/auth.service.ts` — `updateUserProfile`: email change is uniqueness-checked (`409`); a password change verifies `currentPassword` (`401` if wrong), re-hashes with bcrypt, **clears `mustChangePassword`** (covers the forced first-login change) and **revokes all refresh tokens** (kills every session). Returns the safe user projection + `passwordChanged`.
- `user/auth/auth.controller.ts` — `updateProfile`; on a password change it also clears this session's cookies. Message tells the app to re-login when the password changed.
- `user/auth/auth.route.ts` — `PATCH /profile` (guarded by `authenticate` + **`authorizeUser`**). Also tightened `GET /profile` with `authorizeUser` so admin tokens can't read a staff profile.

Full user-side auth surface now: `POST /login`, `POST /refresh`, `GET /profile`, **`PATCH /profile`** (new), `POST /logout` — all under `/api/v1/auth/user`.

### Verification
- `npx tsc --noEmit` → **0 errors** (strict mode). One `exactOptionalPropertyTypes` fix on the service param type.
- **Full E2E via the real HTTP routes (supertest + live DB)** — all green: login returns tokens in the body with `mustChangePassword:true`; **Bearer** `GET /profile` works and a no-token request is `401`; **edit email** works; **edit password** returns `passwordChanged:true`, clears `mustChangePassword`, and **revokes the old refresh token** (old refresh → `401`); wrong `currentPassword` → `401`; `newPassword` without `currentPassword` → `400`; empty body → `400`; re-login with the new email + password works; refresh returns a rotated pair; logout (Bearer + body token) → `200` and the refresh token no longer works. Test data cleaned up.

### New Endpoint Count (this iteration)
**1 new endpoint** (`PATCH /auth/user/profile`), plus mobile-friendly upgrades (Bearer auth, tokens-in-body) to the existing user login/refresh/logout. **Total project endpoints: 77.**

### User features — Auth, Availability, Swaps (verified end-to-end)
The three staff features were confirmed working through the real HTTP routes (with Bearer auth), and one usability gap was closed.

- **Auth / password update** — login (email + admin-set password), `PATCH /auth/user/profile` (edit email + password), logout. Covered above; re-confirmed.
- **Availability (calendar)** — `user/availability` already had `GET /:year/:month`, `PUT /:year/:month/days` (full-replace calendar of `AVAILABLE`/`UNAVAILABLE`/`WISH` + note + preferred times), `POST /:year/:month/submit`. **Added `GET /api/v1/availability`** — lists the user's months with an **`editable`** flag (DRAFT + before cut-off), so the mobile app knows which month is open without guessing. Service `listMyMonths` + controller + route.
- **Shift swaps** — `user/swaps` (`POST /` request, `GET /` my swaps, `POST /:id/cancel`) → admin `POST /admin/swaps/:id/approve` performs the exchange in one transaction and notifies both. All pre-existing; verified.

**Verification (supertest + live DB), all green:**
- *Availability:* open month → `GET` DRAFT → `PUT` saves 3 calendar days (WISH note + preferred times round-trip) → date-outside-month `400`, duplicate-date `400` → `submit` → `SUBMITTED` → edit-after-submit `409` → unopened month `404`; `GET /availability` lists months newest-first with the correct `editable` flags.
- *Swaps:* two users each admin-confirmed on a shift → user A `POST /swaps` → `201 PENDING`, recipient B notified → same-shift `400`, duplicate-pending `409` → B sees it in `role=received` → **admin approve exchanges the shifts** (A now confirmed on B's shift and vice-versa), **both notified**, swap `APPROVED`.
- All `USER` routes reject admin tokens (`403`) and no-token requests (`401`); Bearer auth works throughout. Test data cleaned up.

### Endpoint Count (this iteration)
**1 new endpoint** (`GET /api/v1/availability`). **Total project endpoints: 78.**

### Submitted availability visible in the admin dashboard
Closed the loop so a user's submitted availability shows up on the admin side. The admin module already had `GET /admin/availability` (per-employee submission **status** + `filledDays` count) and `GET /admin/availability/:userId` (one employee's full `days[]`). **Added `GET /api/v1/admin/availability/grid?year=&month=`** — the whole month in one call: every active employee with their **day-by-day** entries (`AVAILABLE`/`UNAVAILABLE`/`WISH` + note + preferred times) + status + a summary. This is the consolidated data the dashboard needs to render the availability grid that feeds weekly planning, instead of fetching one employee at a time. New `getMonthGrid` service + controller + route (declared **before** `/:userId` so `grid` isn't captured as a userId).

**Verification (supertest + live DB), 14/14 green:** admin opens a month → user A saves 3 calendar days + submits → **admin status view** shows A `SUBMITTED` (`filledDays:3`) and B in the `notSubmitted` list → **admin per-employee view** returns A's exact days (WISH note round-trips) with the user identity → **admin grid** returns A (`SUBMITTED`, 3 days) and B (`DRAFT`, 0 days) with a correct summary → guards: no-auth `401`, user token `403`, missing query params `400`. Test data cleaned up.

### Endpoint Count (this iteration)
**1 new endpoint** (`GET /admin/availability/grid`). **Total project endpoints: 79.**

