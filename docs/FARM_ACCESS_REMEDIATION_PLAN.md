# Farm Access & Role Model — Remediation Plan

**Repo:** `Upcheck-India/Upcheckapp` · **Suggested location:** `docs/FARM_ACCESS_REMEDIATION_PLAN.md`
**Audience:** an AI coding agent working this repo under `AGENTS.md`, plus the human reviewing its PRs.
**Status:** proposal — nothing here has been implemented. Line numbers are from the state of `master` at the time of writing; re-verify with `grep` before editing, they will drift.

---

## 0. How to use this document

This is six independent workstreams (**W1–W6**) plus a set of **collateral fixes (C1–C5)** found while auditing the same code paths. They are ranked by risk, and **W1 → W2 → W3 is the intended order**. W4 and W5 are design-first: do not write migrations for them until a human has signed off on the schema.

Each workstream below gives you: the problem, the exact files, the change, the tests, and acceptance criteria. Do not batch multiple workstreams into one PR.

**Before you touch anything, follow `AGENTS.md`:**

1. `git fetch origin && git status`
2. `gh issue list` / `gh pr list` — check nobody is already in this area
3. File a GitHub issue per workstream (one issue = one branch = one PR)
4. Branch from `development`, not `master`: `git checkout development && git pull && git checkout -b fix/<slug>`
5. Gate before every commit:
   - `cd backend && npx tsc --noEmit -p . && npx jest --silent --maxWorkers=2`
   - `cd frontend && npx tsc --noEmit && npx jest --silent --maxWorkers=2`
6. PR against `development`. **Do not self-merge.** Call out permission-logic changes and migrations loudly in the PR body — `AGENTS.md` names both as risk categories requiring explicit flagging.

**Two repo landmines that apply to almost every workstream here:**

- **Permissions are mirrored on both sides.** Backend `farm-access/farm-capability.ts` ↔ frontend `permissions/capabilities.ts`. Changing one without the other creates a client/server mismatch. The backend is the source of truth and the only real enforcer; the frontend copy drives visibility only (hide, never merely disable).
- **Migrations are not automatic.** `migrationsRun: false` in `app.module.ts`. A merged migration is **not applied** until a human runs `npm run migration:run`. Any new column must be tolerated when absent — follow the `isMissingTable()` / `42P01` degradation pattern already in `FarmAccessService`.

---

## 1. The model as it exists today

Two authorization systems coexist. Only one of them is any good.

### 1.1 Per-farm RBAC (the good one — keep it)

`farm_members.role` ∈ `owner | manager | worker | viewer`, one row per (farm, user), unique index on `(farm_id, user_id)`.

Enforced by `FarmAccessService` (`backend/src/farm-access/farm-access.service.ts`), which is the single source of truth for "may this user do capability C on this farm/pond?". The capability matrix lives in `farm-access/farm-capability.ts`:

| Capability | owner | manager | worker | viewer |
|---|:-:|:-:|:-:|:-:|
| `READ` | ✅ | ✅ | ✅ | ✅ |
| `WRITE_OPERATIONAL` | ✅ | ✅ | ✅ | — |
| `WRITE_MANAGEMENT` | ✅ | ✅ | — | — |
| `VIEW_FINANCIALS` | ✅ | ✅ | — | — |
| `MANAGE_WORKERS` | ✅ | ✅ | — | — |
| `OWNER_ONLY` | ✅ | — | — | — |

Two enforcement entry points:

- **Route layer** — `@UseGuards(OwnershipGuard)` + `@OwnsResource(entity, param, ownerPath, capability)`. Fails closed if the decorator is missing. Capability defaults to `WRITE_OPERATIONAL` when omitted.
- **Service layer** — `farmAccess.assertCanAccessFarm/Pond(userId, id, capability)`, or the member-aware helpers `pondsService.findOneAccessible(id, userId, capability)` / `pondsService.verifyAccess(...)` / `cropsService.findOneAccessible(...)`.

