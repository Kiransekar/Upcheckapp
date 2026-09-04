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
export type NotificationRoute =
    | {
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
    | {
          // RootNavigator:160 declares `FarmMembers: { farmId: string; farmName?: string }`.
          screen: 'FarmMembers';
          params: { farmId: string };
      }
    | {
          // RootNavigator:249 declares `LeaveRequests: { farmId: string; farmName?: string }`.
          screen: 'LeaveRequests';
          params: { farmId: string };
      };

export function routeForNotification(data: unknown): NotificationRoute | null {
    if (!data || typeof data !== 'object') return null;
    const { type, reportId, farmId } = data as {
        type?: unknown;
        reportId?: unknown;
        farmId?: unknown;
    };

    if (type === 'feedback_reply' && typeof reportId === 'string' && reportId.length > 0) {
        return { screen: 'FeedbackDetail', params: { id: reportId } };
    }

    if (type === 'pending_join' && typeof farmId === 'string' && farmId.length > 0) {
        return { screen: 'FarmMembers', params: { farmId } };
    }

    if (type === 'leave_request' && typeof farmId === 'string' && farmId.length > 0) {
        return { screen: 'LeaveRequests', params: { farmId } };
    }

    return null;
}
