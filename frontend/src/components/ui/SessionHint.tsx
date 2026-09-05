import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { Icon } from './Icon';
import { pondSlotDone, pondFedThisSession, slotAt } from '../../features/logProgress';
import { formatAge } from '../../utils/formatDate';
import type { PondContext } from '../../api/pondContext';
import type { PondWithHealth } from '../../utils/pondHealth';

/**
 * "Logged" / "Fed" — has THIS pond been checked and fed in the current slot.
 *
 * Driven entirely by `pondSlotDone` / `pondFedThisSession` from
 * features/logProgress.ts, the single definition of "done" the reminders and
 * the Today progress card also read — so the farm row, the pond dashboard and
 * the notification can never disagree.
 *
 * State is carried in `accessibilityState.checked`, not colour alone: a
 * screen reader announces it and a farmer who cannot tell fill from outline
 * on a cheap sunlit screen still sees a different icon.
 */
export interface SessionHintProps {
    ctx: PondContext;
    /** Deterministic clock for tests; defaults to the real time. */
    now?: Date;
}

const Badge = ({
    testID,
    checked,
    label,
}: {
    testID: string;
    checked: boolean;
    label: string;
}) => (
    <View
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        style={[styles.badge, checked ? styles.badgeOn : styles.badgeOff]}
    >
        <Icon
            name={checked ? 'check_circle' : 'radio_button_unchecked'}
            size={14}
            color={checked ? theme.roles.light.successText : theme.roles.light.textTertiary}
        />
        <Text style={[styles.label, checked && styles.labelOn]} numberOfLines={1}>
            {label}
        </Text>
    </View>
);

export const SessionHint: React.FC<SessionHintProps> = ({ ctx, now }) => {
    const { t } = useTranslation();
    const clock = now ?? new Date();
    const slot = slotAt(clock);
    const logged = pondSlotDone(ctx, slot, clock);
    const fed = pondFedThisSession(ctx, slot, clock);

    return (
        <View style={styles.row}>
            <Badge testID="session-hint-logged" checked={logged} label={t('ponds.sessionHintLogged', 'Logged')} />
            <Badge testID="session-hint-fed" checked={fed} label={t('ponds.sessionHintFed', 'Fed')} />
        </View>
    );
};

/**
 * "Logged 2 d · Fed 6 h" — the two ages, on one line, always.
 *
 * SessionHint above answers "has this been done in the CURRENT slot", which is
 * a yes/no about today. It cannot say how long a pond has been ignored, so a
 * pond nobody has touched for a fortnight looked exactly like one logged this
 * morning and missed since lunch. This is that missing half, and it is shown
 * unconditionally — an age only offered when something is already wrong is an
 * age the farmer has to go looking for.
 *
 * Feed age comes from `PondContext.lastFeedAt`, which the backend computes as
 * MAX(feed.recordedAt) GROUPED BY crop — so a pond with no active crop always
 * reports null. That renders as "never fed", never as "just now".
 */
export interface AgeHintProps {
    /** Newest water-quality record, or null if there has never been one. */
    loggedAt: string | null | undefined;
    /** `PondContext.lastFeedAt` — null on any pond without an active crop. */
    fedAt: string | null | undefined;
    /** Slate treatment: the log is too old to trust. Fresh stays muted. */
    stale?: boolean;
    /** Deterministic clock for tests; defaults to the real time. */
    now?: Date;
}

export const AgeHint: React.FC<AgeHintProps> = ({ loggedAt, fedAt, stale, now }) => {
    const { t } = useTranslation();
    const clock = now ?? new Date();
    const line = [
        loggedAt ? t('ponds.ageLogged', { age: formatAge(loggedAt, clock) }) : t('ponds.ageNeverLogged'),
        fedAt ? t('ponds.ageFed', { age: formatAge(fedAt, clock) }) : t('ponds.ageNeverFed'),
    ].join(' · ');

    return (
        <Text testID="age-hint" style={[styles.age, stale && styles.ageStale]} numberOfLines={1}>
            {line}
        </Text>
    );
};

/**
 * The same line for a whole farm, measured off its WORST pond.
 *
 * Worst, not average: a farm card exists to say whether anything on it has been
 * forgotten, and one pond nobody has logged for a week is the answer even when
 * the other nine were done at dawn. A pond that has never been logged sorts
 * oldest, so "never" wins outright.
 */
export const FarmAgeHint: React.FC<{ rows: PondWithHealth[]; now?: Date }> = ({ rows, now }) => {
    if (!rows.length) return null;
    const oldest = (pick: (r: PondWithHealth) => string | null | undefined): string | null => {
        let out: string | null | undefined;
        for (const r of rows) {
            const v = pick(r);
            if (!v) return null; // never — nothing is older than that
            if (!out || v < out) out = v; // ISO-8601 sorts lexicographically
        }
        return out ?? null;
    };
    return (
        <AgeHint
            loggedAt={oldest((r) => r.freshness.asOf)}
            fedAt={oldest((r) => r.context?.lastFeedAt)}
            stale={rows.some((r) => r.freshness.state !== 'fresh')}
            now={now}
        />
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: theme.spacing[1.5] },
    age: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        lineHeight: 16,
        color: theme.roles.light.textTertiary,
    },
    ageStale: { color: theme.roles.light.staleText },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: theme.spacing[2],
        height: theme.tokens.chip.height,
        borderRadius: theme.radius.full,
        borderWidth: 1,
    },
    badgeOn: {
        backgroundColor: theme.roles.light.successBg,
        borderColor: theme.roles.light.successBorder,
    },
    badgeOff: {
        backgroundColor: theme.roles.light.surfaceVariant,
        borderColor: theme.roles.light.borderDefault,
    },
    label: { ...theme.typeScale.labelSmall, color: theme.roles.light.textTertiary },
    labelOn: { color: theme.roles.light.successText, fontWeight: '600' },
});

export default SessionHint;
