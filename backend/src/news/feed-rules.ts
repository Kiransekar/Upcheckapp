import { createHash } from 'crypto';

/**
 * Pure decision logic for the news feed: what counts as relevant, what
 * category an item belongs to, and when two items are the same story.
 *
 * Deliberately free of Nest/TypeORM so it can be tested as plain functions —
 * these are the rules a reviewer needs to be able to read and argue with.
 */

export const NEWS_CATEGORIES = [
  'market',
  'regulation',
  'disease',
  'research',
  'production',
  'trade',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

/**
 * Categories that must never publish straight from the pipeline. A misread
 * regulation reaching ten thousand farmers as a notification is the worst
 * failure this feature has; a human reads it first.
 */
export const REVIEW_REQUIRED_CATEGORIES: readonly NewsCategory[] = [
  'regulation',
  'disease',
];

export const NEWS_STATUSES = [
  'draft',
  'needs_summary',
  'pending_review',
  'published',
  'rejected',
] as const;

export type NewsStatus = (typeof NEWS_STATUSES)[number];

/** §2.2: our summary, not theirs, and short enough to be plainly a pointer. */
export const MAX_SUMMARY_CHARS = 300;

/**
 * How recent "current" means for the default News listing. Shrimp market
 * and regulatory news moves on a weeks-to-months cadence, not a daily one —
 * Global Seafood Alliance's own feed regularly runs six weeks between
 * shrimp-relevant posts — so a farmer's "current" window has to be generous
 * enough to hold that, not just yesterday's items. What it must never hold
 * is the years-old backlog: nine rows with a newest `published_at` of
 * 2020-12-15 is what put a six-year-old recipe on the News page to begin
 * with. `news.service.ts` filters the default listing to this window and
 * reports whether it found anything, rather than quietly serving whatever
 * is oldest in the table.
 */
export const NEWS_FRESH_WINDOW_DAYS = 45;

/**
 * Below this an item is dropped. Most aquaculture feeds are majority salmon
 * and whitefish; without a threshold an Indian shrimp farmer's feed fills
 * with Norwegian salmon news and the feature dies of irrelevance.
 */
export const RELEVANCE_THRESHOLD = 40;

/** Species and product terms that make an item about the right animal. */
const SPECIES_TERMS =
  /\b(shrimp|prawn|vannamei|litopenaeus|penaeus|monodon|black tiger)\b/gi;

/** Geography and institutions that make an item about the right country. */
const INDIA_TERMS =
  /\b(india|indian|andhra|nellore|godavari|tamil nadu|odisha|orissa|gujarat|kerala|west bengal|mpeda|nfdb|icar|ciba|nacsa|dahd|coastal aquaculture authority)\b/gi;

/** Generic aquaculture vocabulary — supporting evidence, not proof. */
const AQUA_TERMS =
  /\b(aquaculture|hatchery|broodstock|post-?larva[e]?|stocking|pond|farmgate|feed conversion|biofloc|seafood)\b/gi;

/**
 * Species this app's farmers do not raise. A strong negative rather than a
 * mere absence of positives, because "Norwegian salmon exports to India" would
 * otherwise score well on geography alone.
 */
const OFF_TOPIC_TERMS =
  /\b(salmon|salmonid|trout|tilapia|cod|haddock|pollock|norway|norwegian|scottish|chile[an]?)\b/gi;

/**
 * Recipe and cooking vocabulary. MPEDA — our only active source — publishes
 * recipe pages ("Shrimp Ghee Pepper Roast") on the exact same feed as trade
 * notices and lab advisories, so source weight cannot be what tells them
 * apart; only the words in the item can. A recipe must not merely rank below
 * a disease alert, it must never clear the display threshold at all — see
 * the early return in {@link scoreRelevance} below.
 *
 * Recipe titles also tend to pluralise the species casually ("Shrimps Fry",
 * "Prawns Newburg") where trade/regulatory prose treats it as an invariant
 * mass noun ("Shrimp exports", "Shrimp farmers") — so the bare plural is
 * itself food-content evidence, not a species match (SPECIES_TERMS above is
 * deliberately singular-only).
 */
const FOOD_TERMS =
  /\b(recipes?|roast(?:ed)?|skewers?|curr(?:y|ies)|fry|fried|grill(?:ed)?|marinad(?:e|ed)|salads?|pasta|sauces?|cooking|cooks?|dish(?:es)?|serves?|served|tbsp|tsp|teaspoons?|tablespoons?|ingredients?|shrimps|prawns)\b/gi;

const countMatches = (text: string, re: RegExp): number =>
  (text.match(re) ?? []).length;

/**
 * 0–100 relevance for an item, from its headline (plus whatever short feed
 * text we were given, which we score and then throw away — see
 * {@link normalizeFeedItem} in the ingestion service).
 *
 * `sourceWeight` biases institutional sources up: an MPEDA circular titled
 * "Registration of aquaculture units" is highly relevant to an Indian shrimp
 * farmer while containing none of the species keywords.
 */
export const scoreRelevance = (text: string, sourceWeight = 50): number => {
  const t = text ?? '';
  // A farmer opening a disease-risk feed must never see cooking — this beats
  // even the biggest source-weight bias, so it is checked before anything
  // else is computed.
  if (countMatches(t, FOOD_TERMS) > 0) return 0;
  const positive =
    Math.min(countMatches(t, SPECIES_TERMS), 2) * 25 +
    Math.min(countMatches(t, INDIA_TERMS), 2) * 20 +
    Math.min(countMatches(t, AQUA_TERMS), 3) * 10;
  const penalty = Math.min(countMatches(t, OFF_TOPIC_TERMS), 2) * 25;
  const sourceBias = Math.max(0, sourceWeight - 50);
  return Math.max(0, Math.min(100, positive - penalty + sourceBias));
};

/** Keyword evidence per category. First key wins ties, so safest goes first. */
const CATEGORY_TERMS: Record<NewsCategory, RegExp> = {
  regulation:
    /\b(regulation|regulatory|notification|circular|gazette|ban|banned|prohibit\w*|licen[cs]\w*|registration|compliance|mandat\w*|policy|amendment|rules?)\b/gi,
  disease:
    /\b(disease|outbreak|wssv|white spot|ehp|ahpnd|ems|vibrio|pathogen|mortalit\w*|biosecurity|infection)\b/gi,
  market:
    /\b(price|prices|pricing|market|demand|farmgate|oversupply|rate[s]?\/kg|count size)\b/gi,
  trade: /\b(export|import|tariff|shipment|consignment|customs|trade|container)\b/gi,
  research:
    /\b(research|study|studies|trial|journal|scientists?|findings|peer-reviewed)\b/gi,
  production:
    /\b(production|harvest|yield|culture|seed quality|feed|nursery|aeration)\b/gi,
};

/**
 * Best-effort category from the text, falling back to the source's declared
 * default and finally to `production` — the least alarming bucket, since a
 * misfiled item should never end up somewhere that triggers a push.
 */
export const classify = (
  text: string,
  defaultCategory?: string | null,
): NewsCategory => {
  let best: NewsCategory | null = null;
  let bestCount = 0;
  for (const key of NEWS_CATEGORIES) {
    const n = countMatches(text ?? '', CATEGORY_TERMS[key]);
    if (n > bestCount) {
      best = key;
      bestCount = n;
    }
  }
  if (best) return best;
  const fallback = (defaultCategory ?? '') as NewsCategory;
  return NEWS_CATEGORIES.includes(fallback) ? fallback : 'production';
};

/**
 * Title reduced to its words: case, punctuation, leading source prefixes and
 * whitespace removed. Two outlets running the same wire story write the same
 * words with different typography.
 */
export const normalizeTitle = (title: string): string =>
  (title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Collapse key for "the same story". Normalised title plus the publication
 * DAY (not timestamp) — the same story syndicated an hour apart by two
 * outlets should collapse, while a genuine follow-up next week should not.
 */
export const dedupeHash = (title: string, publishedAt: Date | string): string => {
  const d = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  const day = Number.isNaN(d.getTime())
    ? 'undated'
    : d.toISOString().slice(0, 10);
  return createHash('sha256')
    .update(`${normalizeTitle(title)}|${day}`)
    .digest('hex');
};

/** Whether an ingested item may publish without a human reading it first. */
export const initialStatus = (category: NewsCategory): NewsStatus =>
  REVIEW_REQUIRED_CATEGORIES.includes(category) ? 'pending_review' : 'published';