### 1.2 Global `accountType` (the redundant one — remove it)

`'owner' | 'worker'`, chosen on `RegisterScreen`, stored in **Supabase `user_metadata`** (not in your `users` table), read back in `jwt-auth.guard.ts` onto `req.user.accountType`.

It gates **exactly one** authorization decision in the entire backend: `farms.controller.ts:29`, which blocks farm creation for worker accounts. It is client-mutable (see **C1**), it has no UI to change it after signup, and it does not compose with the per-farm roles — a "worker" account can hold the `manager` role on a farm, and can even be handed full ownership via `transferOwnership`, while still being blocked from creating a farm of its own.

---

## 2. Sequencing

```
W1 (manager half-built)  ──┐
C1, C2 (auth/farmCode)   ──┼──►  W2 (join code)  ──►  W3 (accountType → preference)
                           │
W4 (pond scoping) ─────────┘   design-first, independent
W5 (co-owner) ─────────────────design-first, independent
W6 (financial grant) ──────────needs user research first
```

**Why this order.** W1 makes the `manager` role actually work. W2 fixes how people get into a farm at all. W3 removes the redundant account flag — do it *after* W2, because W3 makes "anyone can create a farm" true, which raises the value of the join flow being sound. W4/W5 are schema changes that should not be designed while the above is still moving.

---

## W1 — The `manager` role is half-built (P0)

### Problem

Twenty call sites authorize via the **owner-only** `pondsService.findOne(id, userId)` / `cropsService.findOne(id, userId)`, which throw `ForbiddenException` unless `pond.farm.userId === userId`. The capability matrix says managers and workers have access; these code paths disagree.

Observable symptom: an owner promotes someone to `manager`; that person can log water quality (guarded route, member-aware service) but gets a bare 403 starting a cycle, opening a feed plan, or viewing a disease warning on the same pond. **The role advertises authority the app then refuses.**

This is audit finding #7 in `AUDIT_FINDINGS_2026-07-08.json`, marked ✅ at row 65 of `REMEDIATION_STATUS.md`. It was **partially** remediated — `pnl`, `water-quality`, `feed-records` and `ponds.controller` were moved to member-aware paths; the engine and reporting services were not. **Correct the status row as part of this PR.**

### The mechanical fix

The member-aware helpers already exist and are already used elsewhere — this is a swap, not new infrastructure:

```ts
// backend/src/ponds/ponds.service.ts:476
async findOneAccessible(id: string, userId: string, capability: FarmCapability = 'WRITE_OPERATIONAL'): Promise<Pond>
async verifyAccess(id: string, userId: string, capability: FarmCapability = 'WRITE_OPERATIONAL'): Promise<void>
```

**Guiding rule:** the service-layer check must be **equal to** the route guard's capability — never stricter. Where there is no route guard, the service check *is* the policy.

### Call sites and target capability

