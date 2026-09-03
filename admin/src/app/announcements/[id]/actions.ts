'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
    deleteAnnouncement,
    parseAnnouncementForm,
    publishAnnouncement,
    unpublishAnnouncement,
    updateAnnouncement,
} from '@/lib/announcements';

// Ids are bound on the server (see [id]/page.tsx), so the browser cannot
// change which announcement an action touches on submit.

export async function saveAction(id: string, formData: FormData) {
    await updateAnnouncement(id, parseAnnouncementForm(formData));
    revalidatePath(`/announcements/${id}`);
    revalidatePath('/announcements');
}

export async function publishAction(id: string) {
    await publishAnnouncement(id);
    revalidatePath(`/announcements/${id}`);
    revalidatePath('/announcements');
}

export async function unpublishAction(id: string) {
    await unpublishAnnouncement(id);
    revalidatePath(`/announcements/${id}`);
    revalidatePath('/announcements');
}

export async function deleteAction(id: string) {
    await deleteAnnouncement(id);
    revalidatePath('/announcements');
    redirect('/announcements');
}
