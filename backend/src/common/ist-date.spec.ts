import { toIstDateString } from './ist-date';

/** DATE-1: bucket by IST-local day, not UTC. */
describe('toIstDateString', () => {
  it('keeps a pre-05:30-IST reading on its own IST calendar date', () => {
    // 2026-06-17 02:00 IST === 2026-06-16 20:30 UTC. UTC bucketing would give
    // 2026-06-16; IST bucketing must give 2026-06-17.
    expect(toIstDateString(new Date('2026-06-16T20:30:00.000Z'))).toBe(
      '2026-06-17',
    );
  });

  it('matches UTC when the instant is already the same IST/UTC day', () => {
    expect(toIstDateString(new Date('2026-06-17T09:00:00.000Z'))).toBe(
      '2026-06-17',
    );
  });

  it('rolls to the next day just after IST midnight', () => {
    // 2026-06-17T18:31:00Z === 2026-06-18 00:01 IST.
    expect(toIstDateString(new Date('2026-06-17T18:31:00.000Z'))).toBe(
      '2026-06-18',
    );
  });
});

/**
 * The bug this pins: attendance filtered "today" by building a UTC range from a
 * LOCAL date string, so every check-in between 00:00 and 05:30 IST landed on the
 * previous day and vanished from the roster. On a farm whose shift starts at
 * 05:00 that meant the earliest arrivals were exactly the ones going missing.
 */
describe('istDayRangeUtc', () => {
  const { istDayRangeUtc } = require('./ist-date');

  it('starts at 18:30 UTC the previous day — 00:00 IST', () => {
    const { start } = istDayRangeUtc('2026-08-27');
    expect(start.toISOString()).toBe('2026-08-26T18:30:00.000Z');
  });

  it('ends one millisecond before the next IST midnight', () => {
    const { end } = istDayRangeUtc('2026-08-27');
    expect(end.toISOString()).toBe('2026-08-27T18:29:59.999Z');
  });

  it('includes a 05:00 IST check-in, which the UTC version dropped', () => {
    // 05:00 IST on the 27th is 23:30 UTC on the 26th — outside a naive
    // [27th 00:00Z, 27th 23:59Z] window, inside this one.
    const early = new Date('2026-08-26T23:30:00.000Z');
    const { start, end } = istDayRangeUtc('2026-08-27');
    expect(early >= start && early <= end).toBe(true);
  });

  it('excludes 23:59 IST the day before', () => {
    const justBefore = new Date('2026-08-26T18:29:59.998Z');
    const { start } = istDayRangeUtc('2026-08-27');
    expect(justBefore < start).toBe(true);
  });

  it('covers exactly 24 hours', () => {
    const { start, end } = istDayRangeUtc('2026-08-27');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });
});
