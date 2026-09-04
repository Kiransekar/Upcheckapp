/**
 * The per-FIELD 12-hour prefill rule (spec §4.6).
 *
 * The whole point of `GET /water-quality/latest` is that each column carries
 * its own `<field>AsOf`: a pond can have a salinity from an hour ago and an
 * alkalinity from last week in the same response, and only the first may be
 * written into the form silently. Testing that against the top-level
 * `recordedAt` — the bug this replaced — would pass everything or nothing.
 */
jest.mock('../client', () => ({
    __esModule: true,
    default: { get: jest.fn().mockResolvedValue({ data: {} }) },
}));

import apiClient from '../client';
import {
    waterQualityApi,
    prefillCandidates,
    PREFILL_MAX_AGE_HOURS,
    SLOW_CHANGING_PREFILL_FIELDS,
} from '../waterQuality';

const NOW = Date.parse('2026-09-04T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const byField = (latest: any) =>
    Object.fromEntries(prefillCandidates(latest, NOW).map((c) => [c.field, c]));

describe('prefillCandidates', () => {
    it('applies the age test per field, not against recordedAt', () => {
        const got = byField({
            // The newest record is minutes old, but it only carried salinity.
            recordedAt: hoursAgo(0.1),
            salinity: 18, salinityAsOf: hoursAgo(0.1),
            alkalinity: 120, alkalinityAsOf: hoursAgo(80),
            hardness: 140, hardnessAsOf: hoursAgo(11.9),
            transparency: 35, transparencyAsOf: hoursAgo(12.1),
        });

        expect(got.salinity.fresh).toBe(true);
        expect(got.hardness.fresh).toBe(true);
        expect(got.alkalinity.fresh).toBe(false);
        expect(got.transparency.fresh).toBe(false);
    });

    it('treats exactly 12 h as too old to fill in silently', () => {
        const [c] = prefillCandidates(
            { salinity: 18, salinityAsOf: hoursAgo(PREFILL_MAX_AGE_HOURS) },
            NOW,
        );
        expect(c.fresh).toBe(false);
        expect(c.ageHours).toBe(12);
    });

    it('reports the age so the offer can say how old the value is', () => {
        const [c] = prefillCandidates({ alkalinity: 120, alkalinityAsOf: hoursAgo(18) }, NOW);
        expect(c.ageHours).toBeCloseTo(18, 6);
        expect(c.value).toBe(120);
        expect(c.asOf).toBe(hoursAgo(18));
    });

    it('skips a field with a value but no timestamp — age is unknowable', () => {
        expect(prefillCandidates({ salinity: 18, salinityAsOf: null }, NOW)).toEqual([]);
    });

    it('skips a field that was never measured, and a zero value is still a value', () => {
        const got = byField({
            salinity: null, salinityAsOf: null,
            // 0 ppt is a real freshwater reading, not "missing".
            transparency: 0, transparencyAsOf: hoursAgo(1),
        });
        expect(got.salinity).toBeUndefined();
        expect(got.transparency).toEqual(
            expect.objectContaining({ value: 0, fresh: true }),
        );
    });

    it('never offers pH, DO or temperature — those must be measured fresh', () => {
        const candidates = prefillCandidates(
            {
                ph: 8.1, phAsOf: hoursAgo(1),
                dissolvedOxygen: 5, dissolvedOxygenAsOf: hoursAgo(1),
                temperature: 30, temperatureAsOf: hoursAgo(1),
                ammonia: 0.2, ammoniaAsOf: hoursAgo(1),
                salinity: 18, salinityAsOf: hoursAgo(1),
            },
            NOW,
        );
        expect(candidates.map((c) => c.field)).toEqual(['salinity']);
        expect(SLOW_CHANGING_PREFILL_FIELDS).toEqual([
            'salinity', 'alkalinity', 'hardness', 'transparency',
        ]);
    });

    it('treats a future timestamp (skewed device clock) as fresh, not negative-aged', () => {
        const [c] = prefillCandidates({ hardness: 140, hardnessAsOf: hoursAgo(-5) }, NOW);
        expect(c.ageHours).toBe(0);
        expect(c.fresh).toBe(true);
    });

    it('returns nothing for a missing or unparsable response', () => {
        expect(prefillCandidates(null, NOW)).toEqual([]);
        expect(prefillCandidates(undefined, NOW)).toEqual([]);
        expect(prefillCandidates({ salinity: 18, salinityAsOf: 'not-a-date' }, NOW)).toEqual([]);
    });
});

/**
 * The backend compares `chemistryOnly` against the LITERAL string 'true';
 * anything else — including `false`, `'0'` or absence — keeps the unfiltered
 * behaviour. Sending a boolean would serialise fine and silently do nothing.
 */
describe('waterQualityApi.getAll — chemistryOnly', () => {
    const get = apiClient.get as jest.Mock;
    beforeEach(() => get.mockClear());

    it("sends the literal string 'true' when the chemistry chart asks for it", () => {
        waterQualityApi.getAll('pond-1', { take: 100, chemistryOnly: true });
        expect(get).toHaveBeenCalledWith(
            '/water-quality',
            { params: { pondId: 'pond-1', page: undefined, take: 100, chemistryOnly: 'true' } },
        );
    });

    it('omits it entirely otherwise, so the old behaviour is byte for byte', () => {
        waterQualityApi.getAll('pond-1', { take: 100 });
        waterQualityApi.getAll('pond-1', { take: 100, chemistryOnly: false });
        expect(get.mock.calls[0][1].params.chemistryOnly).toBeUndefined();
        expect(get.mock.calls[1][1].params.chemistryOnly).toBeUndefined();
    });
});
