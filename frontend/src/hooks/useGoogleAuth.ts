import { useEffect, useState } from 'react';
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { useAuthStore, type SignupIntent } from '../store/authStore';

const extra = Constants.expoConfig?.extra ?? {};

// Configure Google Sign-In globally
const hasClientIds = !!(extra.googleClientIdWeb || extra.googleClientIdIos || extra.googleClientIdAndroid);

if (hasClientIds) {
    GoogleSignin.configure({
        webClientId: extra.googleClientIdWeb || undefined,
        iosClientId: extra.googleClientIdIos || undefined,
        // scopes: ['profile', 'email'], // default
    });
}

export function useGoogleAuth() {
    const { googleLogin, isLoading } = useAuthStore();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setIsReady(hasClientIds);
    }, []);

    // 'signin' (Login screen) vs 'signup' (Create Account screen) — both call
    // the same backend endpoint, which otherwise auto-provisions a brand-new
    // account on first Google login regardless of which screen sent the
    // request. Defaults to 'signup' so any other/legacy caller keeps today's
    // auto-provisioning behavior unchanged; only Login explicitly passes
    // 'signin' to gate on an existing account.
    /**
     * `intent` is the OAuth intent; `signupIntent` is IntentScreen's answer,
     * which used to be dropped entirely on this path — see
     * `authStore.armSignupIntent`.
     */
    const signInWithGoogle = async (
        intent: 'signin' | 'signup' = 'signup',
        signupIntent?: SignupIntent,
    ) => {
        if (!hasClientIds) {
            useAuthStore.getState().setError('Google Sign-In is not configured. Please contact support.');
            return;
        }

        try {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            // The native SDK caches the last-authenticated Google account on the
            // device and silently returns it from signIn() — no account picker —
            // whenever one is cached. Without this, a user can never pick a
            // different Google account after the first login, whether they meant
            // to log in again or sign up fresh with a different account. signOut()
            // only clears this local cache (not the OAuth grant), so it doesn't
            // force the user to re-consent — just re-pick.
            try {
                await GoogleSignin.signOut();
            } catch {
                // no-op if nothing was cached
            }
            const response = await GoogleSignin.signIn();
            
            if (isSuccessResponse(response)) {
                const idToken = response.data.idToken;
                if (idToken) {
                    // Propagate the 2FA challenge (if any) so the screen can
                    // navigate to it — the store only sets a session on success.
                    return await googleLogin(idToken, intent, signupIntent);
                } else {
                    useAuthStore.getState().setError('No ID token received from Google.');
                }
            } else {
                // response is probably cancelled
                console.log('Google sign in cancelled/other:', response);
            }
        } catch (error: any) {
            if (isErrorWithCode(error)) {
                if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                    // user cancelled the login flow
                    return;
                } else if (error.code === statusCodes.IN_PROGRESS) {
                    // operation (e.g. sign in) is in progress already
                    return;
                } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                    useAuthStore.getState().setError('Google Play Services not available or outdated.');
                    return;
                }
            }
            useAuthStore.getState().setError(error.message || 'Google sign in failed');
        }
    };

    return {
        signInWithGoogle,
        isReady,
        isLoading,
    };
}
