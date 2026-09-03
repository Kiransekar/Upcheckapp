# Phase 1 — Critical Bugs, Product Mistakes, Wrong Directions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the sixteen Phase 1 items from the research spec: two crash/staleness bugs, the pending-membership leak, a real permission model with harvest gating, worker access to attendance and leave, farm-explicit Team actions, confirmations on crucial edits, actor columns on money tables, offline feed timestamps, species/seed dropdowns, weekly-chem routing, pond-label and keyboard fixes.

**Architecture:** One backend PR (two migrations, capability resolution, listMine payload, harvest gate, audit stamping) deploys first. One frontend PR ships by OTA after. Work is split into file-disjoint tasks so subagents run in parallel; locale namespaces are assigned per task to avoid write conflicts.

**Tech Stack:** NestJS + TypeORM + Postgres (Jest), Expo/React Native + TanStack Query + zustand (Jest + RNTL), i18next with six locales.

**Spec:** `docs/superpowers/specs/2026-09-03-phased-remediation-research.md` §3

**Branch:** `feat/phase1-hardening` (from master `7a96efa`)

## Global Constraints

- No new native dependency in `frontend/`.
- No edits under `frontend/src/screens/auth/**`, `backend/src/auth/**`, `frontend/plugins/**`.
- Gate: `npx tsc --noEmit` + `npx jest --maxWorkers=2 --forceExit` in the package touched; `bash scripts/check-calculator-i18n.sh` on frontend.
- Six locales `en, hi, bn, ta, te, or`. **Add every new key to all six files** — do not use `t('key', 'Default')` (the `keyUsage.test.ts` ratchet at 63 will fail).
- Mixed CRLF/LF: use the Edit tool. Read a file before editing it; grep does not count.
- Migrations: additive, idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`), reversible `down()`, class `Name<timestamp>` with `name` field. Next timestamps: `1780500200000`, `1780500300000`.
- Mock `useFocusEffect` in tests with `React.useEffect(effect, [effect])`, never `[]`.
- Backend authorization lives in services via `farmAccess.assertCanAccessFarm/Pond(userId, id, CAPABILITY)`; route decorators `@OwnsResource(...)` must agree, pinned by `route-capabilities.spec.ts`.
- Owner is never reducible by any override or policy.

---

## File Structure

| Task | Files |
|---|---|
| B1 permissions | `backend/src/migrations/1780500200000-AddCapabilityPolicies.ts` (new), `farm-access/farm-capability.ts`, `farm-access/farm-member.entity.ts`, `farms/farm.entity.ts`, `farm-access/farm-access.service.ts`, `farm-members/farm-members.service.ts`, `farm-members/farm-members.controller.ts`, `farm-members/dto/capability-overrides.dto.ts` (new), `farms/dto/role-policy.dto.ts` (new), `farms/farms.controller.ts`, `farms/farms.service.ts`, `harvests/harvests.service.ts`, `harvests/harvests.controller.ts`, `harvests/harvest.entity.ts`, `farm-access/route-capabilities.spec.ts`, `farm-access/farm-capability.spec.ts` (new), `farm-members/farm-members.service.spec.ts` |
| B2 data integrity | `backend/src/migrations/1780500300000-AddMoneyAuditColumns.ts` (new), `harvests/harvest-record.entity.ts` + its service, `transactions/transaction.entity.ts`, `transactions/transactions.service.ts`, `feed-records/feed-record.entity.ts`, `feed-records/dto/create-feed-record.dto.ts`, `crops/species.ts` (new), `crops/dto/create-crop.dto.ts`, `ponds/pond-naming.service.ts`, matching specs |
| F1 errors + cache | `frontend/src/api/errors.ts` (new) + `__tests__/errors.test.ts`, all 80 `response?.data?.message` sites (excluding `screens/auth/**`), `frontend/src/query/client.ts`, `frontend/src/query/__tests__/invalidation.test.ts` (new) |
| F2 permissions client | `frontend/src/permissions/capabilities.ts`, `hooks/usePermissions.ts`, `api/farmMembers.ts`, `api/farms.ts`, `store/membershipStore.ts`, `features/species.ts` (new), `screens/farms/MemberDetailScreen.tsx`, `screens/farms/FarmMembersScreen.tsx`, `screens/ponds/PondDashboardScreen.tsx`, `screens/logs/History/WaterQualityHistoryScreen.tsx`, `screens/cycles/CreateCycleScreen.tsx`, locales `members.ts`, `ponds.ts`, `history.ts`, `cycles.ts` |
| F3 team access | `screens/main/TeamScreen.tsx`, `screens/leave/LeaveRequestsScreen.tsx`, `screens/attendance/AttendanceScreen.tsx`, locales `team.ts`, `leave.ts` |
| F4 confirm + labels + keyboard + feed time | `utils/confirm.ts` (new) + test, `screens/logs/HarvestLogScreen.tsx`, `screens/ponds/CreatePondScreen.tsx`, `screens/farms/CreateFarmScreen.tsx`, `screens/cycles/CycleDetailScreen.tsx`, `screens/logs/FeedLogScreen.tsx`, `screens/logs/History/HarvestHistoryScreen.tsx`, `screens/main/QuickLogScreen.tsx`, `components/ui/PondPicker.tsx` (no), 17 keyboard screens, locales `common.ts`, `home.ts` |

Stage A runs B1, B2, F1 in parallel. Stage B runs F2, F3, F4 in parallel after F1 lands (F1 touches many screens). Stage C is the gate, review, PR, deploy, migration, OTA.

---

## Stage A

### Task B1: Permission model, listMine payload, harvest gate (backend)

**Files:** see table.

**Interfaces produced:**
```ts
// farm-capability.ts
export type FarmCapability = 'READ' | 'WRITE_OPERATIONAL' | 'WRITE_MANAGEMENT' | 'VIEW_FINANCIALS'
  | 'MANAGE_WORKERS' | 'OWNER_ONLY' | 'RECORD_HARVEST' | 'VIEW_INVENTORY' | 'MANAGE_INVENTORY';
/** Capabilities an owner may grant/revoke per role or per member. OWNER_ONLY and READ are never overridable. */
export const OVERRIDABLE_CAPABILITIES: readonly FarmCapability[] =
  ['RECORD_HARVEST', 'VIEW_FINANCIALS', 'MANAGE_INVENTORY', 'VIEW_INVENTORY', 'MANAGE_WORKERS', 'WRITE_MANAGEMENT'];