| # | File : line | Function | Replace with | Route guard today |
|---|---|---|---|---|
| 1 | `crops/crops.service.ts:26` | `create` (start cycle) | `pondsService.findOneAccessible(dto.pondId, userId, 'WRITE_MANAGEMENT')` | `WRITE_MANAGEMENT` |
| 2 | `crops/crops.service.ts:129` | `findOne` (economics path) | `pondsService.findOneAccessible(crop.pondId, userId, 'VIEW_FINANCIALS')` | n/a (service-only) |
| 3 | `crops/crops.service.ts:185` | `remove` | `pondsService.findOneAccessible(crop.pondId, userId, 'OWNER_ONLY')` | `OWNER_ONLY` |
| 4 | `crops/crops.service.ts:211` | `harvest` | `…, 'WRITE_MANAGEMENT')` | `WRITE_MANAGEMENT` |
| 5 | `crops/crops.service.ts:244` | `close` | `…, 'WRITE_MANAGEMENT')` | `WRITE_MANAGEMENT` |
| 6 | `disease-warning/disease-warning.service.ts:208` | persist snapshot | `…, 'WRITE_OPERATIONAL')` | **none** |
| 7 | `disease-warning/disease-warning.service.ts:220` | `recent` | `…, 'READ')` | **none** |
| 8 | `disease-warning/disease-warning.service.ts:229` | `latest` | `…, 'READ')` | **none** |
| 9 | `feed-advisor/feed-advisor.service.ts:160` | persist plan | `…, 'WRITE_MANAGEMENT')` | **none** |
| 10 | `feed-advisor/feed-advisor.service.ts:180` | `recent` | `…, 'READ')` | **none** |
| 11 | `feed-advisor/feed-advisor.service.ts:195` | record actual kg | `…, 'WRITE_OPERATIONAL')` | **none** |
| 12 | `harvest-timing/harvest-timing.controller.ts:66` | persist optimize | `…, 'WRITE_MANAGEMENT')` | **none** |
| 13 | `harvest-timing/harvest-timing.controller.ts:86` | `recent` | `…, 'READ')` | **none** |
| 14 | `measurement/measurement.service.ts:56` | `create` | `…, 'WRITE_OPERATIONAL')` | **none** |
| 15 | `measurement/measurement.service.ts:67` | idempotent-replay ownership recheck | `…, 'WRITE_OPERATIONAL')` | **none** |
| 16 | `measurement/measurement.service.ts:181` | `query` | `…, 'READ')` | **none** |
| 17 | `measurement/measurement.service.ts:214` | `findOne` | `…, 'READ')` | **none** |
| 18 | `pond-context/pond-context.service.ts:229` | `getContext` | `…, 'READ')` | **none** |
| 19 | `pond-context/pond-context.service.ts:241` | crop lookup | `cropsService.findOneAccessible(cropId, userId)` | **none** |
| 20 | `reports/reports.service.ts:83` | `getCycleAnalysis` | leave as `cropsService.findOne(...)` — it inherits `VIEW_FINANCIALS` from #2 | **none** |

**Rationale for the non-obvious ones:**

- **#2** — `crops.findOne` is commented "STRICT — this path feeds economics/PNL". Keep that intent, but express it as the capability that actually means it: `VIEW_FINANCIALS` (owner + manager), matching the matrix. Site #20 then inherits the right behaviour for free.
- **#3** — cycle deletion. The route guard is `OWNER_ONLY`, so assert `OWNER_ONLY` explicitly in the service rather than relying on the guard alone. Note `remove` also calls `this.findOne(id, userId)` first, which after #2 requires `VIEW_FINANCIALS` — an owner satisfies both, a manager is stopped at the explicit `OWNER_ONLY` assert. That is the intended outcome.
- **#11** — recording actual feed consumed is field data, not planning. Worker-writable.
- **#15** — this is the offline-replay guard that re-verifies the *existing* row's own pond. Keep it; only the capability changes.
- **#19** — `pond-context` is a dashboard read. It must not go through the financial-strict crop path.

### Also in this PR: close the guard gap

Six of the seven affected controllers (`feed-advisor`, `disease-warning`, `measurement`, `reports`, `pond-context`, `harvest-timing`) have **no `OwnershipGuard` at all** — the service call is the only authorization. Add route-level declarations so the policy is visible where the route is defined and enforced twice:

```ts
@Get('pond/:pondId')
@UseGuards(OwnershipGuard)
@OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
async recent(@Param('pondId') pondId: string, @CurrentUser() user) { … }
```

Match each route's decorator to the capability in the table above. Where the identifying param is a crop/cycle id, use `@OwnsResource('Crop', 'id', 'pond.farm.userId', …)`.

`reports.controller.ts`'s list endpoints (`dashboard`, `financials`) additionally need scoping by `farmAccess.getFarmIdsWithCapability(userId, 'VIEW_FINANCIALS')` rather than a per-resource guard, so a manager sees only the farms whose financials they may read.

### Remove the footgun

