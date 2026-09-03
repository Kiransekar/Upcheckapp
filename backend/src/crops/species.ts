/**
 * Canonical shrimp species and seed stages accepted on a crop (cycle).
 *
 * Free text let bad values in (prod holds one crop with
 * `species_type = 'VannameiVannamei'`, which broke threshold lookup); the
 * frontend mirrors these lists as dropdowns.
 */
export const CANONICAL_SPECIES = [
  'Vannamei',
  'Monodon',
  'Indicus',
  'Scampi',
] as const;

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
