# Upcheck — System Architecture

> Orientation doc for engineers joining the Upcheck team. It explains how the
> monorepo fits together, where the important seams are, and the two rules you
> must never get wrong (auth, and deploy targets). Read this first, then dive
> into the focused guides linked at the bottom.

Upcheck is a shrimp-farming operations app: a React Native mobile client backed
by a NestJS API, sitting on Supabase (Postgres + Auth) with Redis for
short-lived state.

- `backend/` — NestJS 11 + TypeORM, deployed to **Render** (`upcheck-backend`, live at `https://api.upcheck.in`).
- `frontend/` — Expo SDK 54 / React Native 0.81, shipped over-the-air via **EAS Update** (channel `production`).

Supabase project ref: `mcslntwchfucavjrrhnu`.

---

## 1. High-level system diagram

```
                          ┌──────────────────────────────────────┐
                          │        Mobile client (Expo RN)        │
                          │  frontend/                            │
                          │  • zustand stores (auth, farm, sync)  │
                          │  • axios apiClient (Bearer token)     │
                          │  • offline write-queue (recordSync)   │
                          └───────┬───────────────────────┬───────┘
                                  │                        │
             (1) auth only        │                        │  (2) all data
             anon key, sign-in    │                        │  Bearer <access_token>
             OTP, OAuth           │                        │  HTTPS → /api/*
                                  ▼                        ▼
                     ┌────────────────────┐    ┌──────────────────────────┐
                     │   Supabase Auth    │    │   NestJS API (Render)     │
                     │  (GoTrue)          │    │   https://api.upcheck.in  │
                     │  issues JWTs       │    │                           │
                     └─────────┬──────────┘    │  JwtAuthGuard (global)    │
                               │               │   └─ verifies token via   │
                     mirror trigger            │      supabase.auth        │
                     on_auth_user_created      │        .getUser()         │
                               │               │  OwnershipGuard + RBAC    │
                               ▼               │  TypeORM services         │
                  ┌────────────────────────────┴──────────┐   │            │
                  │        Supabase Postgres               │◄──┘  connects  │
                  │  auth.users  ──trigger──►  public.*    │   as table     │
                  │  RLS enabled on every public table     │   OWNER (RLS   │
                  │  (defense-in-depth; no anon policies)  │   bypassed)    │
                  └────────────────────────────────────────┘                │
                                                              ┌─────────────┴───┐
                                                              │ Redis (2FA/OTP  │
                                                              │ temp state) —   │
                                                              │ in-memory       │
                                                              │ fallback        │
                                                              └─────────────────┘
```

**Where auth happens.** The client talks to Supabase Auth *directly* for
sign-in only (using the anon key) and receives a JWT access + refresh token
pair. Every subsequent data request goes to the NestJS API with that token in
an `Authorization: Bearer …` header. The backend does **not** trust the token
blindly — it re-validates it against Supabase on each request (see §5). All
business data flows through the API; the client never reads/writes Postgres
directly. That is deliberate: RLS locks the anon role out of every table (§2,
§4), so the API is the only data path.

---

## 2. Backend architecture

NestJS with the standard module → controller → service → entity → dto layering.
Entry point is `backend/src/main.ts` (global prefix `api`, global
`ValidationPipe`, CORS). The root module `backend/src/app.module.ts` wires
TypeORM, the throttler, and **~46 feature modules**.

### 2.1 The module pattern (worked example: `ponds`)

`backend/src/ponds/` is the canonical shape every feature follows:

```
ponds/
  ponds.module.ts        — declares the module, imports TypeOrmModule.forFeature([Pond, …])
  ponds.controller.ts    — HTTP routes, guards, decorators — no business logic
  ponds.service.ts       — business logic + repository access
  pond.entity.ts         — TypeORM entity (maps to the `ponds` table)
  dto/                    — CreatePondDto / UpdatePondDto (class-validator rules)
  *.service.ts           — helper services (pond-naming, pond-dimension) as needed
```

