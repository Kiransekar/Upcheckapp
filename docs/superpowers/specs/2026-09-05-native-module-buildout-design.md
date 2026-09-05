# Native Module Build-out — Design

**Date:** 2026-09-05 · **Status:** design approved, NOT YET IMPLEMENTED
**Trigger:** run this when the current batch of OTA-solvable work is finished.
**Baseline at time of writing:** master `2f515ed`, Expo SDK 54, RN 0.81.5, `newArchEnabled: true`,
runtime `1.0.0`, OTA group `a415bade`.

## Purpose

Ship **one** new Android binary carrying every native module we can foresee needing for
roughly the next twelve months, so that all subsequent feature work ships by OTA against
it. Anything omitted here costs another build, another Play Store review and another
forced user update — so the bias is deliberately toward inclusion.

## Decisions taken

1. **Breadth: everything plausible in 12 months**, not just the immediate list.
2. **Telemetry: crash-only Sentry, PostHog behind explicit consent.** Farmer financial data
   must not leave the device by default.
3. **"Alarm" means scheduled reminders**, which `expo-notifications` already does. We do
   NOT request the restricted exact-alarm permissions.
4. **Android only.** `ios/` is not committed and the Truecaller flow is Android-specific.
5. **Do not install yet.** OTA-solvable work lands first; this document is the reference.

---

## Two hard constraints — read before touching anything

### 1. `expo prebuild --clean` will destroy Truecaller auth

`frontend/android/` is committed (51 files) and IS the source of truth. EAS builds from it
directly. The `plugins/withTruecaller.js` header states plainly that the plugin reproduces
only the config-level wiring — manifest meta-data, the phone/call-log permissions, and the
Gradle dependency. It does **not** reproduce:

- `android/app/src/main/java/com/upcheck/app/truecaller/TruecallerAuthModule.kt`
- `android/app/src/main/java/com/upcheck/app/truecaller/TruecallerAuthPackage.kt`
- their registration in `MainApplication.getPackages()`

A clean prebuild regenerates the native tree and silently drops all three. Auth then fails
at runtime, not at build time.

**Therefore the install path is:**

1. `npx expo install <packages>` — writes `package.json`, pins SDK-54-correct versions.
2. **React Native autolinking** picks the native code up from `node_modules` at build time.
   No prebuild required for linking itself.
3. Hand-edit `android/app/src/main/AndroidManifest.xml` for permissions and `<queries>`.
4. Hand-add any Gradle wiring a library documents as manual.
5. Build. **Never run `expo prebuild --clean`.** If a plugin genuinely requires prebuild,
   run it on a scratch branch, diff the result against the committed tree, and port the
   changes by hand.

**Verify before every build:** the two `.kt` files exist and `MainApplication` still
registers `TruecallerAuthPackage()`.

### 2. `runtimeVersion` must stop being a hardcoded literal

`app.config.ts:103` pins `runtimeVersion: "1.0.0"`. The moment the binary gains native
modules, an OTA published from this repo is still labelled `1.0.0` and Expo will serve it
to **existing** 1.0.0 installs that do not contain those modules. The bundle imports native
code that isn't there — crash on launch, for every existing user, with no way to push a fix
to them.

**Change to a fingerprint policy as part of this work:**

```ts
runtimeVersion: { policy: "fingerprint" }
```

Expo then derives the runtime from a hash of the actual native project, so a native change
automatically produces a new runtime and old binaries simply stop receiving updates instead
of receiving poisoned ones. This is the correct setting for a "build once, OTA after"
strategy and removes the failure mode permanently.

**Consequence to plan for:** existing installs stop receiving OTAs the moment this ships.
Everyone must install the new APK/bundle from the Play Store. Land the OTA-solvable fixes
FIRST (as decided), because they are the last things reachable by the current binary.

---

## Already installed — do not re-add

