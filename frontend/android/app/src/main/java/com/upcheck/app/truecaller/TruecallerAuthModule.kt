package com.upcheck.app.truecaller

import androidx.fragment.app.FragmentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.content.Intent
import android.util.Log

import com.truecaller.android.sdk.oAuth.CodeVerifierUtil
import com.truecaller.android.sdk.oAuth.TcOAuthCallback
import com.truecaller.android.sdk.oAuth.TcOAuthData
import com.truecaller.android.sdk.oAuth.TcOAuthError
import com.truecaller.android.sdk.oAuth.TcSdk
import com.truecaller.android.sdk.oAuth.TcSdkOptions
import com.truecaller.android.sdk.common.VerificationCallback
import com.truecaller.android.sdk.common.TrueException
import com.truecaller.android.sdk.common.VerificationDataBundle
import com.truecaller.android.sdk.common.models.TrueProfile

import java.math.BigInteger
import java.security.SecureRandom

/**
 * TruecallerAuthModule — thin, faithful RN bridge over the official Truecaller
 * OAuth SDK 3.3.0. Exposes both:
 *
 *   • One-tap OAuth (Truecaller users) — PKCE authorization-code flow. The
 *     `codeVerifier` is generated here and returned to JS so the backend can
 *     complete the server-to-server token exchange.
 *   • Non-Truecaller-user verification (India + Android only) — missed-call /
 *     Truecaller-IM OTP, streamed to JS as `TruecallerVerification` events.
 *
 * JS contract: `src/native/TruecallerAuth.ts` — keep the two in sync.
 *
 * SDK 3.3.0 note: `getAuthorizationCode` is launcher-only, so the one-tap flow
 * registers an ActivityResultLauncher through the activity's
 * `activityResultRegistry` (this works from a native module AFTER the activity
 * is RESUMED, which `registerForActivityResult` would not) and completes via
 * the 3-arg `onActivityResultObtained(activity, resultCode, data)`.
 */
class TruecallerAuthModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val TAG = "TruecallerAuth"
    private val EVENT_NAME = "TruecallerVerification"

    /** Pending one-tap promise; resolved by the TcOAuthCallback. */
    @Volatile private var oauthPromise: Promise? = null

    /** Pending initialize() promise; resolved by onSdkReady/onFailure. */
    @Volatile private var initPromise: Promise? = null

    /** PKCE verifier generated for the in-flight one-tap request. */
    @Volatile private var currentCodeVerifier: String? = null

    /** initAsync has completed (onSdkReady fired). */
    @Volatile private var sdkReady = false
    /** initAsync is currently running. */
    @Volatile private var initializing = false
    /** getAuthorizationCode was requested before the SDK finished init. */
    @Volatile private var pendingAuthLaunch = false

    /** Activity-result launcher for the OAuth consent screen (SDK 3.3.0). */
    private var oauthLauncher: ActivityResultLauncher<Intent>? = null
    private var launcherActivity: FragmentActivity? = null

    override fun getName(): String = "TruecallerAuth"

    // ── One-tap OAuth callback ────────────────────────────────────────────────

    private val oAuthCallback = object : TcOAuthCallback {
        // 3.3.0: async init finished. Resolve a waiting initialize() and, if the
        // user already tapped, launch the queued consent flow.
        override fun onSdkReady() {
            sdkReady = true
            initializing = false
            initPromise?.let { it.resolve(safeIsUsable()); initPromise = null }
            if (pendingAuthLaunch) {
                pendingAuthLaunch = false
                val act = currentFragmentActivity()
                if (act != null) runOnUi { launchAuth(act) }
                else resolveOauth(unavailable())
            }
        }

        override fun onSuccess(tcOAuthData: TcOAuthData) {
            val map = Arguments.createMap().apply {
                putString("type", "oauth")
                putString("authorizationCode", tcOAuthData.authorizationCode)
                putString("state", tcOAuthData.state)
                putString("codeVerifier", currentCodeVerifier)
                val scopes = Arguments.createArray()
                tcOAuthData.scopesGranted?.forEach { scopes.pushString(it) }
                putArray("scopesGranted", scopes)
            }
            resolveOauth(map)
        }

        override fun onFailure(tcOAuthError: TcOAuthError) {
            // During init this signals init failure; otherwise it's an auth
            // failure. Route accordingly.
            if (initializing || initPromise != null) {
                initializing = false
                initPromise?.let { it.resolve(false); initPromise = null }
                if (pendingAuthLaunch) {
                    pendingAuthLaunch = false
                    resolveOauth(errorMap("ERROR_SDK_NOT_INITIALIZED", "Truecaller init failed"))
                }
                return
            }
            val message = tcOAuthError.errorMessage ?: "Truecaller error"
            val lower = message.lowercase()
            val outcome = when {
                lower.contains("cancel") || lower.contains("dismiss") -> "cancelled"
                else -> "error"
            }
            resolveOauth(Arguments.createMap().apply {
                putString("type", outcome)
                putString("errorCode", "ERROR_UNKNOWN")
                putString("message", message)
            })
        }

        // Truecaller app not usable / user chose "use another number" → the app
        // should fall back to the missed-call flow.
        override fun onVerificationRequired(tcOAuthError: TcOAuthError?) {
            resolveOauth(Arguments.createMap().apply {
                putString("type", "verificationRequired")
            })
        }
    }

    @Synchronized
    private fun resolveOauth(map: WritableMap) {
        val p = oauthPromise
        oauthPromise = null
        p?.resolve(map)
    }

    private fun safeIsUsable(): Boolean =
        try {
            TcSdk.getInstance().isOAuthFlowUsable
        } catch (e: Exception) {
            false
        }

    /**
     * Kick off async SDK init on a background thread (3.3.0 requirement).
     * `onSdkReady` / `onFailure` on the shared callback report completion.
     */
    private fun startInit(activity: FragmentActivity) {
        if (initializing) return
        initializing = true
        Thread {
            try {
                try {
                    TcSdk.clear()
                } catch (_: Exception) {
                    // fine if nothing to clear
                }
                val options = TcSdkOptions.Builder(activity, oAuthCallback)
                    .sdkOptions(TcSdkOptions.OPTION_VERIFY_ALL_USERS)
                    .build()
                TcSdk.initAsync(options)
            } catch (e: Exception) {
                Log.w(TAG, "initAsync failed: ${e.message}")
                initializing = false
                initPromise?.let { it.resolve(false); initPromise = null }
                if (pendingAuthLaunch) {
                    pendingAuthLaunch = false
                    resolveOauth(errorMap("ERROR_SDK_NOT_INITIALIZED", e.message ?: "init failed"))
                }
            }
        }.start()
    }

    /** Launch the consent screen (UI thread, SDK ready). */
    private fun launchAuth(activity: FragmentActivity) {
        try {
            if (!TcSdk.getInstance().isOAuthFlowUsable) {
                resolveOauth(Arguments.createMap().apply {
                    putString("type", "verificationRequired")
                })
                return
            }
            val state = BigInteger(130, SecureRandom()).toString(32)
            TcSdk.getInstance().setOAuthState(state)
            TcSdk.getInstance()
                .setOAuthScopes(arrayOf("profile", "phone", "openid", "email"))
            val verifier = CodeVerifierUtil.generateRandomCodeVerifier()
            currentCodeVerifier = verifier
            val challenge = CodeVerifierUtil.getCodeChallenge(verifier)
            if (challenge == null) {
                resolveOauth(errorMap("ERROR_UNKNOWN", "Code challenge unavailable"))
                return
            }
            TcSdk.getInstance().setCodeChallenge(challenge)
            ensureLauncher(activity)
            TcSdk.getInstance().getAuthorizationCode(activity, oauthLauncher!!)
        } catch (e: Exception) {
            Log.w(TAG, "launchAuth failed: ${e.message}")
            resolveOauth(errorMap("ERROR_UNKNOWN", e.message ?: "Truecaller error"))
        }
    }

    // ── Non-TC verification callback ──────────────────────────────────────────

    private val verificationCallback = object : VerificationCallback {
        override fun onRequestSuccess(callbackType: Int, bundle: VerificationDataBundle?) {
            val map = Arguments.createMap()
            when (callbackType) {
                VerificationCallback.TYPE_MISSED_CALL_INITIATED -> {
                    map.putString("status", "MISSED_CALL_INITIATED")
                    bundle?.getString(VerificationDataBundle.KEY_TTL)?.toIntOrNull()?.let {
                        map.putInt("ttl", it)
                    }
                    bundle?.getString(VerificationDataBundle.KEY_REQUEST_NONCE)?.let {
                        map.putString("requestNonce", it)
                    }
                }
                VerificationCallback.TYPE_MISSED_CALL_RECEIVED ->
                    map.putString("status", "MISSED_CALL_RECEIVED")
                VerificationCallback.TYPE_OTP_INITIATED -> {
                    map.putString("status", "OTP_INITIATED")
                    bundle?.getString(VerificationDataBundle.KEY_TTL)?.toIntOrNull()?.let {
                        map.putInt("ttl", it)
                    }
                }
                VerificationCallback.TYPE_OTP_RECEIVED -> {
                    map.putString("status", "OTP_RECEIVED")
                    bundle?.getString(VerificationDataBundle.KEY_OTP)?.let {
                        map.putString("otp", it)
                    }
                }
                VerificationCallback.TYPE_VERIFICATION_COMPLETE -> {
                    map.putString("status", "VERIFICATION_COMPLETE")
                    bundle?.getString(VerificationDataBundle.KEY_ACCESS_TOKEN)?.let {
                        map.putString("accessToken", it)
                    }
                }
                VerificationCallback.TYPE_PROFILE_VERIFIED_BEFORE -> {
                    map.putString("status", "PROFILE_VERIFIED_BEFORE")
                    val profile = bundle?.profile
                    profile?.accessToken?.let { map.putString("accessToken", it) }
                    profile?.firstName?.let { map.putString("firstName", it) }
                    profile?.lastName?.let { map.putString("lastName", it) }
                }
                else -> return
            }
            emit(map)
        }

        override fun onRequestFailure(callbackType: Int, trueException: TrueException) {
            emit(Arguments.createMap().apply {
                putString("status", "ERROR")
                putString("message", trueException.exceptionMessage ?: "Verification failed")
            })
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun currentFragmentActivity(): FragmentActivity? =
        reactContext.currentActivity as? FragmentActivity

    private fun emit(map: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, map)
    }

    /**
     * Register (once per activity instance) the launcher the SDK uses to return
     * the consent-screen result. Uses `activityResultRegistry.register` (the
     * lifecycle-less overload) so it can be created after the activity is
     * RESUMED, then forwards the result to the SDK.
     */
    private fun ensureLauncher(activity: FragmentActivity) {
        if (oauthLauncher != null && launcherActivity === activity) return
        oauthLauncher?.let { try { it.unregister() } catch (_: Exception) {} }
        launcherActivity = activity
        oauthLauncher = activity.activityResultRegistry.register(
            "truecaller_oauth_" + System.currentTimeMillis(),
            ActivityResultContracts.StartActivityForResult(),
        ) { result ->
            try {
                TcSdk.getInstance()
                    .onActivityResultObtained(activity, result.resultCode, result.data)
            } catch (e: Exception) {
                Log.w(TAG, "onActivityResultObtained failed: ${e.message}")
            }
        }
    }

    // ── @ReactMethods ─────────────────────────────────────────────────────────

    @ReactMethod
    fun initialize(promise: Promise) {
        val activity = currentFragmentActivity()
        if (activity == null) {
            promise.resolve(false)
            return
        }
        if (sdkReady) {
            promise.resolve(safeIsUsable())
            return
        }
        // Resolve once onSdkReady/onFailure fires.
        initPromise = promise
        startInit(activity)
    }

    @ReactMethod
    fun isOAuthUsable(promise: Promise) {
        promise.resolve(sdkReady && safeIsUsable())
    }

    @ReactMethod
    fun getAuthorizationCode(promise: Promise) {
        val activity = currentFragmentActivity()
        if (activity == null) {
            promise.resolve(unavailable())
            return
        }
        synchronized(this) {
            oauthPromise?.resolve(unavailable())
            oauthPromise = promise
        }
        if (sdkReady) {
            runOnUi { launchAuth(activity) }
        } else {
            // Init hasn't finished — queue the launch; onSdkReady will run it.
            pendingAuthLaunch = true
            startInit(activity)
        }
    }

    @ReactMethod
    fun requestVerification(phoneNational: String, promise: Promise) {
        val activity = currentFragmentActivity()
        if (activity == null) {
            promise.reject("ERROR_PLATFORM_UNSUPPORTED", "No activity")
            return
        }
        if (!sdkReady) {
            // JS awaits initialize() before calling this; a not-ready state means
            // init failed or is still running. Surface it so JS can retry.
            promise.reject("ERROR_SDK_NOT_INITIALIZED", "Truecaller SDK not ready")
            return
        }
        runOnUi {
            try {
                // Country code is fixed to "IN": Truecaller only supports non-TC
                // verification for Indian numbers.
                TcSdk.getInstance()
                    .requestVerification("IN", phoneNational, verificationCallback, activity)
                promise.resolve(null)
            } catch (e: Exception) {
                Log.w(TAG, "requestVerification failed: ${e.message}")
                promise.reject("ERROR_UNKNOWN", e.message ?: "requestVerification failed")
            }
        }
    }

    @ReactMethod
    fun verifyMissedCall(firstName: String, lastName: String, promise: Promise) {
        runOnUi {
            try {
                val profile = TrueProfile.Builder(firstName, lastName).build()
                TcSdk.getInstance().verifyMissedCall(profile, verificationCallback)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERROR_UNKNOWN", e.message ?: "verifyMissedCall failed")
            }
        }
    }

    @ReactMethod
    fun verifyOtp(firstName: String, lastName: String, otp: String, promise: Promise) {
        runOnUi {
            try {
                val profile = TrueProfile.Builder(firstName, lastName).build()
                TcSdk.getInstance().verifyOtp(profile, otp, verificationCallback)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERROR_UNKNOWN", e.message ?: "verifyOtp failed")
            }
        }
    }

    @ReactMethod
    fun clear() {
        runOnUi {
            try {
                oauthLauncher?.let { try { it.unregister() } catch (_: Exception) {} }
                oauthLauncher = null
                launcherActivity = null
                if (sdkReady || initializing) {
                    TcSdk.clear()
                    sdkReady = false
                    initializing = false
                }
            } catch (e: Exception) {
                Log.w(TAG, "clear failed: ${e.message}")
            }
        }
    }

    // NativeEventEmitter housekeeping (required by RN ≥0.65; no-ops here).
    @ReactMethod fun addListener(eventName: String) {}

    @ReactMethod fun removeListeners(count: Int) {}

    // ── small helpers ─────────────────────────────────────────────────────────

    private fun runOnUi(block: () -> Unit) {
        if (com.facebook.react.bridge.UiThreadUtil.isOnUiThread()) block()
        else com.facebook.react.bridge.UiThreadUtil.runOnUiThread(block)
    }

    private fun unavailable(): WritableMap =
        Arguments.createMap().apply { putString("type", "unavailable") }

    private fun errorMap(code: String, message: String): WritableMap =
        Arguments.createMap().apply {
            putString("type", "error")
            putString("errorCode", code)
            putString("message", message)
        }
}
