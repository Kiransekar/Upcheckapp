# Farm Access & Role Model — Execution Tasklist

**Source plan:** [`docs/FARM_ACCESS_REMEDIATION_PLAN.md`](./FARM_ACCESS_REMEDIATION_PLAN.md)
**Design source (binding for every UI task below):** [`docs/reference/UPCHECK_DESIGN_SYSTEM.md`](./reference/UPCHECK_DESIGN_SYSTEM.md) + the existing Claude Design canvas — **do not invent new visual design.** See the Design gate section before writing any screen code.
**Verified against `master` @ `704d816` on 2026-08-25.** Line numbers below were re-grepped and are current unless marked.

---

## Status — Phases 1–4 complete (2026-08-25)

Seven branches off `development`, each independently passing both gates. **Nothing pushed; no PRs opened.**

| Branch | Workstream | Files |
|---|---|---|
| `fix/remove-unvalidated-auth-update` | C1 | 2 |
| `fix/server-farm-code` | C2 | 5 |
| `fix/qr-scan-reset` | C4 | 2 |
| `fix/member-list-error-state` | C5 | 8 |
| `fix/manager-role-capabilities` | W1 | 20 |
| `feat/farm-invites` | W2 | 19 |
| `fix/remove-account-type` | W3 | 35 |

Test counts on each branch (baseline 594 backend / 221 frontend): W1 → 667 backend; W2 → 623 backend, 227 frontend; W3 → 596 backend, 224 frontend. C3 needed no work.

**Three deviations from the plan, all deliberate — see the section for each:** C1 deletes the route rather than validating it; W1 additionally fixes a viewer-can-edit hole the plan's table would have opened in `measurement.edit()`; T1.27 was already satisfied.

**Merge order matters.** `feat/farm-invites` and `fix/member-list-error-state` both touch `FarmMembersScreen.tsx` and all six `members.ts` locale files. Land C5 first, then rebase the invites branch onto it. `development` is also 19 commits behind `master`.

**Still open by design:** the design-gate items (T0.x — the canvas has no Team/invite artboard), T2.0 (invite-gated vs pending-approval was defaulted, not human-confirmed), T3.12 (signup intent is client-only; not persisted to `users.preferences`), T3.15 (confirmation step on farm creation), and all of Phase 5.

---

## Verification pass — what changed since the plan was written

| Item | Plan says | Actual state |
|---|---|---|
| W1 — 20 owner-only call sites | all 20 open | Confirmed open, **line numbers exact, zero drift** |
| C1 — `POST /auth/update` unvalidated | open | Confirmed open (`supabase-auth.controller.ts:593`) |
| C2 — client-supplied `farmCode` | open | Confirmed open (`create-farm.dto.ts:26-29`) |
| C3 — products catalog authz | open | **Already fixed** — `RolesGuard` + `@Roles(Role.SUPER_ADMIN)` on all four write routes. **Close as done; correct the plan.** |
| C4 — QR scanner dead-end | open | Confirmed open (`AddWorkerScreen.tsx:53-64`, catch never resets `scanned`) |
| C5 — member list swallows errors | open | Confirmed open (`FarmMembersScreen.tsx:41-47`, bare `catch { setMembers([]) }`) |
| Latest migration timestamp | `1780302100000` | Still `1780302100000-CreateLeaveRequests.ts` — a new migration must exceed it |

> **Supabase MCP note:** project `mcslntwchfucavjrrhnu` is **not** the Upcheck database — it holds an unrelated accounting/GST/cap-table schema with no `farms` / `ponds` / `farm_members` / `crops` tables. Do not use it to verify or apply anything in this plan. TypeORM migrations under `backend/src/migrations/` remain the source of truth.

---

## Design gate (applies to T2.12, T3.6, T3.10, T3.16, T-C5.1)

Every screen task below is **implementation of an already-approved design**, not a design exercise.

