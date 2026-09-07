import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * The binary's own version and build, read at runtime instead of typed in.
 *
 * Both settings screens used to render the literal "v1.0.0", which was already
 * drifting (app.config carries version 1.0.0 but runtimeVersion 2.0.0) and
 * would rot again on the next bump. expo-application reads them from the
 * installed package; expo-constants is the fallback for Expo Go, where the
 * native version belongs to Expo Go rather than to us.
 */
export const appVersion = (): string =>
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—';

export const appBuild = (): string => Application.nativeBuildVersion ?? '—';
