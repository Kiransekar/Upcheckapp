# Upcheck — News & Market Feed: Specification

**Repo:** `Upcheck-India/Upcheckapp` · **Suggested location:** `docs/NEWS_AND_MARKET_FEED_SPEC.md`
**Audience:** an AI coding agent working this repo under `AGENTS.md`, plus the human reviewing its PRs.
**Status:** proposal — nothing here is implemented. File paths are accurate as of writing; re-verify with `grep` before editing.

---

## 0. Decisions already locked

| Decision | Choice | Consequence |
|---|---|---|
| Content model | **Aggregate + link out** | Store headline + our own short summary + source + canonical URL. **Never** store or display a publisher's full article body. |
| Languages in v1 | **English only** | But the schema ships translation-ready (§5.3) so adding hi/ta/te/bn/or later is data, not a migration scramble. |
| v1 surfaces | **All four** — news feed, daily price board, regulatory alerts, research digest | These are four different pipelines with one shared UI shell. Sequenced in §9. |

Everything below follows from those three.

---

## 1. Read this first: what already exists

**A large part of this is already built. Do not rebuild it.**

### 1.1 The price board backend is ~80% done

`backend/src/india/` already contains a working count-based price system:

- `price-feed.entity.ts` — table `price_feeds` with `region`, `date`, `prices` (a `{ "30": 520, "40": 430 }` count-band → ₹/kg JSON map), `source` (`processor | local_agent | self`), `enteredBy`.
- `pricing.service.ts` — `bandsFromPrices()`, `nearestBand()`, `latestForRegion()`, `priceForCount()`.
- `india.controller.ts` — `GET /india/price-feeds`, `POST /india/price-feeds`, `GET /india/price?region=&count=`.

Indian shrimp is priced **by count, not flat ₹/kg**, and this model already encodes that correctly. **The price board is therefore mostly a frontend surface plus a trust/moderation layer (§6), not a new data pipeline.** Do not create a second price table.

### 1.2 The news module is a bare skeleton

`backend/src/news/` has admin-CRUD only:

- `news-article.entity.ts` — `title`, `content`, `summary`, `category`, `imageUrl`, `author`, `publishedAt`, `isActive`. No source, no URL, no locale, no dedupe key.
- `news.service.ts` — `findAll(category?)` returns **every active article with no pagination or limit**. This will degrade badly once ingestion runs daily; fixing it is part of N1.
- `news.controller.ts` — reads open, writes gated by `RolesGuard` + `@Roles(Role.SUPER_ADMIN)`. Keep this pattern.

Frontend: `screens/news/NewsListScreen.tsx` and `NewsDetailScreen.tsx` exist with category chips, skeleton loading, error and offline states, and `useFocusEffect` refetch. `api/news.ts` has `getAll()` / `getById()`. **Extend these; don't start new screens.**

### 1.3 Dependencies you already have

- `@nestjs/schedule` ^5.0.1 — cron. No new scheduler needed.
- `axios` ^1.15.2 — HTTP.
- Redis (`src/redis/`) with in-memory fallback — use for feed-fetch dedupe locks and response caching.
- `src/push/` + `frontend/src/api/push.ts` — Expo push tokens, for regulatory alerts.
- `PageOptionsDto` / `PageDto` (used in `ponds.service.ts`) — reuse for news pagination.

**Missing:** an RSS/Atom parser. Add `rss-parser` (or `fast-xml-parser` if you want fewer transitive deps). One new dependency, committed with its lockfile diff.

### 1.4 The translation pattern to copy later

`disease_library_translations` (`src/disease/disease-library-translation.entity.ts`, migration `1780301900000`) is the house pattern: English on the base row, a sidecar table keyed `(entity_id, locale)` with a unique index, and service-level fallback to English when a locale row is missing. **Mirror this exactly for news in §5.3.**

---

## 2. The legal boundary — non-negotiable

The aggregate-and-link model is safe **only if implemented within these limits.** An agent implementing this must treat them as hard requirements, not guidance.

