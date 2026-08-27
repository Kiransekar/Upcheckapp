import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Icon } from '../ui/Icon';
import { SectionHeader } from '../ui/SectionHeader';

/**
 * "Getting started" — the activation checklist, in the redesign's language.
 *
 * It used to be a tinted Card with its own title bar, badges and a close X:
 * a second design system sitting under a screen made of flat rows and hairline
 * section rules. Artboard 1b does not draw it at all, because 1b draws an
 * established farm — so it has to be the quietest thing on the page, not the
 * loudest.
 *
 * Hence: the same SectionHeader every other section uses, three rows the same
 * height as the rows above them, and no fill. Done items go grey with a tick;
 * the one you have not done keeps a chevron, which is the only affordance here.
 *
 * "Hide" is permanent and says so before it happens. A checklist that comes
 * back after you dismissed it is nagging, but silently losing the only route
 * to setup steps a farmer has not finished would be worse — so it asks.
 */

export interface GettingStartedItem {
    key: string;
    label: string;
    done: boolean;
}

export interface GettingStartedProps {
    items: GettingStartedItem[];
    onSelect: (key: string) => void;
    /** Confirmed dismissal — the caller persists it. */
    onDismissForever: () => void;
}

export const GettingStarted: React.FC<GettingStartedProps> = ({
    items,
    onSelect,
    onDismissForever,
}) => {
    const { t } = useTranslation();
    const done = items.filter((i) => i.done).length;

    const confirmHide = () =>
        Alert.alert(t('home.hideChecklistTitle'), t('home.hideChecklistBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('home.hideChecklistConfirm'), style: 'destructive', onPress: onDismissForever },
        ]);

    return (
        <>
            <SectionHeader
                label={t('home.gettingStartedTitle')}
                trailing={`${done}/${items.length}`}
                actionLabel={t('home.hideChecklist')}
                onAction={confirmHide}
            />
            {items.map((item) => (
                <TouchableOpacity
                    key={item.key}
                    style={styles.row}
                    onPress={() => onSelect(item.key)}
                    disabled={item.done}
                    accessibilityRole="button"
                    accessibilityState={{ checked: item.done }}
                    accessibilityLabel={item.label}
                >
                    <Icon
                        name={item.done ? 'check_circle' : 'radio_button_unchecked'}
                        size={20}
                        color={item.done ? c.successText : c.textTertiary}
                    />
                    <Text style={[styles.label, item.done && styles.labelDone]} numberOfLines={1}>
                        {item.label}
                    </Text>
                    {!item.done && <Icon name="chevron_right" size={20} color={c.textTertiary} />}
                </TouchableOpacity>
            ))}
        </>
    );
};

const c = theme.roles.light;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        backgroundColor: c.surface,
        minHeight: 44,
    },
    label: { ...theme.typeScale.bodyMedium, flex: 1, minWidth: 0, color: c.textPrimary },
    labelDone: { color: c.textDisabled, textDecorationLine: 'line-through' },
});

export default GettingStarted;
