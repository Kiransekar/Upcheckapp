# Attendance — bug fixes, upgrade and payroll readiness

**Date:** 2026-09-06 · **Status:** scoped, NOT started (one fix already shipped, see Phase 0)
**Research:** full audit with `file:line` evidence, summarised inline below.

## Decisions taken (binding)

| # | Decision |
|---|---|
| D1 | **Attendance is not tied to pay yet, but will be.** Build the audit trail and the governed amendment route NOW, while the table is small — retrofitting an audit onto historical rows leaves those rows with no history. |
| D2 | The model must express **half-day, absence reason and overtime**. Two timestamps cannot represent them: a half-day is currently "3.5 hours", indistinguishable from leaving early, and an absence is "no row", which is also what a dead phone looks like. |
| D3 | **Owner/manager may amend, any time, always audited.** A worker may never rewrite their own past hours — that is the conflict of interest. Every amendment records who, when, and the previous value. |
| D4 | A forgotten check-out **auto-closes at a farm-configured end time, clearly flagged** as unconfirmed, so it is visible rather than silently becoming a full day. |
| D5 | Approved leave **annotates** the calendar/roster/export as "on leave"; it does NOT create an attendance row. Leave is approved and reversed asynchronously, and letting it mutate the ledger fights the audit trail in D3. |
| D6 | Workers see **their own totals and can export their own record**. |
| D7 | **Server-side summaries and date-bounded reads**, plus the missing composite index. |

---

## Phase 0 — SHIPPED

**The offline check-in recorded the wrong time.** `AttendanceScreen` and `TeamScreen` posted `{ farmId }` with no `checkInAt`, so the server fell back to the column default — `CURRENT_TIMESTAMP` **at the moment the row is written**, which offline is when the queue drains. A 06:00 check-in with no signal, drained at 18:00, recorded an 18:00 start and erased the day's hours. The entity comment claimed the opposite and the DTO already accepted the field; only the client never sent it.

**Two tests were enforcing the bug.** Both asserted `payload: { farmId }` exactly, so they passed *because* no time was sent and failed the moment it was fixed. Both now assert the behaviour — that the recorded instant is the moment of the press — and both fail if the fix is reverted.

> Not fixed by Phase 0: a client can still send an arbitrary `checkInAt` (B3 below). Sending the field does not make that worse — the DTO already accepted it unbounded — but it is now on a live path and belongs in Phase 1.

---

## Confirmed bugs, worst first

Ranked by consequence to a farmer, not by effort.

| id | Bug | Evidence | Consequence |
|---|---|---|---|
| **B1** | Offline check-in recorded drain time | *fixed in Phase 0* | A whole day's hours erased |
| **B2** | Check-out overwrites a **closed** shift unconditionally; no bound, no audit | `attendance.service.ts:112` | A worker can rewrite last week's hours upward; an owner can rewrite anyone's. `checkOutAt < checkInAt` is accepted and the shift then silently drops out of totals |
| **B3** | `checkInAt` accepts any past or future instant | `dto/check-in.dto.ts:19-21` | A worker can backdate or post-date their own attendance via the API |
| **B4** | Home's "present today" buckets by **UTC** | `HomeScreen.tsx:330-334` | Anyone starting 00:00–05:30 IST is not counted present |
| **B5** | No constraint prevents two **open** shifts at once | migration `1780302000000:26-34` | Two devices, or a queued check-in plus a manual retry, produce overlapping shifts |
| **B6** | Approved leave is never reconciled | no cross-reference in either service | Someone on approved leave is listed as an absentee |
| **B7** | Denominator counts **pending** join requests | `farm-members.service.ts:304-307` | "3 of 7 present" where 7 includes people who cannot check in |
| **B8** | Team overview fetches **all attendance history**, every load | `team-overview.service.ts:106-107` | Unbounded payload on a rural connection, for two numbers |
| **B9** | A stale open shift blocks check-in forever | `AttendanceScreen.tsx:81,107` | Forgot to check out three weeks ago → no way to start today; checking out now stamps today onto that old record |
| **B10** | Export offers the attendance dataset to workers who cannot read it | `collect.ts:580`, `ExportScreen.tsx:67` | A worker picking "Attendance" gets a 403 rather than their own hours. *Not traced end to end — verify before fixing* |

