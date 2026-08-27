'use server';

import { revalidatePath } from 'next/cache';
import { updateReport } from '@/lib/feedback';

/**
 * Save the status and the response together.
 *
 * One action, one form: a staffer who writes a reply and forgets to press a
 * second "change status" button is the most likely way this tool goes wrong,
 * so the two live on the same submit. (The backend also refuses to leave a
 * replied-to report at `new` — see FeedbackService.update.)
 *
 * A Server Action, so ADMIN_API_KEY stays on the server. The value is read from
 * `@/lib/feedback`, which is `server-only`.
 */
export async function saveReport(id: string, formData: FormData) {
    const status = String(formData.get('status') ?? '');
    const adminResponse = String(formData.get('adminResponse') ?? '');
    const respondedBy = String(formData.get('respondedBy') ?? '');

    await updateReport(id, { status, adminResponse, respondedBy });

    // Both the detail page and the inbox show this report's status.
    revalidatePath(`/reports/${id}`);
    revalidatePath('/');
}