The controller is thin — it declares the route, the guard, and the RBAC
capability, then delegates:

```ts
// ponds.controller.ts
@Post()
@UseGuards(OwnershipGuard)
@OwnsResource('Farm', 'farmId', 'userId', 'WRITE_MANAGEMENT')
create(@Body() createPondDto: CreatePondDto, @CurrentUser() user) {
  return this.pondsService.create(createPondDto, user.id);
}
```

A second example, `backend/src/sampling/`, is a leaner variant (controller,
service, entity `sampling-data.entity.ts`, dto) — most operational-record
modules (water-quality, feed-records, mortality, treatments…) look like this.
Once you know one, you know all of them.

### 2.2 Authentication: global `JwtAuthGuard` + `@Public()`

`JwtAuthGuard` is registered as a **global** `APP_GUARD` in `app.module.ts`, so
**every route is authenticated by default**. To open a route (sign-in, signup,
OAuth exchange, password reset), annotate it with `@Public()`:

```ts
// auth/decorators/auth.decorators.ts
export const Public = () => SetMetadata('isPublic', true);
```

The guard (`backend/src/auth/guards/jwt-auth.guard.ts`) reads that metadata; if
absent, it extracts the Bearer token and calls `supabase.auth.getUser(token)`.
This validates the JWT **on Supabase's servers**, so it works for both HS256
(legacy) and ES256 (new) signing keys without the backend holding a JWT secret.
On success it sets `req.user = { id, email }`, which every controller reads via
`@CurrentUser()`. Public routes live mostly in
`auth/supabase-auth.controller.ts` (`signup`, `signin`, `login-otp/*`,
`oauth/google`, `oauth/truecaller`, `refresh`, `forgot-password`, …).

There is also a global `ThrottlerGuard` (60 req/60 s) registered ahead of the
auth guard.

### 2.3 Authorization: `FarmAccessService` + RBAC

Auth answers *who you are*; authorization answers *what you may do on this
farm*. Upcheck is multi-tenant by farm, with four roles:

| Role      | Meaning                                                        |
|-----------|---------------------------------------------------------------|
| `owner`   | Full control: farm/pond lifecycle, roles, transfer, economics |
| `manager` | Operations + team: create/verify, financials, invite workers  |
| `worker`  | Field operations: record logs, complete own tasks, read       |
| `viewer`  | Read-only (banks/insurers/consultants)                        |

Roles are stored per-farm in the `farm_members` table
(`farm-access/farm-member.entity.ts`). The single source of truth for "can this
user do X on this farm?" is `backend/src/farm-access/farm-access.service.ts`.
Routes map to **capabilities**, not raw roles, in
`farm-access/farm-capability.ts`:

```
READ              → owner, manager, worker, viewer
WRITE_OPERATIONAL → owner, manager, worker      (field-log writes; the default)
WRITE_MANAGEMENT  → owner, manager              (ponds/cycles/tasks/treatments)
VIEW_FINANCIALS   → owner, manager
MANAGE_WORKERS    → owner, manager
OWNER_ONLY        → owner                        (delete, transfer, role changes)
```

Two enforcement points, both delegating to the same `roleSatisfies()` map:

1. **`OwnershipGuard`** (`common/guards/ownership.guard.ts`) — route-level. The
   `@OwnsResource(entity, paramName, ownerPath, capability)` decorator tells it
   which entity to load, how to walk to the owning farm (e.g. `farm.userId`),
   and which capability the route requires. The direct farm owner always passes;
   otherwise it resolves the caller's role via `FarmAccessService.getRoleOnFarm`
   and checks the capability.
2. **Service methods** — list endpoints scope results with
   `getAccessibleFarmIds()` / `getFarmIdsWithCapability()` so a caller never sees
   another tenant's rows.