1. **Never persist a publisher's article body.** The ingestion pipeline may fetch the full text into memory to generate a summary, but the body **must be discarded** before the row is written. Only the summary we wrote is stored. Add an explicit comment on the entity saying so, and an assertion in the pipeline.
2. **Summaries must be ours, not theirs.** 2–3 sentences, ≤ 300 characters, written to convey the facts. Never copy the publisher's own standfirst/dek verbatim. Facts are not copyrightable; sentences are.
3. **Headlines: store as published, keep them short, always attributed.** Every rendered item shows the source name and links to the canonical URL.
4. **Do not hotlink or re-host publisher images.** v1 uses a category icon from MaterialCommunityIcons instead (`imageUrl` stays null). This also matches the design system's no-decorative-imagery stance and saves bandwidth on 2 GB devices.
5. **Tapping an item opens the publisher's page** — in an in-app browser or the system browser, with the source domain visible. Never render their content inside an Upcheck-branded chrome that implies we wrote it.
6. **Respect `robots.txt` and each feed's stated terms.** Identify with a real User-Agent (`UpcheckBot/1.0 (+https://upcheck.in/bot)`) and an email contact. Rate-limit to one poll per source per hour at most.
7. **Track consent per source.** `news_sources` carries `terms_url`, `terms_checked_at`, `permission_status` (`unknown | granted | denied`), `permission_note`. **Email each publisher asking permission to show headline + our summary + link.** Most will say yes; it costs nothing and converts a grey area into a written yes.
8. **Government sources are different and better.** MPEDA, CAA, NFDB, DAHD and FAO material is largely public-interest content; still attribute and link, but these carry far less risk and should be weighted heavily in the feed.

> If the agent cannot satisfy a rule for a given source, that source does not get ingested. Failing closed on a feed is correct.

---

## 3. Architecture

```
                 ┌──────────────────────────────────────────────┐
  cron (hourly)  │  IngestionService                            │
  ──────────────►│  1 fetch feeds (RSS/Atom/HTML)               │
                 │  2 normalize → RawItem                       │
                 │  3 relevance filter  (shrimp/aqua/India)     │
                 │  4 dedupe / cluster  (title hash + fuzzy)    │
                 │  5 classify → category                       │
                 │  6 summarize (LLM) → ≤300 chars, DISCARD body│
                 │  7 persist news_articles + news_article_src  │
                 └───────────────┬──────────────────────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │ moderation queue         │  regulatory + price items
                    │ (SUPER_ADMIN approves)   │  require human approval
                    └────────────┬─────────────┘
                                 │
   GET /news?category=&page=     ▼
   GET /news/:id            news_articles (isActive = true)
   GET /india/price-feeds        │
                                 ▼
                    NewsListScreen / NewsDetailScreen
                    PriceBoardScreen  (reuses /india/price*)
                    push → regulatory alerts only
```

**Pipeline stages run as separate, individually testable methods.** A failure in step 6 must not lose the item — persist with `summary = null` and `status = 'needs_summary'` rather than dropping it.

---

## 4. Categories

One enum, used by the classifier, the filter chips, and the alert rules.

| Key | Label (en) | Icon | Push? | Approval? |
|---|---|---|---|---|
| `market` | Market & prices | `cash` | no | auto |
| `regulation` | Rules & regulations | `gavel` | **yes** | **human required** |
| `disease` | Disease & health | `bacteria` | on outbreak only | human required |
| `research` | Research | `book-open-variant` | no | auto |
| `production` | Farming & production | `sprout` | no | auto |
| `trade` | Exports & trade | `earth` | no | auto |

**Never auto-push a regulatory item.** A mistranslated or misread rule that reaches 10,000 farmers as a notification is the worst failure mode this feature has.

---

## 5. Data model

### 5.1 Extend `news_articles`

New migration, timestamp **greater than `1780302100000`** (current latest). Follow the idempotent style of `1780300700000-CreateFarmMembers.ts`: `ADD COLUMN IF NOT EXISTS`, guarded FK `DO $$` blocks, working `down()`.

| Column | Type | Notes |
|---|---|---|
| `source_id` | uuid FK → `news_sources` | nullable for hand-written items |
| `source_name` | text | denormalised for display without a join |
| `canonical_url` | text | **required for ingested items**; unique index |
| `dedupe_hash` | varchar(64) | sha256 of normalised title + published date; unique index |
| `status` | varchar(20) | `draft \| needs_summary \| pending_review \| published \| rejected` |
| `relevance_score` | int | 0–100 from the filter, for ranking and debugging |
| `locale` | varchar(8) default `'en'` | base-row language |
| `ingested_at` | timestamptz | |

**Deprecate `content`.** Per §2.1 it must never hold a publisher's body. Either drop it, or repurpose it strictly for hand-written editorial and document that on the entity. Do not leave it ambiguous.

Indexes: `(status, published_at DESC)`, `(category, published_at DESC)`, unique on `canonical_url`, unique on `dedupe_hash`.

### 5.2 New table `news_sources`

| Column | Type |
|---|---|
| `id` | uuid PK |
| `name` | text |
| `homepage_url` | text |
| `feed_url` | text |
| `feed_type` | `rss \| atom \| html \| manual` |
| `default_category` | text nullable |
| `weight` | int default 50 — ranking bias |
| `is_active` | boolean default true |
| `terms_url` | text nullable |
| `terms_checked_at` | timestamptz nullable |
| `permission_status` | `unknown \| granted \| denied` |
| `permission_note` | text nullable |
| `last_fetched_at` / `last_error` | timestamptz / text |