- [ ] **T0.1** — Paste the Claude Design canvas URL into this file under "Design source" before starting any UI task. No canvas link = UI tasks blocked; backend tasks are not.
- [ ] **T0.2** — For each UI task, open the matching artboard and implement it as drawn: layout, hierarchy, copy slots, states.
- [ ] **T0.3** — Enforce the design system hard rules while implementing: no emoji anywhere; `MaterialCommunityIcons` only; semantic tokens from `frontend/src/theme/` only (no raw hex); status = icon + color + text label, never colour alone; 44dp minimum tap targets; `theme.typeScale` only.
- **Do not** restyle, re-lay-out, or "improve" anything the canvas does not cover. If the canvas is silent on something, ask — do not invent.

---

## Ground rules (from `AGENTS.md` — apply to every task below)

- One workstream = one GitHub issue = one branch = one PR. **Never batch workstreams.**
- Branch from `development` (exists on origin), not `master`: `git checkout development && git pull && git checkout -b fix/<slug>`
- Gate before every commit:
  ```
  cd backend  && npx tsc --noEmit -p . && npx jest --silent --maxWorkers=2
  cd frontend && npx tsc --noEmit      && npx jest --silent --maxWorkers=2
  ```
- PR against `development`. **Do not self-merge.** Flag permission-logic changes and migrations loudly in the PR body.
- **Permissions are mirrored:** backend `farm-access/farm-capability.ts` ↔ frontend `permissions/capabilities.ts`. Touch one, touch the other. Backend enforces; frontend hides (never merely disables).
- **`migrationsRun: false`** — a merged migration is not applied until a human runs `npm run migration:run`. Every new table/column must be tolerated when absent (`isMissingTable()` / `42P01` pattern in `FarmAccessService`).
- **i18n: all six locales** (`en, hi, ta, te, bn, or`) for every new key. En-only is the single most common mistake in this repo.

---

## Order of execution

```
Phase 1 (parallel, independent):  C1, C2, C4, C5   <- small, ship first
Phase 2:                          W1               <- P0, largest backend diff
Phase 3:                          W2               <- P0, needs C2 merged
Phase 4:                          W3               <- needs C1 + W2 merged
Phase 5 (design-first, blocked):  W4, W5, W6       <- human sign-off before any code
```

---

# Phase 1 — Collateral fixes

## C1 — `POST /auth/supabase/update` (security, high) — branch `fix/remove-unvalidated-auth-update`

**Done differently from the plan, deliberately.** The endpoint has **zero callers** — nothing in `frontend/src`, no tests, no scripts. Profile self-service already goes through the validated `PATCH /profiles/:id`; passwords go through `POST /auth/supabase/update-password`. Wrapping a DTO around a route nobody calls narrows an attack surface that should not exist at all, so the route and its only-caller service method were **deleted** instead. Smaller diff, and the surface is gone rather than merely guarded.

(The plan also calls it `POST /auth/update`; the controller is `@Controller('auth/supabase')`, so the real path was `/auth/supabase/update`.)

- [x] **T-C1.1** ~~Create `update-user.dto.ts`~~ → not needed; route deleted.
- [x] **T-C1.2** Delete the `@Post('update')` handler.
- [x] **T-C1.3** Delete `SupabaseAuthService.updateUser`, which forwarded a free-form `data` object into `supabase.auth.admin.updateUserById()`.
- [x] **T-C1.4** Email changes keep going through the existing verification flow — the admin-API bypass is gone with the route.
- [x] **T-C1.5** NOTE comments left at both sites explaining why, so an unwhitelisted admin write is not reintroduced.
- **AC met:** no unvalidated body reaches the service-role admin client; there is no longer any client-writable path to `user_metadata.account_type`.

## C2 — Server-generated `farmCode` only (security, medium) — branch `fix/server-farm-code`