`FarmAccessService` depends only on repositories (not other feature services) to
avoid circular deps, and degrades gracefully to owner-only access if the
`farm_members` table is missing during a deploy-before-migrate window (Postgres
`42P01`).

> Note: `auth/roles.enum.ts` (`Role.SUPER_ADMIN`, …) is a separate,
> coarser-grained concept and is **not** the per-farm RBAC used for tenant
> scoping. When you mean tenant access, use `FarmRole` + `FarmCapability`.

### 2.4 TypeORM, migrations, and RLS as defense-in-depth

- **Connection**: `TypeOrmModule.forRootAsync` in `app.module.ts`. In
  production, `synchronize` is **off** — the schema is owned by migrations.
  (In non-prod/sqlite tests, `synchronize: true` + `autoLoadEntities`.)
- **Migrations**: `backend/src/migrations/*.ts`, run manually via the TypeORM
  CLI (`migrationsRun: false` at boot — Render does not auto-migrate). See
  [database & migrations guide](./guides/database-migrations.md).
- **RLS**: `1780301300000-EnableRowLevelSecurity.ts` enables Row Level Security
  on **every** `public` table with **no permissive policies**, so the Supabase
  `anon`/`authenticated` roles get zero direct table access. The backend
  connects as the table **owner** (`DATABASE_URL`), which bypasses RLS, and the
  auth-sync trigger is `SECURITY DEFINER`. Net effect: the API is the only way
  in, and a leaked anon key exposes no data. **Any new table added by a later
  migration must enable RLS itself.**

More depth: [backend guide](./guides/backend.md),
[auth & security guide](./guides/auth-security.md).

---

## 3. Frontend architecture

Expo SDK 54 / React Native 0.81. Source under `frontend/src/`.

### 3.1 Navigation

React Navigation, two layers:

- **`navigation/RootNavigator.tsx`** — a native stack that branches on
  `useAuthStore().isAuthenticated`. Unauthenticated → Login/Register/OTP/
  Truecaller/legal screens. Authenticated → `MainApp` plus every feature screen
  (farms, ponds, cycles, ~11 log screens, calculators, simulations, history,
  decision engines, settings). Owners who just registered are routed into
  `CreateFarm` first via `pendingFarmSetup`.
- **`navigation/MainNavigator.tsx`** — a bottom-tab navigator (Home, …,
  QuickLog, …) that is the `MainApp` screen inside the root stack.

`RootStackParamList` in `RootNavigator.tsx` is the typed route map — add a
screen's params there.

### 3.2 State: zustand stores (`frontend/src/store/`)

| Store                 | Responsibility                                                    |
|-----------------------|-------------------------------------------------------------------|
| `authStore.ts`        | Session/user/token; persisted (refresh token in `expo-secure-store`); `initialize()` on boot |
| `activeFarmStore.ts`  | Currently selected farm context                                   |
| `membershipStore.ts`  | The user's `farm_members` roles; loaded after login, powers `usePermissions()` |
| `syncStore.ts`        | Connectivity flag + the offline operation queue (persisted to AsyncStorage) |
| `notificationStore` / `uiStore` / `uploadStore` / `calculatorStore` | UI + feature-local state |

The `apiClient` (axios, `frontend/src/api/client.ts`) attaches
`authStore.accessToken` as a Bearer header on every request and transparently
refreshes on 401.

### 3.3 Offline write-queue (`frontend/src/sync/recordSync.ts`)

Field operators lose signal, so operational writes are offline-first:

- `saveRecord({ entity, endpoint, payload })` stamps each record with a
  client-minted UUID (`expo-crypto`) so replays are **idempotent** on the
  backend. Online → POST immediately; on a *network* error (no HTTP response) →
  enqueue and return optimistically. Offline → enqueue immediately. A real
  server rejection (4xx/5xx *with* a response) is thrown for the user to see.
