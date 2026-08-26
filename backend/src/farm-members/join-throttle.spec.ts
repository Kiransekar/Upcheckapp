/**
 * The join endpoint's brute-force budget (tasklist W2 verification: "Join
 * endpoint is throttled, proven by a test").
 *
 * An invite code is 8 characters over a 32-character alphabet — about 10^12
 * combinations. That is comfortable against a rate-limited attacker and
 * worthless against an unlimited one, so the throttle is not a nicety here: it
 * is the only thing standing between a stranger and a guessed membership.
 *
 * Losing the decorator would not fail any other test — the endpoint keeps
 * working, just without a ceiling — which is exactly why it needs its own.
 */
import 'reflect-metadata';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { FarmMembersController } from './farm-members.controller';

/** Read what @Throttle wrote onto a handler, for the default named bucket. */
const throttleOn = (handler: unknown) => ({
  limit: Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler as object),
  ttl: Reflect.getMetadata(`${THROTTLER_TTL}default`, handler as object),
});

describe('POST /farm-members/join is rate limited', () => {
  it('carries a throttle bucket', () => {
    const { limit, ttl } = throttleOn(FarmMembersController.prototype.join);

    expect(limit).toBeDefined();
    expect(ttl).toBeDefined();
  });

  it('allows at most 5 attempts per minute', () => {
    // Matches SENSITIVE_THROTTLE in supabase-auth.controller.ts — code
    // redemption is an authentication-shaped action and gets the same budget.
    const { limit, ttl } = throttleOn(FarmMembersController.prototype.join);

    expect(limit).toBe(5);
    expect(ttl).toBe(60_000);
  });

  it('is a tight budget — a wide one would not slow a guesser down', () => {
    // Guards against someone "fixing" a support complaint by raising this to
    // a number that no longer bounds an attacker.
    const { limit, ttl } = throttleOn(FarmMembersController.prototype.join);
    const perHour = (limit as number) * (3_600_000 / (ttl as number));

    expect(perHour).toBeLessThanOrEqual(300);
  });

  it('does not throttle the ordinary roster read — only the credential path', () => {
    // A blanket controller-level throttle would rate-limit an owner opening
    // their own members list, which is not a threat and would look like a bug.
    const { limit } = throttleOn(FarmMembersController.prototype.list);

    expect(limit).toBeUndefined();
  });
});