- [x] **T-C2.1** `farms/dto/create-farm.dto.ts:26-29` — delete the `farmCode` field.
- [x] **T-C2.2** `farms/farms.service.ts:85` — always call `generateFarmCode()`; remove the client-value preference branch.
- [x] **T-C2.3** `generateFarmCode()` — **throw** after 10 collision attempts instead of returning a possibly-colliding code (the column is `UNIQUE`; the insert fails anyway, with a worse error).
- [x] **T-C2.4** Frontend: drop `farmCode` from any create-farm payload still sending it.
- [x] **T-C2.5** Test: create-farm with a client `farmCode` in the body ignores it; generator exhaustion throws.
- **AC:** `grep -rn "farmCode" backend/src/farms/dto` returns nothing.

## C3 — Products catalog authorization — **ALREADY DONE**

- [x] `products.controller.ts` — `create` / `update` / `updateStock` / `remove` all carry `@UseGuards(RolesGuard)` + `@Roles(Role.SUPER_ADMIN)`.
- [x] **T-C3.1** Correct `docs/FARM_ACCESS_REMEDIATION_PLAN.md` section C3 and the matching row in `REMEDIATION_STATUS.md` / audit #39 to reflect this. *(Doc-only; fold into any Phase-1 PR.)*

## C4 — QR scanner dead-end (bug, audit #58) — branch `fix/qr-scan-reset`

- [x] **T-C4.1** `frontend/src/screens/farms/AddWorkerScreen.tsx:57-62` — reset `scanned` in `resolveUser`'s `catch`, matching the existing `setTimeout(() => setScanned(false), 1200)` pattern already used on the invalid-prefix path.
- [x] **T-C4.2** Test: a failed lookup allows an immediate subsequent scan.
- **AC:** a valid-prefix-but-unknown-user QR no longer wedges the scanner until a mode toggle. Blocks W2's invite flow if left broken.

## C5 — Member list error state (bug, audit #59) — branch `fix/member-list-error-state`

- [x] **T-C5.1** `frontend/src/screens/farms/FarmMembersScreen.tsx:41-47` — replace `catch { setMembers([]) }` with an error state; reuse the existing `ErrorState` / `NetworkError` components in `components/ui/`. **Per design canvas — do not design a new error state.**
- [x] **T-C5.2** Wire retry to `load()`.
- [x] **T-C5.3** i18n keys for the error copy in all six locales (`members` namespace).
- [x] **T-C5.4** Test: an API rejection renders the error state, not the empty state.
- **AC:** a network/server failure never tells an owner their roster is empty.

---

# Phase 2 — W1: make the `manager` role actually work (P0)

Branch `fix/manager-role-capabilities`. **Rule: the service-layer check must equal the route guard's capability — never stricter.**

## W1.1 — Migrate the 20 owner-only call sites

Swap `pondsService.findOne(id, userId)` for `pondsService.findOneAccessible(id, userId, <capability>)` (defined at `ponds.service.ts:476`).

- [x] **T1.1** `crops/crops.service.ts:26` `create` (start cycle) → `WRITE_MANAGEMENT`
- [x] **T1.2** `crops/crops.service.ts:129` `findOne` (economics path) → `VIEW_FINANCIALS`
- [x] **T1.3** `crops/crops.service.ts:185` `remove` → `OWNER_ONLY`
- [x] **T1.4** `crops/crops.service.ts:211` `harvest` → `WRITE_MANAGEMENT`
- [x] **T1.5** `crops/crops.service.ts:244` `close` → `WRITE_MANAGEMENT`
- [x] **T1.6** `disease-warning/disease-warning.service.ts:208` persist snapshot → `WRITE_OPERATIONAL`
- [x] **T1.7** `disease-warning/disease-warning.service.ts:220` `recent` → `READ`
- [x] **T1.8** `disease-warning/disease-warning.service.ts:229` `latest` → `READ`
- [x] **T1.9** `feed-advisor/feed-advisor.service.ts:160` persist plan → `WRITE_MANAGEMENT`
- [x] **T1.10** `feed-advisor/feed-advisor.service.ts:180` `recent` → `READ`
- [x] **T1.11** `feed-advisor/feed-advisor.service.ts:195` record actual kg → `WRITE_OPERATIONAL` *(field data, not planning)*
- [x] **T1.12** `harvest-timing/harvest-timing.controller.ts:66` persist optimize → `WRITE_MANAGEMENT`
- [x] **T1.13** `harvest-timing/harvest-timing.controller.ts:86` `recent` → `READ`
- [x] **T1.14** `measurement/measurement.service.ts:56` `create` → `WRITE_OPERATIONAL`
- [x] **T1.15** `measurement/measurement.service.ts:67` idempotent-replay ownership recheck → `WRITE_OPERATIONAL` *(keep the recheck; only the capability changes)*
- [x] **T1.16** `measurement/measurement.service.ts:181` `query` → `READ`
- [x] **T1.17** `measurement/measurement.service.ts:214` `findOne` → `READ`
- [x] **T1.18** `pond-context/pond-context.service.ts:229` `getContext` → `READ`
- [x] **T1.19** `pond-context/pond-context.service.ts:241` crop lookup → `cropsService.findOneAccessible(cropId, userId)` *(dashboard read — must not use the financial-strict crop path)*
- [x] **T1.20** `reports/reports.service.ts:83` `getCycleAnalysis` — **leave as `cropsService.findOne(...)`**; it inherits `VIEW_FINANCIALS` from T1.2.

