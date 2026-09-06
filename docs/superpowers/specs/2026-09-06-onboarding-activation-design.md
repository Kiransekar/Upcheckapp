# Onboarding & Activation — Design

**Date:** 2026-09-06 · **Status:** design approved, NOT YET IMPLEMENTED
**Baseline:** master `f7c3e3e`. Read against the working tree of 2026-09-06, which carries a
concurrent session's then-uncommitted work on money/pond-scoping, `authStore` refresh-token
persistence and `Pond.assumedFields` — all since landed as `130c114` and `01f8bb2`.
**Supersedes:** `docs/ONBOARDING_MODULE_PLAN.md` (2026-07-11). That plan describes a flow
that no longer exists — Language/Intent/JoinFarm/PondNames were added in the Aug–Sep
redesign and the fabricated "EXAMPLE" welcome card it recommended has since been deleted.
Do not implement from it.

## Purpose

Close the activation funnel. Today a farmer can install the app, sign up, and either
(a) be routed into a loop that tells them their correct invite code is wrong, or
(b) complete every step the app asks of them and still never see a single number the
product exists to compute. Neither failure is visible to us, because product analytics is
opt-in behind a Settings toggle nobody is prompted to open.

---

## What the current design already gets right — do not undo any of this

Verified by reading the screens, not the docs. Any implementation that regresses one of
these has made things worse, whatever else it fixed.

1. **One decision per screen.** Language → Welcome → Intent → Register. Language is chosen
   before any English is read and switches live, so the effect is visible before Continue.
2. **The fabricated example dashboard is gone.** `WelcomeScreen.tsx`'s header records why:
   it was "a static mockup of numbers nobody had earned yet". Do not reintroduce fake data
   as a way of showing value.
3. **`Pond.assumedFields`** — a pond records which of its numbers the app guessed rather
   than the farmer measured, because volume, aeration adequacy and every dosing figure read
   them. Presenting a default at full confidence is described in-code as "a lie the farmer
   plans a season on". That principle governs W7 below.
4. **`features/cycleRequirement.ts`** — a feed/sampling/measurement row with a null
   `crop_id` saves successfully and is then silently excluded from FCR, ABW, growth and
   P&L. The gate exists because the success toast was worse than a refusal.
5. **Two distinct join failures.** A code that never existed is a typo (retype it); a code
   that is expired/revoked/exhausted is the owner's to fix. Collapsing them sends a worker
   round in circles. W1 extends this principle rather than replacing it.
6. **The analytics privacy architecture.** The SDK is never constructed without consent,
   revoking consent shuts the client down, and properties pass an allowlist. W8 adds an
   *ask*. It changes none of the above.

---

## Decisions taken

| # | Decision | Chosen |
|---|---|---|
| D1 | Scope | Fix the funnel leaks **and** the value moment. Offline-tolerant farm creation is explicitly out of scope. |
| D2 | Analytics consent | Ask once, honestly, **immediately after the account is created** — before farm setup, so the setup funnel itself is measurable. |
| D3 | Join approval | **Per-invite, owner's choice at mint time.** `farm.joinApproval` continues to govern the open farm-code path. |
| D4 | Invite delivery | **https App Link + public landing page.** |
| D5 | Join domain | **`upcheck.in` apex**, pointed at the existing Vercel project. |
| D6 | App Links sequencing | **Landing page ships now; verified App Links after Play submission**, when the Play App Signing SHA-256 exists. |

---

## One hard constraint — read before touching anything

> **Resolved 2026-09-06, after this document was written.** The concurrent session's work
> landed as `130c114` and `01f8bb2`, and the tree is clean. `authStore.ts` (W2) and
> `PondNamesScreen.tsx` (W7) are no longer contended — start both from `master`. The depth
> half of W7 shipped in `01f8bb2`; see W7 for what remains.

### App Links depend on a key that does not exist yet

`.well-known/assetlinks.json` must carry the **SHA-256 of the signing certificate**. With
Play App Signing enabled, Google re-signs the bundle, so that is *not* the fingerprint of
the AAB you upload. `docs/PLAY_STORE_SUBMISSION.md` already flags the same footgun for
Google Sign-In and Truecaller, and notes that neither fails loudly.

Consequence for W4: the landing page and the https URL ship immediately and are useful on
their own. **Registering App Links is a follow-up task bundled with the post-submission
SHA-1/SHA-256 re-registration**, not part of the initial change.

---

# The workstreams

Ordered by dependency, then by value per unit of effort.

## W1 — Repair the worker dead-end  🔴 highest priority

### The defect, verified end to end

