import Link from 'next/link';
import { ApiError, getAnnouncement, formatWhen } from '@/lib/announcements';
import AnnouncementForm from '../announcement-form';
import { saveAction, publishAction, unpublishAction, deleteAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function AnnouncementPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    let announcement;
    try {
        announcement = await getAnnouncement(id);
    } catch (err) {
        return (
            <>
                <p>
                    <Link href="/announcements">← Announcements</Link>
                </p>
                <p className="error">Could not load this announcement. {(err as Error).message}</p>
            </>
        );
    }

    // Bound on the server so the browser cannot redirect these actions at a
    // different id — same shape as reports/[id]/actions.ts.
    const save = saveAction.bind(null, announcement.id);
    const publish = publishAction.bind(null, announcement.id);
    const unpublish = unpublishAction.bind(null, announcement.id);
    const remove = deleteAction.bind(null, announcement.id);

    return (
        <>
            <p>
                <Link href="/announcements">← Announcements</Link>
            </p>

            <div className="page-head">
                <div>
                    <h1>{announcement.title}</h1>
                    <p className="sub">
                        <span className="pill" data-published={announcement.isPublished}>
                            {announcement.isPublished ? 'Published' : 'Draft'}
                        </span>
                        {announcement.publishedAt &&
                            ` · last published ${formatWhen(announcement.publishedAt)}`}
                    </p>
                </div>
                <div className="actions">
                    <form action={announcement.isPublished ? unpublish : publish}>
                        <button type="submit" className={announcement.isPublished ? 'secondary' : ''}>
                            {announcement.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                    </form>
                    <form action={remove}>
                        <button type="submit" className="danger">
                            Delete
                        </button>
                    </form>
                </div>
            </div>

            <AnnouncementForm initial={announcement} action={save} submitLabel="Save" />
        </>
    );
}
