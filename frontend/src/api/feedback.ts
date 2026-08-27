import apiClient from './client';

/**
 * Farmer feedback — a direct line to the team.
 *
 * Keep FeedbackStatus and FeedbackCategory in step with
 * `backend/src/feedback/feedback-status.ts`; that file documents what each
 * status means.
 */
export type FeedbackStatus = 'new' | 'seen' | 'in_review' | 'done' | 'closed';

export type FeedbackCategory = 'problem' | 'confusing' | 'suggestion' | 'other';

export interface FeedbackReport {
    id: string;
    userId: string;
    farmId: string | null;
    category: FeedbackCategory;
    subject: string | null;
    message: string;
    attachmentPaths: string[];
    /** Signed, short-lived. Empty on list reads — only the detail read signs them. */
    attachmentUrls: string[];
    status: FeedbackStatus;
    adminResponse: string | null;
    respondedAt: string | null;
    respondedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateFeedbackDto {
    category: FeedbackCategory;
    subject?: string;
    message: string;
    farmId?: string;
    attachmentPaths?: string[];
}

/** The picked image, as much of it as `FormData` on React Native needs. */
export interface PickedImage {
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
}

export const feedbackApi = {
    /**
     * Upload one image and get back its storage path.
     *
     * One image per request on purpose: on a rural connection a failed photo
     * should cost the farmer that photo, not the report they just typed.
     *
     * React Native's FormData accepts `{ uri, name, type }` in place of a Blob
     * and streams the file off disk — this is why the picker's local `file://`
     * URI can be posted without reading it into JS memory first.
     */
    uploadAttachment: (image: PickedImage) => {
        const form = new FormData();
        const type = image.mimeType || 'image/jpeg';
        form.append('file', {
            uri: image.uri,
            name: image.fileName || `photo.${type.split('/')[1] ?? 'jpg'}`,
            type,
        } as any);
        return apiClient.post<{ path: string }>('/feedback/attachment', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            // Photos over a rural connection outlive the client's 15s default.
            timeout: 60000,
        });
    },

    create: (dto: CreateFeedbackDto) => apiClient.post<FeedbackReport>('/feedback', dto),

    mine: () => apiClient.get<FeedbackReport[]>('/feedback'),

    one: (id: string) => apiClient.get<FeedbackReport>(`/feedback/${id}`),
};
