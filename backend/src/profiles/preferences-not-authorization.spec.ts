/**
 * The W3 regression guard.
 *
 * `accountType` was a client-mutable flag on the user record that got wired into
 * an authorization decision — a "worker" account was blocked from creating a
 * farm, while the flag itself lived in Supabase `user_metadata` where the client
 * could rewrite it. W3 deleted it.
 *
 * T3.12 puts a different client-supplied value on the user row: the onboarding
 * intent, in `users.preferences`. It is inert by design — it routes the first
 * run and grants nothing. This test is what keeps it inert, because the failure
 * mode is not dramatic: someone reaches for `preferences.onboardingIntent`
 * inside a permission check because it is conveniently to hand, and the same
 * class of bug is back with a new name.
 *
 * A source scan is a blunt instrument, but the thing being asserted really is a
 * property of the whole authorization layer rather than of any one function.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Everything that decides what a caller is allowed to do. */
const AUTHORIZATION_PATHS = [
  'farm-access',
  'common/guards',
  'auth/guards',
  'common/decorators',
];

const SRC = path.join(__dirname, '..');

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });
};

describe('preferences are never an authorization input', () => {
  const files = AUTHORIZATION_PATHS.flatMap((p) => walk(path.join(SRC, p)));

  it('has authorization sources to scan', () => {
    // Guards the guard: a moved directory would otherwise make every assertion
    // below vacuously pass.
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(AUTHORIZATION_PATHS)('%s does not read user preferences', (dirName) => {
    const offenders = walk(path.join(SRC, dirName)).filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      // Strip comments — this very rule is *described* in prose in several of
      // these files, and mentioning it must not count as doing it.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return /\bpreferences\b/.test(code) || /onboardingIntent/.test(code);
    });

    expect(offenders).toEqual([]);
  });

  it('no capability check anywhere consults the onboarding intent', () => {
    const offenders = walk(SRC).filter((file) => {
      if (file.includes('.spec.')) return false;
      if (file.includes(`${path.sep}profiles${path.sep}`)) return false; // owns it
      const code = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return /onboardingIntent/.test(code);
    });

    expect(offenders).toEqual([]);
  });

  it('accountType has not come back', () => {
    const offenders = walk(SRC).filter((file) => {
      if (file.includes('.spec.')) return false;
      const code = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return /\baccountType\b|\baccount_type\b/.test(code);
    });

    expect(offenders).toEqual([]);
  });
});
