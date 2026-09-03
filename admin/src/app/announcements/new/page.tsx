import Link from 'next/link';
import AnnouncementForm from '../announcement-form';
import { createAction } from './actions';

export default function NewAnnouncementPage() {
    return (
        <>
            <p>
                <Link href="/announcements">← Announcements</Link>
            </p>
            <h1>New announcement</h1>
            <p className="sub">
                English is required. Add other languages now or come back later — a
                translation left blank falls back to English in the app.
            </p>
            <AnnouncementForm action={createAction} submitLabel="Create" />
        </>
    );
}
