import Link from 'next/link';
import {
    getReport,
    formatWhen,
    STATUSES,
    STATUS_LABEL,
    CATEGORY_LABEL,
    headline,
} from '@/lib/feedback';
import { saveReport } from './actions';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    let report;
    try {
        report = await getReport(id);
    } catch (err) {
        return (
            <>
                <p>
                    <Link href="/">← Inbox</Link>
                </p>
                <p className="error">Could not load this report. {(err as Error).message}</p>
            </>
        );
    }

    // The action is bound here, on the server, so the id is not something the
    // browser can change on submit.
    const save = saveReport.bind(null, report.id);

    return (
        <>
            <p>
                <Link href="/">← Inbox</Link>
            </p>

            <h1>{headline(report)}</h1>
            <p className="sub">
                {CATEGORY_LABEL[report.category] ?? report.category} · {formatWhen(report.createdAt)}{' '}
                · <span className="pill" data-status={report.status}>{STATUS_LABEL[report.status]}</span>
            </p>

            <h2>What the farmer wrote</h2>
            <div className="message">{report.message}</div>
            <p className="sub">
                <small>
                    user {report.userId}
                    {report.farmId ? ` · farm ${report.farmId}` : ''}
                </small>
            </p>

            {report.attachmentPaths.length > 0 && (
                <>
                    <h2>Photos ({report.attachmentPaths.length})</h2>
                    {report.attachmentUrls.length === 0 ? (
                        <p className="empty">
                            The images could not be signed right now — reload in a moment.
                        </p>
                    ) : (
                        <div className="photos">
                            {/* Plain <img>: these are short-lived signed URLs on a
                                bucket next/image would need configuring for. */}
                            {report.attachmentUrls.map((url, i) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt={`Attachment ${i + 1}`} />
                                </a>
                            ))}
                        </div>
                    )}
                </>
            )}

            <h2>Reply to the farmer</h2>
            <form action={save} className="editor">
                <div>
                    <label htmlFor="status">Status</label>
                    <select id="status" name="status" defaultValue={report.status}>
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="adminResponse">
                        Response — the farmer reads this in the app. Editing it replaces what they
                        see; clearing it removes the reply.
                    </label>
                    <textarea
                        id="adminResponse"
                        name="adminResponse"
                        defaultValue={report.adminResponse ?? ''}
                        placeholder="We found the problem — a fix goes out this week. Thank you for telling us."
                        maxLength={4000}
                    />
                </div>

                <div>
                    <label htmlFor="respondedBy">Your name (shown to the farmer)</label>
                    <input
                        id="respondedBy"
                        name="respondedBy"
                        type="text"
                        defaultValue={report.respondedBy ?? ''}
                        maxLength={120}
                    />
                </div>

                <button type="submit">Save</button>
            </form>

            {report.respondedAt && (
                <p className="sub">
                    <small>
                        Last replied {formatWhen(report.respondedAt)}
                        {report.respondedBy ? ` by ${report.respondedBy}` : ''}
                    </small>
                </p>
            )}
        </>
    );
}