Seed it from §8 via the migration, all rows `permission_status = 'unknown'` and `is_active = false` **except the government sources**. A human flips a source active after checking its terms. That makes §2.7 structural rather than a promise.

### 5.3 New table `news_article_translations` — create it now, populate it later

Mirror `disease_library_translations` exactly:

```
news_article_translations (
  id uuid PK,
  article_id uuid FK → news_articles ON DELETE CASCADE,
  locale varchar(8) NOT NULL,          -- hi | ta | te | bn | or
  title text,
  summary text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (article_id, locale)
)
```

Ship the table and the service-level fallback (`requested locale → en`) in v1 with **zero rows**. `GET /news?locale=te` then works from day one and simply returns English. When translation turns on later it is a backfill job, not a schema change or a client release.

---

## 6. The price board

Reuses `price_feeds`. The work is trust and presentation, not storage.

**Backend additions:**

- `GET /india/price-board?region=&days=7` — returns, per count band: today's **median** of submissions, submission count, direction vs. previous day, and `lastUpdatedAt`. Median, not mean — one fat-fingered entry must not move the board.
- Outlier rejection on submit: discard values > 3× or < 0.33× the trailing 7-day median for that region and count band; store them flagged rather than silently dropping, so abuse is visible.
- Rate-limit `POST /india/price-feeds` per user per region per day (reuse the `SENSITIVE_THROTTLE` pattern from `supabase-auth.controller.ts`).
- Region resolution: default to the region of the user's active farm; fall back to a picker.

**Frontend `PriceBoardScreen`:**

- Count bands as rows (30, 40, 50, 60, 70, 80, 100), ₹/kg large and legible per the type scale, direction arrow with `success`/`danger` tokens.
- **Always show provenance and staleness**: "Median of 6 submissions · Nellore · updated 2 hours ago". A stale board must say so loudly — `warning` banner past 24 h — never silently show yesterday's number as today's.
- A prominent "Submit today's price" action. The board is only as good as the submissions; crowd-sourcing is the product.
- No chart in v1. A 7-day sparkline is a phase-2 nicety, and per the design system charts stay off the worker daily path.

**Honesty rule for the UI copy:** this is a crowd-sourced indicative price, not a quote. Say that once, plainly, on the screen. Farmers make selling decisions on this; overstating its authority is a real-world harm, not a legal one.

---

## 7. Regulatory alerts

- Items classified `regulation` (or `disease` with an outbreak flag) enter `status = 'pending_review'`.
- An admin screen lists pending items; approving sets `published` and enqueues a push.
- Push copy: headline + source name only. No summary in the notification — the farmer taps through.
- Targeting v1: all users. Phase 2: by farm state, once regions are reliable.
- Tie into `banned-substances`: if an item mentions a substance in `banned_substances`, tag it and cross-link to that screen. This is the highest-value integration in the whole feature and worth doing in v1.

---

## 8. Source shortlist

Feed URLs must be **verified at implementation time** — they change, and an unverified URL silently yields an empty feed.

**Government / institutional (activate first — lowest risk, highest trust):**

| Source | What | Notes |
|---|---|---|
| MPEDA | Export policy, production data, notifications | Marine Products Export Development Authority — the anchor source for Indian shrimp |
| Coastal Aquaculture Authority (CAA) | Farm registration, regulation, banned inputs | Directly actionable for farmers |
| NFDB | Schemes, subsidies, advisories | |
| DAHD / Dept. of Fisheries | National policy | |
| ICAR-CIBA | Research, advisories, disease | Central Institute of Brackishwater Aquaculture |
| NaCSA | Farmer-society level guidance | |
| FAO GLOBEFISH | International shrimp market reports | Public-interest, well-suited to summarise |

**Trade press (require the §2.7 permission email before activating):**

| Source | Feed |
|---|---|
| Undercurrent News | Confirmed feeds by species and topic, pattern `https://www.undercurrentnews.com/category/[topic]/feed/` — including shrimp and prices |
| The Fish Site | Aquaculture-focused, covers India specifically |
| SeafoodSource | Trade and market news |
| Aquaculture Alliance / GSA | Standards, certification, disease |
| World Aquaculture Society | Research-adjacent |

**Relevance filter is mandatory.** Most of these feeds are majority salmon and whitefish. Without a scoring filter (shrimp/vannamei/penaeus/India/Andhra/aquaculture keyword weighting, threshold ~40/100), the farmer's feed fills with Norwegian salmon news and the feature dies of irrelevance.

