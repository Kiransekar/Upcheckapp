import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { Icon } from './Icon';
import { pondSlotDone, pondFedThisSession, slotAt } from '../../features/logProgress';
import type { PondContext } from '../../api/pondContext';

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

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: theme.spacing[1.5] },
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