**Not a bug, checked deliberately:** attendance correctly uses `istDayRangeUtc` server-side (`attendance.service.ts:189,195`); `findMine` is hard-filtered to the caller (`:128-129`); and the pond-scoping hole found in the tasks module does **not** reproduce, because attendance has no `pond_id` to scope.

---

## Phase 1 — Correctness and safety

No schema change beyond one index. Ships by OTA plus a backend deploy.

1. **Bound `checkInAt`** (B3) — reject an instant more than a small window in the future, or further in the past than a farm-configurable amount. A manager back-filling yesterday is legitimate; a worker posting January is not.
2. **Refuse check-out on an already-closed record** (B2), and reject `checkOutAt <= checkInAt`. Both are 400s, not silent successes.
3. **Fix the Home present-count** (B4) — bucket by the IST day, using the same helper the server does, or have `/team/overview` pass the date.
4. **Stop counting pending members** (B7) — fix in the three call sites that build denominators, not in `listMembers`, because the members screen legitimately wants to render pending rows.
5. **Prevent two concurrent open shifts** (B5) — a partial unique index on `(farm_id, user_id) WHERE check_out_at IS NULL`. Multiple shifts per day stay legal; two *open* ones do not.
6. **Composite index `(farm_id, check_in_at)`** — the month query filters both and only single-column indexes exist.
7. **Verify B10** and gate the export dataset on capability if confirmed.

**Tests:** every one of these needs a test asserting the refusal, not the call shape. Six existing assertions in `attendance.service.spec.ts` check which capability *string* was passed to an always-resolving mock; they verify nothing about whether a worker is actually refused. `:93-98` is the one that tests real behaviour and is worth more than the other five combined.

---

## Phase 2 — Audit trail and governed amendment (D1, D3)

The phase that makes this a defensible pay record.

- **Migration**: `created_by_id`, `updated_at`, `amended_by_id`, `amended_at`, `previous_values` (jsonb). Backfill `created_by_id` from `user_id` for existing rows, with a comment that historical rows genuinely have no author recorded — do not invent one.
- **`PATCH /attendance/:id`** at `WRITE_MANAGEMENT`, the only route that may change a closed record. Writes the audit fields.
- **Remove** the ability for `WRITE_OPERATIONAL` to re-close a closed shift (B2) — self check-out stays, but only while the shift is open.
- Surface "amended by X on Y" in the log screen and the export. An amendment nobody can see is not an audit trail.

---

## Phase 3 — Shift model (D2)

- **Migration**: `shift_type` (`full` | `half` | `overtime`), `absence_reason` (nullable, constrained set), `auto_closed` boolean.
- Half-day and overtime become explicit rather than inferred from an hours threshold the app does not know.
- Absence reason distinguishes sick / no-show / not-scheduled from "phone died".
- **Auto-close (D4)**: a farm-level `shift_end_time` setting; a shift still open past it is closed at that time with `auto_closed = true` and rendered distinctly everywhere. Needs a decision at build time on whether an auto-closed shift is payable — flag it, do not assume.

---

## Phase 4 — Reads, summaries and leave (D5, D6, D7)

- **Date-bound every read.** `/team/overview` passes today; the log screen passes its month. Kills B8.
- **Server-side summaries**: per-worker and per-period totals computed in SQL, so the phone stops downloading history to add it up. This is also the shape payroll will need.
- **Leave annotation (D5)**: join approved `leave_requests` over the range and mark those days "on leave" in the calendar, the roster and the export. No attendance row is created.
- **Worker self-view (D6)**: own totals per week and month, and their own export. `findMine` already enforces the scoping correctly.
- **Per-worker subtotals in the export** — grouping by worker is what the CSV is actually for; today it is a flat shift list.

---

## Phase 5 — Payroll readiness (D1, not yet requested)

Deliberately last and deliberately not designed here. When wages arrive: an hourly/daily rate per member, a period lock so a paid period cannot be silently amended, and a link from a locked period to a `transactions` row. **Do not build speculatively** — but Phases 2 and 3 exist so this is possible without rewriting history.

---

## Gate

Per the project standard: `npx tsc --noEmit` and `npx jest --maxWorkers=2 --forceExit` in each package changed, plus `bash scripts/check-calculator-i18n.sh` on the frontend. Six locales for every new user-visible string. Migrations hand-run against production, never auto.

## Sequencing note

Phases 1 and 2 are the ones that matter if attendance becomes pay (D1). Phase 3 changes the schema again, so if Phases 2 and 3 are done together it is one migration rather than two — worth doing if both are approved at the same time.
