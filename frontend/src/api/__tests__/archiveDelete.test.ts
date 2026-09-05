/**
 * Spec §4.1 — "you cannot delete this, it holds records".
 *
 * The refusal reaches the screens as an HTTP status, and everything the farmer
 * sees hangs off reading it correctly: a 409 becomes plain language plus an
 * Archive button, anything else stays an error alert. Getting this wrong in
 * either direction is a farmer either seeing a raw server string or being
 * offered "archive instead" for a dead network.
 */
import { isHistoryConflict } from '../farms';

describe('isHistoryConflict', () => {
    it('is true for the farm refusal (409 + crop_history_exists)', () => {
        expect(
            isHistoryConflict({
                response: {
                    status: 409,
                    data: { error: 'crop_history_exists', message: 'Cannot delete a farm with crop history — archive it instead' },
                },
            }),
        ).toBe(true);
    });

    it('is true for the pond refusal, which carries a bare message', () => {
        expect(
            isHistoryConflict({
                response: { status: 409, data: { message: 'Cannot delete a pond with crop history — archive it instead' } },
            }),
        ).toBe(true);
    });

    it('is false for permission, validation and not-found failures', () => {
        for (const status of [400, 401, 403, 404, 422, 500]) {
            expect(isHistoryConflict({ response: { status } })).toBe(false);
        }
    });

    it('is false offline — a request that never got a response is not a refusal', () => {
        expect(isHistoryConflict({ message: 'Network Error' })).toBe(false);
        expect(isHistoryConflict(undefined)).toBe(false);
        expect(isHistoryConflict(null)).toBe(false);
    });
});