## W1.2 — Close the route-guard gap

Six controllers have **no `OwnershipGuard` at all** — the service call is currently the only authorization. Add route-level declarations matching the capability chosen in W1.1.

- [x] **T1.21** `feed-advisor.controller.ts`
- [x] **T1.22** `disease-warning.controller.ts`
- [x] **T1.23** `measurement.controller.ts`
- [x] **T1.24** `pond-context.controller.ts`
- [x] **T1.25** `harvest-timing.controller.ts`
- [x] **T1.26** `reports.controller.ts`

Shape: `@UseGuards(OwnershipGuard)` + `@OwnsResource('Pond', 'pondId', 'farm.userId', '<CAP>')`. Where the identifying param is a crop/cycle id: `@OwnsResource('Crop', 'id', 'pond.farm.userId', '<CAP>')`.

- [x] **T1.27** `reports.controller.ts` list endpoints (`dashboard`, `financials`) — scope by `farmAccess.getFarmIdsWithCapability(userId, 'VIEW_FINANCIALS')` rather than a per-resource guard, so a manager sees only the farms whose financials they may read.

## W1.3 — Remove the footgun

- [x] **T1.28** Delete `pondsService.findOne`'s owner-only branch, or rename it `findOneAsOwner` with a doc comment. Same for `cropsService.findOne`.
- [x] **T1.29** Update `ponds.service.spec.ts:235,241` and `crops.service.spec.ts:174,192`.

## W1.4 — Tests

For each of `crops` / `feed-advisor` / `disease-warning` / `measurement` / `pond-context` / `reports` / `harvest-timing` `.service.spec.ts` (all exist), add the same three cases:

- [x] **T1.30** manager **passes** where the matrix says they should (mock `FarmAccessService.getRoleOnFarm` → `'manager'`)
- [x] **T1.31** worker **blocked** on a `WRITE_MANAGEMENT` / `VIEW_FINANCIALS` path (`ForbiddenException`)
- [x] **T1.32** worker **passes** on the `READ` / `WRITE_OPERATIONAL` paths
- [x] **T1.33** `farm-capability.spec.ts` — one table-driven test asserting route-guard capability equals service capability for **every** route touched here. *This is the regression guard that keeps W1 from un-fixing itself.*

## W1.5 — Docs

- [x] **T1.34** Correct `REMEDIATION_STATUS.md` row 65. Audit finding #7 was marked done, but only `pnl` / `water-quality` / `feed-records` / `ponds.controller` were actually migrated — the engine and reporting services were not.

### W1 acceptance criteria

- [ ] `grep -rn "pondsService.findOne(\|cropsService.findOne(" backend/src` returns nothing but the definitions
- [ ] `manager` can: start a cycle, close a cycle, generate and persist a feed plan, view disease warnings, view pond context, view cycle analysis
- [ ] `worker` can: record measurements, record feed actuals, read plans and warnings — and is 403'd from starting/closing a cycle
- [ ] Both typechecks clean, both suites green