- `drainRecordQueue()` (call on reconnect / app start) replays the queue via
  `syncStore.drainQueue`. The outcomes, as the code actually implements them:
  - **2xx, and 409** → done, removed from the queue. A conflict means the
    server already has it — the client-minted id makes replay idempotent.
  - **400 / 422** → moved to `failedOperations`. **Parked, never dropped.** A
    permanently rejected record stays visible on the Sync screen so the farmer
    can see what did not save and re-enter it. This is load-bearing: an empty
    or out-of-range reading rejected on drain (see the `AtLeastOneOf`
    validator) must not evaporate silently hours after it was taken.
  - **401 / 403 / 5xx / network** → kept, retried on the next reconnect.

  > This paragraph previously read "2xx or 4xx → drop (done or permanently
  > rejected)". That was **wrong about data loss**, which is the worst kind of
  > stale documentation to leave standing: `syncStore` has never dropped a 4xx,
  > and its own comment says "never silently drop". The code was right; this
  > text was not.

### 3.4 i18n (`frontend/src/i18n/`)

`i18next` + `react-i18next`, **6 languages**: English, Hindi (`hi`), Tamil
(`ta`), Telugu (`te`), Bengali (`bn`), Odia (`or`). Each locale under
`i18n/locales/<lang>/` is a namespaced object exposed as one `translation`
namespace, so callers use `t('auth.login')`, `t('common.save')`. The selected
language persists in AsyncStorage.

### 3.5 UI kit (`frontend/src/components/`)

A shared component library under `components/ui/` (`Button`, `Input`, `Card`,
`MetricCard`, `StatusBadge`, `FAB`, `OfflineIndicator`, `ToastHost`, …) plus
`charts/`, `dashboard/`, `forms/`, `layout/`. Design tokens live in
`frontend/src/theme/` (`colors`, `colorRoles`, `spacing`, `typography`,
`radius`, `shadows`). Prefer these over ad-hoc styles.

More depth: [frontend guide](./guides/frontend.md).

---

## 4. Data model overview

Core tenancy chain (each row scoped to a farm, farm scoped to a user):

```
auth.users ──(mirror trigger)──► public.users
                                     │  id (uuid, = auth.users.id)
                                     │
                       farms.user_id │  (legacy primary owner)
                                     ▼
   farm_members ──────────────►  farms ───────────► ponds ───────────► crops
   (farm_id, user_id, role)      (id, user_id,      (id, farm_id,      (id, pond_id,
   owner|manager|worker|viewer    name, …)           name, status, …)   farm_id, stocking…)
                                                          │
                                            active_cycle_id points at the
                                            current crop (cycle)

   records: water_quality, feed_records, sampling_data, mortality, treatments,
            chemical, plankton, microbiology, harvests, feeding_tray_checks,
            transactions, tasks, …  — each carries pond_id / crop_id / farm_id
```

Key entities:

- **`users`** (`auth/user.entity.ts`) — mirror of `auth.users`; `id` matches the
  Supabase auth uuid.
- **`farms`** (`farms/farm.entity.ts`) — tenant root; `user_id` is the primary
  owner; soft-deleted via `deleted_at`.
- **`farm_members`** (`farm-access/farm-member.entity.ts`) — the RBAC join:
  `(farm_id, user_id)` unique, `role` ∈ owner/manager/worker/viewer.
- **`ponds`** (`ponds/pond.entity.ts`) — geometry/dimensions, `status`,
  `active_cycle_id`.
- **`crops`** (`crops/crop.entity.ts`) — a production **cycle** (stocking,
  species, density…). Note the vocabulary split: the backend/DB says **crop**,
  the mobile UI says **cycle** — same thing.

### The `auth.users → public.users` mirror trigger

Defined in `supabase_setup.sql`: `public.handle_new_user()` (`SECURITY
DEFINER`) fires on `AFTER INSERT OR UPDATE ON auth.users`
(`on_auth_user_created` / `on_auth_user_updated`) and upserts the corresponding
`public.users` row (email, name, avatar, phone). This is why a freshly
signed-up user already has an app-side profile row: Supabase Auth owns identity,
Postgres mirrors it so the app's foreign keys (`farms.user_id`,
`farm_members.user_id`) resolve. Being `SECURITY DEFINER`, the trigger bypasses
RLS.