export type CapabilityOverrides = Partial<Record<FarmCapability, boolean>>;
export type RolePolicy = Partial<Record<Exclude<FarmRole, 'owner'>, CapabilityOverrides>>;
export interface MembershipGrant { role: FarmRole | null; overrides: CapabilityOverrides | null; policy: RolePolicy | null }
export function roleSatisfies(role, capability, overrides?: CapabilityOverrides | null, policy?: RolePolicy | null): boolean
```
Resolution: `if (!role) false; if (role==='owner') true-per-matrix (never reduced); if (overrides?.[cap] !== undefined) return it; if (policy?.[role]?.[cap] !== undefined) return it; return CAPABILITY_ROLES[cap].includes(role)`. Non-overridable capabilities ignore overrides and policy.

Defaults added to `CAPABILITY_ROLES`: `RECORD_HARVEST: ['owner','manager']`, `VIEW_INVENTORY: all four`, `MANAGE_INVENTORY: ['owner','manager']`.

- [ ] **Step 1: Migration `1780500200000-AddCapabilityPolicies.ts`**
```sql
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "role_policy" jsonb;
ALTER TABLE "farm_members" ADD COLUMN IF NOT EXISTS "capability_overrides" jsonb;
UPDATE "farm_members" SET "capability_overrides" = jsonb_build_object('VIEW_FINANCIALS', "can_view_financials")
  WHERE "can_view_financials" IS NOT NULL AND "capability_overrides" IS NULL;
