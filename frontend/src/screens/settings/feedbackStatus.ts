import { theme } from '../../theme';
import type { FeedbackStatus } from '../../api/feedback';

/**
 * Colour for a report's status dot.
 *
 * Severity, not decoration: grey until a human has looked at it, blue while
 * somebody is on it, green once it is finished. `closed` stays grey because
 * "we are not doing this" is an ending, not a success.
 */
export const statusTone = (status: FeedbackStatus): string => {
    const c = theme.roles.light;
    switch (status) {
        case 'seen':
            return c.warningText;
        case 'in_review':
            return c.infoText;
        case 'done':
            return c.successText;
        case 'closed':
            return c.textDisabled;
        case 'new':
        default:
            return c.textTertiary;
    }
};
