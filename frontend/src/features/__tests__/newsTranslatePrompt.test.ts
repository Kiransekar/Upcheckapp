import { buildTranslatePrompt } from '../newsTranslatePrompt';

const article = {
    title: 'Shrimp exports rise 12% in Q2',
    summary: 'Exporters report stronger demand from the US market.',
    sourceName: 'Undercurrent News',
};

// Each locale's own name for its language, in its own script — the prompt
// instruction must name the target language so the model answers in it.
const OWN_LANGUAGE_NAME: Record<string, string> = {
    en: 'English',
    hi: 'हिन्दी',
    bn: 'বাংলা',
    ta: 'தமிழ்',
    te: 'తెలుగు',
    or: 'ଓଡ଼ିଆ',
};

describe('buildTranslatePrompt', () => {
    it.each(Object.keys(OWN_LANGUAGE_NAME))('includes title, summary and source for locale %s', (locale) => {
        const prompt = buildTranslatePrompt(article, locale);
        expect(prompt).toContain(article.title);
        expect(prompt).toContain(article.summary);
        expect(prompt).toContain(article.sourceName);
    });

    it.each(Object.entries(OWN_LANGUAGE_NAME))('names the target language in its own script for locale %s', (locale, name) => {
        const prompt = buildTranslatePrompt(article, locale);
        expect(prompt).toContain(name);
    });

    it('falls back to English for an unknown locale', () => {
        const prompt = buildTranslatePrompt(article, 'zz');
        expect(prompt).toContain('English');
        expect(prompt).toContain(article.title);
    });

    it('handles a missing summary without producing a malformed prompt', () => {
        const prompt = buildTranslatePrompt(
            { title: article.title, sourceName: article.sourceName },
            'hi',
        );
        expect(prompt).toContain(article.title);
        expect(prompt).toContain(article.sourceName);
        expect(prompt).not.toContain('undefined');
        expect(prompt).not.toContain('null');
        // No double-blank-line artifact from the skipped summary line.
        expect(prompt).not.toContain('\n\n\n');
    });

    it('handles a missing summary AND source', () => {
        const prompt = buildTranslatePrompt({ title: article.title }, 'ta');
        expect(prompt).toContain(article.title);
        expect(prompt).not.toContain('undefined');
    });
});