`expo-camera` · `expo-haptics` (this is your vibration) · `expo-location` ·
`expo-image-picker` · `expo-notifications` (this is your reminders/alarms) ·
`expo-secure-store` · `expo-crypto` · `expo-clipboard` · `expo-web-browser` ·
`expo-device` · `expo-constants` · `expo-font` · `expo-updates` · `expo-dev-client` ·
`expo-linear-gradient` · `expo-status-bar` · `@react-native-async-storage/async-storage` ·
`@react-native-community/netinfo` · `@react-native-community/slider` ·
`@react-native-picker/picker` · `react-native-svg` · `react-native-screens` ·
`react-native-safe-area-context` · `react-native-qrcode-svg` · `react-native-chart-kit` ·
`react-native-paper` · `@react-native-google-signin/google-signin`

---

## Modules to install

Install with `npx expo install <name>` — it resolves the version matching SDK 54 rather
than whatever is newest. Everything below must be checked for **New Architecture** support
at install time; `newArchEnabled: true` is on.

### A. Files, export and sharing — the immediate ask

| Module | Why |
|---|---|
| `expo-file-system` | Write CSV / XLSX / PDF to disk. Prerequisite for every export path. |
| `expo-sharing` | Hand a saved file to WhatsApp, Gmail, Drive. This is "share to other apps". |
| `expo-print` | HTML → PDF. Harvest reports, cycle summaries, financial statements. |
| `expo-document-picker` | The reverse direction: import a CSV/XLSX price list or bulk pond data. |

**Excel needs no native module.** SheetJS (`xlsx`) is pure JavaScript — it builds the
workbook in memory, and `expo-file-system` writes it. Adding a native spreadsheet library
would be waste. Same for CSV: `frontend/src/utils/csv.ts` already exists and is pure JS;
it only ever needed somewhere to put the file.

### B. Opening and discovering other apps

| Module | Why |
|---|---|
| `expo-linking` | URL building/parsing, `canOpenURL`, and the deferred deep-link capture that follow-up F2 needs (invite links currently only work for signed-in users). |
| `expo-intent-launcher` | Android-only: launch a specific app or a system settings screen by intent. This is the real "open another app" primitive. |

**The manifest matters more than the module here.** Android 11+ hides installed apps unless
you declare them. To detect or open WhatsApp, a dialer, maps, etc., add a `<queries>` block
to `AndroidManifest.xml` naming each package or intent. Without it `canOpenURL` returns
false for apps that are plainly installed. Google Play restricts the broad
`QUERY_ALL_PACKAGES` permission — declare specific packages, never that.

### C. Audio, voice and accessibility

This group is the strongest product fit in the whole list. Many users have limited literacy;
speaking and hearing beats typing and reading.

| Module | Why |
|---|---|
| `expo-audio` | Record voice notes against a pond or a problem report. Replaces the deprecated `expo-av` in SDK 54. This is your microphone. |
| `expo-speech` | Text-to-speech: read an alert or a daily task aloud in the farmer's own language. Six locales already exist. |
| `expo-video` | Training and how-to clips. Also the SDK 54 replacement half of `expo-av`. |

Speech-to-**text** has no first-party Expo module. `@react-native-voice/voice` is the usual
choice; **verify New Architecture support before committing to it** — if it fails, the
fallback is recording with `expo-audio` and transcribing server-side, which needs no extra
native module and is arguably better for six Indian languages anyway.

### D. Gestures, animation and modern UI

| Module | Why |
|---|---|
| `react-native-gesture-handler` | Swipe-to-act on list rows, drawer navigation, anything touch-driven beyond a tap. |
| `react-native-reanimated` | Animation, and a hard peer dependency of most gesture-based libraries. |
| `@gorhom/bottom-sheet` | Bottom sheets, which this app's design language wants repeatedly. Requires both of the above. Use v5+ for New Arch. |
| `react-native-keyboard-controller` | Proper keyboard avoidance. Previously excluded as OTA-impossible. |

