import {
  classify,
  dedupeHash,
  initialStatus,
  normalizeTitle,
  RELEVANCE_THRESHOLD,
  scoreRelevance,
} from './feed-rules';

const passes = (text: string, weight?: number) =>
  scoreRelevance(text, weight) >= RELEVANCE_THRESHOLD;

describe('scoreRelevance', () => {
  it('passes an Indian shrimp story', () => {
    expect(
      passes('Vannamei shrimp prices firm up in Nellore as demand returns'),
    ).toBe(true);
  });

  it('rejects Norwegian salmon, which is most of what these feeds carry', () => {
    expect(passes('Norwegian salmon prices climb to a Q3 record')).toBe(false);
  });

  it('rejects a salmon story that merely mentions India', () => {
    // Geography alone must not carry an item about a species our farmers do
    // not raise — this is the exact failure that fills the feed with noise.
    expect(passes('Norway steps up salmon exports to India')).toBe(false);
  });

  it('passes an institutional notice that names no species, on source weight', () => {
    const title = 'Registration of aquaculture units under the Authority';
    expect(passes(title, 50)).toBe(false);
    expect(passes(title, 90)).toBe(true);
  });

  it('stays inside 0–100', () => {
    const loud = 'shrimp prawn vannamei penaeus india andhra aquaculture pond';
    expect(scoreRelevance(loud, 100)).toBeLessThanOrEqual(100);
    expect(scoreRelevance('salmon salmon salmon trout')).toBe(0);
  });

  // Live titles pulled straight off MPEDA's feed (weight 90, our only active
  // source) — this is the exact mix that put a recipe above a disease alert.
  describe('the MPEDA feed, verbatim (recipes must lose, notices must not)', () => {
    it.each([
      'Shrimp Ghee Pepper Roast',
      'Shrimps Newburg',
      'Sweet Chilli Shrimp Skewers',
    ])('filters out %s', (title) => {
      expect(scoreRelevance(title, 90)).toBeLessThan(RELEVANCE_THRESHOLD);
    });

    it.each([
      'MPEDA Quality Control lab Develops protocol to test free formaldehyde',
      'MPEDA extends microbiology lab testing facility to aqua farmers',
      'Cabinet approves Pradhan Mantri Matsya Sampada Yojana',
    ])('keeps %s', (title) => {
      expect(scoreRelevance(title, 90)).toBeGreaterThanOrEqual(
        RELEVANCE_THRESHOLD,
      );
    });
  });
});

describe('classify', () => {
  it.each([
    ['CAA notification bans a new input from registered farms', 'regulation'],
    ['White spot outbreak reported across Godavari ponds', 'disease'],
    ['Farmgate prices for 30-count fall on weak demand', 'market'],
    ['Shrimp export consignments cleared faster under new customs rule', 'trade'],
    ['ICAR study finds improved feed conversion in trials', 'research'],
  ])('reads %s as %s', (title, expected) => {
    expect(classify(title)).toBe(expected);
  });

  it('falls back to the source default when nothing matches', () => {
    expect(classify('A quiet week on the coast', 'market')).toBe('market');
  });

  it('falls back to production, never to something that could trigger a push', () => {
    expect(classify('A quiet week on the coast')).toBe('production');
    expect(classify('A quiet week', 'nonsense')).toBe('production');
  });
});

describe('dedupeHash', () => {
  const day = '2026-08-20T06:00:00Z';

  it('collapses the same story from two outlets', () => {
    expect(dedupeHash('MPEDA Raises Shrimp Export Target!', day)).toBe(
      dedupeHash('mpeda  raises shrimp export target', '2026-08-20T18:30:00Z'),
    );
  });

  it('keeps a genuine follow-up on another day distinct', () => {
    expect(dedupeHash('MPEDA raises target', '2026-08-20T06:00:00Z')).not.toBe(
      dedupeHash('MPEDA raises target', '2026-08-27T06:00:00Z'),
    );
  });

  it('does not throw on an unparseable date', () => {
    expect(dedupeHash('A headline', 'not a date')).toHaveLength(64);
  });
});

describe('normalizeTitle', () => {
  it('strips case, punctuation and curly quotes', () => {
    expect(normalizeTitle('“Shrimp” prices — up 12%!')).toBe(
      'shrimp prices up 12',
    );
  });
});

describe('initialStatus', () => {
  it('holds regulation and disease for a human', () => {
    expect(initialStatus('regulation')).toBe('pending_review');
    expect(initialStatus('disease')).toBe('pending_review');
  });

  it('publishes the rest', () => {
    expect(initialStatus('market')).toBe('published');
    expect(initialStatus('research')).toBe('published');
  });
});