| Step | Where |
|---|---|
| Worker redeems a valid code | `farm-invites.service.ts:273` — status is `pending`, because `Farm.joinApproval` defaults to `'manual'` (`farm.entity.ts:92`) |
| `JoinedFarmScreen` correctly says "waiting for approval" | `JoinedFarmScreen.tsx` — this part is right |
| Worker continues to Home. `getAccessibleFarmIds` filters `status:'active'` → zero farms | `farm-access.service.ts:144` |
| Home renders the zero-farm state: *"No farms yet — Create a farm / Join with a code"* | `HomeScreen.tsx:752` |
| Worker re-enters the code. Server replies correctly: *"You have already asked to join this farm."* | `farm-invites.service.ts:262` |
| Client discards that message — `already pending` is not one of the four `InviteRejection` values, so it falls through to the typo branch: red boxes, *"Check the code and try again."* | `api/farmMembers.ts:95-103`, `JoinFarmScreen.tsx:117` |

The worker now believes the code is wrong and asks for a new one. The new code produces
the identical error. The loop only ends when an owner happens to open the app.

Workers outnumber owners on every farm. This is the largest activation leak in the product.

### The fix

1. **Widen the rejection contract.** `InviteRejection` gains `already_pending` and
   `already_member`; the backend returns those `reason` codes alongside its existing
   messages. `isDeadCode()` grows a third tone — *waiting*, distinct from both *typo* and
   *dead code*.
2. **Do not loosen `getAccessibleFarmIds`.** `status:'active'` is a real authorization
   boundary and must stay. Instead, `farmMembersApi.listMine()` surfaces pending rows, and
   `HomeScreen` gains a **third empty state** between "loading" and "no farms":
   *"Waiting for [Farm] to let you in."* It is not the create-or-join state.
3. **`JoinedFarmScreen`'s pending branch stops being terminal** — it hands off to that
   waiting state rather than to a dashboard where every action fails.
4. **Owner side.** A pending-requests entry point on Team / `FarmMembersScreen`, so
   approval does not depend on a push notification arriving and being tapped.

**Files:** `backend/src/farm-members/farm-invites.service.ts`,
`frontend/src/api/farmMembers.ts`, `frontend/src/screens/onboarding/JoinFarmScreen.tsx`,
`frontend/src/screens/onboarding/JoinedFarmScreen.tsx`,
`frontend/src/screens/main/HomeScreen.tsx`,
`frontend/src/screens/farms/FarmMembersScreen.tsx`, plus `members.ts` × 6 locales.

**Test that must exist:** a worker with only a `pending` membership sees the waiting state,
not the zero-farm state; re-submitting the same code shows the waiting tone, not the error
tone. Mutation-check both — the second one currently passes for the wrong reason.

---

## W2 — Honour the signup intent on every method

`IntentScreen` is a full screen asking a real question. Its answer reaches `signup()` on
the **email path only** (`RegisterScreen.tsx:94`). `googleLogin` never sets
`pendingFarmSetup`/`pendingFarmJoin` and never calls `persistOnboardingIntent`
(`authStore.ts:481`); the Truecaller buttons navigate with no params at all
(`RegisterScreen.tsx:193`).

Truecaller is described in `RegisterScreen.tsx`'s own header as *"the only working
phone-number sign-up route"* — i.e. the likely dominant path for this audience. So for most
farmers, `IntentScreen` is ceremony, and the server-side resume point that would survive a
reinstall is never armed.

**Fix:** `googleLogin` and both Truecaller screens accept a `SignupIntent` and do exactly
what `signup()` already does — set the gate, fire-and-forget `persistOnboardingIntent`.
`RegisterScreen` passes its `intent` into both social buttons.

**Unblocked** as of `130c114` — start from `master`.

---

## W3 — Fix the returning-user route

`RootNavigator.tsx:236` reads:

```ts
: !isAuthenticated && needsLanguage
    ? 'Language'
    : undefined
```

`undefined` makes React Navigation fall back to the **first registered screen**, and the
first screen in the unauthenticated stack *is* `Language` (`RootNavigator.tsx:255`). The
branch is dead. Anyone who logs out — or whose refresh token is revoked, which routes
through `clearSession()` — reopens the app at the language picker and must walk
Language → Welcome → "Skip for now" → Login. The comment two lines above states the
intent was "everyone else starts on the main app / login."

**Fix:** make every branch explicit — `needsLanguage ? 'Language' : 'Login'`. One line,
plus the navigator test that currently does not exist for this case.

---

## W4 — Invite delivery: landing page now, App Links after submission

