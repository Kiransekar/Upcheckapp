/**
 * The one way an account is identified to a third party.
 *
 * Both telemetry services need a STABLE per-user id — Sentry to say "one
 * farmer hit this a hundred times" rather than "a hundred farmers did", and
 * PostHog for anything that counts people rather than events: retention,
 * growth, DAU/MAU, and consistent feature-flag assignment. Without one,
 * PostHog mints a fresh anonymous id and every metric that is about PEOPLE is
 * silently empty, which is exactly what happened on the first build.
 *
 * It must not be the raw user id, the email, or the phone number. The Privacy
 * Policy (section 6) promises an "irreversible identifier, never your phone
 * number", so this is a salted SHA-256 truncated to 16 hex characters: enough
 * to be unique across any realistic user base, and not reversible into the id
 * it came from.
 *
 * The same salt and length in both services on purpose — a person in PostHog
 * and a user in Sentry are then the same string, so a crash can be tied to the
 * session that produced it without either service ever holding an identifier
 * that means anything outside Upcheck.
 */
import * as Crypto from 'expo-crypto';

const SALT = 'upcheck:';
const LENGTH = 16;

export async function hashUserId(rawId: string): Promise<string | null> {
    try {
        const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${SALT}${rawId}`,
        );
        return digest.slice(0, LENGTH);
    } catch {
        // Never let an identity failure break a screen or drop an event; the
        // caller falls back to anonymous, which is degraded but correct.
        return null;
    }
}