Adding these unlocks the drag-and-drop shelf grid that spec §6 excluded as impossible, and
retires the tap-to-place compromise.

### E. Telemetry — per the approved posture

| Module | Configuration |
|---|---|
| `@sentry/react-native` | **Crash and error only.** Scrub aggressively: no request/response bodies, no `Authorization` header, no phone numbers, no financial values. Identify users by a hashed id, never a phone number. |
| `posthog-react-native` | **Installed but inert until consent.** No autocapture. Initialise only after the farmer opts in; a clear toggle in Settings that actually stops collection when off. |

Two things to get right, and they are product decisions rather than technical ones:

- **Consent must be real.** India's DPDP Act treats this as personal data processing. A
  pre-ticked box or a buried default is not consent. Ask once, plainly, in the farmer's
  language, and honour "no" permanently.
- **Financial data must never reach either service.** Transactions, harvest values and
  expense amounts are the most sensitive things in this app. Add explicit scrub rules and
  test them — a breadcrumb containing a request body will leak them silently.

### F. Background work and offline

| Module | Why |
|---|---|
| `expo-background-task` | Drain the offline write queue while the app is closed. The app already has `recordSync.ts` with a queue; today it only flushes when the app is open. SDK 54's replacement for `expo-background-fetch`. |
| `expo-task-manager` | Required peer of the above. |
| `expo-sqlite` | A real local database. AsyncStorage is a key-value store and will not scale to a season of daily logs across many ponds. If offline-first is the long-term direction, this is the module you will most regret omitting. |

### G. Images and performance on cheap phones

| Module | Why |
|---|---|
| `expo-image` | Faster, better-caching replacement for RN `Image`. Meaningful on low-end hardware. |
| `expo-image-manipulator` | Compress and resize before upload. On rural bandwidth, uploading a full-resolution disease photo is the difference between a report that sends and one that does not. |

### H. Reaching people

| Module | Why |
|---|---|
| `expo-contacts` | Invite a worker from the phone's contact list instead of typing a number. Directly improves the invite flow that follow-up F2 already flags as weak. |
| `expo-sms` | Send that invite as an SMS. The most reliable channel in rural India. |

### I. Odds and ends, cheap to include

| Module | Why |
|---|---|
| `expo-keep-awake` | Don't sleep mid-way through a logging session with wet hands. |
| `expo-screen-orientation` | Charts and tables in landscape. |
| `expo-cellular` | Detect a 2G connection and degrade deliberately rather than hanging. |
| `expo-localization` | Device locale as the first-run default for language selection. |

### J. Maps — decide explicitly

`react-native-maps` is the biggest single addition (Play Services dependency, several MB).
Include it **only if** farm/pond geography is genuinely on the roadmap — plotting ponds,
drawing farm boundaries, showing regional disease or price data. `expo-location` is already
installed, so you can capture coordinates today without it; you just cannot draw them on a
map. If in doubt, include it: this build is the cheap moment.

---

## Explicitly NOT installing, and why

