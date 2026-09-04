# Phase 3 — Outcomes, Release Notes and Follow-ups

**Branch:** `feat/phase3-polish` · 25 commits · merge-base `7b20fdf` · head `e36b04d`
**Spec:** `docs/superpowers/specs/2026-09-04-phase-3-design.md`
**Plan:** `docs/superpowers/plans/2026-09-04-phase-3-polish.md`

Final gates: backend `tsc` 0 · 117 suites / 1195 tests. Frontend `tsc` 0 · 117 suites / 772
tests · calculator i18n passed. The frontend suite was run 8 consecutive times after the
flake fix; 8/8 green.

---

## Release note — what a farmer or owner will notice

1. **Farm cards no longer claim "All fine" for ponds nobody has logged.** A pond with no
   water-quality log for more than 2 days shows a slate bar instead of green, with a
   "Last log 3 d" age hint; past 7 days it reads as having no recent data. The card's
   coloured left edge follows the same rule. A real alert still outranks silence — a pond
   with a critical reading stays red.
2. **Status colours on the log-entry screens changed for seven parameters.** Consolidating
   two disagreeing threshold tables means pH 6.5–7.0 and 9.0–9.5, plus extreme temperature,
   salinity, alkalinity, nitrite and nitrate, now paint red where they painted amber. This
   affects the input field's border and icon only, not alerts. It is the correct direction:
   the field now agrees with the alert engine, which is what the consolidation was for.
3. **Members with financial *view* access can no longer edit or delete transactions.** Those
   two actions moved to a management capability. Same shape as the harvest gate in Phase 1.
4. **Inventory items can be shared across farms.** A shared item requires manage rights on
   *every* paired farm to adjust — so a manager of only one of them loses the ability to
   adjust stock they could adjust yesterday. Intended, but it is a permission removal.
5. **Stock history is now recorded and visible** on the item detail screen — who moved stock,
   by how much, and why. For a shared item this includes activity by another farm's staff.
   That is inherent to sharing: if two farms share stock, both need to see why it moved.
6. **Deleting a worker no longer deletes their expense history.** Those rows survive with no
   attributed user, so historical expenses may show a blank "entered by".
7. **Invite links** now appear in the share message alongside the 8-character code.
   **They only work for people who already have the app and are signed in** — see follow-up
   F2. The printed/scanned QR code is unchanged and still carries the bare code.
8. **Push notifications** now reach the owner (and managers, where the farm delegates
   approval) when someone asks to join a farm or applies for leave.

---

## Decisions the user must confirm or reverse

**D1 — `TransactionsService.create` still runs on `VIEW_FINANCIALS`, the read capability.**
`update` and `remove` moved to `WRITE_MANAGEMENT`; `create` did not. The result is incoherent:
a member with financial view can add a large expense they then cannot delete. It was left
alone because `create` was always on that capability — this branch did not regress it — and
moving it removes a permission real users hold today. **User's call.**

**D2 — Spec §B.2 (inventory → money) ships as plumbing only.** The service path, the
`transactions.inventory_item_id` column and its migration are all in and reviewed, but
nothing sets `purchase`: no route, no DTO field, no UI. The spec said "a purchase on
create/adjust writes a `transactions` row"; today no purchase can be expressed. Wiring the UI
is new product surface that was outside the approved task list.

**D3 — Unpaired inventory items are no longer permitted.** Spec §B.1 allowed an item attached
to no farm, with a warning. Implemented literally, that skipped the capability check entirely
for such items — any authenticated user could read or write them by id. Fail-closed was
chosen instead. To restore the affordance safely, add a `created_by_id` column to `inventory`
and scope unpaired items to their creator.

---

## Follow-ups (none blocking)

- **F1 — the purchase path has no idempotency guard.** `AdjustStockDto` carries no client id
  and `createInternal` neither accepts nor checks one, so a retry would double-write both a
  movement row and a money row. Unreachable today. **Must be closed before any purchase UI
  ships** — marked with a `ponytail:` comment at the call site.
- **F2 — invite links only work for signed-in users.** `RootNavigator` mounts `JoinFarm`
  inside the `isAuthenticated` branch only, and there is no deferred deep-link capture, so an
  unregistered person lands on Login and the code is dropped. Degrades gracefully: the share
  text still carries the bare code. Fixing it means capturing the initial URL and replaying it
  after signup.
- **F3 — `ParameterInput` hardcodes species `'vannamei'`.** Species-blindness predates this
  work, but vannamei bands sharpen some misreads — a freshwater scampi pond at ~2 ppt salinity
  was "warning" under the old flat table and is "critical" now. `ChemicalLogScreen.tsx` already
  has `cropId` in scope and could thread the real species through.
- **F4 — `TransactionsController` has no `@OwnsResource` guard.** Its checks live in the
  service. Now documented in `route-capabilities.spec.ts`'s `UNGUARDED` list, but worth
  revisiting for consistency with the other controllers.
- **F5 — existence-before-authorization.** `loadItem`/`setPairing` throw `NotFoundException`
  before any authz check, so an authenticated user can distinguish "this id exists" from "it
  does not" for any inventory item. Pre-existing codebase pattern, not introduced here.
- **F6 — native-speaker review** of the hi/bn/ta/te/or strings added by this branch, along
  with Phase 2's.
- **F7 — the 63-key defaulted-i18n backlog** (`keyUsage.test.ts` ratchets at `<= 63`).

---

## Invariant that must not be broken

`findAll` derives inventory membership purely from `inventory_farms`, while `lowStockQuery`
also ORs in the legacy `inventory.farm_id` column. These agree **only** because:

1. migration `1780600400000` backfills every non-null `farm_id` into `inventory_farms`, and
2. `create()` and `setPairing()` always keep `farm_id` inside the pairing set.

Break either and the low-stock badge will silently disagree with the item list again — which
is exactly the bug the final review caught.

---

## Migration run order (hand-run against production, `migrationsRun: false`)

`1780600300000` inventory_movements → `1780600400000` inventory_farms (+ backfill, then drop
NOT NULL) → `1780600500000` transactions.inventory_item_id → `1780600600000` expenses user_id
nullable + SET NULL.

Operator notes:

- **Run in a low-traffic window.** `1780600500000` and `1780600600000` both re-add a foreign
  key with a plain `ADD CONSTRAINT` (no `NOT VALID`), which validates every existing row under
  an `ACCESS EXCLUSIVE` lock. `1780600500000` also adds a non-`CONCURRENTLY` index on
  `transactions`. This matches all 61 FK-add statements in the repo, but it stalls writes.
- **Migrations must land before the OTA bundle** — the new frontend calls
  `GET /inventory/:id/movements`.
- **`1780600400000.down` fails loudly by design** if any `inventory` row has a null `farm_id`
  and no pairing. Run `SELECT id FROM inventory WHERE farm_id IS NULL` and reconcile by hand;
  do not force it. TypeORM wraps CLI migrations in a transaction, so the failure rolls back
  and the join table survives.
- `1780600300000` and `1780600400000` enable RLS with **no policies**, matching the house
  pattern. Safe only because the backend connects as the table owner. If that role ever
  changes, both tables go invisible and pairing silently degrades to the legacy column.
