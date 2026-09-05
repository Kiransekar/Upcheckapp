'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAnnouncement, parseAnnouncementForm } from '@/lib/announcements';

export async function createAction(formData: FormData) {
    const announcement = await createAnnouncement(parseAnnouncementForm(formData));
    revalidatePath('/announcements');
    redirect(`/announcements/${announcement.id}`);
}