Once all twenty sites are migrated, **delete `pondsService.findOne` and `cropsService.findOne`'s owner-only branch entirely**, or rename to `findOneAsOwner` with a doc comment. Leaving an owner-only method named `findOne` next to a member-aware `findOneAccessible` guarantees this regresses the next time someone adds an engine. Update `ponds.service.spec.ts:235,241` and `crops.service.spec.ts:174,192` accordingly.

### Tests

Every affected module already has a spec file (`crops.service.spec.ts`, `feed-advisor.service.spec.ts`, `disease-warning.service.spec.ts`, `measurement.service.spec.ts`, `pond-context.service.spec.ts`, `reports.service.spec.ts`, `harvest-timing.service.spec.ts`). For each, add the same three cases:

1. **manager passes** where the matrix says they should (mock `FarmAccessService.getRoleOnFarm` → `'manager'`)
2. **worker blocked** on a `WRITE_MANAGEMENT` / `VIEW_FINANCIALS` path, with `ForbiddenException`
3. **worker passes** on the `READ` / `WRITE_OPERATIONAL` paths

Add one table-driven test in `farm-capability.spec.ts` asserting the route-guard capability and the service capability agree for every route touched here — this is the regression that keeps W1 from un-fixing itself.

### Acceptance criteria

- [ ] Zero remaining calls to the owner-only `findOne` variants outside `ponds.service.ts` / `crops.service.ts` themselves (`grep -rn "pondsService.findOne(\|cropsService.findOne(" backend/src` returns nothing but the definitions)
- [ ] A user with `manager` on a farm can: start a cycle, close a cycle, generate and persist a feed plan, view disease warnings, view pond context, view cycle analysis
- [ ] A user with `worker` can: record measurements, record feed actuals, read plans and warnings — and is 403'd from starting/closing a cycle
- [ ] `REMEDIATION_STATUS.md` row 65 corrected with a note on what was actually outstanding
- [ ] Both test suites green, both typechecks clean

---

## W2 — The join code is the weakest link (P0)

### Problem

`farm.farmCode` is simultaneously:

- the farm's **public identity** (displayed in `FarmMembersScreen`, copyable, in QR payloads), and
- its **join credential** — `POST /farm-members/join` looks up a farm by `farmCode` and inserts a `worker` membership with `addedById: null`.

Consequences: anyone holding the code gets read access to the entire farm and write access to all operational logs. No owner approval. No expiry. No revocation. No audit trail of who let them in. And `farms.service.create()` accepts a **client-supplied** `farmCode` (`create-farm.dto.ts:29`, `@IsOptional() @IsString() @MaxLength(50)`), so an owner can set `FARM0001` and any 50-character string bypasses the 8-char generator's entropy entirely.

This undermines the role system more than any owner/worker asymmetry does: a well-designed capability matrix is worthless if the front door is a static shared string.

### Design

Split identity from credential, and put the owner in the loop.

**New table `farm_invites`:**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `farm_id` | uuid FK → farms, ON DELETE CASCADE | indexed |
| `code` | varchar(8) UNIQUE | same charset as `generateFarmCode()` (A–Z minus I/O, 2–9) |
| `role` | varchar(20) default `'worker'` | what the invite grants; validated with `canAssignRole` at creation |
| `created_by_id` | uuid FK → users, ON DELETE SET NULL | |
| `expires_at` | timestamptz | default now() + 7 days |
| `max_uses` | int default 1 | |
| `used_count` | int default 0 | |
| `revoked_at` | timestamptz null | |
| `created_at` | timestamptz default now() | |

**New endpoints** (`farm-members.controller.ts`):

- `POST /farms/:farmId/invites` — `MANAGE_WORKERS`. Body `{ role?, expiresInHours?, maxUses? }`. Enforce `canAssignRole(callerRole, role)`. Returns the code once.
- `GET /farms/:farmId/invites` — `MANAGE_WORKERS`. Active invites only.
- `DELETE /farms/:farmId/invites/:id` — `MANAGE_WORKERS`. Sets `revoked_at`.
- `POST /farm-members/join` — **rewritten**: resolve by `farm_invites.code`, reject expired / revoked / exhausted, insert membership with `role` from the invite and `addedById = invite.created_by_id`, increment `used_count` in the same transaction.