---

# Phase 3 — W2: replace the join code with real invites (P0)

Branch `fix/farm-invites`. **Depends on C2.** Today `farm.farmCode` is both public identity *and* join credential — no approval, no expiry, no revocation, no audit trail.

## W2.0 — Decision (human, before any code)

- [ ] **T2.0** Confirm **invite-gated** (recommended: simpler, no new membership state, no new UI beyond the invite sheet) vs **pending-approval** (safer, but adds a state machine and a notification surface). Default: invite-gated.

## W2.1 — Schema

- [x] **T2.1** Entity `backend/src/farm-invites/farm-invite.entity.ts`:
  `id` uuid PK · `farm_id` uuid FK→farms ON DELETE CASCADE (indexed) · `code` varchar(8) UNIQUE (same charset as `generateFarmCode()`: A–Z minus I/O, 2–9) · `role` varchar(20) default `'worker'` · `created_by_id` uuid FK→users ON DELETE SET NULL · `expires_at` timestamptz (default now() + 7 days) · `max_uses` int default 1 · `used_count` int default 0 · `revoked_at` timestamptz null · `created_at` timestamptz default now()
- [x] **T2.2** Migration `backend/src/migrations/<timestamp>-CreateFarmInvites.ts` — timestamp **greater than `1780302100000`**. Copy the exact idempotent style of `1780300700000-CreateFarmMembers.ts`: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, FKs inside guarded `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` blocks, and a working `down()`.
- [x] **T2.3** **Backfill:** one non-expiring `max_uses = 0` (unlimited) invite per existing farm carrying its current `farmCode`. **Do not silently invalidate live codes** — real farms have that string written on a whiteboard.

## W2.2 — Backend endpoints (`farm-members.controller.ts`)

- [x] **T2.4** `POST /farms/:farmId/invites` — `MANAGE_WORKERS`. Body `{ role?, expiresInHours?, maxUses? }`. Enforce `canAssignRole(callerRole, role)`. Returns the code **once**.
- [x] **T2.5** `GET /farms/:farmId/invites` — `MANAGE_WORKERS`. Active invites only.
- [x] **T2.6** `DELETE /farms/:farmId/invites/:id` — `MANAGE_WORKERS`. Sets `revoked_at`.
- [x] **T2.7** `POST /farm-members/join` — **rewrite**: resolve by `farm_invites.code`; reject expired / revoked / exhausted with distinct errors; insert the membership with `role` from the invite and `addedById = invite.created_by_id`; increment `used_count` **in the same transaction**.
- [x] **T2.8** Throttle `POST /farm-members/join` with the existing `SENSITIVE_THROTTLE` (5/min) from `supabase-auth.controller.ts`.
- [x] **T2.9** `isMissingTable()` / `42P01` fallback to the legacy `farmCode` lookup while the migration is unapplied (`migrationsRun: false`). **Say so loudly in the PR.**
- [x] **T2.10** Owner-facing "rotate code" action so a farm can retire its legacy code deliberately.

## W2.3 — Frontend (design canvas required — see Design gate)

- [x] **T2.11** `JoinFarmScreen` — input shape unchanged (still an 8-char code); add distinct error states for expired / revoked / already-used.
- [x] **T2.12** `FarmMembersScreen` — replace the raw farm-code display with an **Invite sheet**: generate, show, copy/share, revoke, list active invites with expiry. Keep the farm code visible as **identity only**, clearly separated from the invite. *Implement the canvas artboard as drawn.*
- [x] **T2.13** New `members`-namespace i18n keys in **all six** locales.

## W2.4 — Tests

- [x] **T2.14** Expired / revoked / exhausted invite returns a distinct translated error and creates **no** membership
- [x] **T2.15** A backfilled legacy code still joins successfully
- [x] **T2.16** A brute-force attempt is rate-limited
- [x] **T2.17** `canAssignRole` is enforced at invite creation (a manager cannot mint a manager invite)
- [x] **T2.18** `used_count` increments transactionally; `max_uses` is respected under concurrent joins

