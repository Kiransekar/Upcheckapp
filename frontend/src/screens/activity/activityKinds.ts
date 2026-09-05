import type { IconName } from '../../components/ui/Icon';
import {
    ACTIVITY_KINDS,
    FINANCIAL_ACTIVITY_KINDS,
    type ActivityKind,
} from '../../api/activity';

/**
 * One glyph per activity kind, shared by the timeline and the pond dashboard's
 * "today" block so the same event never wears two different icons.
 *
 * Material Symbols (components/ui/Icon), not MaterialCommunityIcons — both
 * screens are on the redesigned set.
 */
export const ACTIVITY_ICON: Record<ActivityKind, IconName> = {
    water_quality: 'water_drop',
    feed: 'grain',
    sampling: 'scale',
    measurement: 'show_chart',
    harvest: 'set_meal',
    mortality: 'warning',
    tray_check: 'checklist',
    chemical: 'science',
    treatment: 'science',
    microbiology: 'science',
    plankton: 'grass',
    disease: 'warning',
    transaction: 'currency_rupee',
    expense: 'receipt_long',
};

/**
 * The kinds this user can actually be shown.
 *
 * The server drops `transaction` and `expense` for a caller without
 * VIEW_FINANCIALS, so offering them as filters would hand a worker two chips
 * that always answer "nothing here".
 */
export const visibleActivityKinds = (canViewFinancials: boolean): ActivityKind[] =>
    canViewFinancials
        ? [...ACTIVITY_KINDS]
        : ACTIVITY_KINDS.filter((k) => !FINANCIAL_ACTIVITY_KINDS.includes(k));

/** i18n key for a kind's label. Kept here so both screens name it the same way. */
export const activityKindKey = (kind: ActivityKind): string => `activity.kind_${kind}`;
