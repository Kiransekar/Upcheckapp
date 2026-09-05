# Play Store Submission — Neerani

**Status:** ready to submit. The artifact is built and the OTA channel is populated.
**Owner:** Upcheck Technologies Private Limited
**Last updated:** 5 September 2026

---

## What you are submitting

| | |
|---|---|
| App name | **Neerani** |
| Package (immutable identity) | `com.upcheck.app` |
| Version | `1.0.0`, versionCode **10** |
| Artifact | Android App Bundle (`.aab`) |
| EAS build | `b2fba237-9e01-4d88-bd81-56a6b55531a3` |
| Download | https://expo.dev/artifacts/eas/GP6EGxMwvWSX0_rRrx_TPUG8mF2DuIAqUveKlJGw4c4.aab |
| **Artifact expires** | **5 October 2026** — download and keep a local copy |
| OTA channel | `production` (already carries the Neerani wordmark fix) |
| Signing | EAS-managed keystore (`Upcheck-preview`) |

The package id stays `com.upcheck.app` deliberately. Play treats it as the app's
identity forever, and both the Google OAuth client and the Truecaller
registration are bound to it plus a signing fingerprint. The user-facing name is
`Neerani`; the id is invisible to farmers.

---

## ⚠️ Read this first — the failure that will not announce itself

**Enabling Play App Signing changes your app's signing fingerprint.** Google
re-signs the bundle with its own key, so the SHA-1 of the app a farmer installs
from Play is **not** the SHA-1 of the AAB you uploaded.

**Google Sign-In and Truecaller are both registered against a SHA-1.** Neither
will work for Play-installed users until the new fingerprint is registered, and
neither fails loudly — the user taps "Continue with Google", nothing happens, and
nobody files a bug.

Your side-loaded APK will keep working the whole time, because it is signed with
the original key. **A passing test on the APK proves nothing about the Play
build.**

### The fix, in order

1. Upload the AAB to **Internal testing** (step 6 below).
2. Play Console → **Setup → App integrity → App signing key certificate**.
   Copy the **SHA-1 certificate fingerprint**.
3. Add it to Google Cloud Console → APIs & Services → Credentials → the Android
   OAuth 2.0 client for `com.upcheck.app`. Keep the existing fingerprint too —
   an OAuth client can hold several, and you still need the old one for
   side-loaded builds.
4. Add it to the Truecaller developer dashboard for the same package.
5. Install **through the Play internal-testing link** — not the APK — and sign in
   with **both** Google and Truecaller before promoting to any wider track.

Do not skip step 5. It is the only test that exercises the real signature.

---

## Prerequisites to have ready

| Item | Where it comes from | Status |
|---|---|---|
| Google Play Developer account (one-off $25) | play.google.com/console | you |
| Privacy Policy, publicly reachable URL | host `docs/legal/PRIVACY_POLICY.md` | **content ready, needs hosting** |
| Data deletion URL | host `docs/legal/ACCOUNT_DELETION.md` | **content ready, needs hosting** |
| App icon, 512×512 PNG | `frontend/assets/` | ready |
| Feature graphic, 1024×500 | — | **to produce** |
| Screenshots, min 2 phone | from the APK on the OPPO | **to capture** |
| Short description (80 chars) | draft below | draft |
| Full description (4000 chars) | draft below | draft |

Both legal URLs must be reachable **before** you submit — Play rejects a listing
whose policy link 404s, and the deletion URL is separately mandatory under the
data-deletion policy.

---

## Data safety form — answer it from this table

Play's Data safety section must match what the app actually does and what the
Privacy Policy says. Mismatches are a common rejection reason, and here the
policy is the source of truth because it is published.

### Permissions declared in the manifest

`INTERNET` · `CAMERA` · `ACCESS_FINE_LOCATION` · `ACCESS_COARSE_LOCATION` ·
`RECORD_AUDIO` · `READ_CONTACTS` · `READ_PHONE_STATE` · `READ_CALL_LOG` ·
`ANSWER_PHONE_CALLS` · `READ_EXTERNAL_STORAGE` · `WRITE_EXTERNAL_STORAGE` ·
`VIBRATE`