More depth: [database & migrations guide](./guides/database-migrations.md).

---

## 5. Request lifecycle (authenticated write)

Example: a worker records a feed entry from the field.

```
1. Client    saveRecord({ entity:'feed', endpoint:'/feed-records', payload })
             → apiClient POSTs https://api.upcheck.in/api/feed-records
               with Authorization: Bearer <access_token>
               (if offline / network error → enqueue in syncStore, return optimistically)

2. Edge      Render routes to NestJS; global ThrottlerGuard checks rate limit.

3. Guard     JwtAuthGuard: route not @Public → supabase.auth.getUser(token)
             validates the JWT server-side → sets req.user = { id, email }.
             (401 if missing/expired.)

4. Guard     OwnershipGuard: reads @OwnsResource(...) metadata, loads the target
             entity, walks ownerPath to the owning farm, and checks the caller's
             FarmRole against the route capability via FarmAccessService.
             Owner passes directly; others must satisfy the capability.
             (403 if not permitted.)

5. Pipe      ValidationPipe validates/whitelists the DTO (class-validator).

6. Service   FeedRecordsService applies business logic and writes via the
             TypeORM repository. The DB connection is the table owner, so RLS is
             bypassed; the client-supplied UUID makes the insert idempotent.

7. Response  201/JSON flows back; the client marks the queued op done (or, if it
             was sent inline, returns the server row).
```

Read requests are the same minus the DTO validation, and use `READ`-capability
guards or farm-id–scoped service queries so a caller only ever sees their farms.

---

## 6. Deployment topology

```
   backend/  ──git push / autoDeploy──►  Render  (service: upcheck-backend)
             npm ci && npm run build          │  Node web service, free plan
             npm run start:prod               │  healthCheck: /api/health
                                              ▼
                                     https://api.upcheck.in
                                              │
                                     Supabase Postgres (Supavisor pooler URL)
                                     Supabase Auth (GoTrue)
                                     Redis (optional; in-memory fallback)

   frontend/ ──eas update --channel production──►  EAS Update  (OTA JS bundle)
             (native binaries via `eas build` → Play Store / TestFlight)
```

Config: `render.yaml` (backend service + env vars), `frontend/eas.json`
(build profiles + channels), `frontend/app.json` (`updates`, `runtimeVersion`,
EAS `projectId`).

### The one rule you must not get wrong

**Backend changes deploy to Render. Frontend changes ship via EAS Update — NOT
through Render.**

- A change under `backend/` → merge/push → Render rebuilds and redeploys the API.
  DB schema changes additionally require running the migration (Render does not
  auto-migrate; see the migrations guide).
- A change under `frontend/` (JS/TS/assets) → `eas update --channel production`
  pushes it over-the-air to installed apps. Render knows nothing about the app.
  Only changes to native code / SDK / `runtimeVersion` require a new `eas build`
  and store submission.

Getting this backwards (expecting a frontend fix to appear because Render
deployed, or vice-versa) is the most common onboarding mistake.

More depth: [operations guide](./OPERATIONS.md).

---

## Where to go next

- [Backend guide](./guides/backend.md) — modules, DTOs, services, testing.
- [Frontend guide](./guides/frontend.md) — screens, stores, sync, i18n, theming.
- [Auth & security guide](./guides/auth-security.md) — Supabase Auth, JwtAuthGuard, RBAC, RLS, 2FA/Truecaller.
- [Database & migrations guide](./guides/database-migrations.md) — schema, migrations, the mirror trigger.
- [Feature matrix](./FEATURES.md) — what the app does, feature by feature.
- [Operations](./OPERATIONS.md) — deploys, env vars, runbooks.
