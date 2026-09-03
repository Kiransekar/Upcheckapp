'use client';

import { useState } from 'react';
import { LOCALES, LOCALE_LABEL, CATEGORY_LABEL, type AnnouncementCategory, type Locale } from '@/lib/announcement-locales';
import type { Announcement } from '@/lib/announcements';

/**
 * Create/edit form for one announcement, shared by /announcements/new and
 * /announcements/[id]. Client Component only because the preview needs to
 * react to typing — submission still goes through a real server action
 * (`action`), the same progressive-enhancement shape as the feedback pages.
 */
export default function AnnouncementForm({
    initial,
    action,
    submitLabel,
}: {
    initial?: Announcement;
    action: (formData: FormData) => void | Promise<void>;
    submitLabel: string;
}) {
    const [category, setCategory] = useState<AnnouncementCategory>(
        initial?.category ?? 'feature',
    );
    const [fields, setFields] = useState<Record<string, { title: string; body: string }>>(
        () => {
            const map: Record<string, { title: string; body: string }> = {
                en: { title: initial?.title ?? '', body: initial?.body ?? '' },
            };
            for (const locale of LOCALES) {
                if (locale === 'en') continue;
                const t = initial?.translations.find((tr) => tr.locale === locale);
                map[locale] = { title: t?.title ?? '', body: t?.body ?? '' };
            }
            return map;
        },
    );
    const [previewLocale, setPreviewLocale] = useState<Locale>('en');

    const setField = (locale: string, part: 'title' | 'body', value: string) =>
        setFields((prev) => ({ ...prev, [locale]: { ...prev[locale], [part]: value } }));

    // What the farmer would actually see: this locale if it has content, else
    // English — the same rule AnnouncementsService applies server-side.
    const shown =
        fields[previewLocale]?.title || fields[previewLocale]?.body
            ? fields[previewLocale]
            : fields.en;

    return (
        <div className="announcement-editor">
            <form action={action} className="editor">
                <div>
                    <label htmlFor="key">Key (stable id, e.g. 2026-09-feed-advisor)</label>
                    <input
                        id="key"
                        name="key"
                        type="text"
                        defaultValue={initial?.key ?? ''}
                        maxLength={64}
                        required
                    />
                </div>

                <div className="row">
                    <div>
                        <label htmlFor="category">Category</label>
                        <select
                            id="category"
                            name="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                        >
                            {(Object.keys(CATEGORY_LABEL) as AnnouncementCategory[]).map((c) => (
                                <option key={c} value={c}>
                                    {CATEGORY_LABEL[c]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="priority">
                            Priority (lower shows first among live announcements)
                        </label>
                        <input
                            id="priority"
                            name="priority"
                            type="number"
                            defaultValue={initial?.priority ?? 0}
                        />
                    </div>
                </div>

                <h2>Text, per language</h2>
                {LOCALES.map((locale) => (
                    <fieldset key={locale} className="locale">
                        <legend>
                            {LOCALE_LABEL[locale]}
                            {locale === 'en' && <span className="required"> — required</span>}
                        </legend>
                        <div>
                            <label htmlFor={`title_${locale}`}>Title</label>
                            <input
                                id={`title_${locale}`}
                                name={`title_${locale}`}
                                type="text"
                                maxLength={200}
                                defaultValue={fields[locale]?.title ?? ''}
                                required={locale === 'en'}
                                onChange={(e) => setField(locale, 'title', e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor={`body_${locale}`}>Body</label>
                            <textarea
                                id={`body_${locale}`}
                                name={`body_${locale}`}
                                maxLength={2000}
                                defaultValue={fields[locale]?.body ?? ''}
                                required={locale === 'en'}
                                onChange={(e) => setField(locale, 'body', e.target.value)}
                            />
                        </div>
                    </fieldset>
                ))}

                <button type="submit">{submitLabel}</button>
            </form>

            <aside className="preview">
                <h2>Preview</h2>
                <div className="preview-locales">
                    {LOCALES.map((locale) => (
                        <button
                            key={locale}
                            type="button"
                            data-active={previewLocale === locale}
                            onClick={() => setPreviewLocale(locale)}
                        >
                            {LOCALE_LABEL[locale]}
                        </button>
                    ))}
                </div>
                <div className="card">
                    <span className="pill" data-category={category}>
                        {CATEGORY_LABEL[category]}
                    </span>
                    <strong>{shown.title || <em>(no title yet)</em>}</strong>
                    <p>{shown.body || <em>(no body yet)</em>}</p>
                    {previewLocale !== 'en' &&
                        !fields[previewLocale]?.title &&
                        !fields[previewLocale]?.body && (
                            <small className="fallback-note">
                                No {LOCALE_LABEL[previewLocale]} text yet — the app falls back to
                                English, shown here.
                            </small>
                        )}
                </div>
            </aside>
        </div>
    );
}
