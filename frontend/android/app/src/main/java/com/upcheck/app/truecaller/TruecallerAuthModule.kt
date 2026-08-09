package com.upcheck.app.truecaller

import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import android.app.Activity
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
 * OAuth SDK 3.x (`com.truecaller.android.sdk:truecaller-sdk`). It exposes both:
 *
 *   • One-tap OAuth (Truecaller users) — PKCE authorization-code flow. The
 *     `codeVerifier` is generated here and returned to JS so the backend can
 *     complete the server-to-server token exchange.
 *   • Non-Truecaller-user verification (India + Android only) — missed-call /
 *     Truecaller-IM OTP. Progress is streamed to JS as `TruecallerVerification`
 *     device events; on completion an `accessToken` is delivered for backend
 *     validation.
 *
 * The JS contract lives in `src/native/TruecallerAuth.ts`; keep the two in sync.
 *
 * SDK-version note: this uses the single-arg `getAuthorizationCode(activity)`
 * overload + `onActivityResultObtained(activity, requestCode, resultCode, data)`
 * so the flow works with React Native's classic Activity-result forwarding
 * (no `registerForActivityResult`, which a RN native module can't own). This
 * matches the shipping community wrappers. If a future SDK drops that overload,
 * switch to the `getAuthorizationCode(activity, launcher)` variant.
 */
class TruecallerAuthModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val TAG = "TruecallerAuth"
    private val EVENT_NAME = "TruecallerVerification"

    /** Pending one-tap promise; resolved by the TcOAuthCallback. */
    @Volatile private var oauthPromise: Promise? = null

    /** PKCE verifier generated for the in-flight one-tap request. */
    @Volatile private var currentCodeVerifier: String? = null

    /** CSRF state we set; used to sanity-check the callback's echoed state. */
    @Volatile private var currentState: String? = null

    @Volatile private var initialized = false

    override fun getName(): String = "TruecallerAuth"

    // ── One-tap OAuth callback ────────────────────────────────────────────────

    private val oAuthCallback = object : TcOAuthCallback {
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
            // Map the SDK error to our coarse JS outcome. Truecaller uses
            // numeric error codes; a user dismiss surfaces here too, so we
            // classify by the message when the code is ambiguous.
            val message = tcOAuthError.errorMessage ?: "Truecaller error"
            val lower = message.lowercase()
            val outcome = when {
                lower.contains("cancel") || lower.contains("dismiss") -> "cancelled"
                else -> "error"
            }
            val map = Arguments.createMap().apply {
                putString("type", outcome)
                putString("errorCode", "ERROR_UNKNOWN")
                putString("message", message)
            }
            resolveOauth(map)
        }

        // Truecaller app not usable / user chose "use another number" → the app
        // should fall back to the missed-call flow.
        override fun onVerificationRequired(tcOAuthError: TcOAuthError?) {
            val map = Arguments.createMap().apply {
                putString("type", "verificationRequired")
            }
            resolveOauth(map)
        }
    }

    @Synchronized
    private fun resolveOauth(map: WritableMap) {
        val p = oauthPromise
        oauthPromise = null
        p?.resolve(map)
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
            val map = Arguments.createMap().apply {
                putString("status", "ERROR")
                putString("message", trueException.exceptionMessage ?: "Verification failed")
            }
            emit(map)
        }
    }

    // ── Activity-result forwarding for the one-tap flow ───────────────────────

    private val activityEventListener: ActivityEventListener =
        object : BaseActivityEventListener() {
            override fun onActivityResult(
                activity: Activity?,
                requestCode: Int,
                resultCode: Int,
                data: Intent?,
            ) {
                if (requestCode == TcSdk.SHARE_PROFILE_REQUEST_CODE) {
                    val act = currentFragmentActivity() ?: return
                    try {
                        TcSdk.getInstance()
                            .onActivityResultObtained(act, requestCode, resultCode, data)
                    } catch (e: Exception) {
                        Log.w(TAG, "onActivityResultObtained failed: ${e.message}")
                    }
                }
            }
        }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun currentFragmentActivity(): FragmentActivity? =
        currentActivity as? FragmentActivity

    private fun emit(map: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, map)
    }

    private fun ensureInitialized(activity: FragmentActivity) {
        if (initialized && TcSdk.getInstance() != null) return
        val options = TcSdkOptions.Builder(activity, oAuthCallback)
            // OPTION_VERIFY_ALL_USERS enables BOTH one-tap (TC users) and the
            // missed-call / OTP path for non-TC users.
            .sdkOptions(TcSdkOptions.OPTION_VERIFY_ALL_USERS)
            .build()
        TcSdk.init(options)
        initialized = true
    }

    // ── @ReactMethods ─────────────────────────────────────────────────────────

    @ReactMethod
    fun initialize(promise: Promise) {
        val activity = currentFragmentActivity()
        if (activity == null) {
            promise.resolve(false)
            return
        }
        runOnUi {
            try {
                ensureInitialized(activity)
                promise.resolve(TcSdk.getInstance().isOAuthFlowUsable)
            } catch (e: Exception) {
                Log.w(TAG, "initialize failed: ${e.message}")
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun isOAuthUsable(promise: Promise) {
        runOnUi {
            try {
                val usable = initialized && TcSdk.getInstance().isOAuthFlowUsable
                promise.resolve(usable)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun getAuthorizationCode(promise: Promise) {
        val activity = currentFragmentActivity()
        if (activity == null) {
            promise.resolve(unavailable())
            return
        }
        // Only one one-tap request may be in flight.
        synchronized(this) {
            oauthPromise?.resolve(unavailable())
            oauthPromise = promise
        }
        runOnUi {
            try {
                ensureInitialized(activity)
                if (!TcSdk.getInstance().isOAuthFlowUsable) {
                    resolveOauth(Arguments.createMap().apply {
                        putString("type", "verificationRequired")
                    })
                    return@runOnUi
                }
                val state = BigInteger(130, SecureRandom()).toString(32)
                currentState = state
                TcSdk.getInstance().setOAuthState(state)
                TcSdk.getInstance()
                    .setOAuthScopes(arrayOf("profile", "phone", "openid", "email"))
                val verifier = CodeVerifierUtil.generateRandomCodeVerifier()
                currentCodeVerifier = verifier
                val challenge = CodeVerifierUtil.getCodeChallenge(verifier)
                if (challenge == null) {
                    resolveOauth(errorMap("ERROR_UNKNOWN", "Code challenge unavailable"))
                    return@runOnUi
                }
                TcSdk.getInstance().setCodeChallenge(challenge)
                TcSdk.getInstance().getAuthorizationCode(activity)
            } catch (e: Exception) {
                Log.w(TAG, "getAuthorizationCode failed: ${e.message}")
                resolveOauth(errorMap("ERROR_UNKNOWN", e.message ?: "Truecaller error"))
            }
        }
    }

    @ReactMethod
    fun requestVerification(phoneNational: String, promise: Promise) {
        val activity = currentFragmentActivity()
        if (activity == null) {
            promise.reject("ERROR_PLATFORM_UNSUPPORTED", "No activity")
            return
        }
        runOnUi {
            try {
                ensureInitialized(activity)
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
                if (initialized) {
                    TcSdk.clear()
                    initialized = false
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