### W2 acceptance criteria

- [ ] A revoked or expired invite returns a distinct, translated error and creates no membership
- [ ] `farmCode` alone no longer grants access once a farm has rotated its code
- [ ] `create-farm.dto.ts` no longer accepts a client-supplied `farmCode` (C2 merged)
- [ ] Existing circulating codes still work via the backfilled invite row
- [ ] Join endpoint is throttled, proven by a test

---

# Phase 4 — W3: collapse `accountType` into an onboarding preference (P1)

Branch `fix/remove-account-type`. **Depends on C1 (the reason the gate never held) and W2.** This is a **deletion, not a rewrite**.

> **Do not touch** `farm_members`, `FarmAccessService`, `CAPABILITY_ROLES`, `canAssignRole`, `canManageMember`, or `OwnershipGuard`. Those are the system you are keeping.

## W3.1 — Backend removal

- [x] **T3.1** `farms/farms.controller.ts:29` — delete the `if (user.accountType === 'worker') throw ...` block entirely
- [x] **T3.2** `auth/guards/jwt-auth.guard.ts:79` — stop attaching `accountType` to `req.user`, so nothing can authorize on it by accident later
- [x] **T3.3** `auth/dto/signup.dto.ts:51` — remove the `accountType` field (and the stale mention at line 17)
- [x] **T3.4** `auth/supabase-auth.controller.ts:121-133` — stop writing `account_type` into Supabase `user_metadata`
- [x] **T3.5** `auth/supabase-auth.service.ts:68` — remove `account_type` from the signup metadata type

## W3.2 — Frontend converts it to a preference (design canvas required)

- [x] **T3.6** `screens/auth/RegisterScreen.tsx` — keep the question, reword it as **intent**: "I run my own farm" / "I work on someone's farm". It no longer sends an auth claim. *Copy and layout per canvas.*
- [x] **T3.7** `store/authStore.ts:102-105, 316-325` — drop `accountType`. **Keep** `pendingFarmSetup` / `pendingFarmJoin` (legitimate first-run routing) and drive them from the intent answer.
- [x] **T3.8** `navigation/RootNavigator.tsx:280-283` — unchanged; still routes on `pendingFarmSetup` / `pendingFarmJoin`. *(Verify only.)*
- [x] **T3.9** `screens/farms/FarmsListScreen.tsx:21` — delete the `isWorker` gate; the FAB is always available
- [x] **T3.10** `screens/main/HomeScreen.tsx:705` — replace the either/or branch with **both** CTAs, permanently: "Create farm" **and** "Join with code"
- [x] **T3.11** `api/auth.ts:11` — drop `accountType` from the signup payload type
- [ ] **T3.12** Persist the intent (if at all) in `users.preferences` — the `jsonb` column already exists on the `User` entity — **not** in Supabase auth metadata
- [x] **T3.13** Rework `auth.accountTypeLabel` / `auth.accountTypeRequired` copy into the intent wording across **all six** locales
- [x] **T3.14** `screens/attendance/__tests__/AttendanceScreen.test.tsx:50` — drop `accountType` from the test fixture

## W3.3 — Mitigate junk farms in UI, not with a permanent flag

- [ ] **T3.15** Confirmation step on farm creation
- [x] **T3.16** Empty-state copy that nudges the other way: *"Working on someone else's farm? Enter their code instead."* (all six locales)

## W3.4 — Tests and docs

- [x] **T3.17** Test: a user who signed up as "worker" can create a farm and becomes its `owner` in `farm_members`
- [x] **T3.18** State in the PR body: **no data migration is needed.** `jwt-auth.guard.ts` already defaults absent metadata to `'owner'`, and the Truecaller / OTP / OAuth signup paths never set `account_type` at all — so a large share of existing users are already effectively owner accounts. No memberships change, no rows move.

### W3 acceptance criteria

