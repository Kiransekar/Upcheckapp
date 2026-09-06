# Pond money, pond identity, and the silent logout

**Date:** 2026-09-06 · **Status:** SHIPPED (all four reports fixed)

Four reports, researched to root cause before any edit. Decisions taken by the
owner are recorded first so the reasoning survives the code.

## Decisions taken (binding)

| # | Decision |
|---|---|
| D1 | **Merge the two money ledgers at read time.** Keep the pond Expenses tab as the pond-scoped view; project every pond cost into the Money entry list, the same way harvest sales already are. No migration of live money rows. |
| D2 | **A money entry may name a pond, optionally.** "Whole farm" stays the default — a licence fee belongs to no pond, and every pre-existing row is one. |
| D3 | **Onboarding stays short, and says what it guessed.** No measurement questionnaire in front of someone who has not seen the app. But add an optional "more details" so a farmer who wants to answer is not made to wait — and where the app filled something in, the pond says it is **not confirmed** rather than showing a default as if the farmer gave it. |
| D4 | **Ask a real name per pond**, pre-filled `P1…PN`, editable. Whatever is typed becomes the display name; the server's pond code is derived from it rather than asked for. |

---

## 1. Money — two ledgers, one of them half-invisible

**Reported:** "The money data in farm money screen and the expenses tab inside
each pond differs. I added expense inside a pond but it didnt show inside the
money screen."

There are two tables. `transactions` is farm-level, written by Money's "Add
entry". `expenses` is pond/crop-level, written by the pond Expenses tab. The
Money **headline** summed both. The Money **entry list** rendered
`transactions` only, and pond costs were fetched solely when the farmer drilled
into one specific pond (`MoneyScreen.tsx`, `enabled: !!pondId`). So a cost typed
on a pond moved the total and then had no line to point at.

**Fixed** by `ExpensesService.findMoneyEntries` — a read-only projection into
entry shape, merged in `MoneyOverviewService`, exactly the pattern
`HarvestsService.findMoneyEntries` established. Writing a real `Transaction` per
expense would have double-counted every cost, because the report already sums
that table.

### The money that was counted nowhere

Found while tracing the above, and worse than the report.

`ExpensesService.create` sets `cropId` to `pond.activeCycleId` when none is
given — **null for a pond with no running cycle**. The financial report reached
costs only through `getCycleFinancials(cropId)`, i.e. `WHERE cropId = …`. Those
rows matched no crop and were counted **nowhere**: not in the headline, not in
any list. A farmer recording pond prep, repairs or seed between crops saw ₹0.

**Fixed** by summing costs **per pond** (`ExpensesService.totalsByPond`), which
counts every row exactly once whether or not it has a crop, and collapses the
per-crop fan-out into one query. Revenue still comes from the crop loop, because
a harvest genuinely belongs to a cycle.

### Pond attribution on entries (D2)

`transactions.pond_id`, nullable, `ON DELETE SET NULL` — deleting a pond must
not delete the record of having spent money on it. The create path proves the
named pond belongs to the named farm; without that check, a farmer could pass
their own `farmId` with another tenant's `pondId`. Same rule
`ExpensesService.create` already applied to `cropId`.

**Left deliberately:** `TransactionsService.findAll` still hard-codes
`archived: false`. That was exactly right while a transaction hung off a farm
only; now that one may name a pond, a row on an archived pond will not be
marked. Marked `ponytail:` in the code — join the pond when enough money is
attributed for it to be visible. Pond costs, which are the archived money that
actually exists today, **are** marked.

---

## 2. Pond creation asked for almost nothing

**Reported:** "it didnt ask me the required fields in pond creation but shows
only in editing process."

Both are true, of different screens. `CreatePondScreen` asks for everything.
Onboarding's `PondNamesScreen` asks for a prefix, a depth and an optional area,
then **hardcodes** `geometryType: 'irregular'` and `constructionType:
'earthen'`. The farmer went through onboarding, so they met the short one.

The problem was never that onboarding is short — it is that the result was
indistinguishable from an answer the farmer gave. The pond page rendered
"Earthen" and an area with the same confidence as a surveyed figure, and volume,
aeration adequacy and every dosing figure downstream read those numbers.

**Fixed** three ways, per D3:
- An optional **"Add more details"** on the onboarding step — shape and
  construction, one tap away, for the farmer who wants to say now.
- `ponds.assumed_fields` (new column) records what the **app** filled in.
  Never inferred server-side: the server cannot tell a defaulted `earthen` from
  a chosen one, so the client says which it was.
- The pond page shows a banner naming exactly what is unconfirmed and why it
  matters, linking to the form. Answering a field retires its label —
  `PondsService.update` derives that from what the update actually **sets**, not
  from a flag the client sends, so a confirmation cannot be claimed without a
  value behind it.

---

## 3. P1, P2 everywhere

**Reported:** "I created ponds like P1, P2 as prefix based identification but
thats not farmer friendly and also it leads to duplication."

Onboarding sent `namePrefix` and **no `displayName` at all**, defaulting to
`'P'`. Every farm in the app therefore started at P1, and a farmer with two
farms had two P1s with nothing between them. Renaming existed only in the pond
edit form.

**Fixed** per D4: one editable name box per pond, pre-filled `P1…PN`. A farmer
who does not care taps straight through; one who does types "North pond". The
prefix the server needs for its pond code is derived from the name
(`derivePrefix`, falling back to `P` for a name with no Latin characters — a
Tamil or Odia name must not fail creation).

---

## 4. The app logged people out on network errors

**Reported:** "the app is auto logging out in network errors, phone restart etc."

Two independent root causes, both proven, both fixed.

**4a — the offline path erased its own credential.** `authStore`'s persist
`partialize` wrote `refreshToken: state.session?.refresh_token`, re-deriving it
on **every** state write. `enterOfflineSession()` sets `session: null` — so the
one code path built to keep a farmer signed in through a network blip was itself
wiping the refresh token out of SecureStore. The next cold start found nothing
to restore and showed the login screen. No revoked token, no server involvement.

The token is now state in its own right; only `clearSession()` drops it.

**4b — the backend reported "your session is invalid" for its own outage.**
`SupabaseAuthService.refreshSession` mapped **every** error to
`UnauthorizedException`. The client correctly treats a 401 from that endpoint as
proof the session was revoked and calls `clearSession()` — which also wipes
every cached read. So a transient failure between the backend and Supabase
(timeout, 5xx, rate limit, a dead fetch with no status at all) signed the farmer
out of their phone, then asked them to sign in again against the service that is
currently unreachable.

Only 400/401/403 from Supabase now ends a session. Everything else is a 503,
which the client already handles by staying authenticated against cached data
and retrying on reconnect.

---

## Migrations (hand-run, never `migrationsRun`)

| File | What |
|---|---|
| `1780700400000-AddTransactionPond` | `transactions.pond_id` uuid null, FK SET NULL, index |
| `1780700500000-AddPondAssumedFields` | `ponds.assumed_fields text[] NOT NULL DEFAULT '{}'` |

Both additive, idempotent and reversible. Every pre-existing row gets the
honest default: no pond, nothing assumed.

## Gate

`npx tsc --noEmit` and `npx jest --maxWorkers=2 --forceExit` in both packages,
plus `bash scripts/check-calculator-i18n.sh`. Backend 122 suites / 1315 tests;
frontend 143 suites / 1131 tests. Every fix above is mutation-proven: the guard
was broken, the test watched to fail, the guard restored.

Six locales for every new string. The five non-English sets still want a
native-speaker pass — same standing caveat as the email templates.
