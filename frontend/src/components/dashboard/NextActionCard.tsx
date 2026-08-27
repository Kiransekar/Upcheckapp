import React from 'react';
import { useTranslation } from 'react-i18next';
import { HeroCard, DO_FIRST_BG, DO_FIRST_ON } from './HeroCard';
import type { BriefingItem, AlertSeverity } from '../../api/alertCenter';

/**
 * "Do this first" — the single most urgent thing across every farm, stated as
 * one action.
 *
 * This is the centrepiece of the redesign (artboard 1b). Home previously opened
 * on a list of alerts, which asks the farmer to untangle severity, pond and
 * farm before they can act. The design's answer is to do that ranking for them
 * and put ONE action at the top, with the rest demoted to a "Then" list.
 *
 * The card itself is HeroCard, shared with the first-run setup step that fills
 * the same slot before there is anything to raise an alert about.
 */

/** Re-exported: several screens colour against the hero's palette. */
export { DO_FIRST_BG, DO_FIRST_ON };

/** Rank order: a critical anywhere outranks a watch anywhere. */
const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 3, watch: 2, info: 1 };

export interface NextActionCardProps {
    /** Alerts across every farm the user can see, unranked. */
    items: BriefingItem[];
    /** Resolve a pond id to its farm's name — each item carries its farm. */
    farmNameForPond?: (pondId: string | null) => string | undefined;
    /** Primary action: the farmer says they have done it. */
    onDone: (item: BriefingItem) => void;
    /** Secondary: not now. The card then shows the next one. */
    onLater: (item: BriefingItem) => void;
}

/** Most severe first; ties broken by how many alerts back it. */
export const rankActions = (items: BriefingItem[]): BriefingItem[] =>
    [...items].sort(
        (a, b) =>
            SEVERITY_RANK[b.topSeverity] - SEVERITY_RANK[a.topSeverity] ||
            b.alertCount - a.alertCount,
    );

export const NextActionCard: React.FC<NextActionCardProps> = ({
    items,
    farmNameForPond,
    onDone,
    onLater,
}) => {
    const { t } = useTranslation();
    const ranked = rankActions(items);
    const item = ranked[0];

    // Nothing urgent is a RESULT, not an empty state — the caller decides
    // whether to render a calm "all clear" or a setup step instead.
    if (!item) return null;

    return (
        <HeroCard
            eyebrow={t('home.doThisFirst')}
            counter={ranked.length > 1 ? t('home.oneOfN', { n: ranked.length }) : null}
            farm={farmNameForPond?.(item.pondId)}
            headline={item.topTitle}
            // `steps[0]` is the engine's plain-language explanation of why this
            // matters — the number that triggered it, not a restated title.
            why={item.steps?.[0]}
            primaryLabel={t('home.markDone')}
            onPrimary={() => onDone(item)}
            secondaryLabel={t('home.later')}
            onSecondary={() => onLater(item)}
        />
    );
};

export default NextActionCard;
