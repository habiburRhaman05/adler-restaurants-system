# Adler App — Production Readiness Plan

Context file for future work. Read this instead of re-scanning the whole
repo — it captures the state as of 2026-07-06 and the agreed migration plan.

> **Update (2026-07-06):** Phase 0 + Phase 1 groundwork implemented. See
> "Implementation Status" at the bottom before starting new work — it lists
> exactly what exists now and what's still a stub.

## 1. Current State

**Stack:** Expo SDK 55, expo-router (file-based nav), React 19.2, RN 0.83,
TypeScript strict, @tanstack/react-query (installed, unused), axios.

**Structure today** (`src/`):
```
src/
  app/                  # expo-router routes (login, settings, tabs)
  components/           # 3 shared components (bottom-tab, header, library-header)
  config/api.ts         # single axios instance, hardcoded baseURL
  lib/queryClient.ts
  services/products.ts  # one function, calls dummyjson.com directly (not via config/api)
```

This is a prototype / UI-scaffolding stage app — routing and screens exist,
but there is no real application layer underneath them.

**Gaps found (blocking production):**
- **Auth is fake**: [login.tsx](../src/app/login.tsx) hardcodes `DEMO_EMAIL` /
  `DEMO_PASSWORD` client-side, no token issuance, no session persistence,
  no route guarding — any user can deep-link past `/login`.
- **No env/config separation**: [config/api.ts](../src/config/api.ts) hardcodes
  `https://api.example.com`; no `.env`, no per-environment (dev/staging/prod) config.
- **No secure storage**: no `expo-secure-store` or token/session handling at all.
- **Inconsistent data layer**: `services/products.ts` bypasses the shared
  `api` axios instance and calls a public demo API directly; react-query is
  installed but no query/mutation hooks exist anywhere.
- **No error boundaries, no global error/loading UI, no offline handling.**
- **No state management** beyond local `useState` in screens.
- **No testing** (no Jest/RNTL config, no test files).
- **No theming system** — colors/spacing duplicated as local `COLORS` objects
  per screen (see login.tsx).
- **No i18n, no accessibility pass, no crash reporting / analytics.**
- **No CI**, no lint-staged/husky, no env validation, no app versioning strategy.
- `.gitignore` looks fine; no secrets currently committed.

## 2. Target Modular Architecture

Move from route-dumped screens to a layered, feature-first structure. Keep
`src/app/**` as *routing only* (thin screens that import from `features/`).

```
src/
  app/                        # expo-router routes ONLY — thin, no business logic
    (tabs)/
    settings/
    login.tsx
    _layout.tsx

  features/                   # one folder per business domain
    auth/
      components/
      hooks/                  # useLogin, useSession
      api/                    # auth.api.ts
      store/                  # authSlice / auth store
      types.ts
    plans/
    schedule/
    profile/
    analysis/

  components/                  # shared/dumb UI only (Button, Card, Header, TabBar)
    ui/

  hooks/                       # cross-feature hooks (useDebounce, useAppState)

  lib/                         # thin wrappers around 3rd-party libs
    queryClient.ts
    storage.ts                # expo-secure-store wrapper
    logger.ts

  services/                    # generic API client, interceptors
    api/
      client.ts                # axios instance + interceptors (auth header, refresh, error mapping)
      endpoints.ts

  store/                       # global app state (zustand/redux) if needed beyond react-query

  theme/                       # colors, spacing, typography — single source of truth
    colors.ts
    spacing.ts
    index.ts

  config/
    env.ts                     # validated env (zod) per APP_ENV
    constants.ts

  types/                       # shared/global TS types

  utils/                       # pure helper functions

  i18n/                        # translations (if multi-language needed)

  assets/                      # (already exists at root, keep)
```

**Rules:**
- `app/**` files must stay screen-shells: layout + calling a `features/*` hook/component. No inline axios calls, no inline business logic.
- `features/*` are self-contained: a feature never imports another feature's internals directly — go through `components/`, `store/`, or `services/` if sharing is needed.
- All network calls go through `services/api/client.ts` (single axios instance with interceptors), never ad-hoc `axios.get(...)` in a screen or service.
- All colors/spacing come from `theme/`, never inline hex per screen.

## 3. Migration Plan (phased, incremental — app stays runnable throughout)

**Phase 0 — Foundations**
- Add `.env` + `.env.example`, install `react-native-dotenv` or use `expo-constants` + `app.config.ts`; add `config/env.ts` with zod validation.
- Centralize `services/api/client.ts`: one axios instance, request/response interceptors, error normalization.
- Add `theme/` and migrate one screen (login) to prove the pattern.

**Phase 1 — Auth**
- Real auth flow: `features/auth/api` (login/refresh/logout endpoints), `expo-secure-store` for token persistence, `features/auth/store` (session state), route guard in `app/_layout.tsx` (redirect unauthenticated users away from tab routes).
- Add logout, session restore on app boot, token refresh interceptor.

**Phase 2 — Data layer**
- Wrap `products.ts` and future endpoints as react-query hooks under each feature's `hooks/` (`usePlans`, `useSchedule`, etc.), all going through the shared client.
- Add global loading/error UI (suspense boundaries or query status handling), retry/offline handling.

**Phase 3 — Restructure existing screens into `features/`**
- Move `plans`, `schedule`, `profile`, `analysis`, `settings` screens' logic out of `app/` into matching `features/*`, leaving thin route files behind.
- Extract shared UI primitives (buttons, inputs, cards) into `components/ui/`.