---

## 9. Workstreams

One issue, one branch, one PR each. Branch from `development`.

| ID | Title | Depends on |
|---|---|---|
| **N1** | Extend `news_articles` schema + `news_sources` + `news_article_translations`; add pagination to `findAll`; deprecate `content` | — |
| **N2** | Ingestion pipeline: fetch → normalize → relevance → dedupe → persist (no LLM yet, `status = needs_summary`) | N1 |
| **N3** | Summarization + classification step; body-discard assertion | N2 |
| **N4** | Moderation queue + admin approve/reject endpoints | N1 |
| **N5** | Frontend: extend `NewsListScreen` / `NewsDetailScreen` — source attribution, external link-out, offline cache, category chips from §4 | N1 |
| **N6** | `PriceBoardScreen` + `/india/price-board` + outlier rejection + submit throttle | — (independent, can run in parallel) |
| **N7** | Regulatory alerts: push on approval, banned-substance cross-link | N4, N5 |
| **N8** | Translation backfill job + `locale` query param wiring | N1, N3 (deferred past v1) |

**Suggested order:** N1 → N2 → N3 → N5 (a working English feed), with N6 in parallel since it touches nothing the others touch. Then N4 → N7. N8 when you decide to turn languages on.

---

## 10. Offline behaviour

The app is offline-tolerant and `AGENTS.md` treats that as mandatory. For news, which is read-only:

- Cache the last 50 published items (headline, summary, source, category, date, URL) in AsyncStorage on every successful fetch.
- Offline: render from cache with the `cloud-off-outline` banner and a "Last updated <relative time>" line. Never an empty state when a cache exists.
- Link-out taps while offline: a plain toast saying the article needs a connection. Do not open a dead browser tab.
- The price board caches the same way and **must** show its staleness banner when serving cached numbers.

Do not use `recordSync.ts` here — that's for queued writes. Price submissions, however, **should** go through it, since a farmer may enter a price pond-side with no signal.

---

## 11. Scheduling and failure modes

- `@nestjs/schedule` cron, hourly, staggered per source. Redis lock per source so two dynos don't double-fetch.
- Per-source timeout 10 s, 3 retries with backoff, then record `last_error` and continue. **One dead feed must never fail the run.**
- Log per run: items fetched / filtered out / deduped / persisted / failed. Without this you cannot tell "the feed is quiet" from "the parser broke".
- Cap: 200 items per run. A misconfigured feed should not insert 10,000 rows.
- Summarization cost is trivial at this volume (tens of items/day), but cap spend per run anyway and alert on breach.

---

## 12. Testing

- **Unit:** relevance scorer (shrimp item passes, salmon item fails), dedupe hash (same story from two outlets collapses), classifier, outlier rejection, median calculation, English fallback when a locale row is absent.
- **Fixtures:** commit two or three real RSS XML samples to `src/news/__fixtures__/` and parse those. Never hit the network in tests.
- **Contract:** `GET /news` returns paginated, `published`-only, newest first; `GET /news?locale=te` returns English while translations are empty.
- **Guard test:** a non-admin cannot POST/PATCH/DELETE news or approve a pending item.
- **Regression test for §2.1:** assert the persisted row's body/`content` is null for every ingested item. This is the one that stops a future refactor from quietly reintroducing legal exposure.
- Frontend: list renders offline from cache; item tap opens external URL; stale price board shows the warning banner.

---

## 13. Open decisions for the human

1. **Who approves regulatory items, and within what SLA?** An approval queue nobody watches makes the alert feature worse than not having it.
2. **In-app browser or system browser** for link-outs? In-app keeps the session; system browser is a clearer signal that the content is someone else's.
3. **Who sends the permission emails** in §2.7, and does a source stay dark until a reply arrives? (Recommended: government sources live immediately, trade press dark until answered.)
4. **Price board regions** — is the existing free-text `region` on `price_feeds` good enough, or does it need a controlled list before farmers see aggregates? Free text will fragment ("Nellore" vs "AP-Nellore") and break the median.
5. **Translation trigger** — what volume or user signal turns N8 on?

---

## 14. Summary

| Item | Status |
|---|---|
| Price storage + count-band pricing | **Already built** in `src/india/` — reuse |
| News CRUD + admin gating | **Already built**, needs schema extension and pagination |
| News list/detail screens | **Already built**, need attribution + link-out + cache |
| Cron, HTTP, Redis, push | **Already available** as dependencies |
| RSS parser | One new dependency |
| Ingestion, dedupe, relevance, summarization | New — N2/N3 |
| Moderation queue | New — N4 |
| Price board UI + trust layer | New — N6 |
| Translations | Schema now, data later — N8 |
