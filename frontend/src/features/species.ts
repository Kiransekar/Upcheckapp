/**
 * The species and seed lists a cycle may be started with.
 *
 * Mirrors `backend/src/crops/species.ts`, which validates the same two lists
 * with `@IsIn`. They were free text on both sides, and a typo did not error —
 * it silently fell through to vannamei thresholds, so the farmer got the wrong
 * alerts with nothing to say why (prod still holds one crop typed
 * `VannameiVannamei`).
 *
 * Species carry an i18n label key because the common name is what a farmer
 * recognises; seed grades are already the industry's own notation (PL-10), so
 * they are shown literally in every language.
 */
export const CANONICAL_SPECIES = ['Vannamei', 'Monodon', 'Indicus', 'Scampi'] as const;

export const SEED_TYPES = [
    'PL-8',
    'PL-9',
    'PL-10',
    'PL-11',
    'PL-12',
    'PL-13',
    'PL-14',
    'PL-15',
    'Juvenile',
    'Other',
] as const;

export type CanonicalSpecies = (typeof CANONICAL_SPECIES)[number];
export type SeedType = (typeof SEED_TYPES)[number];

/** Translation key for a species' farmer-facing label (`cycles.species_*`). */
export const speciesLabelKey = (s: CanonicalSpecies) => `cycles.species_${s}`;