**Phase 4 — Quality & hardening**
- Add Jest + React Native Testing Library, at least smoke tests per feature.
- Add ESLint/Prettier strict config + Husky pre-commit + lint-staged.
- Add error boundary + crash reporting (Sentry) + basic analytics.
- Accessibility pass (labels, contrast, hit slop consistency).

**Phase 5 — Release readiness**
- EAS build profiles per environment (dev/staging/prod) in `eas.json`, app icons/splash finalized, versioning/build-number bump strategy, store metadata, privacy policy links, permissions audit (app.json).
- CI (GitHub Actions or similar): typecheck, lint, test, EAS build on tag.

## 4. Suggested Additions to `package.json`

- `expo-secure-store` — token storage
- `zod` — env & API response validation
- `zustand` (or keep react-query only if state is server-derived) — lightweight client state if needed beyond query cache
- `expo-constants` / `app.config.ts` (dynamic config) — replace static `app.json` for env-driven values
- Dev: `jest`, `jest-expo`, `@testing-library/react-native`, `eslint-config-expo` (already via `expo lint`), `husky`, `lint-staged`, `sentry-expo` (optional)

## 5. How to use this doc

Treat this as the source of truth for "where does X go" during the rewrite.
Update the phase checklist as work lands; don't re-derive the architecture
from scratch each session — extend this file instead.

## 6. Chosen Stack (locked in 2026-07-06)

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo (managed) + expo-router | already in place |
| Server state / API calls | TanStack Query + axios | cache/retry/refetch handled, axios for interceptors |
| Client state | Zustand | minimal boilerplate; only used for session/UI state, never server data |
| Forms | React Hook Form + Zod | shared schema also validates env + API shapes |
| Styling | `StyleSheet` (existing screens) + NativeWind (new work) | avoids a big-bang rewrite; write new components in NativeWind, leave working StyleSheet screens alone until touched |
| Animation | Reanimated 3 + Gesture Handler | already installed; not yet used — adopt for new gesture/animated work instead of `Animated` API |
| Secure storage | expo-secure-store | token/session persistence |

## 7. Implementation Status (as of 2026-07-06)

**Done:**
- `services/api/client.ts` — single axios instance, attaches bearer token from secure storage, clears session on 401, logs failures via `lib/logger.ts`. Replaces the old `config/api.ts` and the ad-hoc `axios.get` in `services/products.ts` (both removed).
- `config/env.ts` — zod-validated env (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_ENV`), throws at boot if misconfigured. `.env.example` added; `.env` gitignored.
- `theme/` — `colors.ts`, `spacing.ts`, `typography.ts` extracted from the old per-screen `COLORS` object in `login.tsx`.
- `lib/storage.ts` — expo-secure-store wrapper (`get`/`set`/`remove`).
- `features/auth/` — `types.ts`, `schema.ts` (zod `loginSchema`), `api/auth.api.ts` (`loginRequest`/`logoutRequest` hitting `ENDPOINTS.auth.*`), `store/authStore.ts` (zustand: `status: 'checking'|'authenticated'|'unauthenticated'`, `restoreSession`/`setSession`/`logout`), `hooks/useLogin.ts` + `hooks/useLogout.ts` (react-query mutations wired to the store).
- `features/plans/` — same shape (`types.ts`, `api/plans.api.ts`, `hooks/usePlans.ts`) as the first template for migrating the remaining screens (`schedule`, `profile`, `analysis`, `settings`) into `features/*`. **Not yet done** — those screens still live entirely under `app/` with inline logic.
- `app/_layout.tsx` — now calls `restoreSession()` on boot and uses `Stack.Protected` to gate `(tabs)` behind `authenticated` and `login` behind `unauthenticated`; shows a spinner while `status === 'checking'`.
- `app/login.tsx` — rewritten on React Hook Form + Zod (`loginSchema`), calls `useLogin()` instead of the old hardcoded `DEMO_EMAIL`/`DEMO_PASSWORD` check. **The demo login is gone** — this screen now expects a real backend at `EXPO_PUBLIC_API_URL` with `/auth/login` returning `{ user, token, refreshToken }`. Point `.env`'s `EXPO_PUBLIC_API_URL` at a real backend (or a mock server) to actually log in.
- NativeWind installed and wired: `tailwind.config.js`, `global.css`, `babel.config.js` (`babel-preset-expo` pinned to `~55.0.23` to match the installed Expo SDK — do not let this drift to `latest`), `metro.config.js` (`withNativeWind`), `nativewind-env.d.ts` for TS types. Verified with `npx expo export --platform web` — bundles clean, CSS output generated, all 15 routes render.
- `package.json`: added `"typecheck": "tsc --noEmit"`.

**Known pre-existing issues (not touched, out of scope for this pass):**
- `src/app/setting.tsx` and `src/components/libray-header.tsx` fail `tsc --noEmit` under `typedRoutes` (bad route strings: `'/'`, `'/settings/'`). `libray-header.tsx` also appears to be a leftover template file (YouTube branding, typo'd name) unrelated to this app — worth confirming with whoever owns this repo whether it's dead code to delete.

**Not started (next up, in priority order):**
1. Move `schedule`, `profile`, `analysis`, `settings` screen logic into `features/*` (Phase 3 of §3) — same pattern as `features/auth` and `features/plans`.
2. Global error boundary + query error/loading UI conventions.
3. Token refresh flow (the 401 interceptor in `services/api/client.ts` currently just clears the session; wire `useAuthStore.getState().logout()` there instead of the empty branch, and add a refresh-token retry).
4. Tests (Jest + RNTL), ESLint/Prettier strict + Husky, Sentry, CI, EAS build profiles per environment — Phase 4/5, untouched.
5. Fix or delete `setting.tsx` / `libray-header.tsx` (see above).