**Rate-limit `POST /farm-members/join`** with the existing `SENSITIVE_THROTTLE` (5/min) from `supabase-auth.controller.ts` — an 8-char code over a 32-char alphabet is ~10¹² combinations, which is fine against a throttled attacker and not fine against an unthrottled one.

**Decide with the human:** *pending approval* (join creates a `pending` membership the owner must accept) vs *invite-gated* (above). Invite-gated is simpler, needs no new membership state, and no new UI beyond the invite sheet. Pending-approval is safer but adds a state machine and a notification surface. **Default recommendation: invite-gated now, pending-approval only if owners ask for it.**

### Migration

New file `backend/src/migrations/<timestamp>-CreateFarmInvites.ts` — timestamp must be **greater than `1780302100000`** (the current latest). Follow the exact idempotent style of `1780300700000-CreateFarmMembers.ts`: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, FKs inside guarded `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$;` blocks, and a working `down()`.

**Backfill:** for every existing farm, insert one non-expiring `max_uses = 0` (unlimited) invite carrying the current `farmCode`, so codes already circulating among real workers keep working. Then give owners a "rotate code" action so they can retire it deliberately. **Do not silently invalidate live codes** — real farms have that string written on a whiteboard.

Because `migrationsRun: false`, the join path must tolerate the table being absent: reuse the `isMissingTable()` / `42P01` pattern and fall back to the legacy `farmCode` lookup until a human runs the migration. Say so loudly in the PR.

### Frontend

- `JoinFarmScreen` — unchanged input shape (still an 8-char code); add error states for expired / revoked / already-used.
- `FarmMembersScreen` — replace the raw farm-code display with an **Invite** sheet: generate, show, copy/share, revoke, list active invites with expiry. Keep the farm code visible as identity only, clearly separated from the invite.
- New i18n keys in the `members` namespace across **all six locales** (`en, hi, ta, te, bn, or`) — `AGENTS.md` names en-only additions as the single easiest mistake in this repo.

### Acceptance criteria

- [ ] A revoked or expired invite returns a distinct, translated error and creates no membership
- [ ] `farmCode` no longer grants access on its own once a farm has rotated its code
- [ ] `create-farm.dto.ts` no longer accepts a client-supplied `farmCode` (see **C2**)
- [ ] Existing circulating codes still work via the backfilled invite row
- [ ] Join endpoint is throttled; brute-force attempt is rate-limited in a test

---

## W3 — Collapse `accountType` into an onboarding preference (P1)

### Problem

A global owner/worker flag that gates one endpoint, lives in client-mutable auth metadata, has no post-signup UI to change it, and contradicts the per-farm role model the rest of the app uses. An "owner" account is strictly better than a "worker" account in every respect — it can do everything a worker can (join a farm, be promoted) *plus* create farms — so the choice is not a real choice, it is a trap for anyone who picks "worker" and later leases a pond.

Your own UI already teaches the correct model: `FarmContextBar` renders a per-farm `RoleBadge` (crown / hard-hat) in the farm switcher, with a code comment saying it exists to remove owner-vs-worker confusion.

### This is a deletion, not a rewrite

Do **not** touch `farm_members`, `FarmAccessService`, `CAPABILITY_ROLES`, `canAssignRole`, `canManageMember`, or `OwnershipGuard`. Those are the system you are keeping.

**Backend — remove:**

| File | Change |
|---|---|
| `farms/farms.controller.ts:29` | Delete the `if (user.accountType === 'worker') throw …` block entirely |
| `auth/guards/jwt-auth.guard.ts:79` | Stop attaching `accountType` to `req.user`, so nothing can authorize on it by accident later |
| `auth/dto/signup.dto.ts:50-51` | Remove the `accountType` field |
| `auth/supabase-auth.controller.ts:121-133` | Stop writing `account_type` into Supabase `user_metadata` |
| `auth/supabase-auth.service.ts:68` | Remove `account_type` from the signup metadata type |