Today the share text is *"Or tap: `upcheckapp://join/{{code}}`"*
(`i18n/locales/en/members.ts:31`, and the same in all five other locales). `linking.ts`
registers `prefixes: ['upcheckapp://']` — a custom scheme only. WhatsApp does not linkify
custom schemes, so the line renders as dead text; and a recipient without the app installed
gets nothing at all. No web fallback, no Play Store fallback, no code carried through
install.

### Phase A — ship now

- Public `/join/[code]` route on the **existing Vercel Next.js project** (`admin/`), served
  from the **`upcheck.in` apex**.
- The page shows the farm name, the 8-character code in large type, and a Play Store
  button. It must work with JavaScript off and on a slow connection.
- Replace the `upcheckapp://` line with `https://upcheck.in/join/{{code}}` in all six
  `members.ts` locale files.
- Keep the bare code in the message. It is the fallback that always works.

### Phase B — after Play submission

- Serve `.well-known/assetlinks.json` from `upcheck.in` with the **Play App Signing
  SHA-256**.
- Add the `https` prefix and Android `intentFilters` with `autoVerify` to
  `app.config.ts`. Note the existing comment at `app.config.ts:32` explaining why there is
  no `intentFilters` entry today — it is correct for the custom scheme and must be revised,
  not deleted.
- Bundle this with the Google Sign-In / Truecaller fingerprint re-registration, which has
  to happen at the same moment for the same reason.

---

## W5 — Per-invite approval

`farm_invites` already carries `role`, `expiresAt`, `maxUses`, `usedCount`, `revokedAt`.
Adding approval is one column and one read.

- **Migration:** `farm_invites.requires_approval boolean NOT NULL DEFAULT false`.
  Timestamp must exceed `1780700500000`.
- `CreateInviteDto` gains an optional `requiresApproval`.
- `redeem()` reads **the invite's** flag in preference to `farm.joinApproval`. The farm-level
  policy continues to govern the open farm-code path unchanged.
- Owner UI: one toggle on the invite sheet — *"Let them in straight away"* vs *"I'll
  approve first"*.

**Default is `false` (no approval).** An invite code is already server-minted, expiring,
revocable and use-limited — it *is* the credential. Requiring a second manual step on top
is what strands the worker in W1. Owners who want gatekeeping opt into it per invite.

Migrations are run manually here and several are already queued unrun. This adds one more —
say so loudly in the PR.

---

## W6 — One activation guide, ending at the value moment

`HomeScreen` currently renders **two** activation guides with different sequences and
different finish lines:

| | Sequence | Finish line |
|---|---|---|
| `firstStep` hero (`HomeScreen.tsx:450`) | ponds → **cycle** → log | a logged reading on a stocked pond |
| `GettingStarted` checklist (`HomeScreen.tsx:564`) | ponds → log → invite | "invite your team" |

The checklist can be completed **100% without ever stocking a cycle**. Water-quality logging
correctly works without one (`cycleRequirement.ts` — water quality is pond-level and
complete on its own), so "log your first reading" is satisfiable while FCR, ABW, growth,
feed advice, disease risk and P&L all stay empty. **The checklist's finish line is not the
product's value moment.**

**Fix:** retire the checklist; keep the hero, whose sequence is already right. One
definition of activated: **pond → cycle → first log → invite team**, with the cycle step
non-skippable in the definition.

Note the hero's existing proxy: it uses `logsToday.total === 0` to mean "nothing is
stocked". A farmer with four ponds who stocks one has `total > 0`, so the cycle step
disappears for the other three. Fix the proxy while consolidating, or accept and document
it — do not leave it undocumented in the one guide that survives.

---

## W7 — Seed the first cycle in the wizard

Nothing in first run shows what the app computes, and the honest reason is that it cannot:
every differentiated number needs a stocked cycle. Rather than fake it, ask for it at the
one moment the farmer is already thinking about that pond.

`PondNamesScreen` gains an optional per-pond **"Is this pond already stocked?"** — stocking
date and a rough PL count. Answering creates the crop; skipping is free and lands exactly
where W6's hero picks up.

One rule, inherited from the screen's own stated philosophy: **anything the app infers
rather than the farmer states goes into `assumedFields`.** A stocking date or PL count the
farmer skipped must not reach the engines looking like an answer.

> **Depth: done, shipped in `01f8bb2` (2026-09-06).** This document originally called for
> marking depth assumed on ponds 2..N, since one typed depth was applied to the whole set
> and — unlike shape, construction and area — was not recorded as a guess, while feeding
> volume, aeration adequacy and every dosing figure. The implemented rule is better than
> the one proposed here: `pondCount > 1 ? ['depthM'] : []`. For a **single** pond the typed
> depth genuinely *is* that pond's measurement, so marking it assumed would have been a
> false negative — flagging a real reading as a guess and degrading confidence the farmer
> had earned. Two mutation-proven tests pin both directions. Do not redo this.

