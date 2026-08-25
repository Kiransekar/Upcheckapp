/**
 * SMS-OTP fallback — SCAFFOLD, currently DISABLED.
 *
 * Truecaller's non-Truecaller-user missed-call/OTP verification is officially
 * "deprecating soon". This module is a ready-to-wire replacement path using
 * Supabase's native phone SMS-OTP, so that when Truecaller retires missed-call
 * we can flip it on WITHOUT touching the working Truecaller flows.
 *
 * It is intentionally inert: `SMS_OTP_FALLBACK_ENABLED` is `false`, nothing
 * imports it into a live screen, and the functions throw until implemented.
 *
 * To enable in the future:
 *   1. Configure a paid SMS gateway (Twilio / MessageBird / …) in the Supabase
 *      dashboard → Authentication → Phone. Supabase SMS OTP does NOT work
 *      without a provider.
 *   2. Implement the two functions below with the Supabase client:
 *        await supabase.auth.signInWithOtp({ phone: phoneE164 })
 *        const { data } = await supabase.auth.verifyOtp({
 *          phone: phoneE164, token: code, type: 'sms',
 *        })
 *      then return `data.session` (map to the app's AuthSession).
 *   3. In TruecallerPhoneScreen, when `isSmsOtpFallbackEnabled()` is true and
 *      Truecaller reports the number can't be verified, route here instead.
 */

/** Master switch. Keep `false` until Truecaller missed-call is retired. */
export const SMS_OTP_FALLBACK_ENABLED = false;

export function isSmsOtpFallbackEnabled(): boolean {
  return SMS_OTP_FALLBACK_ENABLED;
}

/** Request an SMS OTP for an E.164 phone number. */
export async function requestSmsOtp(_phoneE164: string): Promise<void> {
  throw new Error(
    'SMS OTP fallback is not enabled. See src/features/smsOtpFallback.ts.',
  );
}

/** Verify an SMS OTP; on success this will return a session to store. */
export async function verifySmsOtp(
  _phoneE164: string,
  _code: string,
): Promise<never> {
  throw new Error(
    'SMS OTP fallback is not enabled. See src/features/smsOtpFallback.ts.',
  );
}
