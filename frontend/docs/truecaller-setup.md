# Truecaller sign-in — setup, build & testing

UpCheck supports three Truecaller-powered sign-in journeys, all on the official
**Truecaller OAuth SDK 3.3.0** via a hand-written native module
(`android/app/src/main/java/com/upcheck/app/truecaller/`), plus a JS bridge
(`src/native/TruecallerAuth.ts`):

1. **One-tap OAuth** — users **with** the Truecaller app installed & signed in.
   PKCE authorization-code flow → backend exchanges it for a session.
2. **Missed-call verification** — users **without** the Truecaller app (India +
   Android only). The SDK places a silent drop-call it auto-detects.
3. **OTP (Truecaller IM)** — fallback within the missed-call flow on eligible
   accounts.

> **Account linking:** identity is the **verified phone number only**. A
> Truecaller login is matched/merged to an existing account solely by phone
> (`public.users.phone`, stored E.164). Cross-provider linking (attach a phone
> to an existing email/Google account) is done only through an authenticated
> in-app action — never by the self-asserted Truecaller profile email.

---

## 1. Truecaller OAuth portal (one-time, **you** must do this)

1. Register at the **OAuth portal**: <https://sdk-console-noneu.truecaller.com/>
   (non-EU host — correct for India).
2. Create a project → add an **Android** app:
   - **Package name:** `com.upcheck.app`
   - **SHA-1 fingerprint(s):** one per signing key you'll install (see §3).
3. Copy the **Client ID** it generates.
4. Under the project's scopes, enable at least `profile`, `phone` (and `email`,
   `openid` if you want them — they must match the SDK's `setOAuthScopes`).
5. **Enable "Non-Truecaller user verification"** (bottom of the project page) —
   required for the missed-call flow. ⚠️ India + Android only, and Truecaller
   marks this flow **"deprecating soon"** (see §7).
6. Add your **Privacy Policy** and **Terms** links (shown on the consent sheet).

### Where the Client ID goes (must be identical in all three)

| Location | Key |
|---|---|
| `frontend/app.config.ts` | `TRUECALLER_ANDROID_CLIENT_ID` (env `EXPO_PUBLIC_TRUECALLER_ANDROID_CLIENT_ID`) |
| `frontend/android/app/src/main/AndroidManifest.xml` | `<meta-data com.truecaller.android.sdk.ClientId>` |
| Backend env | `TRUECALLER_OAUTH_CLIENT_ID` |

The current committed default is a placeholder/dev Client ID
(`e98dcupeqtmcocbxr7qb4g7b4sub8blazhxrt-1ikmw`). Replace it with your real one
(or set the env vars) before a production build.

---

## 2. Backend env (`backend/.env`)

```env
TRUECALLER_OAUTH_CLIENT_ID="<your real client id>"
# Defaults are correct for India/non-EU; override only for EU:
TRUECALLER_OAUTH_BASE_URL="https://oauth-account-noneu.truecaller.com"
TRUECALLER_OTP_VERIFY_URL="https://sdk-otp-verification-noneu.truecaller.com/v1/otp/client/installation/phoneNumberDetail"
TRUECALLER_KEYS_API_URL="https://api4.truecaller.com/v1/key"
```

- One-tap: backend `POST /api/auth/supabase/oauth/truecaller/exchange`
  (`{ authorizationCode, codeVerifier, state }`) → token exchange → userinfo.
- Missed-call: backend `POST /api/auth/supabase/oauth/truecaller`
  (`{ accessToken, phoneNumber, firstName, lastName }`) → validates the token at
  the `phoneNumberDetail/{accessToken}` endpoint with the `clientId` header.

---

## 3. Build a dev client with EAS (no local Android toolchain needed)

The native module can't be validated by `tsc`/`jest` — it needs a real build.

```bash
cd frontend
# 1. Get the SHA-1 of the signing key EAS will use, and register it on the portal:
eas credentials -p android        # → copy the SHA-1 for the "development" build
# 2. Build the dev client (internal distribution):
eas build --profile development --platform android
```

Install the resulting APK on the emulator/phone, then start Metro:

```bash
npx expo start --dev-client
```

> **SHA-1 must match the installed APK's signing key**, or every Truecaller call
> fails with a client-id / partner error. `eas build` (managed credentials) and
> the local `debug.keystore` have **different** SHA-1s — register whichever one
> actually signs the APK you install.

Native (Kotlin/gradle/manifest) changes require a **new** `eas build`. JS/TS
changes hot-reload over Metro with no rebuild.

---

## 4. Testing loop with `adb` (emulator or real phone)

Once the dev client is installed and connected to Metro, drive it via `adb`:

```bash
adb devices                                   # confirm the device/emulator
adb install -r <path-to-dev-client>.apk       # (re)install
adb shell monkey -p com.upcheck.app 1         # launch
adb exec-out screencap -p > /tmp/screen.png    # screenshot (viewable)
adb shell input tap <x> <y>                    # tap
adb shell input text "9876543210"             # type
adb logcat -s TruecallerAuth:* ReactNativeJS:* # native + JS logs
```

- **LDPlayer:** use its bundled `adb.exe` or `adb connect 127.0.0.1:5555`.
- **Real phone over Wi-Fi:** enable Wireless debugging → `adb connect <phone-ip>:<port>`.

### What can actually be validated where

| Journey | LDPlayer emulator | Real phone (Indian SIM) |
|---|---|---|
| UI / navigation / permissions / error handling | ✅ | ✅ |
| One-tap OAuth | ⚠️ needs Truecaller app installed+signed-in; emulators may fail the SDK integrity check | ✅ |
| **Missed-call** | ❌ no SIM — can't receive the drop-call | ✅ |
| OTP (IM) fallback | ❌ | ✅ (if enabled for your account) |

---

## 5. Runtime permissions

The missed-call flow requests `READ_PHONE_STATE` + `READ_CALL_LOG` at runtime
(see `TruecallerPhoneScreen`). `ANSWER_PHONE_CALLS` is declared in the manifest.
These are **restricted** permissions: a Google Play **Permissions Declaration**
is required at submission. One-tap OAuth needs **no** runtime permissions.

---

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `isOAuthFlowUsable` false on a device with Truecaller | Not signed in to Truecaller, or SHA-1/package mismatch on the portal |
| One-tap opens then fails immediately | Client ID wrong / SHA-1 not registered / scopes not enabled on portal |
| Backend `Invalid authorization code` | Client ID mismatch between app & backend, or code already used (single-use) |
| Missed-call never detected | Permissions denied, non-Indian number, or emulator (no SIM) |
| Backend `Invalid access token` (missed-call) | `TRUECALLER_OAUTH_CLIENT_ID` not sent / wrong on the `clientId` header |
| Native build fails on `getAuthorizationCode(activity)` | Pin `truecaller-sdk:3.1.0` in `android/app/build.gradle` (documents that single-arg overload) |

---

## 7. Deprecation note & SMS-OTP fallback

Truecaller's **non-Truecaller-user missed-call/OTP flow is officially
"deprecating soon."** A **Supabase phone SMS-OTP** path is scaffolded (inert,
feature-flagged off) so we can swap to it when Truecaller retires missed-call —
without touching the working Truecaller paths. Enabling it requires a paid SMS
gateway (Twilio/MessageBird/etc.) configured in Supabase Auth. See
`src/features/smsOtpFallback.ts` and the backend `SmsOtpFallback` scaffold.