**Frontend — convert to a preference:**

| File | Change |
|---|---|
| `screens/auth/RegisterScreen.tsx` | Keep the question, reword it as *intent*: "I run my own farm" / "I work on someone's farm". It no longer sends an auth claim |
| `store/authStore.ts:102-105, 316-325` | Drop `accountType` from the store. Keep `pendingFarmSetup` / `pendingFarmJoin` — they are legitimate first-run routing — but drive them from the intent answer |
| `navigation/RootNavigator.tsx:280-283` | Unchanged; still routes on `pendingFarmSetup` / `pendingFarmJoin` |
| `screens/farms/FarmsListScreen.tsx:21` | Delete the `isWorker` gate; the FAB is always available |
| `screens/main/HomeScreen.tsx:705` | Replace the either/or branch with **both** CTAs, permanently: "Create farm" *and* "Join with code" |

Persist the intent (if at all) in `users.preferences` — the `jsonb` column already exists on the `User` entity — not in Supabase auth metadata.

### Migration and rollout

**No data migration is needed, and this is worth stating in the PR.** `jwt-auth.guard.ts` already defaults absent metadata to `'owner'`, and the Truecaller / OTP / OAuth signup paths never set `account_type` at all — so a large share of existing users are *already* effectively owner accounts. Removing the check changes nothing for them and unblocks the ones who declared "worker". No memberships change, no rows move.

### Accepted cost

Some users will create junk farms by tapping around. Mitigate in UI, not with a permanent flag:

- confirmation step on farm creation
- empty-state copy that nudges the other way: *"Working on someone else's farm? Enter their code instead."*

### Where to hold the line

Do not reintroduce this idea at farm level (e.g. "only owner-type accounts may receive ownership transfer"). The membership row's `role` must be the single answer to every "may they?" question. One system, one place.

### Acceptance criteria

- [ ] `grep -rn "accountType\|account_type" backend/src frontend/src` returns only the onboarding-preference usage — zero authorization reads
- [ ] A user who signed up as "worker" can create a farm and becomes its `owner` in `farm_members`
- [ ] Both CTAs visible on Home for every account
- [ ] i18n keys for the reworded intent question present in all six locales

---

## W4 — No pond-level scoping (P2 — design first, do not implement yet)

### Problem

`getAccessibleFarmIds(userId)` returns farms, full stop. Membership is farm-level only. On a 20-pond farm, every worker can see and write to every pond. For any farm large enough to need pond supervisors — precisely the farms most likely to pay for this app — the current schema **cannot express** the thing the customer wants.

### Sketch (for the design discussion, not for implementation)

Add an optional scope to membership rather than a new role:

```
farm_member_ponds ( farm_member_id uuid FK, pond_id uuid FK, PRIMARY KEY (farm_member_id, pond_id) )
```