| Thing | Why not |
|---|---|
| An Excel/XLSX native library | SheetJS is pure JS. `expo-file-system` writes the result. |
| A CSV library | `src/utils/csv.ts` already exists and works. |
| A barcode/QR scanner module | `expo-camera` in SDK 54 already scans barcodes via `CameraView`. `react-native-qrcode-svg` already renders them. |
| Exact-alarm permissions (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`) | Decided: reminders only. Google Play restricts these to alarm and calendar apps and requires a policy declaration; a farm app risks rejection. `expo-notifications` already schedules reminders. |
| `QUERY_ALL_PACKAGES` | Play-restricted. Declare specific `<queries>` entries instead. |
| `@react-native-community/datetimepicker` | `CalendarPicker` was built to replace it and works. |
| `expo-av` | Deprecated in SDK 54; superseded by `expo-audio` + `expo-video`. |
| `expo-sensors`, `expo-battery` | No identified product use. Add later if one appears — but note that "later" means another build. |

---

## Manifest changes required

All hand-edited into the committed `android/app/src/main/AndroidManifest.xml`. Do not
regenerate the file.

- `RECORD_AUDIO` — voice notes (`expo-audio`).
- `READ_CONTACTS` — contact-based invites (`expo-contacts`).
- A `<queries>` block naming the specific packages/intents to detect or launch (WhatsApp,
  SMS, dialer, maps, mail), plus intent-based entries for generic share targets.
- Confirm the existing Truecaller permissions (`READ_PHONE_STATE`, `READ_CALL_LOG`,
  `ANSWER_PHONE_CALLS`) survive the edit — they are added by the plugin at prebuild time,
  but the committed manifest is what actually builds.

Every new runtime permission needs a plain-language rationale string in all six locales,
shown before the system dialog. A farmer who sees an unexplained microphone prompt will
decline it.

---

## Size budget

Rough expectation: **+15–30 MB** installed, dominated by maps (if included), Sentry,
reanimated and gesture-handler.

Mitigations, in order of value:

1. **Ship the Play Store build as an `app-bundle`** — `eas.json`'s `production` profile
   already does. Play then delivers per-ABI splits, so a device downloads roughly half of
   what a universal APK would cost.
2. Keep Hermes on (default) and confirm ProGuard/R8 minification is enabled for release.
3. Audit with `npx expo-doctor` and the APK analyser after the build; drop anything from
   group I or J that did not earn its size.

This matters more than usual: the target user is on a low-end Android device, often on a
metered connection, and may abandon a large update.

---

## Install procedure

1. Land the outstanding OTA-solvable fixes first, and publish them. They are the last
   changes the current binary can receive.
2. Branch. `npx expo install` the agreed set, in the groups above, committing per group so
   a bisect is possible.
3. Switch `runtimeVersion` to the fingerprint policy.
4. Hand-edit `AndroidManifest.xml` for permissions and `<queries>`.
5. Configure Sentry (scrub rules) and PostHog (consent-gated, no autocapture).
6. **Verify Truecaller is intact:** both `.kt` files present, `TruecallerAuthPackage()`
   still registered in `MainApplication.getPackages()`, no prebuild was run.
7. `npx expo-doctor`, then `npx tsc --noEmit`, then the full Jest suite in both packages.
8. EAS build on the `preview` profile (APK) and install on the OPPO CPH2467.
9. **Smoke-test Truecaller login first**, before anything else. It is the highest-value
   thing this build can break and the failure is silent until a user tries to log in.
10. Then verify: a PDF export opens, a share sheet appears, a voice note records and plays,
    a bottom sheet drags, Sentry receives a deliberately thrown test error, and PostHog
    receives NOTHING until consent is granted.
11. Only then build `production` (app-bundle) and submit.

## Verification checklist for the built APK

- [ ] Truecaller login succeeds on a real device
- [ ] Existing OTA-delivered features still work (Phase 1–3 surface)
- [ ] Export → PDF, CSV and XLSX each produce a file that opens in another app
- [ ] Share sheet lists the expected targets; `canOpenURL` correctly detects WhatsApp
- [ ] Microphone permission prompt shows the localised rationale first
- [ ] Reminders still fire (regression risk: `expo-notifications` alongside new modules)
- [ ] Sentry captures a test crash with **no** phone number, token or money value attached
- [ ] PostHog sends nothing before consent, and stops when consent is withdrawn
- [ ] App size and cold-start time measured on the OPPO, compared against the current build

## Open items to settle at install time

- New Architecture support for `@react-native-voice/voice` and any in-app-update library.
- Whether `react-native-maps` is in or out (group J).
- Whether an in-app-update prompt is wanted, so users are nudged to the new binary — worth
  deciding *now*, because after this build the OTA channel can no longer reach anyone still
  on `1.0.0`.
