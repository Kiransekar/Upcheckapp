/**
 * Where a tapped notification should take the farmer — a pure decision, kept
 * separate from navigation so it is testable without a navigator and reusable
 * for both the warm-app listener and the cold-start check.
 *
 * A reminder (`{ tag: 'wq-reminder' | 'chem-reminder', slot }`, see
 * utils/notifications.ts) has no destination of its own — tapping one just
 * opens the app, which is already what happens. Only a payload this function
 * recognises routes anywhere; anything else — including a shape that merely
 * resembles one — is ignored rather than risking a crash on a malformed push.
 */
export interface NotificationRoute {
    screen: 'FeedbackDetail';
    /**
     * The NAVIGATOR's param shape, not the push payload's. RootNavigator:222
     * declares `FeedbackDetail: { id: string }` while the backend sends
     * `reportId`. Passing the payload's name straight through would navigate
     * with a param the screen never reads, landing the farmer on an empty
     * report instead of the reply they tapped — so the translation happens
     * here, once, rather than at each call site.
     */
    params: { id: string };
}

export function routeForNotification(data: unknown): NotificationRoute | null {
    if (!data || typeof data !== 'object') return null;
    const { type, reportId } = data as { type?: unknown; reportId?: unknown };

    if (type === 'feedback_reply' && typeof reportId === 'string' && reportId.length > 0) {
        return { screen: 'FeedbackDetail', params: { id: reportId } };
    }

    return null;
}
