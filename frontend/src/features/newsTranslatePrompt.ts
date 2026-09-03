import en from '../i18n/locales/en';
import hi from '../i18n/locales/hi';
import ta from '../i18n/locales/ta';
import te from '../i18n/locales/te';
import bn from '../i18n/locales/bn';
import or from '../i18n/locales/or';

/**
 * "Translate & explain" prompt builder for a news article.
 *
 * News comes from Undercurrent News / Global Seafood Alliance in English
 * only, but most farmers using Upcheck read Hindi, Bengali, Tamil, Telugu or
 * Odia. There's no in-app translator — instead this builds a prompt, IN the
 * farmer's own app language (not English), asking whatever AI app they
 * already have to translate and explain it. The instruction has to be
 * written in the target language because that's what reliably makes a model
 * answer in that language.
 *
 * The label/prompt strings live in `content.news.translate` of each locale
 * file — the single source of truth also used for the button, toast and
 * fallback modal — rather than being duplicated here.
 */

const LOCALE_CONTENT: Record<string, typeof en> = { en, hi, ta, te, bn, or };

export interface NewsPromptArticle {
    title: string;
    summary?: string | null;
    sourceName?: string | null;
}

export function buildTranslatePrompt(article: NewsPromptArticle, locale: string): string {
    const tpl = (LOCALE_CONTENT[locale] ?? LOCALE_CONTENT.en).content.news.translate.prompt;

    const lines = [tpl.instruction, '', `${tpl.headline}: ${article.title}`];
    if (article.summary) {
        lines.push(`${tpl.summary}: ${article.summary}`);
    }
    if (article.sourceName) {
        lines.push(`${tpl.source}: ${article.sourceName}`);
    }
    lines.push('', tpl.shared);

    return lines.join('\n');
}
