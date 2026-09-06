/**
 * TRUE new/full moon instants — Meeus, *Astronomical Algorithms*, ch. 49
 * ("Phases of the Moon"). (E5.1)
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Both moon implementations in this app used a MEAN synodic month: a fixed
 * 29.530588 days from a fixed epoch. The real Moon does not keep that
 * timetable — its orbit is elliptical, so a true new or full moon deviates
 * from the mean one by up to **±14 hours**. That is easily enough to land a
 * predicted new moon on the wrong calendar DATE.
 *
 * For this audience that is not a rounding detail. Amavasya and Purnima come
 * from the Panchang, which uses TRUE phase at LOCAL time. A farmer who sees
 * the app disagree with the Panchang concludes — reasonably — that the app is
 * wrong, and stops trusting the whole feature.
 *
 * The second error compounded it: the mean instant was formatted without
 * converting to IST. `2026-09-11 20:29 UTC` is `2026-09-12 01:59 IST` — the
 * app said the 11th while the farmer's calendar said the 12th. That half is
 * fixed by bucketing in IST wherever these instants are displayed, using the
 * same helpers `DATE-1` gave the rest of the app and never gave this module.
 *
 * ── Why it is safe to ship ────────────────────────────────────────────────
 * Pure arithmetic. No library, no native module, no dependency — so it ships
 * over the air like any other change.
 *
 * ── Accuracy ──────────────────────────────────────────────────────────────
 * The periodic terms below are Meeus's, truncated to the largest ones. That
 * is good to roughly a minute, which is far inside what a calendar date needs
 * and vastly better than the ±14 hours it replaces. It is deliberately NOT a
 * full ephemeris: we need the right DAY, not the right second.
 */

const RAD = Math.PI / 180;

/** Julian Day for a JS Date. */
export const toJulianDay = (d: Date): number => d.getTime() / 86_400_000 + 2440587.5;

/** The inverse. */
export const fromJulianDay = (jd: number): Date =>
  new Date((jd - 2440587.5) * 86_400_000);

/**
 * The k-th lunation since 2000 Jan 6 (Meeus 49.2). Integer k gives a NEW
 * moon; k + 0.5 gives a full moon.
 */
const meanPhaseJde = (k: number): number => {
  const t = k / 1236.85; // Julian centuries since J2000, per Meeus 49.3
  return (
    2451550.09766 +
    29.530588861 * k +
    0.00015437 * t * t -
    0.00000015 * t * t * t +
    0.00000000073 * t * t * t * t
  );
};

/**
 * Apply the periodic corrections to a mean phase.
 *
 * `isNew` selects Meeus's new-moon series or his full-moon series; the two
 * differ only in the leading coefficient of the first term.
 */
const correction = (k: number, isNew: boolean): number => {
  const t = k / 1236.85;

  // Sun's mean anomaly (49.4), Moon's mean anomaly (49.5), Moon's argument of
  // latitude (49.6), longitude of the ascending node (49.7).
  const M = (2.5534 + 29.10535670 * k - 0.0000014 * t * t - 0.00000011 * t * t * t) * RAD;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * t * t + 0.00001238 * t * t * t - 0.000000058 * t * t * t * t) * RAD;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * t * t - 0.00000227 * t * t * t + 0.000000011 * t * t * t * t) * RAD;
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * t * t + 0.00000215 * t * t * t) * RAD;

  // Eccentricity of Earth's orbit (47.6) — scales the solar-anomaly terms.
  const E = 1 - 0.002516 * t - 0.0000074 * t * t;

  const lead = isNew ? -0.40720 : -0.40614;

  let c =
    lead * Math.sin(Mp) +
    0.17241 * E * Math.sin(M) +
    0.01608 * Math.sin(2 * Mp) +
    0.01039 * Math.sin(2 * F) +
    0.00739 * E * Math.sin(Mp - M) -
    0.00514 * E * Math.sin(Mp + M) +
    0.00208 * E * E * Math.sin(2 * M) -
    0.00111 * Math.sin(Mp - 2 * F) -
    0.00057 * Math.sin(Mp + 2 * F) +
    0.00056 * E * Math.sin(2 * Mp + M) -
    0.00042 * Math.sin(3 * Mp) +
    0.00042 * E * Math.sin(M + 2 * F) +
    0.00038 * E * Math.sin(M - 2 * F) -
    0.00024 * E * Math.sin(2 * Mp - M) -
    0.00017 * Math.sin(Om) -
    0.00007 * Math.sin(Mp + 2 * M);

  // Additional planetary corrections (Meeus, "Additional corrections"). Small,
  // but they are the difference between ~1 minute and ~5 minutes of error.
  const A1 = (299.77 + 0.107408 * k - 0.009173 * t * t) * RAD;
  const A2 = (251.88 + 0.016321 * k) * RAD;
  const A3 = (251.83 + 26.651886 * k) * RAD;
  const A4 = (349.42 + 36.412478 * k) * RAD;
  const A5 = (84.66 + 18.206239 * k) * RAD;

  c +=
    0.000325 * Math.sin(A1) +
    0.000165 * Math.sin(A2) +
    0.000164 * Math.sin(A3) +
    0.000126 * Math.sin(A4) +
    0.000110 * Math.sin(A5);

  return c;
};

/** The true instant of the k-th new (or full) moon, as a Julian Day. */
export const truePhaseJde = (k: number, isNew: boolean): number =>
  meanPhaseJde(isNew ? k : k + 0.5) + correction(isNew ? k : k + 0.5, isNew);

/** Approximate lunation number for a date — the search seed. */
const approxK = (d: Date): number => {
  // Meeus 49.2: k ≈ (year − 2000) × 12.3685, with the year as a decimal.
  const year = d.getUTCFullYear() + (d.getUTCMonth() + 0.5) / 12;
  return (year - 2000) * 12.3685;
};

/**
 * The first true new (or full) moon at or after `from`.
 *
 * Searches outward from the approximate lunation rather than trusting the
 * seed, because near a phase boundary `approxK` can be off by one and a
 * silently-wrong month is exactly the failure this module exists to remove.
 */
export const nextPhase = (from: Date, isNew: boolean): Date => {
  const fromJd = toJulianDay(from);
  let k = Math.floor(approxK(from));
  // Step back two lunations, then walk forward to the first one that is not
  // in the past. Bounded so a bad input cannot spin.
  k -= 2;
  for (let i = 0; i < 8; i++) {
    const jd = truePhaseJde(k + i, isNew);
    if (jd >= fromJd) return fromJavaSafe(jd);
  }
  return fromJavaSafe(truePhaseJde(k + 8, isNew));
};

/** Guard against a NaN escaping into a Date, which renders as "Invalid Date". */
const fromJavaSafe = (jd: number): Date => {
  const d = fromJulianDay(jd);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
};

/**
 * Days from `from` to the nearest spring tide (new OR full moon), using true
 * phases. This is what the molt window is actually keyed on.
 */
export const daysToNearestSpringTide = (from: Date): number => {
  const jd = toJulianDay(from);
  const candidates = [nextPhase(from, true), nextPhase(from, false)].map(toJulianDay);
  // Also look backwards one of each: the nearest spring tide may have just
  // passed, and a molt window is symmetric around it.
  let k = Math.floor(approxK(from));
  for (let i = -3; i <= 0; i++) {
    candidates.push(truePhaseJde(k + i, true), truePhaseJde(k + i, false));
  }
  return Math.min(...candidates.map((c) => Math.abs(c - jd)));
};
