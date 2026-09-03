/**
 * DO = 400 CRASHED THE APP.
 *
 * The backend rejects dissolvedOxygen > 30 with a class-validator 400 whose
 * `message` is a string ARRAY. `Alert.alert(title, string[])` is a native
 * crash on Android — the root ErrorBoundary cannot catch it. Every screen
 * read `err.response?.data?.message` straight into the alert body.
 *
 * This helper is the single choke point: whatever the server sends back, the
 * caller gets a string.
 */
import { apiErrorMessage } from '../errors';

describe('apiErrorMessage', () => {
    it('joins a class-validator string array with newlines', () => {
        const err = {
            response: { status: 400, data: { message: ['dissolvedOxygen must not be greater than 30', 'ph must be a number'] } },
        };
        expect(apiErrorMessage(err, 'fallback')).toBe(
            'dissolvedOxygen must not be greater than 30\nph must be a number',
        );
    });

    it('returns a plain string message as-is', () => {
        expect(apiErrorMessage({ response: { data: { message: 'Pond not found' } } }, 'fallback')).toBe('Pond not found');
    });

    it('falls back for a non-string message', () => {
        expect(apiErrorMessage({ response: { data: { message: 42 } } }, 'fallback')).toBe('fallback');
    });

    it('falls back for an empty array', () => {
        expect(apiErrorMessage({ response: { data: { message: [] } } }, 'fallback')).toBe('fallback');
    });

    it('falls back for an array holding no strings', () => {
        expect(apiErrorMessage({ response: { data: { message: [{ constraint: 'x' }] } } }, 'fallback')).toBe('fallback');
    });

    it('falls back for a whitespace-only message', () => {
        expect(apiErrorMessage({ response: { data: { message: '   ' } } }, 'fallback')).toBe('fallback');
    });

    it('falls back when there is no response at all (network error)', () => {
        expect(apiErrorMessage(new Error('Network Error'), 'fallback')).toBe('fallback');
    });

    it('falls back for undefined and null', () => {
        expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback');
        expect(apiErrorMessage(null, 'fallback')).toBe('fallback');
    });
});
