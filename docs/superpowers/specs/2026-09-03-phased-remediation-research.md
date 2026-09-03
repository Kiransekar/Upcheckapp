# Phased Remediation — Research Findings and Phase Split

**Date:** 2026-09-03 · **Status:** research complete, awaiting go on Phase 1
**Baseline:** master `7a96efa` (PR #121), OTA group `9f751a07`, runtime `1.0.0`

This is the research turn. Five parallel explorers traced every requested item against
the code. Each phase gets its own bite-sized task plan
(`docs/superpowers/plans/2026-09-03-phase-N-*.md`) written at the start of that phase,
because Phase 2 and 3 tasks depend on the shape Phase 1 lands.

---

## Global constraints (apply to every phase)

- **OTA only.** No new native dependency in `frontend/`. Anything needing one is listed in §6 and is NOT scheduled.
- **Auth untouched.** No edits under `frontend/src/screens/auth`, `backend/src/auth`, or the Truecaller plugin.
- **Gate every commit:** `npx tsc --noEmit` and `npx jest --maxWorkers=2 --forceExit` in the package changed; `bash scripts/check-calculator-i18n.sh` on frontend. `keyUsage.test.ts` fails the build on any raw i18n key; `localeParity.test.ts` fails on any key missing from one of the six locales.
- **Six locales, always:** `en, hi, bn, ta, te, or`. Model-authored strings for hi/bn/ta/te/or are unverified register; flagged for native review.
- **Mixed CRLF/LF files:** use the Edit tool; `python` is absent on the dev box.
- **Backend migrations are hand-run in production** (`migrationsRun: false`). Every migration is additive, idempotent, reversible, and follows `1780500100000-AddAnnouncements.ts`. Deploy order: migration → backend → OTA.
- **Subagents must Read a file before Edit**; grep output does not count.

---

## 1. Findings that change the request

Several asks assumed something is missing that already exists, or named a symptom whose root cause is elsewhere. The plan fixes the cause, not the assumed gap.

| Ask | Reality | What actually needs doing |
|---|---|---|
| "No QR or worker code to add workers, no accept flow" | **All of it exists.** 8-char invite codes with expiry/max-uses/revoke (`farm_invites`), QR render of the invite (`FarmMembersScreen.tsx:256`) and of the worker's profile (`ProfileScreen.tsx:374`), QR scanner via `expo-camera` in `AddWorkerScreen` and `JoinFarmScreen`, and a **pending-approval queue** (`status: 'pending'`, `farm.joinApproval`, approve/decline endpoints). | Make it discoverable from Team, add badges for the pending queue, and fix the one real bug: `GET /farm-members/mine` returns pending memberships with no status (`farm-members.service.ts:413-425`), so a not-yet-approved user gets a full worker role client-side and every tap 403s. |
| "Owner can't log attendance; worker/manager/viewer can't log attendance or apply leave at all" | Backend allows owner/manager/worker to check in and apply (`attendance.service.ts:65-78`, `leave-requests.service.ts:64`). Viewer is blocked by design. **The frontend hides the Attendance and Leave rows behind `canManageMembers`** (`TeamScreen.tsx:290`), so a worker has no route to either screen. The owner's only path is through that row, which in All-farms mode picks an arbitrary farm (`TeamScreen.tsx:137-142`). | Unhide the rows for every non-viewer role; add a self check-in card; make Attendance/Manage-team/Assign farm-explicit in All-farms mode (the Leave row already is, `:315-320`). |
| "Worker can just click harvest" | Correct. Harvest rides `WRITE_OPERATIONAL`, the same key as a pH reading (`PondDashboardScreen.tsx:725`; no backend gate). There is no `HARVEST` capability. | New `RECORD_HARVEST` capability, owner/manager by default, with the role-policy and per-member override model below. |
| "Permissions for whole member type or single-member override, money too" | Model is a 6-key enum × role matrix with exactly **one** per-member override, `canViewFinancials` (`farm-member.entity.ts:75`). The backend honours it; **the client never receives it** (`listMine` omits it, `capabilities.ts:27` has no override param), so the Money tab stays hidden after an owner grants it. | Generalise to `farm.rolePolicy` + `member.capabilityOverrides` (jsonb), thread both through `roleSatisfies` and the client mirror, and surface them in Manage Members. |
| "Audit page of who did what" | No audit table. But ten log tables already carry `created_by_id`/`updated_by_id` (migration `1780300800000`). **The three money-bearing tables do not:** `harvests`, `harvest_records`, `transactions` record no actor. | Add actor columns to those three first (data is being lost daily), then build the audit read as a query across existing tables. No new event table. |
| "Pond shows idle after creating a cycle until refresh" | `/crops` is missing from `URL_ENTITY_MAP` (`query/client.ts:230-247`), so the write interceptor invalidates nothing; the focus refetch is `stale: true` only against a 5-minute `staleTime`. Affects create, close, update, delete. | Two map rows. |
| "DO = 400 crashed the app" | Backend correctly rejects DO > 30 (`@Max(30)`). The 400 body's `message` is a **string array**, and `Alert.alert(title, string[])` crashes natively on Android (`WaterQualityLogScreen.tsx:127`). **80 call sites** read `response.data.message` the same way; none normalise. The root `ErrorBoundary` cannot catch a native crash. | One shared `apiErrorMessage(err)` helper; replace all 80 reads. |
| "KAV must be done" | `ScreenWrapper` already applies `KeyboardAvoidingView` by default; **no screen lacks it.** The real defect is `keyboardShouldPersistTaps`: 20 screens (all 10 log screens) pass `scroll={false}` and render their own ScrollView without it, so with the keyboard open the first tap on Save only dismisses the keyboard. | Set the prop on those 20 ScrollViews. |
| "Prefill water quality from previous log" | **Already built** for salinity/alkalinity/hardness/transparency (`WaterQualityLogScreen.tsx:20,49-85`). Two gaps: the hint is only visible inside the collapsed "more readings" block, and `GET /water-quality/pond/:id/latest` returns the newest *row*, so a pH-only log wipes the prefill source. | Implement the 12-hour rule, the tap-to-prefill hint, and the always-visible warning above Save as specified; fix `latest` to per-column latest on the backend. |
| "Editing name allows friendly names but creation asks for strict prefix" | The farmer never types `name`. Creation asks for `displayName` only; the backend derives a 4-char `namePrefix` and generates `name` (e.g. `NURS01`), which is immutable. Rename changes `displayName` only. | Stop rendering `name` anywhere the farmer sees it: `PondDashboardScreen.tsx:442` uses the navigation param instead of the fetched `pond.displayName`; `HarvestHistoryScreen.tsx:82,163` pass `pondName: ''`; `QuickLogScreen.tsx:38` duplicates `pondLabel`. |
| "Delete farms/ponds with no history, else archive" | **Backend is ~90% built:** `PATCH /ponds/:id/archive`, `DELETE /ponds/:id` refuses ponds with crop history, farms soft-delete via `@DeleteDateColumn`, `findMine`/`findAll` already exclude archived, `includeArchived` is plumbed. **Zero frontend call sites** for any of it. One backend bug: `pond-naming.service.ts:39` counts archived ponds against the 500 cap. | Build the UI; add the "this farm can no longer be deleted after this save" confirmation with never-ask-again; fix the count. |
| "Weekly chemistry history" | None exists, and the dashboard tile's history mode routes back to the **blank entry form** (`PondDashboardScreen.tsx:98`). Weekly-chem rows land in `water_quality_records` but `WaterQualityHistoryScreen` renders only pH/DO/temp/salinity, so they show as `-- -- -- --`. | New history screen over the existing table; fix the tile route; render chemistry columns in WQ history. |
| "Species and seed type must be dropdown" | Free text. A typo silently maps to `'vannamei'` thresholds (`waterQualityThresholds.ts:98-106`), so wrong alerts with no error. `PondSetupScreen.tsx:469-479` already does the species dropdown correctly with `SelectField` + `GET /reference/species`; `CreateCycleScreen` is the outlier. `seedType` has no list anywhere and the entity comment (`net / gross / actual`) contradicts the UI placeholder (`PL-10`). | Reuse the PondSetup pattern; define the seed list; add `@IsIn` server-side. |
| "Inventory quantity +/-, unit dropdown" | `Stepper` and `SelectField` already exist in `components/ui`, tested, used elsewhere. Inventory uses raw `Input` for both. | Swap the components. |
| "Feed, money and inventory must be paired" | **Feed→inventory deduction is fully built on the backend** (`feed-records.service.ts:66-110`: deduct, compensate, reconcile on edit, credit on delete) and **never triggered** because `FeedLogScreen.tsx:68-73` never sends `inventoryItemId`. Inventory→money has zero references. Inventory is hard-scoped to one farm (`farm_id NOT NULL`). | Phase 2: add the item picker to the feed log (activates the pipeline). Phase 3: money link and multi-farm scoping (schema change). |

---

## 2. Item ledger

Every item from the request, plus incidental defects found while tracing. Phase: **1** critical bug / product mistake / wrong direction · **2** must have · **3** nice to have. BE = backend deploy needed. OTA = frontend part ships by OTA.

| # | Item | Root cause / gap | BE | OTA | Phase |
|---|---|---|---|---|---|
| 1 | DO=400 native crash | `Alert.alert` with `string[]`; 80 sites, no normaliser | – | ✅ | 1 |
| 2 | Pond idle after cycle create | `/crops` absent from invalidation map | – | ✅ | 1 |
| 3 | Pending member gets phantom role; financial grant invisible | `listMine` omits `status` and `canViewFinancials`; `roleCan` has no override | ✅ | ✅ | 1 |
| 4 | Worker can harvest | No harvest capability | ✅ | ✅ | 1 |
| 5 | Role-level and per-member permission model incl. money | Only one hard-coded override | ✅ migration | ✅ | 1 |
| 6 | Worker has no path to attendance/leave | Rows gated on `canManageMembers` (`TeamScreen.tsx:290`) | – | ✅ | 1 |
| 7 | Team picks an arbitrary farm for Manage team / Attendance / Assign | `farms[0]` fallback in All mode | – | ✅ | 1 |
| 8 | Leave submit posts `farmId: undefined` in All mode | `LeaveRequestsScreen.tsx:151` lacks the fallback its own header describes | – | ✅ | 1 |
| 9 | Weekly-chem history tile opens blank form; rows blank in WQ history | `PondDashboardScreen.tsx:98`; `WaterQualityHistoryScreen.tsx:207-236` | – | ✅ | 1 |
| 10 | Pond name/displayName discrepancy on dashboard, harvest history, quick log | Route-param title; `pondName: ''`; duplicated helper | – | ✅ | 1 |
| 11 | Keyboard: first tap on Save dismisses keyboard | `keyboardShouldPersistTaps` missing on 20 own-ScrollView screens | – | ✅ | 1 |
| 12 | No confirmation editing harvest / pond / farm | Only 2 confirms exist app-wide; no shared helper (65 raw `Alert.alert`) | – | ✅ | 1 |
| 13 | Harvests, harvest_records, transactions record no actor | Skipped by audit-columns migration | ✅ migration | – | 1 |
| 14 | Offline feed log stamped with sync time | `feed_records.recorded_at` is `@CreateDateColumn` (`feed-record.entity.ts:43`) | ✅ | ✅ | 1 |
| 15 | Species / seed type dropdown | Free text; silent threshold fallback | ✅ `@IsIn` | ✅ | 1 |
| 16 | Archived ponds count against 500 cap | `pond-naming.service.ts:39` | ✅ | – | 1 |
| 17 | Archive/delete farms and ponds UI, "locks after first save" confirm with never-ask-again, archived screen, include-archived filter | Backend built, UI absent; farm has soft-delete only, no archive-with-history semantics | ✅ small | ✅ | 2 |
| 18 | All workers in one place: self + others attendance, leave request + approval | `AllWorkersScreen` untouched; pieces exist separately | – | ✅ | 2 |
| 19 | Badges: pending leave, pending join | No badge component; zero `tabBarBadge` uses; counts already reach the client | – | ✅ | 2 |
| 20 | Activity/audit read: farm, pond, overall; by kind; date range | No endpoint; 14 tables with 4 timestamp shapes; needs #13 | ✅ endpoint | ✅ | 2 |
| 21 | Day view of all logs for a pond or farm | Same endpoint as #20; today block covers water+feed only | ✅ (#20) | ✅ | 2 |
| 22 | Cycle history and details per pond/farm; edit cycle | Backend complete; `CycleDetailScreen` has **zero** navigate call sites; no list UI | – | ✅ | 2 |
| 23 | Weekly chemistry screen redesign + history screen | Single card, six inputs, no grouping; no history | – | ✅ | 2 |
| 24 | Water quality prefill per spec (12 h rule, tap hint, warning above Save) | Partially built; `latest` returns newest row not per-column | ✅ | ✅ | 2 |
| 25 | Inventory: stepper, unit dropdown, category consistency, icon field + picker (100s of icons), defects D1–D12 | Components exist; no `icon` column; 12 defects listed in §4.7 | ✅ column | ✅ | 2 |
| 26 | Feed log picks an inventory item → stock deducts | Payload omits `inventoryItemId` | – | ✅ | 2 |
| 27 | Manager can create/edit inventory; member inventory access setting | Service uses `OWNER_ONLY`; no inventory capability | ✅ | ✅ | 2 |
| 28 | Quick-log pond picker | Horizontal chips, no farm name, unbounded; `PondPicker` exists but also omits farm | – | ✅ | 2 |
| 29 | Audit CSV export | `toCsv` + `Share.share` exists in `AttendanceLogScreen` only | – | ✅ | 2 |
| 30 | Inventory shelf grid view | No `numColumns` anywhere; tap-to-place is JS-only | ✅ position column | ✅ | 3 |
| 31 | Inventory pairing: one / many / all farms / unpaired with warning | `farm_id NOT NULL`; no M:N precedent in codebase | ✅ join table + data migration | ✅ | 3 |
| 32 | Inventory ↔ money: purchases create a transaction | Zero references; two competing money models (`transactions` vs `expenses`) | ✅ | ✅ | 3 |
| 33 | Inventory stock-movement ledger (`reason` is discarded today) | No table | ✅ | ✅ | 3 |
| 34 | Push notification on pending join / pending leave | Nothing emitted | ✅ | – | 3 |
| 35 | Invite an unregistered person (SMS/email) | Lookup dead-ends on non-users | ✅ | ✅ | 3 |
| 36 | Consolidate `ChemicalLog` (crop-scoped `chemical_data`) vs `WeeklyChemistry` (pond-scoped `water_quality_records`) | Two forms, two tables, overlapping fields | ✅ | ✅ | 3 |
| 37 | Dead code: `cropsService.findByPond`, `ReportsScreen` import, `WeeklyChemistry` ignores `cropId` and `queued` | – | – | ✅ | 3 |

---

## 3. Phase 1 — critical bugs, product mistakes, wrong directions

Ships as one backend PR (migrations + services) and one frontend PR (OTA). Backend must be live before the OTA.

### 3.1 API error normaliser (#1)
- `frontend/src/api/errors.ts` (new): `apiErrorMessage(err, fallback)` joins array messages with a newline, falls back for non-string, never returns a non-string.
- Replace all 80 `response?.data?.message` reads. Mechanical; one subagent, batch reads first.
- Test: array body → joined string; string body → itself; no body → fallback. Regression test on `WaterQualityLogScreen` posting DO=400 asserts `Alert.alert` receives a string.

### 3.2 Crop invalidation (#2)
- `query/client.ts`: `['/crops', 'crop']` in `URL_ENTITY_MAP`; `crop → [pond, ponds, farm, farms, home, briefing, money]` in `ENTITY_QUERY_KEYS`.
- Test: existing invalidation spec gains a `/crops` case.

### 3.3 Membership payload and permission model (#3, #4, #5)
Backend:
- Migration `AddCapabilityPolicies`: `farms.role_policy jsonb NULL`, `farm_members.capability_overrides jsonb NULL`. Backfill `capability_overrides = {"VIEW_FINANCIALS": <can_view_financials>}` where not null. Keep the old column for one release; `roleSatisfies` reads overrides first.
- `farm-capability.ts`: add `RECORD_HARVEST` (owner, manager), `MANAGE_INVENTORY` (owner, manager), `VIEW_INVENTORY` (all). Resolution order: member override → farm role policy → default matrix. Owner is never reducible.
- `harvests.service.ts` create/update/delete assert `RECORD_HARVEST`. `route-capabilities.spec.ts` gains harvests and inventory controllers.
- `listMine`: filter `status: 'active'` **and** project `status`, `capabilityOverrides`, and the farm's `rolePolicy`.
- Endpoints: `PATCH /farms/:id/role-policy` (owner), `PATCH /farm-members/:id/overrides` (owner; managers may not grant beyond their own role).

Frontend:
- `permissions/capabilities.ts` mirrors the resolution order; `MyMembership` gains the three fields; `usePermissions` exposes `canRecordHarvest`, `canManageInventory`.
- `PondDashboardScreen` harvest button and `HarvestLog` gate on `canRecordHarvest`; `cycleRequirement` unchanged.
- Manage Members: a "Permissions" section per role (toggle grid: harvest, money, inventory, manage workers) and on `MemberDetailScreen` the same grid as per-member override with a "uses role default" state. Replaces the lone financial `Switch`.
- Tests: resolution-order table test on both sides; `listMine` spec asserting pending excluded; PondDashboard test: worker without grant sees no harvest button, worker with grant does.

### 3.4 Team farm scoping and attendance/leave access (#6, #7, #8)
- `TeamScreen`: Attendance and Leave rows visible to every role with `canRecordData` (not viewer); a self check-in/out card always present for those roles (backend already permits). Manage team, Attendance, Assign in All-farms mode open a farm chooser (modal `SelectField`) instead of `farms[0]`; the Leave row's existing pattern is the reference.
- `LeaveRequestsScreen` submit uses `farmId ?? farms[0]?.id` and shows a farm `SelectField` when scope is All.
- `AttendanceScreen`: unchanged for self; roster section stays behind `canManageOperations`.
- Tests: worker role renders both rows; All-mode Manage team opens chooser, never navigates with `farms[0]` silently.

### 3.5 Weekly-chem routing and history rows (#9)
- `PondDashboardScreen.tsx:98` `historyRoute: 'WaterQualityHistory'` with a `chemistry` filter param until the Phase 2 screen lands.
- `WaterQualityHistoryScreen` rows render whichever of the ten columns are non-null (two-row grid), so a chemistry record is legible.

### 3.6 Pond label (#10)
- `PondDashboardScreen` title: `pondLabel(pond) ?? route.params.pondName`.
- `HarvestHistoryScreen` passes the real label. `QuickLogScreen` imports `pondLabel` from `utils/pondHealth` and shows the farm name as a chip caption when the user has more than one farm.

### 3.7 Keyboard (#11)
- `keyboardShouldPersistTaps="handled"` on the 20 own-ScrollViews: the 10 log screens plus OtpLogin, TruecallerPhone, TwoFactorChallenge, DiseaseList, Expenses, HarvestPlans, LeaveRequests, CreatePond, Profile, TwoFactor. Auth screens: the prop only, nothing else touched.

### 3.8 Confirm helper and crucial edits (#12)
- `frontend/src/utils/confirm.ts` (new): `confirm({ title, message, confirmLabel, destructive }) → Promise<boolean>` over `Alert.alert`.
- Applied to: harvest edit (`HarvestLogScreen`), pond edit (all fields, not just dimensions), farm edit, cycle close (already confirmed, switch to helper), and Phase 2 archive/delete.
- Existing 65 raw `Alert.alert` calls are left alone.

### 3.9 Actor columns on money tables (#13) and feed timestamp (#14)
- Migration `AddMoneyAuditColumns`: `created_by_id`, `updated_by_id` on `harvests`, `harvest_records`, `transactions`, FK users `ON DELETE SET NULL`, same shape as `1780300800000`. Services stamp them.
- `feed_records.recorded_at`: plain `@Column` with default, DTO accepts optional `recordedAt`; `FeedLogScreen` sends the local timestamp like the water-quality screen already does.
- `expenses.user_id ON DELETE CASCADE`: left alone; noted for Phase 3 (data-loss risk on account delete, but changing an FK on a live table is not a Phase 1 move).

### 3.10 Species and seed dropdowns (#15)
- `CreateCycleScreen`: species `SelectField` from `GET /reference/species` (PondSetup pattern), storing `speciesId` **and** the `speciesType` label; seed `SelectField` from a fixed list `PL-8 … PL-15, Juvenile, Other`. Seed migration for `species` if the table is empty in prod (verify with a read-only query first).
- DTO: `@IsIn` on `seedType`; species validated by id.
- `toThresholdSpecies` no longer defaults silently: unknown → `null`, callers fall back explicitly.

### 3.11 Pond cap count (#16)
- `pond-naming.service.ts:39`: `status: Not('archived')`. One test.

**Phase 1 exit:** both test suites green, backend deployed and `/api/health` ok, OTA published, then the on-device Maestro pass on the OPPO handset for: DO=400 shows an alert; cycle create refreshes the dashboard; worker sees attendance and can check in; worker without grant sees no harvest button.

---

## 4. Phase 2 — must have

### 4.1 Archive and delete (#17)
- Farm: add `archived_at` + `PATCH /farms/:id/archive` (owner). `DELETE /farms/:id` refuses when any pond has crop history, mirroring ponds. `GET /farms?includeArchived`.
- "First save locks deletion": on the first write of any log for a farm (client-side, `AsyncStorage` flag per farm + `FirstUseHint`-style never-ask-again), show the confirm from §3.8. The server needs nothing; the guard is already the crop-history refusal.
- Screens: archive/delete actions on `FarmDetailScreen` and `CreatePondScreen` edit mode; an **Archived** section on `FarmsListScreen` and `FarmDetailScreen` behind an "include archived" chip; unarchive action. Archived ponds excluded from `PondPicker`, QuickLog, engines unless the chip is on (backend already filters `findMine`).

### 4.2 Team hub: everyone in one place (#18, #19)
- Rebuild `AllWorkersScreen` as the roster across farms: per member → today's attendance, open leave, role, pending-approval state; owner/manager approve/decline inline; self check-in card on top.
- Badges: `tabBarBadge` on the Team tab = pending joins + pending leaves (owner/manager). Counts from `team-overview` (add `pendingJoins` to it). One query, no new endpoint.

### 4.3 Activity endpoint, audit page, day view, export (#20, #21, #29)
- `GET /activity?farmId|pondId&from&to&kinds[]` → `{ at, kind, pondId, cropId, actorId, actorName, summary, recordId }[]`, built as one `UNION ALL` over the fourteen log tables with per-branch timestamp casts (the four shapes are enumerated in the explorer report), scoped by `getAccessibleFarmIds`, paginated by `(at, id)` cursor. `VIEW_FINANCIALS` gates the harvest-sale and transaction branches.
- `ActivityScreen`: scope chips (all / farm / pond), kind chips, date range via `CalendarPicker`, grouped by day, actor shown. Reached from Team (owner/manager) and from the pond dashboard's "today" block, which switches to this endpoint and drops its two-call client filter.
- Export: move `toCsv` to `utils/csv.ts`; CSV via `Share.share`. **PDF and file save are not OTA-shippable (§6).**

### 4.4 Cycle history (#22)
- `CycleListScreen` per pond (from dashboard) and per farm (from farm detail): status, DOC, stocking, harvest total, P&L (behind `VIEW_FINANCIALS`). Wire `CycleDetailScreen` (currently unreachable); add edit-cycle form using the existing `PATCH /crops/:id` with the §3.8 confirm.

### 4.5 Weekly chemistry (#23)
- Screen: three groups (nitrogen: ammonia, nitrite, nitrate · buffering: alkalinity, hardness · clarity: transparency), band hints from `waterQualityThresholds`, last-week value beside each field, offline toast, section headers.
- `WeeklyChemistryHistoryScreen` over `GET /water-quality?pondId&chemistryOnly`, chart per parameter. Tile history route points here.

### 4.6 Water quality prefill (#24)
- Backend: `latest` returns per-column latest with `*AsOf` (logic exists in `pond-context.service.ts:390-396`, expose it).
- Frontend: if last record < 12 h → prefill silently as today; if ≥ 12 h → do not prefill, show a "Use last reading" button with the age; on prefill, every field marked and a persistent warning above Save until the farmer touches each prefilled field or explicitly confirms.

### 4.7 Inventory (#25, #26, #27)
- Column `icon text NULL` + DTO. Curated list of ~150 MCI glyph names grouped (feed, chemicals, medicine, equipment, tools, packaging, safety, misc); `IconPicker` = searchable grid modal. MCI is the chosen set (inventory already uses it; the `Icon.tsx` ligature set is not).
- `Stepper` for quantity (step by unit: 1 for pieces, 0.5 for kg/L), `SelectField` for unit (`kg, g, L, mL, bag, pcs, bottle, box`), category as `ChipGroup` on both create and edit, `@IsIn` server-side, `@Min(0)`.
- Feed log: `SelectField` of feed-category items for the pond's farm → `inventoryItemId`; shows remaining stock; skipped when none.
- Access: `MANAGE_INVENTORY` (create/update/delete, owner+manager default) and `VIEW_INVENTORY` (all) replace `OWNER_ONLY`; both editable per role/member from the Phase 1 permission grid. `findAll` without farm uses `getAccessibleFarmIds`.
- Explorer defects D1–D12 fixed in the same pass: low-stock definition differs backend vs frontend; `reason` on adjust is discarded; expiry date labelled "Last Purchase"; category is chips on create but free text on edit; two divergent category→icon maps; stock bar divides by zero; negative quantities accepted; `category` unvalidated; low-stock alert goes to owner only; inventory routes missing from `route-capabilities.spec.ts`; entity comment advertises `medicine` which the UI lacks; `GET /inventory` without farm returns `[]` for members.

### 4.8 Quick-log pond picker (#28)
- `PondPicker` gains farm grouping (section per farm when > 1 farm) and a search field when > 8 ponds; QuickLog adopts it with `fetchContext={false}`. Fixes five screens at once.

---

## 5. Phase 3 — nice to have and polish

- **Shelf grid** (#30): `FlatList numColumns` shelf view with tap-to-select then tap-a-cell-to-place; `position int` column. Drag-and-drop is excluded (§6).
- **Inventory pairing** (#31): `inventory_farms` join entity (mirror `farm_member_pond.entity.ts`), `farm_id` becomes nullable, "unpaired" allowed with the not-recommended warning; pairing chooser one / many / all. Data migration copies each `farm_id` into the join table.
- **Inventory ↔ money** (#32): purchase on create/adjust writes a `transactions` row (category `inventory`) tagged with the item; `transactions` is canonical (farm-scoped, already in Money). `expenses` untouched.
- **Stock movements** (#33): `inventory_movements` table; persist `reason`; replaces the "coming soon" stub.
- **Push on pending join / leave** (#34) via the existing `push` module.
- **Invite unregistered people** (#35): share a pre-filled join link; the code path already exists once they register.
- **Chemistry consolidation** (#36) and dead-code removal (#37).
- `expenses.user_id` FK to `SET NULL`; native-speaker review of all new strings; the 63-key defaulted-i18n backlog.

---

## 6. Not OTA-shippable — excluded, needs a native build if wanted

| Ask | Why | Status |
|---|---|---|
| Drag-and-drop shelf reordering | needs `react-native-gesture-handler` + `react-native-reanimated`; neither is in the binary | **Excluded.** Tap-to-place instead. |
| PDF export, save-to-file export | needs `expo-print` / `expo-file-system` / `expo-sharing`; none in the binary | **Excluded.** CSV via the share sheet instead. |
| Keyboard `adjustResize` config, `react-native-keyboard-controller` | `app.config.ts` and native deps | **Excluded.** Not needed; the tap-persistence fix covers the reported symptom. |
| Native date/time picker | `@react-native-community/datetimepicker` absent | Not needed; `CalendarPicker` exists. |

Everything else in §3–§5 is OTA on the frontend, with backend deploys and hand-run migrations where marked.

---

## 7. Decisions taken (say so if you want a different one)

1. **Permission model shape:** jsonb `rolePolicy` on farm + jsonb `capabilityOverrides` on member, resolved override → policy → default. Owner never reducible. Chosen over per-permission columns because inventory and future keys ride the same shape with no further migration.
2. **Audit is a read-time union, not an event table.** The actor columns already exist on eleven tables and land on the last three in Phase 1. A new event table would duplicate every write path for no new information.
3. **Harvest default:** owner and manager only. Existing workers lose harvest until the owner toggles it on for the worker role. This is the requested product direction; it is a visible behaviour change and will be called out in the release note.
4. **Inventory pairing is Phase 3, not Phase 2.** Single-farm inventory with feed deduction (Phase 2) delivers the day-to-day value; multi-farm scoping is a schema change with a data migration and belongs after the model settles.
5. **Money model for inventory purchases:** `transactions`, not `expenses`.

---

## 8. Sizing

| Phase | Backend | Frontend | Migrations | Rough size |
|---|---|---|---|---|
| 1 | 6 modules | 30+ files (80 mechanical error-site edits) | 2 | 3 PRs, one deploy + one OTA |
| 2 | 5 modules + 1 new endpoint | 9 screens (5 new) | 3 | ~6 PRs |
| 3 | 4 modules | 4 screens | 4 | ~5 PRs |

---

## 9. Evidence carried forward from the research explorers

Everything below was established by reading code on 2026-09-03 at master `7a96efa`. A future session should re-verify line numbers but not re-derive the facts.

### 9.1 Log tables and their timestamp shapes (for the Phase 2 `/activity` UNION)

| Table | Entity file | Time column(s) | Shape | Scope key | Actor column |
|---|---|---|---|---|---|
| `water_quality_records` | `water-quality/water-quality-record.entity.ts` | `recorded_at` | timestamptz, client-supplied | `pond_id` | `created_by_id` |
| `feed_records` | `feed-records/feed-record.entity.ts` | `recorded_at` (+ `feeding_time` text) | timestamptz, client-supplied since Phase 1 | `pond_id`, `crop_id` nullable | `created_by_id` |
| `sampling_data` | `sampling/sampling-data.entity.ts` | `sampling_date` (+ `created_at`) | date | `pond_id`, `crop_id` nullable | `created_by_id` |
| `measurements` | `measurement/measurement.entity.ts` | `measured_at` (+ `time_of_day` text) | timestamptz | `pond_id`, `crop_id` nullable | `entered_by`, `entered_by_role` (different naming) |
| `harvests` | `harvests/harvest.entity.ts` | `harvest_date` | date | `crop_id` | `created_by_id` (Phase 1) |
| `harvest_records` | `harvests/harvest-record.entity.ts` | `harvest_date` | date | none | **orphan table: no code writes it** |
| `mortality_records` | `mortality/mortality-record.entity.ts` | `record_date` | date | `crop_id` NOT NULL | `created_by_id` |
| `feeding_tray_checks` | `feeding-tray-checks/feeding-tray-check.entity.ts` | `check_date` + `check_time` | date + time | `pond_id` | `created_by_id` |
| `chemical_data` | `chemical/chemical-data.entity.ts` | `measurement_date` + `measurement_time` | date + time | `crop_id` | `created_by_id` |
| `treatments` | `treatments/treatment.entity.ts` | `treatment_date` | date | `pond_id` | `created_by_id` |
| `microbiology_data` | `microbiology/microbiology-data.entity.ts` | `measurement_date` | date only | `crop_id` | `created_by_id` |
| `plankton_data` | `plankton/plankton-data.entity.ts` | `measurement_date` + `measurement_time` | date + time | `crop_id` | `created_by_id` |
| `disease_records` | `disease/disease-record.entity.ts` | `recorded_date` | date | `pond_id` | `created_by_id` |
| `transactions` | `transactions/transaction.entity.ts` | `transaction_date` | date | `farm_id` (no pond/crop) | `created_by_id` (Phase 1) |
| `expenses` | `finances/expense.entity.ts` | `expense_date` | date | `pond_id` NOT NULL, `crop_id` nullable, no `farm_id` | `user_id` NOT NULL, `ON DELETE CASCADE` |
| `attendance` | `attendance/attendance.entity.ts` | `check_in_at`, `check_out_at` | timestamptz | `farm_id` | `user_id` (subject) |
| `leave_requests` | `leave-requests/leave-request.entity.ts` | `start_date`, `end_date` | date | `farm_id` | `user_id`, `decided_by_id` |
| daily routine | none | none | **no table**; derived in `DailyRoutineScreen.tsx` from pond-context + tray checks | none | none |

Each UNION branch needs its own cast to a common instant: timestamptz as-is; `date` to `date::timestamptz` at IST midnight; `date + time` to `(d + t)::timestamptz`. Crop-scoped tables join `crops` to get `pond_id`. Two money models coexist (`transactions` farm-scoped free-text category; `expenses` pond-scoped enum category); Phase 3 picks `transactions` as canonical.

### 9.2 Inventory defects found (Phase 2 §4.7)

| # | Defect | Evidence |
|---|---|---|
| D1 | Low-stock definition differs: backend `quantity <= reorder_level` excludes NULL reorder level; frontend treats NULL as 0 | `inventory.service.ts:96,105` vs `InventoryListScreen.tsx:200,204` |
| D2 | `AdjustStockDto.reason` validated, sent, never persisted; no movement table; "Stock History" is a stub | `adjust-stock.dto.ts:9-10`, `inventory.service.ts:109`, `InventoryDetailScreen.tsx:78,240-248` |
| D3 | `expiryDate` rendered under the label "Last Purchase" in all six locales | `InventoryDetailScreen.tsx:213-217`, `en/inventory.ts:44` |
| D4 | Category is chips on create, free text on edit; a typo hides the item from every filter tab | `InventoryListScreen.tsx:359-379` vs `InventoryDetailScreen.tsx:314-319` |
| D5 | Two divergent category-to-icon maps (`equipment` is `tools` in tabs, `package-variant` in rows) | `InventoryListScreen.tsx:22-28` vs `:254` |
| D6 | Stock bar divides by `reorderLevel * 2`: NaN width when null or 0 | `InventoryDetailScreen.tsx:180-184` |
| D7 | `GET /inventory` without `farmId` uses owned farms only; members get `[]` | `inventory.service.ts:46` vs the `feed-records.service.ts:125` pattern |
| D8 | `quantity`, `unitPrice`, `reorderLevel` accept negatives on create and update (no `@Min(0)`) | `create-inventory-item.dto.ts:19-33` |
| D9 | `category` has no `@IsIn` server-side | `create-inventory-item.dto.ts:16-17` |
| D10 | Low-stock alert goes to `farm.userId` only, not managers | `inventory.service.ts:150-160` |
| D11 | Inventory routes absent from the `route-capabilities.spec.ts` guard-drift test | `route-capabilities.spec.ts:26-31` |
| D12 | Entity comment advertises `medicine`; UI offers `other` | `inventory-item.entity.ts:36` vs `InventoryListScreen.tsx:22-28` |
| D13 | Create, update, delete are `OWNER_ONLY` (a manager cannot add an item), contradicting the matrix doc | `inventory.service.ts:28,78,87` |
| D14 | `UpdateInventoryItemDto` is `PartialType(Create)`, so `farmId` is patchable (moves items between farms) | `update-inventory-item.dto.ts:4` |

Inventory facts: the entity has no `icon`, `location`, `position`, `userId`, `pondId`; `quantity` and `unit` are free (`numeric`, `text`); `farm_id NOT NULL` FK CASCADE. `feed_records.inventory_item_id` FK exists and the full deduct, compensate, reconcile pipeline in `feed-records.service.ts:31-110,179-226` works; the only missing piece is the picker in `FeedLogScreen.tsx:68-73`. `feed_products` is a standalone catalogue with no FK from anything. `credit_ledgers` has no inventory FK despite its "Inventory Credit" label. MCI glyph count is 7448; the app has two icon systems (MCI via `@expo/vector-icons`, and `components/ui/Icon.tsx` Material Symbols ligature font); inventory uses MCI. No `numColumns` grid exists anywhere. No `ManyToMany` precedent; mirror `farm-access/farm-member-pond.entity.ts` for join tables.

### 9.3 Team and members facts (Phase 2 §4.2)

- `farm_invites` entity: `code` (8 chars), `role`, `createdById`, `expiresAt`, `maxUses`, `usedCount`, `revokedAt`; rejection reasons `not_found | revoked | expired | exhausted` mapped to 404 or 410; throttled 5 per minute. Endpoints in `farm-members.controller.ts:66-136`.
- Pending queue: `farm_members.status` (`active` or `pending`), `farm.joinApproval` (`manual` or `auto`), `farm.joinApprover` (`owner` or `managers`); list, approve, decline, policy at `farm-members.controller.ts:99-126`.
- `team-overview.service.ts` is a batching layer (`GET /team-overview/overview?farmId`) returning `myAttendance`, `allAttendance`, `pendingLeave` rows. It does **not** carry pending joins or the caller's own leave requests; add both fields there for badges and the worker's Leave-row count.
- No `tabBarBadge` usage anywhere; the tab bar is `navigation/MainNavigator.tsx:88-153`; `notificationStore.unreadCount` exists but only `NotificationsScreen` reads it.
- Attendance: `attendance.entity.ts` has a client-minted uuid PK, `farmId`, `userId`, `checkInAt`, `checkOutAt`; no pond scope, no geolocation. `findAllForFarm` needs `WRITE_MANAGEMENT`.
- Leave: `leave_requests.status` is pending, approved or rejected with `decidedById` and `decidedAt`; apply needs `WRITE_OPERATIONAL` with `userId` forced to the caller; approve needs `WRITE_MANAGEMENT`; a `?status=pending` filter exists.
- `AllWorkersScreen.tsx` is untouched legacy and is the natural home for the Phase 2 hub.
- Nothing in `push/` or `alert-center/` emits on a pending join or leave.

### 9.4 Cycles, ponds, farms facts (Phase 2 §4.1, §4.4)

- Crops endpoints: `POST /`, `GET /?pondId=`, `GET /:id`, `PATCH /:id`, `PATCH /:id/harvest`, `DELETE /:id`, `PATCH /:id/close`; `findAllAccessible` is member-aware, `findByPond` is owner-only and now dead code. Status is `active`, `completed` or `cancelled`.
- `CycleDetailScreen` is registered (`RootNavigator.tsx:377`) with zero `navigate('CycleDetail'` call sites. It renders status, DOC, seed, species, targets, harvest and close buttons, expenses, harvest plans, and a feature-flagged analysis link.
- Ponds: `status` includes `archived` and there is an `archived_at` column; `PATCH /ponds/:id/archive` refuses an active cycle and a re-archive; `DELETE /ponds/:id` refuses crop history. `findMine`, `findAll` and the counts already exclude archived; `includeArchived` is plumbed through `pondsApi.getAll` but never passed. `pondsApi.archive`, `pondsApi.delete`, `farmsApi.delete` have zero call sites.
- Farms: `@DeleteDateColumn deleted_at` soft delete only; no `archived_at`; `DELETE /farms/:id` soft-deletes without a history check.
- `engine-alert.service.ts:168-173` has no archived filter but is transitively safe (an active cycle is required). `pond-context.service.ts:181` is unfiltered but only receives filtered ids.
- The species reference table has **0 rows in production**, so `PondSetupScreen` shows an empty species dropdown (it guards with `required={speciesOpts.length > 0}`). Phase 1 gave `CreateCycleScreen` a fixed canonical list instead. Seeding the table (4 rows with ranges from `features/waterQualityThresholds.ts:76-79`) would fix PondSetup.
- Pond `name` is generated (`pond-naming.service.ts:64-77`, prefix plus zero-padded sequence) and immutable (`CreatePondDto` has no `name`); `displayName` is the farmer-facing field; the helper is `utils/pondHealth.ts:147 pondLabel`.

### 9.5 Water quality and weekly chemistry facts (Phase 2 §4.5, §4.6)

- Weekly chemistry writes the `water_quality_records` columns `ammonia, nitrite, nitrate, alkalinity, hardness, transparency` via `saveRecord({ entity: 'water_quality' })`; `chemical_data` (`ChemicalLogScreen`) is a separate crop-scoped table with overlapping fields plus calcium, magnesium, potassium.
- `GET /water-quality/pond/:pondId/latest` returns the newest **row**; per-column carry-forward exists server-side only in `pond-context.service.ts:390-396` (`chemistryAsOf`, `alkalinityAsOf`).
- `WaterQualityLogScreen.tsx:20` `SLOW_CHANGING_PREFILL_FIELDS = ['salinity','alkalinity','hardness','transparency']`; prefill effect at `:49-85`; the hint is only inside the collapsed "more readings" block (`showMore` defaults false, `:46,179-186`).
- `features/logProgress.ts` is pure (no storage); `SessionHint` derives from `PondContext`; neither can serve as a last-values cache.
- History screens registered: WaterQuality, Feed, Sampling, Treatment, Harvest, Chemical, Plankton, Microbiology, Disease, Mortality, PondDimension. None for WeeklyChemistry, DailyRoutine, Measurements, FeedingTrayChecks.

### 9.6 Infrastructure facts

- react-query on 7 screens only; everything else is `useState` plus `useFocusEffect` with the axios-layer `api/offlineCache.ts`. Write invalidation is the axios response interceptor (`api/client.ts:71-99`) via `URL_ENTITY_MAP` and `ENTITY_QUERY_KEYS` in `query/client.ts`; `/inventory`, `/simulations`, `/profiles` are deliberately absent. A new write endpoint that must refresh a cached read needs a row in both tables.
- `usePermissions(farmId?)` is pure over `membershipStore` (zustand, loaded once from `GET /farm-members/mine`, no TTL). Since Phase 1 it consumes `capabilityOverrides` and `rolePolicy` through `grantForFarm`.
- Design system has: `Button, Card, ChipGroup, SummaryRow, SectionHeader, StatusBadge, EmptyState, ErrorState, Input, NumberField, SelectField (modal list), Stepper, CalendarPicker (pure JS), Skeleton, StatRow, ScreenHeader, Icon, ToastHost, PondPicker, FirstUseHint, PrefilledBanner, SessionHint`, plus `components/members/CapabilityGrid` and `utils/confirm.ts` since Phase 1. Missing: bottom sheet, segmented control, numeric badge, grid, date-time picker, layout primitives.
- Export: `toCsv` is local to `AttendanceLogScreen.tsx:101-118`, shared via `Share.share`. No file-system, print or sharing modules.
- `ScreenWrapper` applies KeyboardAvoidingView by default; own-ScrollView screens need `keyboardShouldPersistTaps` themselves (fixed on 16 screens plus Leave in Phase 1; auth screens untouched: `OtpLogin`, `TruecallerPhone`, `TwoFactorChallenge`).
- Backend: `synchronize: !isProduction`; production migrations are hand-run and the `migrations` ledger is not consistently maintained (`AddAnnouncements1780500100000` was applied without a ledger row). `ValidationPipe` `whitelist: true` strips unknown DTO fields, so a DTO must declare `id` for idempotent replays. Controllers use `@CurrentUser()`; four holdouts use `@Req()`.
- `runtimeVersion` is the literal `"1.0.0"` in `app.config.ts`; channels live in `eas.json`. `expo-camera` is in the binary and used for QR scanning.

## 10. Phase 1 handoff notes

Commits on `feat/phase1-hardening`: `cd609c8` (B2 data integrity), `cf97820` (B1 permissions), `102e51d` (F1 errors and cache), `bd4334f` (F4 confirm, labels, keyboard), `48c9395` (F3 team), `ec7984c` (F2 permission grid, harvest gate, species, chemistry rows).

Deferred from Phase 1; carry into Phase 2:
- The worker's Team Leave row shows a static "Request time off" instead of a count of own open requests; needs a `myLeaveRequests` field in the `team-overview` payload.
- `common.savedOffline` is not a defined key; two call sites use the default-value form and F3 added `team.savedOffline`. Define it in `common.ts` and drop the local copy.
- `RootNavigator.tsx` `HarvestHistory` param type does not declare `pondName` (screens are `any`-typed, so no error).
- Six error-alert sites under `screens/auth/**` still pass `response.data.message` raw (auth is frozen by user instruction).
- Inventory controllers still use `OWNER_ONLY`; the `VIEW_INVENTORY` and `MANAGE_INVENTORY` capabilities exist and resolve but no route consumes them yet (Phase 2 §4.7).
- `can_view_financials` column retained for one release; drop in Phase 3.
- `harvest_records` is an orphan table (no writer); the audit columns were added anyway. Decide in Phase 3 whether to drop it.
- Latent bug fixed in B2 worth knowing: `UpdateTransactionDto` inherited `id` from the create DTO and spread it into `repository.update`, so a PATCH could reassign a transaction's primary key. Now stripped, with a spec.