Semantics: **no rows = access to all ponds on that farm** (preserves every current membership's behaviour with zero backfill). One or more rows = restricted to exactly those ponds.

Enforcement point: `FarmAccessService.assertCanAccessPond` gains the pond check after the farm check; `getAccessibleFarmIds` gains a sibling `getAccessiblePondIds(userId, capability)` that list endpoints use for scoping.

**Open questions for the human before any code:**

1. Does pond scoping apply to `viewer` and `manager`, or `worker` only?
2. Does a scoped worker see farm-level aggregates that include ponds they can't open?
3. What happens to a scoped worker's access when a pond is archived or a cycle moves?

Do not write a migration until these are answered.

---

## W5 — Single owner, no recovery path (P2 — design first)

### Problem

`farm.userId` is single-valued. `transferOwnership` hands the crown to an existing member and **demotes the outgoing owner to `manager`** — there is no co-ownership. Family-run and partnership farms are the norm in this market. If the one owner account is lost (phone lost, number changed, person leaves), the farm has **no recovery path inside the app**.

There is also a latent inconsistency worth fixing regardless of the co-owner decision: `transferOwnership` never checks the target's `accountType`, so a "worker" account can be made the real owner of an existing farm while still being blocked from creating a new one. **W3 removes this inconsistency for free** — another reason to do W3.

### Two options to put to the human

**Option A — allow multiple `owner` rows.** `farm_members` already permits it (the unique index is on `(farm_id, user_id)`, not on role). Requires: making `farm.userId` a *creator* record rather than the authority, auditing every `farm.userId === userId` fast-path (`OwnershipGuard`, `getRoleOnFarm`'s fallback, `farms.findOwnedByUser`), and a rule preventing removal of the last owner.

**Option B — keep single owner, add recovery.** A nominated recovery contact, or an owner-initiated "emergency transfer" with OTP re-verification. `farm-members.service.ts` already carries a `NOTE:` that OTP re-verification on transfer (blueprint §28.6) was deferred — this is where that lands.

**Recommendation:** Option A models the real world better, but it touches the owner fast-path in the guard, which is load-bearing security code. If you take it, do the fast-path audit as its own PR *before* the schema change.

---

## W6 — Manager sees full P&L (P3 — research before building)

`VIEW_FINANCIALS: ['owner', 'manager']` means a hired manager sees the farm's profit and loss. `farm-capability.ts`'s own comment says viewer-level cost visibility should be *"only if the owner grants it, handled separately per-farm"* — that per-farm grant is **not implemented anywhere**.

Whether the current default is wrong is a product question, not an engineering one. **Ask five real farm owners before changing it.** If they want it configurable, the shape is a per-farm boolean grant (`farm_members.can_view_financials`, nullable, overriding the role default) consulted inside `roleSatisfies` — one place, consistent with everything else.

---

## Collateral fixes found in the same code paths

These are independent of the workstreams and each deserves its own issue. **C1 and C2 should ship before or with W3** — C1 in particular is the reason the `accountType` gate does not actually hold.

### C1 — `POST /auth/update` takes unvalidated input into the admin client (**security, high**)

`backend/src/auth/supabase-auth.controller.ts:593`:

```ts
@Post('update')
@UseGuards(SupabaseAuthGuard)
async updateUser(@CurrentUser() user, @Body() body: { email?; password?; data?: any }) {
  return this.supabaseAuthService.updateUser(user.id, body);  // → supabase.auth.admin.updateUserById()
}
```

No DTO, no whitelist, `data: any` passed straight into the **service-role admin client**. Two consequences:

1. Any authenticated user can `POST /auth/update {"data":{"account_type":"owner"}}` and promote themselves — so the farm-creation gate never held.
2. A user can set their own `email` through the admin API, **bypassing the verification flow** — no confirmation to the new address, no notice to the old one. Given `auth-security.md:163` explicitly reasons about not trusting unverified emails elsewhere, this is inconsistent with the project's own threat model.

**Fix:** add a validated `UpdateUserDto` whitelisting only what a user may change about themselves. Route email changes through the existing verification flow rather than the admin API. Never forward a free-form `data` object to `updateUserById`.

### C2 — Client-supplied `farmCode` (**security, medium**)

`farms/dto/create-farm.dto.ts:29` accepts an optional 50-char `farmCode`, and `farms.service.ts:85` uses it verbatim in preference to `generateFarmCode()`. This defeats the generator's entropy and, while `farmCode` remains the join credential, lets an owner set a trivially guessable one. **Remove the field from the DTO**; always generate server-side. (`generateFarmCode` also silently returns a possibly-colliding code after 10 attempts — make it throw instead, since the column is `UNIQUE` and the insert will fail anyway with a worse error.)

### C3 — Products catalog has authentication but no authorization (**security, high — audit #39**)

`backend/src/products/products.controller.ts:20`: `create`, `update`, `updateStock` and `remove` have only the global `JwtAuthGuard`. Any authenticated user — including a worker on someone else's farm — can rewrite prices, change stock, or delete the shared catalog. `UseGuards` is imported but never applied. Needs an admin check (the `roles.enum.ts` global RBAC scaffold is the natural fit) before launch.

### C4 — QR scanner dead-ends on a failed lookup (**bug — audit #58**)

`frontend/src/screens/farms/AddWorkerScreen.tsx:57` — when a scanned QR has a valid prefix but the user lookup fails, `resolveUser`'s catch never resets `scanned`, so `onBarcode`'s `if (scanned) return` blocks every subsequent scan until the user toggles modes. Reset `scanned` in the catch. Directly in the way of the invite flow you are rebuilding in W2.

### C5 — Member list swallows errors and renders "no members" (**bug — audit #59**)

`frontend/src/screens/farms/FarmMembersScreen.tsx:41` — `load()` catches all API errors and sets `members` to `[]`, so a network or server failure renders the empty state. The owner is told their roster is empty when it is not. Add an error state with retry (`ErrorState` / `NetworkError` components already exist in `components/ui/`).

---

## Verification checklist (run before every PR in this plan)

```bash
cd backend  && npx tsc --noEmit -p . && npx jest --silent --maxWorkers=2
cd frontend && npx tsc --noEmit      && npx jest --silent --maxWorkers=2
```

Plus, for any PR touching a migration:

```bash
bash scripts/verify-fresh-db.sh   # requires Docker — ask the human first
```

**Manual matrix to walk once W1–W3 are merged.** Create one farm, add three members (`manager`, `worker`, `viewer`), and confirm each of these against the capability table — this is the check no unit test fully replaces:

| Action | owner | manager | worker | viewer |
|---|:-:|:-:|:-:|:-:|
| View dashboard / ponds | ✅ | ✅ | ✅ | ✅ |
| Record water quality / feed / sampling | ✅ | ✅ | ✅ | ❌ |
| Create pond, start / close cycle | ✅ | ✅ | ❌ | ❌ |
| Generate feed plan, view disease warning | ✅ | ✅ | read-only | read-only |
| View P&L / transactions | ✅ | ✅ | ❌ | ❌ |
| Invite / remove worker | ✅ | ✅ | ❌ | ❌ |
| Change roles, delete farm, transfer ownership | ✅ | ❌ | ❌ | ❌ |
| Create a farm of their own | ✅ | ✅ | ✅ | ✅ (after W3) |

---

## Documentation to update as part of these PRs

- `docs/guides/auth-security.md` §5.3 and §6.1 — role model, capability table, and the invite flow from W2
- `REMEDIATION_STATUS.md` — correct row 65 (W1), add rows for anything closed here
- `AGENTS.md` "Codebase-specific landmines" — add a line: *engine/report services must use the member-aware `findOneAccessible`, never an owner-only fetch* (this is the recurrence you are trying to prevent)
- `docs/APP_FLOW.md` / `docs/ONBOARDING.md` — the signup question is now an intent preference, and both CTAs are permanent

---

## Summary table

| ID | Title | Priority | Type | Blocking |
|---|---|---|---|---|
| W1 | Manager role half-built — 20 owner-only call sites | P0 | Implement now | — |
| W2 | Join code: identity ≠ credential, add invites | P0 | Implement now | C2 |
| W3 | `accountType` → onboarding preference | P1 | Implement now | W2, C1 |
| W4 | Pond-level scoping | P2 | Design first | — |
| W5 | Co-owner / ownership recovery | P2 | Design first | — |
| W6 | Per-farm financial visibility grant | P3 | Research first | — |
| C1 | `POST /auth/update` unvalidated → admin client | High | Fix now | — |
| C2 | Client-supplied `farmCode` | Medium | Fix now | — |
| C3 | Products catalog missing authorization | High | Fix now | — |
| C4 | QR scanner dead-ends after failed lookup | Medium | Fix now | — |
| C5 | Member list swallows errors | Medium | Fix now | — |
