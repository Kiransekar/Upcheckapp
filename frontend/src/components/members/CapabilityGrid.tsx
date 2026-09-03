/**
 * The permission grid — one row per capability an owner may hand out or take
 * back, each a three-state choice.
 *
 * Three states, not a switch, because "off" and "not set" are different
 * answers: a member left on **Default** follows the farm's role policy, and
 * changing that policy later moves them with it. A switch can only say on or
 * off, which is why the one financial `Switch` this replaces could never
 * express "whatever a worker normally gets".
 *
 * The same component binds to a per-member override (`MemberDetailScreen`) and
 * to a per-role policy (`FarmMembersScreen`); only `value` and `defaults`
 * differ. UI visibility only — the backend resolves and enforces the identical
 * order (override → policy → matrix).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '../ui/ChipGroup';
import { theme } from '../../theme';
import {
    OVERRIDABLE_CAPABILITIES,
    type CapabilityOverrides,
    type FarmCapability,
} from '../../permissions/capabilities';

const c = theme.roles.light;

type TriState = 'default' | 'allowed' | 'blocked';

const stateOf = (v: boolean | undefined): TriState =>
    v === undefined ? 'default' : v ? 'allowed' : 'blocked';

interface CapabilityGridProps {
    /** The overrides being edited. `null` or `{}` = everything on its default. */
    value: CapabilityOverrides | null;
    /** What this capability resolves to when no override is set. */
    defaults: (capability: FarmCapability) => boolean;
    /** The whole merged object, or `null` when nothing is overridden any more. */
    onChange: (next: CapabilityOverrides | null) => void;
    disabled?: boolean;
}

export const CapabilityGrid: React.FC<CapabilityGridProps> = ({
    value,
    defaults,
    onChange,
    disabled = false,
}) => {
    const { t } = useTranslation();

    const options = [
        { value: 'default', label: t('members.capDefault') },
        { value: 'allowed', label: t('members.capAllowed') },
        { value: 'blocked', label: t('members.capBlocked') },
    ];

    const set = (capability: FarmCapability, next: TriState | null) => {
        if (disabled) return;
        const merged: CapabilityOverrides = { ...(value ?? {}) };
        // Deselecting a chip is the same answer as picking Default: stop
        // overriding and follow whatever the role gets.
        if (next === 'default' || next == null) delete merged[capability];
        else merged[capability] = next === 'allowed';
        onChange(Object.keys(merged).length > 0 ? merged : null);
    };

    return (
        <View>
            {OVERRIDABLE_CAPABILITIES.map((capability) => {
                const state = stateOf(value?.[capability]);
                return (
                    <View key={capability} style={styles.row} testID={`capability-${capability}`}>
                        <Text style={styles.label}>{t(`members.cap_${capability}`)}</Text>
                        <ChipGroup
                            options={options}
                            value={state}
                            onChange={(next) => set(capability, next as TriState | null)}
                        />
                        {state === 'default' && (
                            <Text style={styles.caption}>
                                {t(
                                    defaults(capability)
                                        ? 'members.capDefaultAllowed'
                                        : 'members.capDefaultBlocked',
                                )}
                            </Text>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
    },
    label: { ...theme.typeScale.bodyLarge, color: c.textPrimary, marginBottom: theme.spacing[2] },
    caption: {
        ...theme.typeScale.bodySmall,
        color: c.textTertiary,
        marginTop: -theme.spacing[1],
        marginBottom: theme.spacing[2],
    },
});

export default CapabilityGrid;
