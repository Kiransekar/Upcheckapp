import { formatAge } from '../formatDate';

const NOW = new Date('2026-09-04T10:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe('formatAge', () => {
    it('reads under an hour as a floor, not "0 h"', () => {
        expect(formatAge(hoursAgo(0.5), NOW)).toBe('<1 h');
    });

    it('reads hours below a day', () => {
        expect(formatAge(hoursAgo(4), NOW)).toBe('4 h');
        expect(formatAge(hoursAgo(23), NOW)).toBe('23 h');
    });

    it('switches to days at 24 hours', () => {
        expect(formatAge(hoursAgo(24), NOW)).toBe('1 d');
        expect(formatAge(hoursAgo(24 * 12), NOW)).toBe('12 d');
    });

    it('says never for a missing timestamp', () => {
        expect(formatAge(null, NOW)).toBe('never');
        expect(formatAge(undefined, NOW)).toBe('never');
    });

    it('says never for an unparseable timestamp rather than throwing', () => {
        expect(formatAge('not-a-date', NOW)).toBe('never');
    });

    it('does not render a future timestamp as a negative age', () => {
        // Phone clocks drift and offline records carry client-minted times.
        expect(formatAge(new Date(NOW.getTime() + 3600_000).toISOString(), NOW)).toBe('<1 h');
    });
});