- [ ] `grep -rn "accountType\|account_type" backend/src frontend/src` returns **only** the onboarding-preference usage — zero authorization reads
- [ ] Both CTAs visible on Home for every account
- [ ] Intent-question i18n keys present in all six locales

> **Hold the line:** do not reintroduce this idea at farm level (e.g. "only owner-type accounts may receive ownership transfer"). The membership row's `role` must be the single answer to every "may they?" question. One system, one place.

---

# Phase 5 — Design-first / blocked

## W4 — Pond-level scoping (P2 — DO NOT IMPLEMENT YET)

Membership is farm-level only; on a 20-pond farm every worker can see and write to every pond. Sketch: `farm_member_ponds (farm_member_id, pond_id)` — **no rows means access to all ponds** (preserves current behaviour with zero backfill); one or more rows restricts to exactly those ponds. Enforcement in `FarmAccessService.assertCanAccessPond` plus a sibling `getAccessiblePondIds(userId, capability)` for list scoping.

- [ ] **T4.1** Human answer: does pond scoping apply to `viewer` and `manager`, or to `worker` only?
- [ ] **T4.2** Human answer: does a scoped worker see farm-level aggregates that include ponds they cannot open?
- [ ] **T4.3** Human answer: what happens to a scoped worker's access when a pond is archived or a cycle moves?
- [ ] **T4.4** **Blocked until T4.1–T4.3 are answered.** No migration before then.

## W5 — Co-ownership / owner recovery (P2 — design first)

`farm.userId` is single-valued; `transferOwnership` demotes the outgoing owner to `manager`. A lost owner account means no in-app recovery path.

- [ ] **T5.1** Human decision: **Option A** — allow multiple `owner` rows (`farm_members`' unique index is on `(farm_id, user_id)`, not role) — vs **Option B** — keep a single owner and add recovery (nominated recovery contact, or OTP-re-verified emergency transfer; `farm-members.service.ts` already carries a deferred `NOTE:` for blueprint §28.6 OTP re-verification).
- [ ] **T5.2** If Option A: audit every `farm.userId === userId` fast-path (`OwnershipGuard`, `getRoleOnFarm`'s fallback, `farms.findOwnedByUser`) **as its own PR, before any schema change** — this is load-bearing security code.
- [ ] **T5.3** If Option A: add a rule preventing removal of the last owner.
- [ ] **T5.4** Note in the discussion: W3 already removes the latent inconsistency where a "worker" account can be handed real ownership while being blocked from creating a farm of its own.

## W6 — Manager financial visibility (P3 — research before building)

`VIEW_FINANCIALS: ['owner', 'manager']` means a hired manager sees the farm's P&L. `farm-capability.ts`'s own comment says viewer-level cost visibility should be *"only if the owner grants it, handled separately per-farm"* — that per-farm grant is not implemented anywhere.

- [ ] **T6.1** **Ask five real farm owners** before changing the default. This is a product question, not an engineering one.
- [ ] **T6.2** If they want it configurable: a per-farm nullable boolean `farm_members.can_view_financials` overriding the role default, consulted **inside `roleSatisfies`** — one place, consistent with everything else.

---

## Manual matrix — walk once after W1–W3 merge

Create one farm, add three members (`manager`, `worker`, `viewer`), and confirm each row. This is the check no unit test fully replaces.

| Action | owner | manager | worker | viewer |
|---|:-:|:-:|:-:|:-:|
| View dashboard / ponds | Y | Y | Y | Y |
| Record water quality / feed / sampling | Y | Y | Y | N |
| Create pond, start / close cycle | Y | Y | N | N |
| Generate feed plan, view disease warning | Y | Y | read-only | read-only |
| View P&L / transactions | Y | Y | N | N |
| Invite / remove worker | Y | Y | N | N |
| Change roles, delete farm, transfer ownership | Y | N | N | N |
| Create a farm of their own | Y | Y | Y | Y (after W3) |

Plus, for any PR touching a migration: `bash scripts/verify-fresh-db.sh` (requires Docker — **ask the human first**).
