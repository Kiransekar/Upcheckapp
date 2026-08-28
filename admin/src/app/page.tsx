import Link from 'next/link';
import {
    ApiError,
    listReports,
    headline,
    formatWhen,
    STATUSES,
    STATUS_LABEL,
    CATEGORY_LABEL,
} from '@/lib/feedback';

/**
 * The inbox.
 *
 * A Server Component: the fetch (and therefore ADMIN_API_KEY) happens on the
 * server and only rendered HTML reaches the staffer's browser. Filters are
 * plain links with a query string rather than client state — it makes a
 * filtered inbox a shareable URL, and there is no JavaScript to ship.
 */
export const dynamic = 'force-dynamic';

export default async function InboxPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>;
}) {
    const { status } = await searchParams;

    let reports;
    try {
        reports = await listReports({ status });
    } catch (err) {
        // Never render a failed read as an empty inbox — that reads as "no
        // farmer has ever reported anything" and the reports go unanswered.
        //
        // Point at the right end. A 401 is the API answering, not failing to
        // answer, so telling someone to check UPCHECK_API_URL sends them to
        // audit a setting that was never wrong. Refused and unreachable are
        // different faults with different fixes.
        const refused = err instanceof ApiError && err.status === 401;
        return (
            <>
                <h1>Feedback</h1>
                <p className="error">
                    {refused ? (
                        <>
                            The Upcheck API refused this dashboard. Set <code>ADMIN_API_KEY</code>{' '}
                            on the backend (Render) and here, to the same value — the message
                            below says which side is unhappy.
                        </>
                    ) : (
                        <>
                            Could not reach the Upcheck API. Check <code>UPCHECK_API_URL</code> on
                            this deployment.
                        </>
                    )}
                    <br />
                    <small>{(err as Error).message}</small>
                </p>
            </>
        );
    }

    return (
        <>
            <h1>Feedback</h1>
            <p className="sub">
                {reports.length} report{reports.length === 1 ? '' : 's'}
                {status ? ` · ${STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}` : ''}
            </p>

            <div className="filters">
                <Link href="/" data-active={!status}>
                    All
                </Link>
                {STATUSES.map((s) => (
                    <Link key={s} href={`/?status=${s}`} data-active={status === s}>
                        {STATUS_LABEL[s]}
                    </Link>
                ))}
            </div>

            {reports.length === 0 ? (
                <p className="empty">Nothing here.</p>
            ) : (
                reports.map((r) => (
                    <Link key={r.id} href={`/reports/${r.id}`} className="row">
                        <div className="grow">
                            <strong>{headline(r)}</strong>
                            <small>
                                {CATEGORY_LABEL[r.category] ?? r.category} · {formatWhen(r.createdAt)}
                                {r.attachmentPaths.length > 0 && ` · ${r.attachmentPaths.length} photo(s)`}
                                {r.adminResponse && ' · replied'}
                            </small>
                        </div>
                        <span className="pill" data-status={r.status}>
                            {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                    </Link>
                ))
            )}
        </>
    );
}
