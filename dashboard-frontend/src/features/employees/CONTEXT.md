# Employees feature — quick context

Read this before touching `src/pages/employees-page.tsx`, `src/components/employee/*`, or
`src/features/employees/*` — it should save you from re-scanning the whole app.

## Data flow
- Page: [employees-page.tsx](../../pages/employees-page.tsx) owns all state (search/debounced,
  department filter, isActive filter, cursor stack) and wires `useEmployees` (react-query) +
  the 4 mutation hooks from [use-employees.ts](hooks/use-employees.ts).
- `EmployeeTableContainer` → `EmployeeTable` ([employee-table-component.tsx](../../components/employee/employee-table-component.tsx))
  is presentation-only: it renders rows, the loading skeleton, the empty state, and the
  Prev/Next footer. It has no data-fetching of its own.
- Department filtering is **client-side** (`filteredEmployees` in the page) — the backend has no
  `department` query param, only `search`, `isActive`, `categoryId`, `cursor`, `limit`.

## Pagination — cursor (keyset), not offset
Per `API_Doc.md` §4 (`GET /admin/users`), this list uses **cursor pagination**, unlike most other
admin list endpoints in this app which use page/limit offset pagination. Concretely:
- Request: `cursor` (opaque, from previous response) + `limit`. No `page` param exists server-side.
- Response: `meta.pagination = { limit, nextCursor, hasNextPage }` — there is no `total`/`totalPages`.
- The page fakes a "page number" locally via `cursorStack` (an array of previously-visited
  cursors) purely for the "Page N" label — the server has no concept of this.
- Changing `search`/`isActive`/department filter must reset `cursor` + `cursorStack` (see the
  `useMemo` reset block in the page) since a cursor from one filter set is invalid for another.
- `data.data.counts = { active, inactive }` is **unaffected by the `isActive` filter** — it's
  always the full split, and `active + inactive` is the true total employee count (used for the
  header's "N staff members" line). Don't read `counts.active` alone as "total".

## Loading state
Table loading state renders `EmployeeTableRowSkeleton` (6 skeleton `<tr>`s shaped like a real row:
avatar circle, name/email bars, badge bar, action-icon square) instead of a spinner — same
`Skeleton` primitive (`@/components/ui/skeleton`) used by `CategoryCardSkeleton` (categories
feature) and the workload sheets-list row skeletons. If you add a new list view in this app,
match this pattern rather than a spinner.

## Gotchas
- `isFetching && !isLoading` drives the subtle "refetching" dim/spinner-in-filters state, kept
  separate from the full-skeleton `isLoading` state — don't collapse the two.
- `mutatingId` (from `useMutatingIds`) dims/disables the specific row being edited/deleted, not
  the whole table.