Also worth fixing here while the file is open: the create loop is **sequential** — one
`pondsApi.create` round trip per pond — and on partial failure it toasts a count and
`navigation.reset`s to Home with **no retry path**, leaving a farm with fewer ponds than the
farmer named.

**Unblocked** as of `01f8bb2` — start from `master`.

---

## W8 — Ask for analytics consent, once

Seventeen events are wired, including `SIGNUP_COMPLETED`, `ONBOARDING_COMPLETED`,
`FARM_CREATED`, `POND_CREATED`, `CYCLE_STARTED`, `FIRST_LOG_RECORDED` and
`INVITE_ACCEPTED`. Consent defaults to `'unasked'` (`telemetryPrefs.ts:33`) and the **only**
place to grant it is a toggle in Settings (`SettingsScreen.tsx:451`) the farmer is never
prompted to open. In production the funnel is dark for effectively every user.

"Never ask" is not the same as "privacy-first". It means every activation decision after
this one — including every workstream above — ships on judgement with no way to tell whether
it worked.

**Fix:** one screen, immediately after the account exists and before farm setup (D2), with
a genuine two-button choice, nothing pre-ticked, and wording that matches the Privacy
Policy's existing promise that switching it off "stops collection — it is not a preference
we quietly ignore". Declining must be a single tap and must never be re-asked.

**No change** to the allowlist, the never-construct-without-consent rule, or the
shutdown-on-revoke path. The ask is the only addition.

### Baseline to capture before anything else ships

Once consent is live, these are the numbers the rest of this document is judged against:

- % of accounts that reach a created farm
- % that reach a **stocked cycle** (the real activation moment — W6's finish line)
- % of invited workers who reach an active membership, split by approval mode (W5)
- % of first-run sessions that end at the language screen and never return (W3)

---

# Ordering

| Order | Workstream | Why here |
|---|---|---|
| 1 | **W8** consent ask | Everything downstream is unmeasurable without it. Cheap, independent, no blockers. |
| 2 | **W3** returning-user route | One line, no dependencies, affects every signed-out user. |
| 3 | **W1** worker dead-end | The largest leak. Independent of the concurrent session's files. |
| 4 | **W5** per-invite approval | Completes W1's story; needs a migration, so start it early enough to run. |
| 5 | **W4-A** landing page + https link | Independent of the app entirely; unblocks the invite loop for uninstalled recipients. |
| 6 | **W2** intent on all signup methods | No longer blocked (`130c114`); may move earlier if W1 slips. |
| 7 | **W6** one activation guide | Should land before W7, so W7 has one guide to hand off to. |
| 8 | **W7** cycle seeding (depth half shipped in `01f8bb2`) | Wants W6 landed first, so there is one guide to hand off to. |
| 9 | **W4-B** verified App Links | Blocked on the Play App Signing key. Bundle with the SHA re-registration. |

---

# Cross-cutting costs, stated plainly

- **i18n × 6.** W1, W5, W7 and W8 all add strings. A namespace added to `en` and not
  registered in the other five silently resolves to nothing — this repo's single easiest
  mistake, per `AGENTS.md`. Check all six before calling any of these done.
- **Migrations are manual.** W5 adds one to a queue that already has unrun entries.
- ~~**File collisions.**~~ Resolved 2026-09-06: `130c114` and `01f8bb2` landed and the tree
  is clean. No file in this document is contended.
- **Verification gate.** `cd backend && npx tsc --noEmit -p . && npx jest` and
  `cd frontend && npx tsc --noEmit && npx jest` must both be green before any commit, per
  `AGENTS.md`. Branch from `development`, PR into `development`, no self-merge.

# Explicitly out of scope

- **Offline-tolerant farm/pond creation.** Onboarding is today the least offline-tolerant
  part of an offline-first app — `CreateFarm`/`PondNames` bypass `recordSync` entirely and
  need a live connection. Fixing it properly means client-minted farm IDs and is an
  architectural change that would dominate this effort. Recorded here so it is deferred
  deliberately rather than forgotten.
- **Progress-indicator unification.** The first run currently numbers itself three
  incompatible ways: "step 1–3 of 3" (Language/Welcome/Intent), an unnumbered account form,
  then "Step 1 of 2" (CreateFarm/PondNames). Real, cosmetic, and cheaper to fix once W6/W7
  have settled the step count.
- **The email-verification cliff.** Email signup ends at "check your email" + "Back to
  login"; leaving to a mail client and returning is a real drop-off point. W2 reduces its
  blast radius by making the phone paths work properly; changing the verification model
  itself is a separate decision.
