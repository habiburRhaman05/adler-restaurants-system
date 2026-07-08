# 📖 Adler Restaurant Management System — API Documentation

**Base URL:** `http://localhost:8000/api/v1`

**Health check:** `GET http://localhost:8000/health` → `{ "status": "ok", "uptime": <sec>, "timestamp": "..." }`

**Status:** All 68 endpoints below are implemented and verified end-to-end (automated smoke test, all passing).

**Example request (cURL):** cookie-based auth — log in once to a cookie jar, then reuse it.
```bash
# 1. Log in (stores accessToken + refreshToken cookies in jar.txt)
curl -c jar.txt -X POST http://localhost:8000/api/v1/auth/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@adler.com","password":"Admin@123456"}'

# 2. Call a protected endpoint with the jar
curl -b jar.txt http://localhost:8000/api/v1/admin/overview
```
Browser clients instead use `fetch(url, { credentials: "include" })` so the cookies ride along automatically.

---

## Conventions

### Authentication
JWT tokens are issued as **HttpOnly cookies** on login — the client never handles the raw tokens.

| Cookie | Lifetime | Purpose |
|--------|----------|---------|
| `accessToken` | 60 min | Sent automatically on every request; identifies the caller |
| `refreshToken` | 2 days | Used only by the `/refresh` endpoints to mint a new pair |

- Cookies are `HttpOnly`, `Secure`, `SameSite=None`. Browser clients must send credentials (`fetch(..., { credentials: "include" })`); CLI clients use a cookie jar.
- There are **two principals**: `ADMIN` (webapp) and `USER` (staff / mobile app). A token carries a `role`, and routes are guarded accordingly.
- Refresh tokens are **rotated** on every refresh (old one revoked) and their SHA-256 hash is stored server-side.

### Roles & route guards
| Guard | Applies to | On failure |
|-------|-----------|------------|
| `authenticate` | any protected route | `401` if no/invalid `accessToken` |
| `authorizeAdmin` | all `/admin/**` routes | `403` if the caller is not an admin |
| `authorizeUser` | staff routes (`/shifts`, `/notifications`, `/swaps`, `/availability`) | `403` if the caller is not a staff user |

### Success response envelope
```json
{
  "success": true,
  "message": "Human readable message.",
  "data": { "...": "..." },
  "meta": { "timestamp": "2026-07-05T05:06:09.994Z", "pagination": { "...": "..." } }
}
```
`data` and `meta.pagination` are present only where relevant.

### Error response envelope
Two shapes exist:

**Validation errors** (from the request validator) → `400`:
```json
{
  "success": false,
  "errors": [
    { "code": "too_small", "minimum": 6, "path": ["password"], "message": "Password must be at least 6 characters" }
  ]
}
```

**Application/domain errors** (not found, conflict, auth, etc.):
```json
{
  "success": false,
  "message": "A user with this email already exists.",
  "errorDetails": { "originalMessage": "A user with this email already exists." },
  "stack": "… (development only)"
}
```
> `errorDetails.originalMessage` and `stack` are only populated when `NODE_ENV=development`.

### Common status codes
| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Validation failed / bad input |
| `401` | Not authenticated (missing/expired token) |
| `403` | Authenticated but not allowed (wrong role / not the owner) |
| `404` | Resource not found |
| `409` | Conflict (duplicate, invalid state transition, resource in use) |
| `429` | Too many requests (rate limited) |
| `500` | Server error |

