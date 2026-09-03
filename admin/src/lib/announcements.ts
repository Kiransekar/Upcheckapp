import 'server-only';

/**
 * The only place this app talks to the announcements API. `server-only` is
 * the enforcement, not a convention — see `feedback.ts` for why. The plain
 * locale/category vocabulary lives in `announcement-locales.ts` instead,
 * which carries no API key and so is safe for the client-side form to
 * import directly.
 */

export {
    LOCALES,
    LOCALE_LABEL,
    CATEGORY_LABEL,
    type AnnouncementCategory,
    type Locale,
} from './announcement-locales';
import { LOCALES, type AnnouncementCategory } from './announcement-locales';

export interface AnnouncementTranslation {
    locale: string;
    title: string | null;
    body: string | null;
}

export interface Announcement {
    id: string;
    key: string;
    category: AnnouncementCategory;
    title: string;
    body: string;
    isPublished: boolean;
    publishedAt: string | null;
    priority: number;
    createdAt: string;
    updatedAt: string;
    translations: AnnouncementTranslation[];
}

export interface SaveAnnouncementInput {
    key: string;
    category: string;
    title: string;
    body: string;
    priority: number;
    translations: { locale: string; title?: string; body?: string }[];
}

/** Carries the HTTP status so a page can tell refused from unreachable. */
export class ApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'ApiError';
    }
}

function config() {
    const baseUrl = process.env.UPCHECK_API_URL;
    const key = process.env.ADMIN_API_KEY;
    if (!baseUrl || !key) {
        throw new Error(
            'UPCHECK_API_URL and ADMIN_API_KEY must both be set on this deployment.',
        );
    }
    return { baseUrl: baseUrl.replace(/\/$/, ''), key };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const { baseUrl, key } = config();
    const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            'content-type': 'application/json',
            'x-admin-key': key,
            ...(init?.headers ?? {}),
        },
        // Staff must see the state they are about to edit, not a cached one.
        cache: 'no-store',
    });
    if (!res.ok) {
        const detail = await res.text().then(
            (body) => {
                try {
                    return (JSON.parse(body) as { message?: string }).message ?? '';
                } catch {
                    return body.slice(0, 200);
                }
            },
            () => '',
        );
        throw new ApiError(
            `${init?.method ?? 'GET'} ${path} failed: ${res.status}` +
                (detail ? ` — ${detail}` : ''),
            res.status,
        );
    }
    // DELETE returns no body.
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export function listAnnouncements(): Promise<Announcement[]> {
    return call<Announcement[]>('/admin/announcements');
}

export function getAnnouncement(id: string): Promise<Announcement> {
    return call<Announcement>(`/admin/announcements/${id}`);
}

export function createAnnouncement(body: SaveAnnouncementInput): Promise<Announcement> {
    return call<Announcement>('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function updateAnnouncement(
    id: string,
    body: SaveAnnouncementInput,
): Promise<Announcement> {
    return call<Announcement>(`/admin/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export function publishAnnouncement(id: string): Promise<Announcement> {
    return call<Announcement>(`/admin/announcements/${id}/publish`, { method: 'PATCH' });
}

export function unpublishAnnouncement(id: string): Promise<Announcement> {
    return call<Announcement>(`/admin/announcements/${id}/unpublish`, { method: 'PATCH' });
}

export function deleteAnnouncement(id: string): Promise<void> {
    return call<void>(`/admin/announcements/${id}`, { method: 'DELETE' });
}

/**
 * Turn the shared create/edit form's FormData into the API payload. One
 * parser for both /announcements/new and /announcements/[id] actions, since
 * `announcement-form.tsx` renders the same field names for both.
 */
export function parseAnnouncementForm(formData: FormData): SaveAnnouncementInput {
    const translations: { locale: string; title?: string; body?: string }[] = [];
    for (const locale of LOCALES) {
        if (locale === 'en') continue;
        const title = String(formData.get(`title_${locale}`) ?? '').trim();
        const body = String(formData.get(`body_${locale}`) ?? '').trim();
        if (title || body) translations.push({ locale, title, body });
    }
    return {
        key: String(formData.get('key') ?? '').trim(),
        category: String(formData.get('category') ?? ''),
        title: String(formData.get('title_en') ?? '').trim(),
        body: String(formData.get('body_en') ?? '').trim(),
        priority: Number(formData.get('priority') ?? 0) || 0,
        translations,
    };
}

export const formatWhen = (iso: string): string =>
    new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
