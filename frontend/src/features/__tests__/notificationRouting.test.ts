import { routeForNotification } from '../notificationRouting';

describe('routeForNotification', () => {
    // The payload says `reportId`; the navigator (RootNavigator:222) declares
    // `FeedbackDetail: { id: string }`. This asserts the translation, because
    // passing `reportId` through would navigate with a param the screen never
    // reads and open an empty report.
    it('routes a support reply to the report it answers, in the navigator\'s param shape', () => {
        expect(routeForNotification({ type: 'feedback_reply', reportId: 'r-9' }))
            .toEqual({ screen: 'FeedbackDetail', params: { id: 'r-9' } });
    });

    it('ignores a reminder, which has no destination of its own', () => {
        expect(routeForNotification({ tag: 'wq-reminder', slot: 'morning' })).toBeNull();
    });

    it('ignores an unknown or malformed payload rather than crashing', () => {
        expect(routeForNotification({})).toBeNull();
        expect(routeForNotification({ type: 'feedback_reply' })).toBeNull();
        expect(routeForNotification(null)).toBeNull();
        expect(routeForNotification(undefined)).toBeNull();
        expect(routeForNotification({ type: 'feedback_reply', reportId: 42 })).toBeNull();
    });

    it('routes a pending-join push to the farm team screen', () => {
        expect(routeForNotification({ type: 'pending_join', farmId: 'f1' })).toEqual({
            screen: 'FarmMembers',
            params: { farmId: 'f1' },
        });
    });

    it('routes a leave-request push to the leave screen', () => {
        expect(routeForNotification({ type: 'leave_request', farmId: 'f1', leaveRequestId: 'lr1' })).toEqual({
            screen: 'LeaveRequests',
            params: { farmId: 'f1' },
        });
    });

    it('ignores pending_join / leave_request payloads missing a farmId', () => {
        expect(routeForNotification({ type: 'pending_join' })).toBeNull();
        expect(routeForNotification({ type: 'leave_request' })).toBeNull();
    });
});