### Rate limiting
Every response carries standard **`RateLimit-*`** headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`); exceeding a limit returns **`429`** with a `Retry-After` header and the standard error envelope.

| Scope | Window | Limit | Notes |
|-------|--------|-------|-------|
| Global (all `/api/v1/**`) | 15 min | 1000 / IP | health probe exempt |
| Auth (`/auth/*/login`, `/auth/*/refresh`) | 15 min | 20 / IP | **only failed attempts count** — successful sign-ins never count toward the limit, so a legitimate user is never locked out |

Limits are per client IP and tunable via env (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`). `429` body:
```json
{ "success": false, "message": "Too many attempts. Please wait a few minutes and try again.", "meta": { "timestamp": "…" } }
```

### Pagination
Most list endpoints use **offset** pagination — they accept `page` (default `1`) and `limit`, and return:
```json
"meta": { "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```
The **Employees** list (§4) instead uses **cursor (keyset)** pagination for stable, drift-free scrolling. It accepts `limit` + an opaque `cursor` and returns:
```json
"meta": { "pagination": { "limit": 10, "nextCursor": "Y21yN2s0b3B2MDAwMg", "hasNextPage": true } }
```
Fetch the first page without a cursor, then pass the returned `nextCursor` back as `?cursor=…` for each subsequent page. The end is reached when `hasNextPage` is `false` (and `nextCursor` is `null`). A malformed or stale cursor → `400`.

### Project structure
The backend is organized **one folder per feature**, each folder self-contained with its `route`, `controller`, `service`, and `validation` files:
```
src/
├── modules/
│   ├── admin/                      # admin webapp features
│   │   ├── auth/                   # login, refresh, logout, profile (GET/PATCH)
│   │   ├── overview/               # dashboard stat tiles
│   │   ├── employees/              # staff CRUD  (mounted at /admin/users)
│   │   ├── categories/             # roles + sub-categories
│   │   ├── shifts/                 # shift offers, notify, approvals
│   │   ├── swaps/                  # swap review (approve / reject)
│   │   ├── reports/                # hours & wage reports + CSV
│   │   ├── settings/               # org L-GAV rules + notification prefs
│   │   └── availability/           # open month, status, nudge
│   └── user/                       # staff (mobile) features
│       ├── auth/                   # login, refresh, logout, profile
│       ├── shifts/                 # view + accept / decline shifts
│       ├── notifications/          # list + mark read
│       ├── swaps/                  # request / list / cancel swaps
│       └── availability/           # get / save days / submit
├── middleware/  (auth, validateRequest, errorHandler, notFound)
├── routes/index.route.ts           # mounts every feature router
├── config/  ·  utils/  ·  generated/prisma/
└── server.ts
```
Each file's role: **`*.route.ts`** wires paths + guards + validation → **`*.controller.ts`** (HTTP in/out) → **`*.service.ts`** (business logic + Prisma) with **`*.validation.ts`** (Zod schemas + inferred types).

---

## Table of Contents
1. [Authentication — Admin](#1-authentication--admin)
2. [Authentication — Staff (User)](#2-authentication--staff-user)
3. [Admin — Overview](#3-admin--overview)
4. [Admin — Employees](#4-admin--employees)
5. [Admin — Categories](#5-admin--categories)
6. [Admin — Shifts](#6-admin--shifts)
7. [Admin — Shift Approvals](#7-admin--shift-approvals)
8. [Admin — Shift Swaps](#8-admin--shift-swaps)
9. [Admin — Workload](#9-admin--workload)
10. [Admin — Demands](#10-admin--demands)
11. [Admin — Reports](#11-admin--reports)
12. [Admin — Settings](#12-admin--settings)
13. [Admin — Availability](#13-admin--availability)
14. [Staff — Shifts](#14-staff--shifts)
15. [Staff — Notifications](#15-staff--notifications)
16. [Staff — Shift Swaps](#16-staff--shift-swaps)
17. [Staff — Availability](#17-staff--availability)
18. [Enum Reference](#18-enum-reference)
19. [Seed Script](#19-seed-script)
- 📱 [User Side Doc](#user-side-doc) — staff / React Native mobile API

---

## 1. Authentication — Admin

### `POST http://localhost:8000/api/v1/auth/admin/login`  · public
Body:
```json
{ "email": "admin@adler.com", "password": "Admin@123456" }
```
| Field | Type | Rules |
|-------|------|-------|
| `email` | string | valid email |
| `password` | string | min 6 chars |

`200` — sets `accessToken` + `refreshToken` cookies:
```json
{ "success": true, "message": "Admin logged in successfully.",
  "data": { "admin": { "id": "…", "email": "admin@adler.com", "firstName": "Adler", "lastName": "Admin" } } }
```
Errors: `400` invalid body · `401` wrong credentials · `403` deactivated admin.

### `POST http://localhost:8000/api/v1/auth/admin/refresh`  · public (needs `refreshToken` cookie)
Rotates the token pair. `200` sets new cookies. `401` if the refresh token is missing/expired/revoked.

### `POST http://localhost:8000/api/v1/auth/admin/logout`  · authenticated
Revokes the current refresh token and clears cookies. `200`.

### `GET http://localhost:8000/api/v1/auth/admin/profile`  · admin
```json
{ "success": true, "data": { "admin": { "id": "…", "email": "…", "name": "Martin Keller", "firstName": "…", "lastName": "…", "isActive": true, "lastLoginAt": "…", "createdAt": "…", "updatedAt": "…" } } }
```

### `PATCH http://localhost:8000/api/v1/auth/admin/profile`  · admin — update own account
Backs the **Settings → Profile** form. Any subset of the fields below (at least one).
```json
{ "name": "Martin Keller", "email": "martin@adler.ch", "currentPassword": "Admin@123456", "newPassword": "NewPass@123" }
```
| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 1–120 chars |
| `firstName`, `lastName` | string | ≤ 80 chars |
| `email` | string | valid email, unique across admins (`409`) |
| `currentPassword` | string | required **only** when changing the password |
| `newPassword` | string | min 8 chars; **requires** `currentPassword` |

- A password change is **all-or-nothing**: supplying only one of `currentPassword`/`newPassword` → `400`. A wrong `currentPassword` → `401`.
- On a successful **password change**, all of the admin's refresh tokens are revoked and this session's cookies are cleared — the client must log in again with the new password.

`200`:
```json
{ "success": true, "message": "Profile updated successfully.",
  "data": { "admin": { "id": "…", "name": "Martin Keller", "email": "martin@adler.ch", … }, "passwordChanged": false } }
```
When `passwordChanged` is `true` the message is *"Profile updated. Please log in again with your new password."*

---

## 2. Authentication — Staff (User)

Staff accounts are **created by an admin** (§4). There is no self-signup; staff log in with the email + password the admin set.

> 📱 **The staff/mobile (React Native) auth flow — Bearer tokens, tokens-in-body, and the edit-email/password endpoint — is documented in full under [User Side Doc](#user-side-doc).**

### `POST http://localhost:8000/api/v1/auth/user/login`  · public
Body: `{ "email": "anna@adler.ch", "password": "Pass@123" }`

`200` — sets cookies:
```json
{ "success": true, "message": "User logged in successfully.",
  "data": { "user": { "id": "…", "email": "…", "firstName": null, "lastName": null, "mustChangePassword": true } } }
```
`401` wrong credentials · `403` deactivated account.

### `POST http://localhost:8000/api/v1/auth/user/refresh`  · public (needs `refreshToken` cookie)
### `POST http://localhost:8000/api/v1/auth/user/logout`  · authenticated
### `GET http://localhost:8000/api/v1/auth/user/profile`  · authenticated
Returns the caller's full profile (contract, rate, contact — no password hash).

---

## 3. Admin — Overview

### `GET http://localhost:8000/api/v1/admin/overview`  · admin
Dashboard stat tiles.
```json
{
  "success": true,
  "data": {
    "employees": { "active": 11, "inactive": 1, "total": 12 },
    "categories": { "total": 6, "subCategories": 3 },
    "shifts": { "draft": 2, "upcoming": 5, "awaitingApproval": 1 },
    "approvals": { "pendingResponses": 3 },
    "swaps": { "pending": 3 },
    "thisMonth": { "period": { "year": 2026, "month": 7 }, "scheduledHours": 1842, "overtime": 46, "hoursDue": 24, "wageCost": 39260 },
    "availability": {
      "year": 2026, "month": 12, "submitted": 9, "total": 12,
      "notSubmitted": [ { "id": "…", "name": "Marco Bianchi", "email": "marco@adler.ch" } ]
    }
  }
}
```
- `shifts.draft` = shifts not yet notified · `upcoming` = notified & not ended · `awaitingApproval` = notified shifts with ≥1 pending acceptance.
- `thisMonth` is computed from admin-approved shifts in the current month (same engine as Reports).
- `availability` summarizes the **most recently opened** availability month (`null` if none opened): `submitted` / `total` and up to 20 employees who haven't submitted (the Overview "Not submitted yet · Nudge" list).

---

## 4. Admin — Employees
Base path `/admin/users`. All routes are admin-guarded.

### `POST http://localhost:8000/api/v1/admin/users`  · create employee
```json
{
  "email": "anna@adler.ch",
  "password": "Pass@123",
  "name": "Anna Müller",
  "phone": "+41790000001",
  "address": "Bahnhofstrasse 1",
  "department": "Service",
  "designation": "Head Waiter",
  "employeeType": "FULL_TIME",
  "isActive": true,
  "contractType": "MONTHLY_SALARY",
  "workloadPercent": 100,
  "hourlyRate": 28,
  "monthlySalary": 4600,
  "contractedHoursMonthly": 168,
  "hireDate": "2026-01-15T00:00:00.000Z",
  "categoryIds": ["<categoryId>", "…"]
}
```
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `email` | string | ✅ | valid email, unique |
| `password` | string | ✅ | min 6 |
| `name` | string | — | |
| `phone`, `address`, `department`, `designation` | string | — | |
| `employeeType` | enum | — | `FULL_TIME` \| `PART_TIME` |
| `isActive` | boolean | — | default `true` |
| `contractType` | enum | — | `HOURLY` \| `MONTHLY_SALARY` \| `WORKLOAD_PERCENT` |
| `workloadPercent` | number | — | 0–100 |
| `hourlyRate`, `monthlySalary`, `contractedHoursMonthly` | number | — | ≥ 0 |
| `hireDate` | string | — | ISO 8601 |
| `categoryIds` | string[] | — | must all exist (`400` otherwise) |

`201`:
```json
{ "success": true, "message": "User created successfully.",
  "data": { "user": { "id": "…", "email": "…", "name": "Anna Müller", "phone": "…", "address": "…",
    "department": "…", "designation": "…", "employeeType": "FULL_TIME", "contractType": "MONTHLY_SALARY",
    "workloadPercent": "100", "hourlyRate": "28", "monthlySalary": "4600", "contractedHoursMonthly": "168",
    "hireDate": "…", "isActive": true, "mustChangePassword": true, "createdAt": "…", "updatedAt": "…",
    "categories": [ { "id": "…", "name": "Service", "parentId": null } ] } } }
```
> Decimal fields (`hourlyRate`, `monthlySalary`, `workloadPercent`, …) are serialized as **strings**.

Errors: `400` invalid / unknown category · `409` duplicate email.

### `GET http://localhost:8000/api/v1/admin/users`  · list employees · **cursor pagination**
Uses **cursor (keyset)** pagination — the list is ordered **newest-first** (`createdAt`, then `id` as a unique tiebreaker), so rows are never skipped or repeated even as employees are added/removed between page loads.

Query:
| Param | Rules |
|-------|-------|
| `limit` | int 1–100 (default 10) — page size |
| `cursor` | opaque token from the previous page's `nextCursor`; omit for the first page. Malformed/stale → `400` |
| `isActive` | `true` / `false` |
| `search` | matches name / email / firstName / lastName / department / designation |
| `categoryId` | employees assigned to this category |

```json
{ "success": true, "data": {
    "users": [ { "id": "…", "email": "…", "name": "Anna Müller", "phone": "…", "department": "…",
      "designation": "…", "employeeType": "FULL_TIME", "contractType": "MONTHLY_SALARY",
      "workloadPercent": "100", "hourlyRate": "28", "monthlySalary": "4600", "isActive": true,
      "lastLoginAt": "…", "hireDate": "…", "createdAt": "…",
      "categories": [ { "id": "…", "name": "Service", "parentId": null } ] } ],
    "counts": { "active": 11, "inactive": 1 } },
  "meta": { "pagination": { "limit": 10, "nextCursor": "Y21yN2s0b3B2MDAwMg", "hasNextPage": true } } }
```
- **Paging:** repeat the request with `?cursor=<nextCursor>` until `hasNextPage` is `false` (then `nextCursor` is `null`). `cursor` composes with `limit`/`isActive`/`search`/`categoryId` — keep the filters identical across pages.
- `counts` reflects the same filters **except** `isActive`, so it always shows the full active/inactive split ("11 active · 1 inactive") and doubles as the total tally.

### `GET http://localhost:8000/api/v1/admin/users/:userId`  · get one
Full profile incl. `categories`. `404` if not found.

### `PATCH http://localhost:8000/api/v1/admin/users/:userId`  · update
Accepts any subset of the create fields, plus `mustChangePassword` (boolean). Notes:
- `password` (min 6) re-hashes the password.
- `isActive` toggles status **and** keeps `deactivatedAt` consistent (set when going inactive, cleared when reactivated).
- `categoryIds` **fully replaces** the employee's category set.
- `email` change is uniqueness-checked (`409`).

`200` → `{ "data": { "user": { …, "categories": [...] } } }`

### `DELETE http://localhost:8000/api/v1/admin/users/:userId`  · hard delete
`200` `{ "message": "User deleted successfully." }` · `404` if not found.

### `PATCH http://localhost:8000/api/v1/admin/users/:userId/deactivate`
Sets inactive, stamps `deactivatedAt`, and **revokes all the user's refresh tokens** (immediate logout). `400` if already inactive.

### `PATCH http://localhost:8000/api/v1/admin/users/:userId/activate`
Reactivates. `400` if already active.

---

## 5. Admin — Categories
Base path `/admin/categories`. Categories are the work roles (Service, Kitchen, Bar…). Kitchen-style parents may have one level of **sub-categories** (Grill, Prep…).

### `POST http://localhost:8000/api/v1/admin/categories`  · create category or sub-category
```json
{ "name": "Service", "isActive": true, "parentId": "<parentCategoryId?>" }
```
- Omit `parentId` for a top-level category; provide it to create a sub-category.
- Duplicate names are rejected **per parent** (`409`). Nesting deeper than one level → `409`.

`201` → `{ "data": { "category": { "id": "…", "name": "Service", "parentId": null, "isActive": true, "createdAt": "…", "updatedAt": "…" } } }`

### `POST http://localhost:8000/api/v1/admin/categories/:categoryId/subcategories`  · add sub-category (convenience)
Body: `{ "name": "Grill" }`. Same rules as above; `404` if the parent doesn't exist, `409` if the parent is itself a sub-category or the name duplicates a sibling.

### `GET http://localhost:8000/api/v1/admin/categories`  · flat list (top-level)
Query: `page`, `limit` (default 50), `isActive`, `search`. Each row includes `_count.shiftOffers`.

### `GET http://localhost:8000/api/v1/admin/categories/tree`  · full tree with counts
```json
{ "success": true, "data": { "categories": [
    { "id": "…", "name": "Kitchen", "isActive": true, "createdAt": "…",
      "qualifiedCount": 4, "subCategoryCount": 2,
      "children": [ { "id": "…", "name": "Grill", "isActive": true, "qualifiedCount": 0 } ] },
    { "id": "…", "name": "Service", "qualifiedCount": 6, "subCategoryCount": 0, "children": [] }
  ] } }
```
`qualifiedCount` = number of employees assigned to that exact category.

### `GET http://localhost:8000/api/v1/admin/categories/:categoryId`  · get one · `404` if missing
### `PATCH http://localhost:8000/api/v1/admin/categories/:categoryId`  · body `{ "name"?, "isActive"? }` · `409` on duplicate sibling name
### `DELETE http://localhost:8000/api/v1/admin/categories/:categoryId`  · **force delete**
Always deletes the category (`200`). Everything tied to it — and to its sub-categories — is removed in one transaction: day-level Demands, Workload staffing demands, shift offers (their responses + swaps cascade), roster shifts, and employee assignments; sub-categories are deleted too. `404` if not found. **This is destructive** — deactivate (`PATCH isActive:false`) instead if you only want to hide it.

---

## 6. Admin — Shifts
Base path `/admin/shifts`. A **shift** is an open offer that gets broadcast to staff, who accept it; the admin then confirms (approves) who works it (§7).

### `POST http://localhost:8000/api/v1/admin/shifts`  · create (draft)
```json
{
  "jobTitle": "Evening Waiter",
  "categoryId": "<categoryId>",
  "startTime": "2026-11-14T16:00:00.000Z",
  "endTime": "2026-11-14T22:00:00.000Z",
  "hourlyPrice": 28.5,
  "description": "Busy Friday service"
}
```
| Field | Required | Rules |
|-------|----------|-------|
| `jobTitle` | ✅ | 1–150 chars |
| `categoryId` | ✅ | must exist & be active (`404`/`409`) |
| `startTime`, `endTime` | ✅ | ISO 8601; `endTime` **must be after** `startTime` (`400`) |
| `hourlyPrice` | ✅ | ≥ 0 |
| `description` | — | ≤ 2000 chars |

`201` → the shift with `notifiedAt: null` (draft, not yet visible to staff), `category`, `createdById`.

### `GET http://localhost:8000/api/v1/admin/shifts`  · list
Query: `page`, `limit` (default 20), `categoryId`, `notified` (`true`/`false`), `upcoming` (`true`/`false`). Each shift carries roll-up counts:
```json
{ "acceptedCount": 2, "approvedCount": 1, "pendingApprovalCount": 1, "rejectedByAdminCount": 0, "declinedCount": 0 }
```

### `GET http://localhost:8000/api/v1/admin/shifts/:shiftId`  · get one (same count fields) · `404` if missing
### `PATCH http://localhost:8000/api/v1/admin/shifts/:shiftId`  · update
Any subset of create fields. Time bounds are re-checked even on a partial edit (`400` if the resulting `endTime ≤ startTime`).

### `DELETE http://localhost:8000/api/v1/admin/shifts/:shiftId`  · `200` (responses & swaps cascade)

### `POST http://localhost:8000/api/v1/admin/shifts/:shiftId/notify`  · one-click publish
Sends an in-app notification to **every active employee** and stamps `notifiedAt` (making the shift visible to staff). Idempotent-ish: re-notifying re-sends.
```json
{ "success": true, "message": "Notification sent to 12 employee(s).",
  "data": { "shift": { …, "notifiedAt": "…" }, "notifiedCount": 12 } }
```
`409` if there are no active employees.

---

## 7. Admin — Shift Approvals
The accept-then-confirm flow. Staff **accept** a published shift (§14); the admin then **approves** who actually works it. Only approved responses count as "available/confirmed workers".

### `GET http://localhost:8000/api/v1/admin/shifts/approvals`  · feed
Query: `page`, `limit`, `pendingOnly` (`true`/`false`). Returns published shifts that have volunteers.
```json
{ "success": true, "data": { "shifts": [
    { "id": "…", "jobTitle": "Evening Waiter", "startTime": "…", "endTime": "…", "hourlyPrice": "28",
      "category": { "id": "…", "name": "Service" },
      "acceptedCount": 2, "approvedCount": 0, "pendingApprovalCount": 2, "rejectedByAdminCount": 0,
      "declinedCount": 0, "available": 0,
      "volunteers": [
        { "id": "<responseId>", "status": "ACCEPTED", "approvalStatus": "PENDING", "respondedAt": "…",
          "approvedAt": null, "approvalNote": null,
          "user": { "id": "…", "name": "Anna Müller", "email": "…", "phone": "…",
                    "department": "Service", "designation": "Head Waiter", "employeeType": "FULL_TIME" } }
      ] } ] },
  "meta": { "pagination": { … } } }
```

### `GET http://localhost:8000/api/v1/admin/shifts/:shiftId/responses`  · who responded + counts
```json
{ "success": true, "data": {
    "shift": { … },
    "accepted": [ { "id": "<responseId>", "status": "ACCEPTED", "approvalStatus": "APPROVED", "respondedAt": "…",
                    "approvedAt": "…", "approvalNote": null, "user": { … } } ],
    "declined": [ { … "status": "REJECTED" } ],
    "counts": { "acceptedCount": 2, "approvedCount": 1, "pendingApprovalCount": 0,
                "rejectedByAdminCount": 1, "declinedCount": 0, "total": 2, "available": 1 } } }
```
`counts.available` (= `approvedCount`) answers "how many workers are available for this shift".

### `POST http://localhost:8000/api/v1/admin/shifts/:shiftId/responses/:responseId/approve`  · confirm an employee
Sets the response to `APPROVED`, records the admin, and sends the employee a **"Shift confirmed"** notification (updates their mobile status).
`200` → `{ "data": { "response": { …, "approvalStatus": "APPROVED", "approvedAt": "…" } } }`
Errors: `404` response not on this shift · `409` if the response is not `ACCEPTED`.

### `POST http://localhost:8000/api/v1/admin/shifts/:shiftId/responses/:responseId/reject`  · don't assign
Body (optional): `{ "note": "Enough coverage" }`. Sets `REJECTED`, notifies the employee. Same guards.

---

## 8. Admin — Shift Swaps
Employees request to swap their **confirmed** shifts (§16); the admin approves or rejects. Approval performs the exchange atomically.

### `GET http://localhost:8000/api/v1/admin/swaps`  · list
Query: `page`, `limit`, `status` (`PENDING` \| `APPROVED` \| `REJECTED` \| `CANCELLED`). Each **pending** swap carries a lightweight L-GAV `ruleCheck`.
```json
{ "success": true, "data": { "swaps": [
    { "id": "…", "status": "PENDING", "reason": "Doctor appointment", "adminNote": null, "reviewedAt": null,
      "createdAt": "…", "updatedAt": "…",
      "initiatorUser": { "id": "…", "name": "Anna Müller", "firstName": null, "lastName": null, "email": "…" },
      "recipientUser": { "id": "…", "name": "Luca Rossi", … },
      "initiatorShift": { "id": "…", "jobTitle": "Lunch Service", "startTime": "…", "endTime": "…", "category": { "id": "…", "name": "Service" } },
      "recipientShift": { "id": "…", "jobTitle": "Dinner Service", … },
      "ruleCheck": { "passed": true, "violations": [] } } ] },
  "meta": { "pagination": { … } } }
```
`ruleCheck` example on failure: `{ "passed": false, "violations": ["Would exceed 50h weekly max for Luca Rossi"] }`. It is **advisory** — the admin may still approve. `ruleCheck` is `null` for non-pending swaps.

### `POST http://localhost:8000/api/v1/admin/swaps/:swapId/approve`  · approve & exchange
Body (optional): `{ "note": "OK, covered" }`. In one transaction: re-verifies both employees still hold their confirmed shifts, exchanges the two confirmed assignments, sets the swap `APPROVED`, and notifies **both** employees.
`200` → `{ "data": { "swap": { …, "status": "APPROVED" } } }`
Errors: `404` not found · `409` not pending, or a shift is no longer confirmed for its employee.

### `POST http://localhost:8000/api/v1/admin/swaps/:swapId/reject`
Body (optional): `{ "note": "…" }`. Sets `REJECTED`, notifies both; shifts unchanged. `409` if not pending.

---

## 9. Admin — Workload
Base path `/admin/workload`. The **Workload** page is where the admin plans **how many people each category needs for each shift**, week by week, then uploads (publishes) it. A workload **week** is a `WeeklyPlan`; its rows are **staffing demands** (`StaffingDemand`) — one per *category + day + time slot* carrying a `requiredCount`. Demands are **connected to the shifts the admin creates** (§6, `ShiftOffer`): every demand reports how many of its required workers are already covered.

> Built on the pre-existing `WeeklyPlan` / `StaffingDemand` models — **no schema change**. (The auto-roster constraint-solver on top of this remains deferred; this feature delivers demand entry, per-category headcount, week management, and the shift-coverage view.)

### Shift ⇄ workload connection
A shift the admin created (`ShiftOffer`) **fulfils** a demand when it shares the **category**, falls on the **same calendar day**, and **overlaps** the demand's time slot. "Filled" headcount = admin-**APPROVED** workers across those shifts. Every demand is returned annotated:
```json
"fulfillment": { "requiredCount": 3, "filledCount": 1, "pendingCount": 0, "openCount": 2, "status": "PARTIAL" },
"connectedShifts": [ { "id": "…", "jobTitle": "Evening Waiter", "startTime": "…", "endTime": "…",
                      "notified": true, "approvedCount": 1, "pendingCount": 0 } ]
```
`fulfillment.status` = `OPEN` (0 filled) · `PARTIAL` (some) · `MET` (filled ≥ required).

### `POST http://localhost:8000/api/v1/admin/workload/weeks`  · create a workload week
```json
{ "weekStartDate": "2026-11-02", "weekNumber": 45 }
```
| Field | Required | Rules |
|-------|----------|-------|
| `weekStartDate` | ✅ | a date (or ISO date-time) — the week's first day. `year`, `month`, and `weekEndDate` (+6 days) are derived from it |
| `weekNumber` | — | int 1–53; defaults to the **ISO week number** of `weekStartDate` |

`201`:
```json
{ "success": true, "message": "Workload week created successfully.",
  "data": { "week": { "id": "…", "year": 2026, "month": 11, "weekNumber": 45,
    "weekStartDate": "2026-11-02T00:00:00.000Z", "weekEndDate": "2026-11-08T00:00:00.000Z",
    "status": "DRAFT", "submittedAt": null, "needsRenotify": false, "createdAt": "…", "updatedAt": "…" } } }
```
`409` if a week with the same `year` + `month` + `weekNumber` already exists.

### `GET http://localhost:8000/api/v1/admin/workload/weeks`  · list weeks
Query: `page`, `limit` (default 20), `year`, `month`, `status` (`DRAFT` \| `SUBMITTED` \| `PUBLISHED`). Each row adds `demandCount` and `totalRequired`.
```json
{ "success": true, "data": { "weeks": [
    { "id": "…", "year": 2026, "month": 11, "weekNumber": 45, "status": "DRAFT",
      "weekStartDate": "…", "weekEndDate": "…", "demandCount": 4, "totalRequired": 11, … } ] },
  "meta": { "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } } }
```

### `GET http://localhost:8000/api/v1/admin/workload/weeks/:planId`  · one week (full, with fulfillment)
Returns the week, all its demands (each annotated with `fulfillment` + `connectedShifts`), the same demands **grouped by category**, and week `totals`.
```json
{ "success": true, "data": {
    "week": { "id": "…", "weekNumber": 45, "status": "DRAFT", … },
    "totals": { "demandCount": 1, "totalRequired": 2, "totalFilled": 1, "totalOpen": 1 },
    "categories": [
      { "category": { "id": "…", "name": "Service" }, "totalRequired": 2, "totalFilled": 1,
        "demands": [
          { "id": "…", "weeklyPlanId": "…", "date": "2026-11-03", "categoryId": "…", "requiredCount": 2,
            "startTime": "2026-11-03T11:00:00.000Z", "endTime": "2026-11-03T15:00:00.000Z", "note": "lunch service",
            "category": { "id": "…", "name": "Service" },
            "fulfillment": { "requiredCount": 2, "filledCount": 1, "pendingCount": 0, "openCount": 1, "status": "PARTIAL" },
            "connectedShifts": [ { "id": "…", "jobTitle": "Evening Waiter", "startTime": "…", "endTime": "…", "notified": true, "approvedCount": 1, "pendingCount": 0 } ] } ] } ],
    "demands": [ "… the same demand objects, flat …" ] } }
```
`404` if the week doesn't exist.

### `PATCH http://localhost:8000/api/v1/admin/workload/weeks/:planId`  · update week
Body — any subset: `{ "status": "SUBMITTED", "needsRenotify": true }`. `status` is `DRAFT` \| `SUBMITTED` \| `PUBLISHED`; setting `SUBMITTED` stamps `submittedAt`. `200` → the week. `404` if not found.

### `POST http://localhost:8000/api/v1/admin/workload/weeks/:planId/publish`  · upload (publish) the workload
Sets `status = PUBLISHED`. `200` → the week. `409` if the week has **no demands** ("Cannot upload an empty workload…"). `404` if not found.

### `DELETE http://localhost:8000/api/v1/admin/workload/weeks/:planId`
`200` `{ "message": "Workload week deleted successfully." }` (its demands cascade). `404` if not found.

### `POST http://localhost:8000/api/v1/admin/workload/weeks/:planId/demands`  · add a demand
```json
{ "date": "2026-11-03", "categoryId": "<categoryId>", "requiredCount": 2,
  "startTime": "2026-11-03T11:00:00.000Z", "endTime": "2026-11-03T15:00:00.000Z", "note": "lunch service" }
```
| Field | Required | Rules |
|-------|----------|-------|
| `date` | ✅ | a date (or ISO date-time) — the day the demand is for |
| `categoryId` | ✅ | must exist & be active (`404`/`409`) |
| `requiredCount` | ✅ | int 1–1000 (people needed) |
| `startTime`, `endTime` | ✅ | ISO 8601; `endTime` **after** `startTime` (`400`) |
| `note` | — | ≤ 1000 chars |

`201` → `{ "data": { "demand": { … } } }`. `409` if a demand for the **same category + start time on that day** already exists (unique per `[week, date, category, startTime]`).

### `POST http://localhost:8000/api/v1/admin/workload/weeks/:planId/demands/bulk`  · bulk upload demands
Upload many rows at once. Body: `{ "demands": [ { …same fields as "add a demand"… }, … ] }` — 1–500 items, each requiring `endTime > startTime`. Rows that duplicate an existing `[week, date, category, startTime]` are **skipped** (not errored).
`201` → `{ "data": { "createdCount": 7, "skippedCount": 1 } }`. `409` if any `categoryId` doesn't exist / is inactive.

### `PATCH http://localhost:8000/api/v1/admin/workload/demands/:demandId`  · edit a demand
Any subset of the demand fields. Time bounds are re-checked on partial edits (`400` if the resulting `endTime ≤ startTime`). `200` → the demand. `404` if not found.

### `DELETE http://localhost:8000/api/v1/admin/workload/demands/:demandId`
`200` `{ "message": "Staffing demand deleted successfully." }`. `404` if not found.

### `GET http://localhost:8000/api/v1/admin/workload`  · sort by day / week / month
The main **sortable view** — returns every demand whose `date` falls in the chosen window, annotated with `fulfillment` + `connectedShifts` and grouped by category.
| Query | Rules |
|-------|-------|
| `view` | `day` \| `week` \| `month` (default `week`) |
| `date` | ✅ reference date (any day inside the target period) |
| `categoryId` | — filter to a single category |

For `week` the window is the **Monday-based** week containing `date`; for `month` it's the calendar month.
```json
{ "success": true, "data": {
    "view": "week", "range": { "start": "2026-11-02", "end": "2026-11-08" },
    "totals": { "demandCount": 4, "totalRequired": 11, "totalFilled": 3, "totalOpen": 8 },
    "categories": [ { "category": { "id": "…", "name": "Service" }, "totalRequired": 6, "totalFilled": 2, "demands": [ … ] } ],
    "demands": [ "… annotated demand objects, flat, ordered by date then startTime …" ] } }
```

---

## 10. Admin — Demands
Base path `/admin/demands`. The **Weekly demand** page is where the admin plans **how many employees each category needs on each day**, one **Sunday–Saturday** week at a time, then saves and publishes it. The current week shows first, upcoming weeks below — each an editable **category × day** grid.

> **Model:** a `DemandWeek` (one row per Sunday) holds `DayDemand` cells — a required headcount per **(category, day)** (`@@unique([demandWeekId, categoryId, date])`). Grid **rows are the admin's active categories** (§5): every active category gets a row and each of the 7 days a cell (defaulting to `0`). This day-level grid is intentionally distinct from the shift-slot `StaffingDemand` / Workload (§9).

### Week shape (returned by the grid endpoints)
```json
{ "id": "…", "weekStartDate": "2026-07-05", "weekEndDate": "2026-07-11",
  "status": "DRAFT", "publishedAt": null, "relative": "current",
  "days": ["2026-07-05","2026-07-06","2026-07-07","2026-07-08","2026-07-09","2026-07-10","2026-07-11"],
  "categories": [
    { "category": { "id": "…", "name": "Vegetables" },
      "cells": [ { "date": "2026-07-05", "requiredCount": 12, "demandId": "…" },
                 { "date": "2026-07-06", "requiredCount": 13, "demandId": "…" }, "… 5 more, one per day …" ] } ] }
```
`relative` is `current` / `upcoming` / `past` (vs. today's week). An unsaved cell returns `requiredCount: 0` and `demandId: null`.

### `GET http://localhost:8000/api/v1/admin/demands`  · grid view (sortable)
| Query | Rules |
|-------|-------|
| `scope` | `week` \| `month` \| `upcoming` (default `upcoming`) |
| `date` | reference date (any day); defaults to today |

- `week` → the single Sun–Sat week containing `date`.
- `month` → every week whose Sunday falls in `date`'s calendar month.
- `upcoming` (default) → the **current week first, then all future weeks**.
```json
{ "success": true, "data": {
    "scope": "upcoming",
    "today": "2026-07-06",
    "currentWeek": { "weekStartDate": "2026-07-05", "weekEndDate": "2026-07-11" },
    "weeks": [ { "… week shape …": "…" } ] } }
```
`currentWeek` is always returned (computed from today) so the UI can render/offer the current week even when no plan exists for it yet.

### `GET http://localhost:8000/api/v1/admin/demands/weeks`  · list week plans (lightweight)
Newest-first, no grid — powers the modal's "Start from week's data" dropdown.
```json
{ "success": true, "data": { "weeks": [
    { "id": "…", "weekStartDate": "2026-07-12", "weekEndDate": "2026-07-18",
      "status": "DRAFT", "publishedAt": null, "demandCount": 14, "relative": "upcoming" } ] } }
```

### `POST http://localhost:8000/api/v1/admin/demands/weeks`  · create a week plan
```json
{ "weekStartDate": "2026-07-19", "copyFromWeekId": "<existing weekId?>" }
```
| Field | Required | Rules |
|-------|----------|-------|
| `weekStartDate` | ✅ | any day in the target week — the server **snaps it to that week's Sunday** and sets `weekEndDate` to the Saturday |
| `copyFromWeekId` | — | seed the new week from an existing one; each source cell is remapped **day-for-day** (same weekday) into the new week |

`201` → `{ "data": { "week": { "… week shape (incl. any copied cells) …": "…" } } }`. `409` if a plan already exists for that week; `404` if `copyFromWeekId` doesn't exist.

### `GET http://localhost:8000/api/v1/admin/demands/weeks/:weekId`  · one week (full grid) · `404` if missing

### `PUT http://localhost:8000/api/v1/admin/demands/weeks/:weekId`  · save the whole grid
The per-week **Save** button. Upserts every provided cell; cells you omit keep their current value.
```json
{ "demands": [
  { "categoryId": "…", "date": "2026-07-05", "requiredCount": 12 },
  { "categoryId": "…", "date": "2026-07-06", "requiredCount": 13 } ] }
```
| Field (per cell) | Rules |
|------------------|-------|
| `categoryId` | must exist (`400` otherwise) |
| `date` | must be one of the week's 7 days (`400` if outside) |
| `requiredCount` | int 0–1000 |

1–700 cells per call. `200` → `{ "data": { "week": { "… updated grid …": "…" } } }`. `404` if the week is missing.

### `PUT http://localhost:8000/api/v1/admin/demands/weeks/:weekId/cell`  · update a single cell (stepper)
Backs the −/+ steppers. Body: `{ "categoryId": "…", "date": "2026-07-05", "requiredCount": 20 }` (same validation as above).
`200` → `{ "data": { "demand": { "id": "…", "categoryId": "…", "date": "2026-07-05", "requiredCount": 20 } } }`

### `POST http://localhost:8000/api/v1/admin/demands/weeks/:weekId/publish`  · publish
Sets `status = PUBLISHED` and stamps `publishedAt`. `200` → `{ "data": { "week": { "…": "…", "status": "PUBLISHED" } } }`. `404` if missing.

### `DELETE http://localhost:8000/api/v1/admin/demands/weeks/:weekId`  · `200` (cells cascade) · `404` if missing

---

## 11. Admin — Reports
### `GET http://localhost:8000/api/v1/admin/reports`  · per-employee hours & wage
Query: `year` (2000–2100), `month` (1–12), `categoryId`. Defaults to the current month if omitted. Hours are derived from **admin-approved** shift acceptances that fall in the month.
```json
{ "success": true, "data": {
    "period": { "year": 2026, "month": 11 },
    "summary": { "totalWorked": 1372, "overtime": 19, "hoursDue": 24, "wageCost": 39260, "employeeCount": 11 },
    "employees": [
      { "userId": "…", "name": "Anna Müller", "email": "…", "employeeType": "FULL_TIME", "contractType": "MONTHLY_SALARY",
        "workloadPercent": 100, "categories": [ { "id": "…", "name": "Service" } ],
        "contractedHours": 168, "scheduledHours": 165, "workedHours": 165,
        "overtimeHours": 0, "dueHours": 3, "hourlyRate": 28, "monthlySalary": null, "wageCost": 4620 }
    ] } }
```
- `overtimeHours` / `dueHours` are computed against `contractedHoursMonthly`.
- `wageCost` = `workedHours × hourlyRate` (falls back to fixed `monthlySalary` when there is no hourly rate).
- There is no separate time-clock yet, so `workedHours` = `scheduledHours`.

### `GET http://localhost:8000/api/v1/admin/reports/export`  · CSV download
Same query. Responds with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="report-2026-11.csv"`. Columns: Employee, Email, Employee Type, Contract Type, Workload %, Categories, Contracted Hours, Scheduled Hours, Worked Hours, Overtime Hours, Due Hours, Hourly Rate, Monthly Salary, Wage Cost.

---

## 12. Admin — Settings
Single org-wide settings row — the **Settings → L-GAV rule values** and **Notifications** cards.

### `GET http://localhost:8000/api/v1/admin/settings`
On first read the row is created with Swiss L-GAV defaults. `notificationPrefs` is always returned as a complete object (defaults merged over anything stored).
```json
{ "success": true, "data": { "settings": {
    "id": 1,
    "maxDailyHours": "12.5", "maxWeeklyHours": "50", "minRestHoursBetweenShifts": "11",
    "breakRequiredAfterHours": "5.5", "minBreakMinutes": 30, "breakRules": null,
    "sessionTimeoutMinutes": 30, "swapExpiryHours": 72,
    "notificationPrefs": {
      "shiftPublished": true, "swapRequests": true, "availabilityReminders": true, "ruleViolations": true,
      "channelEmail": false, "channelPush": true, "channelInApp": true
    },
    "updatedAt": "…", "updatedById": null } } }
```

### `PATCH http://localhost:8000/api/v1/admin/settings`
Body — any subset (at least one field, else `400`):
| Field | Rules |
|-------|-------|
| `maxDailyHours` | 0–24 |
| `maxWeeklyHours` | 0–168 |
| `minRestHoursBetweenShifts` | 0–48 |
| `breakRequiredAfterHours` | 0–24 |
| `minBreakMinutes` | int 0–480 |
| `sessionTimeoutMinutes` | int 1–1440 |
| `swapExpiryHours` | int 1–720 |
| `notificationPrefs` | object of booleans (see below) |

`notificationPrefs` toggles (all optional — a partial object is **merged** over the current values, so you only send what changes):
| Key | Meaning |
|-----|---------|
| `shiftPublished` | notify staff when a shift is published |
| `swapRequests` | notify admin on new swap requests |
| `availabilityReminders` | send availability reminders |
| `ruleViolations` | surface L-GAV rule-violation alerts |
| `channelEmail` / `channelPush` / `channelInApp` | delivery channels to use |

`200` → updated settings (records `updatedById`; `notificationPrefs` returned fully merged).

---

## 13. Admin — Availability
Base path `/admin/availability`. The admin **opens** a month for availability collection, watches who has submitted, views individual submissions, and nudges stragglers. (Staff fill and submit from the mobile app — §17.)

### `POST http://localhost:8000/api/v1/admin/availability/open`  · open a month
Creates an availability slot for **every active employee** for the month (existing slots keep what's filled and just get the new cut-off).
```json
{ "year": 2026, "month": 12, "cutoffAt": "2026-12-20T00:00:00.000Z" }
```
| Field | Rules |
|-------|-------|
| `year` | int 2000–2100 |
| `month` | int 1–12 |
| `cutoffAt` | ISO 8601 date-time — the binding submission deadline |

`201` → `{ "data": { "year": 2026, "month": 12, "cutoffAt": "…", "opened": 12 } }`. `409` if there are no active employees.

### `GET http://localhost:8000/api/v1/admin/availability?year=2026&month=12`  · submission status
```json
{ "success": true, "data": {
    "year": 2026, "month": 12,
    "employees": [
      { "userId": "…", "name": "Anna Müller", "firstName": null, "lastName": null, "email": "…",
        "status": "SUBMITTED", "submittedAt": "…", "cutoffAt": "…", "filledDays": 12 },
      { "userId": "…", "name": "Luca Rossi", "status": "DRAFT", "submittedAt": null, "cutoffAt": "…", "filledDays": 0 }
    ],
    "notSubmitted": [ { "userId": "…", "name": "Luca Rossi", "status": "DRAFT", … } ],
    "summary": { "total": 12, "submitted": 9, "notSubmitted": 3 } } }
```
`status` is `SUBMITTED` \| `DRAFT` \| `LOCKED` \| `NOT_OPENED` (the last means the employee has no slot for that month, e.g. hired after it was opened).

### `GET http://localhost:8000/api/v1/admin/availability/grid?year=2026&month=12`  · full grid (every employee's days)
The whole month's availability in one call — each active employee **with their day-by-day entries** — so the dashboard can render the availability grid that feeds weekly planning (rather than fetching one employee at a time).
```json
{ "success": true, "data": {
    "year": 2026, "month": 12,
    "employees": [
      { "userId": "…", "name": "Anna Müller", "firstName": null, "lastName": null, "email": "…",
        "status": "SUBMITTED", "submittedAt": "…", "cutoffAt": "…",
        "days": [
          { "id": "…", "date": "2026-12-05", "status": "WISH", "note": "prefer morning",
            "preferredStartTime": "2026-12-05T08:00:00.000Z", "preferredEndTime": "2026-12-05T14:00:00.000Z" } ] },
      { "userId": "…", "name": "Luca Rossi", "status": "DRAFT", "submittedAt": null, "days": [] }
    ],
    "summary": { "total": 12, "submitted": 9, "notSubmitted": 3 } } }
```
`status` per employee is `SUBMITTED` \| `DRAFT` \| `LOCKED` \| `NOT_OPENED`; `days` carries what the employee entered (empty until they fill it in).

### `GET http://localhost:8000/api/v1/admin/availability/:userId?year=2026&month=12`  · one employee's submission
Returns that employee's month with the full `days[]` (each: `date`, `status`, `note`, `preferredStartTime`, `preferredEndTime`) plus the `user`. `404` if they have no slot for the month.

### `POST http://localhost:8000/api/v1/admin/availability/:userId/nudge`  · one-tap reminder
Body: `{ "year": 2026, "month": 12 }`. Sends the employee an `AVAILABILITY_REMINDER` notification. `409` if their month isn't open or they've **already submitted**.

---

## 14. Staff — Shifts
Base path `/shifts`. Staff-guarded (mobile app). Only **published** shifts (notified) are ever visible here.

### `GET http://localhost:8000/api/v1/shifts`  · available shifts
Query: `page`, `limit`, `categoryId`, `mine` (`accepted` \| `rejected` \| `pending`), `upcoming` (`true`/`false`).
```json
{ "success": true, "data": { "shifts": [
    { "id": "…", "jobTitle": "Evening Waiter", "startTime": "…", "endTime": "…", "hourlyPrice": "28",
      "description": "…", "notifiedAt": "…", "category": { "id": "…", "name": "Service" },
      "myResponse": { "status": "ACCEPTED", "approvalStatus": "APPROVED", "respondedAt": "…", "approvedAt": "…" },
      "confirmedCount": 1 } ] },
  "meta": { "pagination": { … } } }
```
- `myResponse` is `null` if the caller hasn't responded. `approvalStatus` reflects whether the admin confirmed them.
- `confirmedCount` = number of admin-approved workers on the shift.

### `GET http://localhost:8000/api/v1/shifts/:shiftId`  · one published shift (same shape) · `404` if not published/found
### `POST http://localhost:8000/api/v1/shifts/:shiftId/respond`  · accept / decline
Body: `{ "status": "ACCEPTED" }` or `{ "status": "REJECTED" }`. Upsert — staff may change their mind up to the shift end.
`200` → `{ "data": { "response": { "id": "…", "shiftOfferId": "…", "status": "ACCEPTED", "respondedAt": "…" } } }`
Errors: `400` bad enum · `404` shift not published · `409` shift already ended.

---

## 15. Staff — Notifications
Base path `/notifications`. Staff-guarded. Scoped to the caller.

### `GET http://localhost:8000/api/v1/notifications`
Query: `page`, `limit`, `unreadOnly` (`true`/`false`).
```json
{ "success": true, "data": {
    "notifications": [ { "id": "…", "type": "SHIFT_OFFER_PUBLISHED", "channel": "IN_APP", "status": "SENT",
      "title": "New shift available", "body": "Evening Waiter (Service) — tap to view and accept.",
      "payload": { "shiftOfferId": "…", "jobTitle": "…", "startTime": "…", "hourlyPrice": "28" },
      "sentAt": "…", "readAt": null, "createdAt": "…" } ],
    "unreadCount": 3 },
  "meta": { "pagination": { … } } }
```
Notification `type` values you'll see: `SHIFT_OFFER_PUBLISHED` (new shift), `SHIFT_CHANGED` (approved/not-assigned), `SWAP_REQUEST_RECEIVED`, `SWAP_REQUEST_RESULT`.

### `PATCH http://localhost:8000/api/v1/notifications/read-all`  · mark all read → `{ "data": { "updatedCount": 2 } }`
### `PATCH http://localhost:8000/api/v1/notifications/:notificationId/read`  · mark one read · `404` if not the caller's

---

## 16. Staff — Shift Swaps
Base path `/swaps`. Staff-guarded (mobile app). Employees request to swap their **confirmed** shifts.

### `POST http://localhost:8000/api/v1/swaps`  · request a swap
```json
{ "initiatorShiftId": "<my confirmed shift>", "recipientUserId": "<colleague>",
  "recipientShiftId": "<their confirmed shift>", "reason": "Doctor appointment" }
```
Validates that **both** the caller and the recipient are currently admin-approved on the shifts named. Notifies the recipient.
`201` → `{ "data": { "swap": { …, "status": "PENDING" } } }`
Errors: `400` self-swap / same shift · `404` recipient not found · `409` a shift isn't confirmed for its employee / already ended / a duplicate pending swap exists.

### `GET http://localhost:8000/api/v1/swaps`  · my swaps
Query: `page`, `limit`, `status`, `role` (`initiated` \| `received`). Returns swaps where the caller is initiator or recipient.

### `POST http://localhost:8000/api/v1/swaps/:swapId/cancel`  · cancel my pending request
`200` → status `CANCELLED`. `403` if the caller isn't the initiator · `409` if not pending.

---

## 17. Staff — Availability
Base path `/availability`. Staff-guarded (mobile app). Employees record their availability & wishes for a month the admin has opened, then submit bindingly before the cut-off.

### `GET http://localhost:8000/api/v1/availability`  · my availability months
Which months I have — so the app knows what's open to submit. Newest first.
```json
{ "success": true, "data": { "months": [
    { "id": "…", "year": 2026, "month": 12, "status": "DRAFT", "cutoffAt": "…", "submittedAt": null,
      "dayCount": 0, "editable": true } ] } }
```
`editable` is `true` only while `status = DRAFT` **and** the cut-off is still in the future.

### `GET http://localhost:8000/api/v1/availability/:year/:month`  · my availability
```json
{ "success": true, "data": { "availability": {
    "id": "…", "year": 2026, "month": 12, "status": "DRAFT", "cutoffAt": "…", "submittedAt": null,
    "days": [
      { "id": "…", "date": "2026-12-05", "status": "WISH", "note": "prefer morning",
        "preferredStartTime": "2026-12-05T08:00:00.000Z", "preferredEndTime": "2026-12-05T14:00:00.000Z" }
    ] } } }
```
`404` if the admin hasn't opened this month yet.

### `PUT http://localhost:8000/api/v1/availability/:year/:month/days`  · save my day entries
**Full replace** of my entries for the month.
```json
{ "days": [
  { "date": "2026-12-01", "status": "AVAILABLE" },
  { "date": "2026-12-05", "status": "WISH", "note": "prefer morning",
    "preferredStartTime": "2026-12-05T08:00:00.000Z", "preferredEndTime": "2026-12-05T14:00:00.000Z" },
  { "date": "2026-12-24", "status": "UNAVAILABLE", "note": "holiday" }
] }
```
| Field (per day) | Rules |
|-----------------|-------|
| `date` | valid date **within** the target month (`400` otherwise); no duplicates in the payload |
| `status` | `AVAILABLE` \| `UNAVAILABLE` \| `WISH` |
| `note` | ≤ 500 chars, optional |
| `preferredStartTime` / `preferredEndTime` | ISO date-time, optional |

`200` → the updated availability. Editable only while `status = DRAFT` **and** before `cutoffAt` — otherwise `409` (`404` if not open).

### `POST http://localhost:8000/api/v1/availability/:year/:month/submit`  · submit bindingly
Moves `DRAFT → SUBMITTED` and stamps `submittedAt`. After this the month is read-only.
`200` → the submitted availability. Errors: `400` no days added · `409` already submitted / cut-off passed · `404` not open.

---

## 18. Enum Reference

| Enum | Values |
|------|--------|
| Role (token) | `ADMIN`, `USER` |
| `EmployeeType` | `FULL_TIME`, `PART_TIME` |
| `ContractType` | `HOURLY`, `MONTHLY_SALARY`, `WORKLOAD_PERCENT` |
| `ShiftResponseStatus` (staff accept/decline) | `ACCEPTED`, `REJECTED` |
| `ShiftApprovalStatus` (admin decision) | `PENDING`, `APPROVED`, `REJECTED` |
| `ShiftSwapStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `PlanStatus` (workload week) | `DRAFT`, `SUBMITTED`, `PUBLISHED` |
| `DemandWeekStatus` (demands week) | `DRAFT`, `PUBLISHED` |
| `NotificationType` | `SHIFT_OFFER_PUBLISHED`, `SHIFT_CHANGED`, `SWAP_REQUEST_RECEIVED`, `SWAP_REQUEST_RESULT`, `WEEKLY_SHIFTS_PUBLISHED`, `AVAILABILITY_REMINDER`, `RULE_VIOLATION`, `GENERAL` |
| `NotificationChannel` | `PUSH`, `EMAIL`, `IN_APP` |
| `NotificationStatus` | `PENDING`, `SENT`, `FAILED`, `READ` |

---

## 19. Seed Script

Create the default admin (idempotent):
```bash
npx tsx src/scripts/seed.ts
```
Credentials: **`admin@adler.com`** / **`Admin@123456`** (change after first login).

---

## User Side Doc

The staff-facing API for the **React Native mobile app**. The staff app is used by non-technical employees, mostly on their phones. These endpoints live under `/api/v1`, require the **`USER`** role, and are built for a token-storing mobile client.

### Authentication model (mobile)
Unlike the admin web app (which relies on HttpOnly cookies), the mobile app **stores the tokens itself**:

- **Login and refresh return the tokens in the response body** (`data.accessToken`, `data.refreshToken`). Store them securely (e.g. Expo SecureStore / Keychain).
- Send the access token on every request:
  ```
  Authorization: Bearer <accessToken>
  ```
  (Cookies are also set for browser clients, but the app should use the Bearer header.)
- Access token lives ~15 min. On a `401`, call **refresh** with the stored refresh token to get a new pair (the refresh token is **rotated** — replace both), then retry the request.
- These endpoints are `USER`-scoped and reject admin tokens with `403`.

### `POST http://localhost:8000/api/v1/auth/user/login`  · public
```json
{ "email": "anna@adler.ch", "password": "Pass@123" }
```
`200`:
```json
{ "success": true, "message": "User logged in successfully.",
  "data": {
    "user": { "id": "…", "email": "anna@adler.ch", "firstName": null, "lastName": null, "mustChangePassword": true },
    "accessToken": "eyJhbGciOi…", "refreshToken": "eyJhbGciOi…" } }
```
- `mustChangePassword: true` on a fresh admin-created account — the app should route the user straight to a **change-password** screen (see the `PATCH` below) before anything else.
- Errors: `400` invalid body · `401` wrong credentials · `403` deactivated account · `429` too many attempts (rate limited).

### `POST http://localhost:8000/api/v1/auth/user/refresh`  · public
Body (mobile): `{ "refreshToken": "<stored refresh token>" }` — or the `refreshToken` cookie (browser).
`200` → new, rotated pair (replace the stored tokens):
```json
{ "success": true, "message": "Tokens refreshed successfully.",
  "data": { "accessToken": "eyJ…", "refreshToken": "eyJ…" } }
```
`401` if the token is missing / expired / already revoked.

### `GET http://localhost:8000/api/v1/auth/user/profile`  · user (Bearer)
The caller's own profile — contact details + **read-only** contract info (no password hash):
```json
{ "success": true, "data": { "user": {
    "id": "…", "email": "anna@adler.ch", "firstName": "…", "lastName": "…", "phone": "…",
    "contractType": "MONTHLY_SALARY", "workloadPercent": "100", "hourlyRate": "28",
    "monthlySalary": "4600", "contractedHoursMonthly": "168", "hireDate": "…",
    "isActive": true, "mustChangePassword": false, "lastLoginAt": "…", "createdAt": "…", "updatedAt": "…" } } }
```

### `PATCH http://localhost:8000/api/v1/auth/user/profile`  · user (Bearer) — **edit email / password**
Change your own **email** and/or **password**. Provide at least one field.
```json
{ "email": "new@adler.ch", "currentPassword": "Pass@123", "newPassword": "NewPass1" }
```
| Field | Rules |
|-------|-------|
| `email` | valid email, unique across users (`409` if taken) |
| `currentPassword` | required **only** when changing the password |
| `newPassword` | min 6 chars; **requires** `currentPassword` |

- A password change verifies `currentPassword` (`401` if wrong), **clears `mustChangePassword`**, and **revokes every refresh token** (all sessions, including the current one). The response has `passwordChanged: true` and the app must send the user back to **login** with the new password.
- This is also the **forced first-login change**: log in with the default password, then `PATCH` with `currentPassword` = default password + a `newPassword`.
- `400` if no field is given, or `newPassword` without `currentPassword`.

`200`:
```json
{ "success": true, "message": "Profile updated successfully.",
  "data": { "user": { "id": "…", "email": "new@adler.ch", "firstName": "…", "lastName": "…",
    "mustChangePassword": false, "isActive": true, "updatedAt": "…" }, "passwordChanged": false } }
```
When `passwordChanged` is `true`, the message is *"Profile updated. Please log in again with your new password."*

### `POST http://localhost:8000/api/v1/auth/user/logout`  · user (Bearer)
Body (mobile): `{ "refreshToken": "<stored refresh token>" }` — or the cookie. Revokes that refresh token (and clears cookies). The app should also delete its stored tokens. `200`.

### Availability (submit with a calendar)
Employees record per-day availability for a month the admin has opened, then submit it bindingly before the cut-off. All `USER`-scoped, Bearer.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/availability` | List my months + `editable` flag — so the app knows what's open (§17). |
| `GET /api/v1/availability/:year/:month` | My calendar for the month (`days[]` with `AVAILABLE` / `UNAVAILABLE` / `WISH` + note + preferred times). `404` if not opened. |
| `PUT /api/v1/availability/:year/:month/days` | **Full replace** of my day entries — the app sends the whole calendar. Editable only while `DRAFT` + before cut-off (`409` after). |
| `POST /api/v1/availability/:year/:month/submit` | Submit bindingly (`DRAFT → SUBMITTED`). Read-only afterwards. |

Each day: `{ "date": "2026-12-05", "status": "WISH", "note": "…", "preferredStartTime": "…", "preferredEndTime": "…" }` (`date` must fall in the target month; no duplicates). Full detail in §17.

### Shift swaps (request → admin approval → both updated)
An employee offers one of **their confirmed shifts** in exchange for a **colleague's confirmed shift**; the request goes to the admin, and on approval both schedules are updated and both are notified.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/swaps` | Request a swap: `{ initiatorShiftId, recipientUserId, recipientShiftId, reason? }`. Both employees must currently be admin-confirmed on the named shifts. Notifies the recipient. `201` (`PENDING`). |
| `GET /api/v1/swaps` | My swaps (filter `status`, `role=initiated\|received`). |
| `POST /api/v1/swaps/:swapId/cancel` | Cancel my own pending request. |

The admin then **approves/rejects** on `/api/v1/admin/swaps` (§8). On **approve**, the two confirmed assignments are exchanged in one transaction and **both employees are notified** (`SWAP_REQUEST_RESULT`); the swap becomes `APPROVED`. Guards: self-swap / same shift → `400`, a duplicate pending swap → `409`, a shift no longer confirmed → `409`. Full detail in §16 (staff) + §8 (admin).

> **Other staff endpoints** — view/accept shifts (§14) and notifications (§15) — are also `USER`-scoped and accept the same `Authorization: Bearer <token>` header.

---

## Endpoint Summary

| Area | Endpoints |
|------|-----------|
| Auth — Admin | 5 |
| Auth — Staff | 5 |
| Admin — Overview | 1 |
| Admin — Employees | 7 |
| Admin — Categories | 7 |
| Admin — Shifts | 6 |
| Admin — Shift Approvals | 4 |
| Admin — Shift Swaps | 3 |
| Admin — Workload | 11 |
| Admin — Demands | 8 |
| Admin — Reports | 2 |
| Admin — Settings | 2 |
| Admin — Availability | 5 |
| Staff — Shifts | 3 |
| Staff — Notifications | 3 |
| Staff — Shift Swaps | 3 |
| Staff — Availability | 4 |
| **Total** | **79** |

> **Not yet implemented (deferred scheduling engine):** the weekly-plan **auto-generation** ("Manage Plans") — automatically turning demand + submitted availability into a rule-compliant proposed roster, with hand-adjustment and per-change L-GAV feedback. The demand side is now built two ways — the day-level **Demands** grid (§10, `DemandWeek` / `DayDemand`) and the shift-slot **Workload** layer (§9, `WeeklyPlan` / `StaffingDemand`) — and employee **availability collection** too (§13 & §17); what remains is only the constraint-solving/roster-generation engine that consumes them. Also open (not blocking): "open to the whole team" swaps (current swaps are targeted) and actual clock-in/out worked-hours capture (reports currently derive hours from approved shifts). Tracked in `implimated.md`.
