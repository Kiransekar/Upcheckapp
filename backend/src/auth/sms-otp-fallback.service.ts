/**
 * SmsOtpFallbackService — SCAFFOLD, currently DISABLED and NOT wired into any
 * module.
 *
 * Truecaller's non-Truecaller-user missed-call/OTP flow is officially
 * "deprecating soon". This is the server-side placeholder for a future
 * Supabase phone SMS-OTP replacement, kept isolated so it cannot interfere
 * with the live Truecaller paths. It is intentionally not added to
 * `auth.module.ts` providers — it never runs until someone wires it up.
 *
 * To enable in the future:
 *   1. Configure a paid SMS provider in Supabase (Auth → Phone).
 *   2. Register this service in `auth.module.ts` and inject the Supabase client.
 *   3. Implement the two methods:
 *        supabase.auth.signInWithOtp({ phone })                 // request
 *        supabase.auth.verifyOtp({ phone, token, type: 'sms' }) // verify → session
 *   4. Add authenticated controller routes mirroring the email-OTP endpoints.
 */
export class SmsOtpFallbackService {
  /** Master switch — keep false until Truecaller missed-call is retired. */
  isEnabled(): boolean {
    return false;
  }

  async requestOtp(_phoneE164: string): Promise<void> {
    throw new Error('SMS OTP fallback is not enabled.');
  }

  async verifyOtp(_phoneE164: string, _code: string): Promise<never> {
    throw new Error('SMS OTP fallback is not enabled.');
  }
}
