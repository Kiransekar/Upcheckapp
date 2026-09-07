/**
 * T3.12 — the onboarding intent is persisted on the `users` row so a farmer who
 * reinstalls, or picks up a second phone mid-setup, resumes where they were.
 *
 * The risk this carries is not losing the value; it is the value being trusted.
 * W3 removed `accountType` because a client-supplied flag on the user record was
 * being read for an authorization decision. Persisting an intent re-creates the
 * SHAPE of that (a client-supplied value on the user row), so what these tests
 * actually guard is that it stays inert: only whitelisted keys land, and nothing
 * in the authorization layer ever consults preferences.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProfilesService } from './profiles.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

/** A ProfilesService wired to a fake DataSource that records its SQL. */
function makeService(stored: Record<string, unknown> = {}) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const dataSource = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (/^\s*SELECT/i.test(sql)) return [{ preferences: stored }];
      // Mimic Postgres `||` then `- text[]`: merge the patch over what is
      // stored, then drop the named keys.
      const patch = JSON.parse(params[1] as string);
      Object.assign(stored, patch);
      for (const key of (params[2] as string[]) ?? []) delete stored[key];
      return [{ preferences: stored }];
    }),
  };
  const svc = new ProfilesService({} as any, dataSource as any, {} as any);
  return { svc, calls, stored };
}

describe('ProfilesService preferences — what may be written', () => {
  it('stores the onboarding intent', async () => {
    const { svc } = makeService();

    const result = await svc.setPreferences('u1', { onboardingIntent: 'own_farm' });

    expect(result).toEqual({ onboardingIntent: 'own_farm' });
  });

  it('merges, so an unrelated preference is not lost', async () => {
    // Replace-instead-of-merge is a data-loss bug that only appears once there
    // is a second preference — by which time it is someone else's mystery.
    const { svc } = makeService({ language: 'te' });

    const result = await svc.setPreferences('u1', { onboardingIntent: 'work_on_farm' });

    expect(result).toEqual({ language: 'te', onboardingIntent: 'work_on_farm' });
  });

  it('merges in SQL rather than read-modify-write', async () => {
    // A read, then a write, would silently drop a concurrent write to another
    // key. Postgres applies `jsonb || jsonb` inside the statement.
    const { svc, calls } = makeService();

    await svc.setPreferences('u1', { onboardingIntent: 'own_farm' });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/\|\|/);
    expect(calls[0].sql).toMatch(/UPDATE users/);
  });

  it('drops keys that are not on the whitelist', async () => {
    // The attack this blocks: writing something an authorization check might
    // one day be careless enough to read.
    const { svc } = makeService();

    const result = await svc.setPreferences('u1', {
      onboardingIntent: 'own_farm',
      roles: ['admin'],
      accountType: 'owner',
      isAdmin: true,
    } as Record<string, unknown>);

    expect(result).toEqual({ onboardingIntent: 'own_farm' });
    expect(result).not.toHaveProperty('roles');
    expect(result).not.toHaveProperty('accountType');
    expect(result).not.toHaveProperty('isAdmin');
  });

  /**
   * The production bug this pins.
   *
   * `clearOnboardingIntent` sent `{ onboardingIntent: undefined }`, which
   * JSON.stringify drops — the body arrived as `{}`, this method skipped it as
   * "nothing writable", and the intent stayed on the row for good. Every owner
   * who finished setup then had the gate re-armed from it on the next launch
   * and was returned to the farm-creation screen at every app open, with no way
   * past it. A clear has to be expressible, and null is how it is spelled.
   */
  it('deletes the key when the value is an explicit null', async () => {
    const { svc, stored } = makeService({ onboardingIntent: 'own_farm' });

    const result = await svc.setPreferences('u1', { onboardingIntent: null });

    expect(result).not.toHaveProperty('onboardingIntent');
    expect(stored).not.toHaveProperty('onboardingIntent');
  });

  it('clearing one key leaves the others alone', async () => {
    const { svc } = makeService({ language: 'te', onboardingIntent: 'own_farm' });

    const result = await svc.setPreferences('u1', { onboardingIntent: null });

    expect(result).toEqual({ language: 'te' });
  });

  it('a clear is one atomic statement, not read-then-write', async () => {
    const { svc, calls } = makeService({ onboardingIntent: 'own_farm' });

    await svc.setPreferences('u1', { onboardingIntent: null });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/UPDATE users/);
    expect(calls[0].params[2]).toEqual(['onboardingIntent']);
  });

  it('issues no UPDATE at all when nothing writable was sent', async () => {
    const { svc, calls } = makeService({ onboardingIntent: 'own_farm' });

    await svc.setPreferences('u1', { roles: ['admin'] } as Record<string, unknown>);

    expect(calls.every((c) => /^\s*SELECT/i.test(c.sql))).toBe(true);
  });

  it('scopes every statement to the one user id it was given', async () => {
    const { svc, calls } = makeService();

    await svc.setPreferences('victim-is-not-here', { onboardingIntent: 'own_farm' });

    expect(calls[0].params[0]).toBe('victim-is-not-here');
    expect(calls[0].sql).toMatch(/WHERE id = \$1/);
  });
});

describe('UpdatePreferencesDto — what the API accepts', () => {
  const check = async (payload: Record<string, unknown>) =>
    validate(plainToInstance(UpdatePreferencesDto, payload));

  it('accepts the two real intents', async () => {
    expect(await check({ onboardingIntent: 'own_farm' })).toHaveLength(0);
    expect(await check({ onboardingIntent: 'work_on_farm' })).toHaveLength(0);
  });

  it('rejects an intent it does not know', async () => {
    const errors = await check({ onboardingIntent: 'admin' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('onboardingIntent');
  });

  it('accepts an empty patch — the field is optional', async () => {
    expect(await check({})).toHaveLength(0);
  });

  it('accepts an explicit null, because that is how a clear is spelled', async () => {
    // @IsOptional skips validators for null as well as undefined. If that ever
    // changes, clearing starts 400ing and owners get stranded on the
    // farm-creation screen again — so it is pinned here rather than assumed.
    expect(await check({ onboardingIntent: null })).toHaveLength(0);
  });
});