### What to declare as collected

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | No | Account management | Required |
| Email address | Yes | No | Account management | Required |
| Phone number | Yes (Truecaller / phone sign-in only) | No | Account management | Optional — email sign-in avoids it |
| User IDs | Yes | No | Account management, analytics (hashed) | Required |
| Photos | Yes (only attached to a record) | No | App functionality | Optional |
| Voice or sound recordings | Yes (only a recorded note) | No | App functionality | Optional |
| Approximate / precise location | Yes | No | App functionality | Optional |
| Contacts | **No** | No | — | Read at pick time, never uploaded |
| Crash logs | Yes | No | Diagnostics | On by default, switchable off |
| Diagnostics | Yes | No | Diagnostics | On by default, switchable off |
| Product interaction | Yes | No | Analytics | **Opt-in only** |
| Financial info | **No** | No | — | Farm expenses stay on our own servers; never sent to analytics or crash reports |

Also tick: **data is encrypted in transit** (yes), **users can request deletion**
(yes — in-app, Profile → Delete Account), and **no data is sold**.

Contacts is deliberately "not collected": the app reads the single entry the user
picks and never uploads the address book. If you are unsure, over-declaring is
safer than under-declaring — but do not declare Financial info as collected-and-
shared, because it is not shared and saying so contradicts the policy.

### Sensitive permission declarations

Play will ask you to justify these two in the **App content → Sensitive app
permissions** section:

- **`READ_CALL_LOG` / `ANSWER_PHONE_CALLS`** — required by the Truecaller SDK for
  missed-call phone verification. Justification: "Phone number verification via
  the Truecaller SDK, which uses a missed call the app must detect. Call log data
  is never read for any other purpose, never stored and never transmitted to our
  servers. Email and Google sign-in are offered as alternatives."
- **`RECORD_AUDIO`** — voice notes attached to a pond record, started only by an
  explicit user action.

Expect this to be reviewed by a human and to add days to the first submission.
If Play pushes back on call-log access, the fallback is to ship without the
Truecaller missed-call path and rely on its one-tap OAuth flow plus email and
Google sign-in.

---

## Store listing drafts

**Short description (80 max):**
> Pond logs, water quality, feed and farm finances — built for shrimp farmers.

**Full description (draft — edit freely):**
> Neerani helps shrimp and aquaculture farmers run their ponds from one place.
>
> • Record water quality, feeding, sampling, mortality and treatments in seconds
> • See at a glance which ponds need attention, and which have not been updated
> • Track expenses, income and cycle profitability
> • Manage inventory and know before feed runs out
> • Share tasks with your team, with roles that control who sees what
> • Works offline — log now, it syncs when you have signal
> • Available in English, Hindi, Bengali, Tamil, Telugu and Odia
>
> Neerani is a decision-support tool. It records what you tell it and highlights
> what may need attention. It is not a substitute for professional or veterinary
> advice, and decisions about your stock remain yours.
>
> From Upcheck Technologies Private Limited.

Keep the disclaimer paragraph. It matches the Terms and it manages expectations
before install rather than after a bad season.

---

## Submission procedure

### 1. Create the app
Play Console → **Create app**. Name `Neerani`, default language English (India),
type **App**, **Free**. Accept the declarations.

