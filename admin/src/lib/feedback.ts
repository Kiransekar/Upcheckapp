import 'server-only';

/**
 * The only place this app talks to the Upcheck API.
 *
 * `server-only` is the enforcement, not a convention: importing this file from
 * a Client Component is a build error, so ADMIN_API_KEY cannot end up in a
 * browser bundle by accident. Every export here runs on the server — Server
 * Components and Server Actions.
 */

export type FeedbackStatus = 'new' | 'seen' | 'in_review' | 'done' | 'closed';

export type FeedbackCategory = 'problem' | 'confusing' | 'suggestion' | 'other';

/** Keep in step with backend/src/feedback/feedback-status.ts. */
export const STATUSES: FeedbackStatus[] = ['new', 'seen', 'in_review', 'done', 'closed'];

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
    new: 'New',
    seen: 'Seen',
    in_review: 'In review',
    done: 'Done',
    closed: 'Closed',
};

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
    problem: 'Something is wrong',
    confusing: 'Something is confusing',
    suggestion: 'Idea',
    other: 'Other',
};

export interface FeedbackReport {
    id: string;
    userId: string;
    farmId: string | null;
    category: FeedbackCategory;
    subject: string | null;
    message: string;
    attachmentPaths: string[];
    attachmentUrls: string[];
    status: FeedbackStatus;
    adminResponse: string | null;
    respondedAt: string | null;
    respondedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Carries the HTTP status so the page can tell refused from unreachable. */
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
        // Fail loudly at request time rather than rendering an empty inbox that
        // looks like "no farmer has ever reported anything".
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
        // A support inbox that shows yesterday's statuses is worse than useless.
        cache: 'no-store',
    });
    if (!res.ok) {
        // Say which end refused, and quote the API's own words.
        //
        // A 401 was reported as "could not reach the Upcheck API", which sent
        // someone to check UPCHECK_API_URL when the URL was perfectly fine —
        // the request had arrived and been turned away. The backend already
        // distinguishes the two cases it cares about ("Admin API is not
        // configured" when ADMIN_API_KEY is unset on ITS side, "Invalid admin
        // key" when the two halves disagree), and that sentence is the whole
        // diagnosis. Passing it through beats paraphrasing it into something
        // vaguer.
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
    return res.json() as Promise<T>;
}

export function listReports(filter: {
    status?: string;
    category?: string;
}): Promise<FeedbackReport[]> {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.category) params.set('category', filter.category);
    params.set('limit', '200');
    return call<FeedbackReport[]>(`/admin/feedback?${params}`);
}

export function getReport(id: string): Promise<FeedbackReport> {
    return call<FeedbackReport>(`/admin/feedback/${id}`);
}

export function updateReport(
    id: string,
    body: { status?: string; adminResponse?: string; respondedBy?: string },
): Promise<FeedbackReport> {
    return call<FeedbackReport>(`/admin/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

/** What a row shows when the farmer did not write a title. */
export const headline = (r: FeedbackReport): string =>
    r.subject?.trim() || r.message.trim().split('\n')[0].slice(0, 100);

export const formatWhen = (iso: string): string =>
    new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
