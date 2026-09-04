import { getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';

/**
 * Deep links — the password-reset email opens upcheckapp://reset-password,
 * and the passwordless-login email opens upcheckapp://otp-callback.
 *
 * DEEPLINK-2: Supabase's reset/magic-link emails put the recovery tokens in
 * a URL FRAGMENT (upcheckapp://reset-password#access_token=...&type=
 * recovery). React Navigation's extractPathFromURL only splits the URL on
 * `?`, never `#` — so the "path" it hands to route matching is literally
 * "reset-password#access_token=...", which can never match the configured
 * 'reset-password' route, and the app silently fell back to its initial
 * route (Sign In) instead of opening ResetPassword. Strip the fragment
 * before matching; ResetPasswordScreen re-parses the tokens itself straight
 * off the raw URL (Linking.getInitialURL/addEventListener), so it's
 * completely unaffected by what happens here.
 */
export const linking = {
  prefixes: ['upcheckapp://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      OtpCallback: 'otp-callback',
      JoinFarm: 'join/:code',
    },
  },
  getStateFromPath: (path: string, options: Parameters<typeof defaultGetStateFromPath>[1]) =>
    defaultGetStateFromPath(path.split('#')[0], options),
};