```
`down()` drops both columns. Keep `can_view_financials` (read nowhere after this task; dropped in Phase 3).

- [ ] **Step 2: Entities.** `Farm.rolePolicy: RolePolicy | null` (`@Column({ name: 'role_policy', type: 'jsonb', nullable: true })`); `FarmMember.capabilityOverrides: CapabilityOverrides | null` (`@Column({ name: 'capability_overrides', type: 'jsonb', nullable: true })`).

- [ ] **Step 3: `farm-capability.spec.ts`** (new) — table test: worker default cannot RECORD_HARVEST; policy `{worker:{RECORD_HARVEST:true}}` grants; member override `false` beats policy `true`; override `true` beats default; owner ignores override `false` for VIEW_FINANCIALS; `OWNER_ONLY` ignores policy `true`; viewer with policy `{viewer:{WRITE_OPERATIONAL:true}}` gets it (documented, allowed). Run: fails (signature). Implement `roleSatisfies` + constants. Run: passes.

- [ ] **Step 4: `farm-access.service.ts`.** `getMembershipOnFarm` returns `MembershipGrant` (role, overrides from member, policy from farm). Every `roleSatisfies(...)` call site passes `(role, cap, overrides, policy)`. `getAccessibleFarmIds` / `:178` map keeps the same shape via overrides. Existing specs (`pending-membership.spec.ts`, `pond-scoping.spec.ts`, `farm-access.service.spec.ts`) updated where they mock `canViewFinancials` → `overrides`. `assertCanAccessFarm(callerId, farmId, 'OWNER_ONLY')` unchanged.

- [ ] **Step 5: `listMine`.** `where: { userId: callerId, status: 'active' }`; project `status: 'active'`, `capabilityOverrides: m.capabilityOverrides ?? null`, `rolePolicy: m.farm.rolePolicy ?? null`. Owned-farm union rows carry `capabilityOverrides: null, rolePolicy: farm.rolePolicy ?? null`. Spec: a pending row is not returned; overrides and policy are projected.

- [ ] **Step 6: Endpoints.**
  - `PATCH /farms/:id/role-policy` body `{ policy: RolePolicy }` — owner only (`assertCanAccessFarm(user.id, id, 'OWNER_ONLY')`); DTO validates keys ⊆ `{manager,worker,viewer}` and inner keys ⊆ `OVERRIDABLE_CAPABILITIES`, values boolean. Returns `{ farmId, rolePolicy }`.
  - `PATCH /farms/:farmId/members/:userId/capabilities` body `{ overrides: CapabilityOverrides | null }` — owner only; target must not be owner; keys ⊆ `OVERRIDABLE_CAPABILITIES`. Replaces `setFinancialAccess` semantics; keep the old `/financials` route working by writing `{VIEW_FINANCIALS}` into overrides (one-release compatibility).
  - Specs: non-owner 403; owner target 400; invalid key 400; happy path persists.

- [ ] **Step 7: Harvest gate.** `harvests.controller.ts` all four `@OwnsResource(..., 'RECORD_HARVEST')`. `harvests.service.ts`: `create` asserts `assertCanAccessPond(userId, crop.pondId, 'RECORD_HARVEST')` (resolve crop by `createDto.cropId`) before save; `update(id, dto, userId)` and `remove(id, userId)` gain `userId`, load the harvest with `crop`, assert the same. Controller passes `user.id`. `Harvest` entity gains `createdById`/`updatedById` (`created_by_id`, `updated_by_id` uuid nullable, FK users SET NULL — column DDL is in B2's migration; entity here). `create` stamps `createdById = userId`; `update` stamps `updatedById`. Spec: worker without grant → Forbidden; worker with override `{RECORD_HARVEST:true}` → allowed (mock `farmAccess` to throw/resolve accordingly, assert capability string `'RECORD_HARVEST'`).

- [ ] **Step 8: `route-capabilities.spec.ts`.** Add rows for `HarvestsController` create/findOne/update/remove with `entityType: 'Crop'|'Harvest'`, `capability: 'RECORD_HARVEST'` (read the decorator shapes from the controller). Run whole backend gate. Commit: `feat(access): role policies, member overrides, RECORD_HARVEST capability`.

### Task B2: Money audit columns, feed timestamp, crop enums, pond count (backend)

- [ ] **Step 1: Migration `1780500300000-AddMoneyAuditColumns.ts`** — same loop as `1780300800000` over `['harvests','harvest_records','transactions']`, adding `created_by_id`, `updated_by_id` + FKs `ON DELETE SET NULL`; `down()` drops constraints then columns.
- [ ] **Step 2: Entities + stamping.** `HarvestRecord` and `Transaction` gain the two columns (the `Harvest` entity is B1's). Find where `harvest_records` rows are written (grep `harvestRecordsRepository|HarvestRecord` in `crops.service.ts`/`harvests.service.ts`; if it is inside `crops.service.closeCycle`/`recordHarvest`, stamp there with the `userId` already passed). `transactions.service.create` stamps `createdById`; `update` stamps `updatedById`. Specs: `create` result carries `createdById === userId`.
- [ ] **Step 3: Feed `recordedAt`.** `feed-record.entity.ts:43` → `@Column({ name: 'recorded_at', type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })` (mirror `water-quality-record.entity.ts:25-35` and its comment). DTO: `@IsOptional() @IsDateString() recordedAt?: string`. Service `create` passes it through (already `create(dto)`); confirm the idempotent replay path is untouched. Spec: a supplied `recordedAt` is persisted verbatim.
- [ ] **Step 4: Crop enums.** `backend/src/crops/species.ts`: `export const CANONICAL_SPECIES = ['Vannamei','Monodon','Indicus','Scampi'] as const; export const SEED_TYPES = ['PL-8','PL-9','PL-10','PL-11','PL-12','PL-13','PL-14','PL-15','Juvenile','Other'] as const;`. DTO: `@IsIn(CANONICAL_SPECIES)` on `speciesType`, `@IsIn(SEED_TYPES)` on `seedType` (both stay optional). `_e2e/create-dtos.validation.spec.ts` (or the crops DTO spec) gains: `'VannameiVannamei'` rejected, `'Vannamei'` accepted, `'PL-10'` accepted. Note in the commit body: prod contains one crop with `species_type = 'VannameiVannamei'`; `PATCH /crops/:id` with a different body still validates only the fields sent, so it is not bricked.
- [ ] **Step 5: Pond count.** `pond-naming.service.ts:39` `where: { farmId, status: Not('archived') }`. Spec asserts the `Not('archived')` where clause.
- [ ] **Step 6: Backend gate. Commit:** `fix(data): actor on money tables, client feed timestamps, crop enums, archived pond count`.

### Task F1: API error normaliser and crop cache invalidation (frontend)

- [ ] **Step 1: `frontend/src/api/errors.ts`**
```ts
/** class-validator 400s send `message: string[]`; Alert.alert(title, string[]) crashes natively on Android. Always a string. */
export function apiErrorMessage(err: unknown, fallback: string): string {
    const m = (err as any)?.response?.data?.message;
    if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join('\n') || fallback;
    if (typeof m === 'string' && m.trim()) return m;
    return fallback;
}
```
Test (`api/__tests__/errors.test.ts`): array → joined; string → itself; number/undefined/no response → fallback; empty array → fallback.
- [ ] **Step 2: Replace all 80 sites.** `grep -rn "response?\.data?\.message\|response\.data\.message" src --include=*.tsx --include=*.ts | grep -v __tests__ | grep -v screens/auth`. Typical before: `Alert.alert(t('common.error'), error.response?.data?.message || t('x.errorSave'))` → after: `Alert.alert(t('common.error'), apiErrorMessage(error, t('x.errorSave')))`. Where the site sets state (`setError(err.response?.data?.message || ...)`) the same substitution applies. Read every file before editing; batch by directory. Leave `screens/auth/**` untouched and list them in the report.
- [ ] **Step 3: Regression test** `screens/logs/__tests__/WaterQualityLogScreen.validation.test.tsx`: mock `saveRecord` to reject with `{ response: { status: 400, data: { message: ['dissolvedOxygen must not be greater than 30'] } } }`; submit; assert `Alert.alert` second arg is a string containing `dissolvedOxygen`.
- [ ] **Step 4: Cache map.** `query/client.ts`: add `['/crops', 'crop']` to `URL_ENTITY_MAP` and `crop: [['pond'], ['ponds'], ['farm'], ['farms'], ['home'], ['briefing'], ['money']]` to `ENTITY_QUERY_KEYS`. New `query/__tests__/invalidation.test.ts`: `resolveEntityForUrl('/crops')==='crop'`, `resolveEntityForUrl('/crops/abc/close')==='crop'`, and `invalidateForEntity('crop')` marks a seeded `qk.pond('p1')` query invalidated (use `queryClient.getQueryState(...).isInvalidated`).
- [ ] **Step 5: Frontend gate. Commit:** `fix(app): never pass a validation array to Alert.alert; invalidate pond caches on cycle writes`.

---

## Stage B (after F1 is committed)

### Task F2: Permission client, member permission grid, harvest gate, species/seed, weekly-chem history rows

**Consumes from B1:** `MyMembership` now `{ farmId, role, status, capabilityOverrides, rolePolicy, farm }`; endpoints `PATCH /farms/:id/role-policy` `{ policy }`, `PATCH /farms/:farmId/members/:userId/capabilities` `{ overrides }`; `FarmMember.capabilityOverrides`.

- [ ] **Step 1: `permissions/capabilities.ts`** mirrors B1 exactly: the three new capabilities, `OVERRIDABLE_CAPABILITIES`, `CapabilityOverrides`, `RolePolicy`, `roleCan(role, cap, overrides?, policy?)` with identical resolution. Test `permissions/__tests__/capabilities.test.ts` is the same table as `farm-capability.spec.ts`.
- [ ] **Step 2: Store + hook.** `MyMembership` gains the fields; `membershipStore.grantForFarm(farmId) → { role, overrides, policy }`; `usePermissions` calls `roleCan(role, c, overrides, policy)` and adds `canRecordHarvest: can('RECORD_HARVEST')`, `canViewInventory`, `canManageInventory`. `api/farmMembers.ts`: `setCapabilities(farmId, userId, overrides)`; `api/farms.ts`: `setRolePolicy(farmId, policy)`.
- [ ] **Step 3: Permission grid.** New `components/members/CapabilityGrid.tsx`: rows = `OVERRIDABLE_CAPABILITIES` with i18n labels (`members.cap_RECORD_HARVEST` …), each a three-state control: **Default / Allowed / Blocked** (`ChipGroup` single-select per row; default shows the effective value in the caption). Props `{ value: CapabilityOverrides | null, defaults: (cap) => boolean, onChange }`.
  - `FarmMembersScreen`: owner-only "Permissions by role" section with a role `ChipGroup` (manager / worker / viewer) and a `CapabilityGrid` bound to `farm.rolePolicy[role]`, saving via `setRolePolicy` with optimistic update and revert on error.
  - `MemberDetailScreen`: replace the financial `Switch` block with a `CapabilityGrid` bound to `member.capabilityOverrides`, saving via `setCapabilities`. Owner only; hidden for owner target.
  - Tests: grid renders three states; saving calls the API with the merged object; a failed save reverts.
- [ ] **Step 4: Harvest gate.** `PondDashboardScreen.tsx:725` `perms.canRecordHarvest` (also the harvest entry in the actions block, and `HarvestLog` screen's own save if it checks perms). Test: worker without grant → no harvest button; worker with `capabilityOverrides.RECORD_HARVEST=true` → button present.
- [ ] **Step 5: Weekly-chem rows and route.** `PondDashboardScreen.tsx:98` `historyRoute: 'WaterQualityHistory'`. `WaterQualityHistoryScreen` card grid: render only the metrics that are non-null on that record, from an ordered list of ten (`ph, dissolvedOxygen, temperature, salinity, ammonia, nitrite, nitrate, alkalinity, hardness, transparency`); if a record has none of the first four but some of the last six, show a "Weekly chemistry" caption on the card. Add `history.waterQualityMetric{Ammonia,Nitrite,Nitrate,Alkalinity,Hardness,Transparency}` + `history.weeklyChemistryTag` to all six locales. Test: a chemistry-only record renders ammonia and no `--` placeholders.
- [ ] **Step 6: Species and seed dropdowns.** `features/species.ts`: `CANONICAL_SPECIES`/`SEED_TYPES` mirrored from B2 with label keys (`cycles.species_Vannamei` = "Vannamei (L. vannamei)", `cycles.species_Monodon` = "Tiger prawn (P. monodon)", `cycles.species_Indicus` = "Indian white prawn (P. indicus)", `cycles.species_Scampi` = "Scampi (M. rosenbergii)"; seed labels literal). `CreateCycleScreen`: `SelectField` for both, species default `'Vannamei'`, seed required. `waterQualityThresholds.toThresholdSpecies`: returns `null` for unknown; the one caller (`WaterQualityHistoryScreen.tsx:94`) falls back to `'vannamei'` explicitly with a comment. Test: `toThresholdSpecies('VannameiVannamei')` → `'vannamei'` (contains) stays; `toThresholdSpecies('banana')` → `null`.
- [ ] **Step 7: Pond title.** `PondDashboardScreen.tsx:442` `title={pond ? pondLabel(pond) : (pondName ?? t('ponds.title'))}` importing `pondLabel` from `utils/pondHealth`.
- [ ] **Step 8: Locales** (`members.ts`, `ponds.ts`, `history.ts`, `cycles.ts` × 6). Frontend gate. Commit: `feat(access): permission grid, harvest gate, species/seed dropdowns, chemistry in history`.

### Task F3: Team access and farm-explicit actions

- [ ] **Step 1: Unhide rows.** `TeamScreen.tsx:290` `perms.canManageMembers` → `perms.canRecordData` for the Attendance/Leave block. For non-managers, the Attendance row subtitle shows the user's own state (`team.yourAttendance`), not the roster count; the Leave row subtitle shows own open requests.
- [ ] **Step 2: Self check-in card.** Always render the card for `canRecordData` roles: when `myAttendance` is null show `team.checkInCta` calling `attendanceApi.checkIn({ farmId })` (needs a concrete farm — see Step 3), else the existing check-out card.
- [ ] **Step 3: Farm chooser in All mode.** New local `useFarmChooser()` in `TeamScreen`: when `activeScope === ALL && farms.length > 1`, the Manage-team, Attendance, Assign and check-in actions open a `Modal` with a `SelectField`-style list of farms (reuse `SelectField`'s modal list if exportable; otherwise a simple `FlatList` of `Card` rows) and navigate with the chosen `farmId`. When only one farm, no chooser. `perms` for the button gating use `canRecordData`/`canManageMembers` on **any** farm in scope (`farms.some`), not `farms[0]`.
- [ ] **Step 4: Leave submit.** `LeaveRequestsScreen.tsx:151` `farmId: farmId ?? selectedFarmId`, where `selectedFarmId` comes from a `SelectField` shown above the form when `route.params.farmId` is undefined and `farms.length > 1` (defaults to `farms[0]`).
- [ ] **Step 5: `keyboardShouldPersistTaps="handled"`** on the own-ScrollView in `LeaveRequestsScreen`.
- [ ] **Step 6: Tests.** `TeamScreen`: worker role renders Attendance and Leave rows and the check-in CTA; owner in All mode with two farms tapping Manage team opens the chooser and does not navigate; choosing farm B navigates with `farmId: 'b'`. `LeaveRequestsScreen`: with undefined `farmId` submit posts a concrete farm.
- [ ] **Step 7: Locales** `team.ts`, `leave.ts` × 6. Gate. Commit: `fix(team): workers reach attendance and leave; team actions pick an explicit farm`.

### Task F4: Confirm helper, crucial-edit confirms, pond labels, feed timestamp, keyboard taps

- [ ] **Step 1: `utils/confirm.ts`**
```ts
export const confirm = (o: { title: string; message?: string; confirmLabel: string; cancelLabel: string; destructive?: boolean }) =>
    new Promise<boolean>((resolve) => Alert.alert(o.title, o.message, [
        { text: o.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: o.confirmLabel, style: o.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
```
Test: resolves true on confirm press, false on cancel and on dismiss.
- [ ] **Step 2: Apply.** Before save when editing: `HarvestLogScreen` (edit mode, `common.confirmEditTitle` / `logs.harvest_confirmEdit`), `CreatePondScreen` (edit mode, any change; keep the stricter dimensions message when dimensions changed on a stocked pond), `CreateFarmScreen` (edit mode), `CycleDetailScreen` close (swap the inline `Alert.alert` for `confirm`). Tests: each edit path calls `Alert.alert` with the confirm buttons and does not call the API when cancelled.
- [ ] **Step 3: Feed timestamp.** `FeedLogScreen` payload adds `recordedAt: new Date().toISOString()` at submit time (read `WaterQualityLogScreen` for how it stamps `recordedAt`). Test: payload carries `recordedAt`.
- [ ] **Step 4: Pond labels.** `HarvestHistoryScreen.tsx:82,163` pass `pondName: route.params.pondName ?? ''` (read what the screen receives; if it has the pond, use `pondLabel`). `QuickLogScreen`: import `pondLabel` from `utils/pondHealth`, delete the local one; when the user has ponds from more than one `farmId`, render the farm name under each chip (fetch farms via `farmsApi.getAll()` once; map `farmId → name`). Test: two ponds on different farms show two farm captions.
- [ ] **Step 5: Keyboard.** `keyboardShouldPersistTaps="handled"` on the own `<ScrollView>` of: `logs/WaterQualityLogScreen, ChemicalLogScreen, FeedLogScreen, SamplingLogScreen, MortalityLogScreen, HarvestLogScreen, TreatmentLogScreen, DiseaseLogScreen, PlanktonLogScreen, MicrobiologyLogScreen, diseases/DiseaseListScreen, finance/ExpensesScreen, harvest/HarvestPlansScreen, ponds/CreatePondScreen, settings/ProfileScreen, settings/TwoFactorScreen`. Not `LeaveRequestsScreen` (F3) and not `screens/auth/**`.
- [ ] **Step 6: Locales** `common.ts` (`confirmEditTitle`, `confirmEditMessage`, `confirm`, `cancel` if absent), `home.ts` × 6. Gate. Commit: `fix(ux): confirm crucial edits, real pond labels, feed log time, keyboard taps`.

---

## Stage C

- [ ] Full gate both packages; `bash scripts/check-calculator-i18n.sh`.
- [ ] `/code-review` on the branch diff; fix findings.
- [ ] Push, PR to master, merge.
- [ ] Apply migrations `1780500200000` and `1780500300000` on prod (hand-run), verify columns, confirm Render deploy `live`, `/api/health` ok, `GET /api/farms/x/role-policy` guarded (401).
- [ ] `eas update --channel preview` with the merge commit message; record group id.
- [ ] Maestro on the OPPO: DO=400 alert; cycle create refreshes dashboard; worker sees attendance row and can check in; worker without grant sees no harvest button; owner grants RECORD_HARVEST to worker role → button appears.