### 2. Complete "App content"
Privacy policy URL · Ads (none) · App access (provide test credentials — sign-in
is required, so **reviewers will be blocked without them**) · Content rating
questionnaire · Target audience (18+, matching the Terms) · Data safety (table
above) · Government apps (no) · Financial features (**no** — the app tracks a
farmer's own expenses, it does not provide financial services) · Health (no).

### 3. Set up Play App Signing
Accept it when prompted. It is effectively mandatory for new apps and lets Google
re-sign per-device APKs. **This is what triggers the SHA-1 problem above.**

### 4. Upload the bundle
**Testing → Internal testing → Create new release**, upload the `.aab`.
Release name `1.0.0 (10)`. Write real release notes.

### 5. Add testers
Internal testing takes an email list, up to 100. Add yourself and anyone
field-testing. The opt-in link is on the same page.

### 6. Install from the Play link and test
Install via the internal-testing link on a device that does **not** have the
side-loaded APK. Then work through the checklist below.

### 7. Promote
Internal → Closed (optional) → Production. Google's review of a first submission
typically takes a few days, longer with sensitive permissions.

---

## On-device checklist before promoting

- [ ] **Truecaller login succeeds** (highest risk, silent failure — see SHA-1 above)
- [ ] **Google Sign-In succeeds** (same SHA-1 dependency)
- [ ] Email sign-up, verification mail arrives, and verification completes
- [ ] App name reads **Neerani**; launcher icon correct
- [ ] Notification small icon is a silhouette, not a solid box
- [ ] Reminders: Settings banner reports armed, and one actually fires
- [ ] Cold start on a fresh install feels acceptable on the OPPO
- [ ] Offline: log a record with data off, confirm it syncs when back on
- [ ] Money screen totals with a custom date range spanning a month boundary
- [ ] Farms list: "Include archived farms" returns the archived farm
- [ ] Analytics consent prompt appears once, and declining is not re-asked
- [ ] After granting consent, PostHog receives `$screen` events and identifies a person
- [ ] A deliberate error reaches Sentry **with no phone number, token or money value attached**

---

## Automated submission (optional)

`eas.json` already carries a `submit.production` block targeting the internal
track as a draft. To use `eas submit` you need a Google Play service account:

1. Play Console → **Setup → API access** → create/link a Google Cloud project.
2. Create a service account, grant it **Release manager** on this app.
3. Download the JSON key.
4. Either set `submit.production.android.serviceAccountKeyPath` to its path
   (**never commit the file**), or upload it once with
   `eas credentials` so EAS holds it.
5. `eas submit --platform android --profile production --latest`

Uploading the first release by hand is perfectly reasonable, and arguably better
— you see every form Play asks for rather than discovering them later.

---

## After launch

**Bumping versions.** `autoIncrement` is `true` for the production profile, so
each build takes the next versionCode. Play rejects duplicates, so do not turn
it off.

**Shipping fixes.** JS-only changes go out by OTA to the `production` channel
(`eas update --branch production`) with no Play review. Anything touching native
code, permissions or `android/` needs a new AAB **and** a `runtimeVersion` bump.

**`runtimeVersion` is a hand-maintained literal** (`app.config.ts`, currently
`2.0.0`). Bump it whenever the native project changes. Forgetting is the one way
to ship a poisoned OTA — Expo would serve a bundle importing native code the
installed binary does not have, crashing every user on it with no way to reach
them. The banner above the value in `app.config.ts` says so.

---

## Known limitations shipping in this release

These are deliberate, documented decisions — not oversights.

| Item | Why |
|---|---|
| Maps unused | `react-native-maps` is installed but nothing renders a map. No Google Maps API key needed. |
| Per-notification icons | 50 icon variants are committed but unusable: expo-notifications exposes no JS API for a per-notification small icon. Needs native work. |
| R8 minification off | `proguard-rules.pro` has no Truecaller rules; enabling R8 risks stripping the SDK and breaking auth silently. |
| Account deletion is immediate | No grace period, because that is what the code does. The policy says so plainly rather than promising a recovery window that does not exist. |
| Backend `SENTRY_DSN` unset | Server errors are invisible until it is set on the Render service serving `api.upcheck.in`. |
| Legal docs English only | A mistranslated "consent" or "liability" changes what the document means. The interface is fully localised; the policy says English is authoritative. |

---

## Outstanding before or shortly after launch

1. **Set `SENTRY_DSN` on Render** —
   `https://69827cb7d662117f72d45e92c99bc094@o4511772335865856.ingest.de.sentry.io/4512033193525328`
2. **Rotate every credential pasted into a chat session** — Upstash, Render,
   `ADMIN_API_KEY`, the database password, the Supabase service-role key, Brevo.
   Rotating `ADMIN_API_KEY` silently stops news ingestion unless QStash schedule
   `scd_7Afogmoukhds95HQJdULfF27tg5P` is updated in the same change.
3. **Host both legal documents** and put the live URLs in Play Console.
4. **Native-speaker review** of the Hindi, Bengali, Tamil, Telugu and Odia copy.
5. `newsTranslatePrompt.ts` re-evaluates 1.7 MB when a news article opens —
   JS-only, ships by OTA whenever convenient.
