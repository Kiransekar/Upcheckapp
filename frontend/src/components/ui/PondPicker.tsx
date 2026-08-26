import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Icon } from './Icon';
import { SectionHeader } from './SectionHeader';
import { pondsApi, type Pond } from '../../api/ponds';
import { pondContextApi, type PondContext } from '../../api/pondContext';
import { pondLabel } from '../../utils/pondHealth';

/**
 * "Pick a pond first" — the piece that makes the calculators pond-aware.
 *
 * The design's whole argument for the calculator screens is that they should
 * "prefill from the pond you picked instead of asking you to type MBW and
 * survival again". This is that: choose a pond once, and the numbers the app
 * already knows arrive filled in, leaving only the value being tested to type.
 *
 * Two calls, not N: the list comes from /ponds/mine, and only the CHOSEN pond's
 * context is fetched. Loading a context per pond to render a list would cost
 * more than the typing it saves.
 *
 * Inline expansion rather than a modal — a picker that covers the form makes
 * you forget what you were filling in, and modal dialogs are avoided across
 * this app anyway.
 */

export interface PondPickerProps {
    /** Currently chosen pond, or null to start unchosen. */
    pondId: string | null;
    /**
     * Fires on choice AND when the chosen pond's context arrives, so a caller
     * can prefill. `context` is null while it is still loading, or if the pond
     * has no snapshot yet.
     */
    onChange: (pondId: string, context: PondContext | null) => void;
    /** Only offer ponds with a cycle running — calculators need stock figures. */
    stockedOnly?: boolean;
}

export const PondPicker: React.FC<PondPickerProps> = ({ pondId, onChange, stockedOnly = false }) => {
    const { t } = useTranslation();
    const [ponds, setPonds] = useState<Pond[]>([]);
    const [context, setContext] = useState<PondContext | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        pondsApi
            .getMine()
            .then(({ data }) => setPonds(data))
            .catch(() => setPonds([]));
    }, []);

    const options = useMemo(
        () => (stockedOnly ? ponds.filter((p) => p.activeCycleId) : ponds),
        [ponds, stockedOnly],
    );

    const selected = options.find((p) => p.id === pondId) ?? ponds.find((p) => p.id === pondId) ?? null;

    // Fetch the chosen pond's snapshot and hand it up. A pond with nothing
    // logged yet resolves to null rather than an error — the calculator simply
    // has nothing to prefill.
    useEffect(() => {
        if (!pondId) {
            setContext(null);
            return;
        }
        let cancelled = false;
        pondContextApi
            .get(pondId)
            .then(({ data }) => {
                if (cancelled) return;
                setContext(data);
                onChange(pondId, data);
            })
            .catch(() => {
                if (cancelled) return;
                setContext(null);
            });
        return () => {
            cancelled = true;
        };
        // onChange is a fresh closure each render in most callers; depending on
        // it would refetch the context on every keystroke in the form below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pondId]);

    const choose = useCallback(
        (pond: Pond) => {
            setOpen(false);
            // Hand the id up immediately; the context follows when it lands.
            onChange(pond.id, null);
        },
        [onChange],
    );

    /** "Day 62 · MBW 18.4 g · 412 kg" — what the calculator will prefill from. */
    const meta = useMemo(() => {
        if (!context) return null;
        return [
            context.doc != null ? t('calculators.pondDay', { day: context.doc }) : null,
            context.abwG != null ? t('calculators.pondMbw', { mbw: context.abwG.toFixed(1) }) : null,
            context.biomassKg != null
                ? t('calculators.pondBiomass', { kg: Math.round(context.biomassKg).toLocaleString('en-IN') })
                : null,
        ]
            .filter(Boolean)
            .join(' · ');
    }, [context, t]);

    return (
        <>
            <SectionHeader
                label={t('calculators.pickPond')}
                actionLabel={selected ? t('calculators.changePond') : undefined}
                onAction={() => setOpen((v) => !v)}
            />

            {selected && !open && (
                <View style={styles.selectedWrap}>
                    <TouchableOpacity
                        style={styles.selected}
                        onPress={() => setOpen(true)}
                        accessibilityRole="button"
                    >
                        <Icon name="water_drop" size={20} color={theme.roles.light.primaryHover} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.selectedName} numberOfLines={1}>
                                {pondLabel(selected)}
                            </Text>
                            <Text style={styles.selectedMeta} numberOfLines={1}>
                                {meta || t('calculators.pondNoData')}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {(open || !selected) && (
                <View style={styles.list}>
                    {options.length === 0 ? (
                        <Text style={styles.empty}>{t('calculators.noPonds')}</Text>
                    ) : (
                        options.map((pond) => (
                            <TouchableOpacity
                                key={pond.id}
                                style={styles.option}
                                onPress={() => choose(pond)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: pond.id === pondId }}
                            >
                                <Icon
                                    name={pond.id === pondId ? 'check_circle' : 'radio_button_unchecked'}
                                    size={20}
                                    color={
                                        pond.id === pondId
                                            ? theme.roles.light.primaryHover
                                            : theme.roles.light.textDisabled
                                    }
                                />
                                <Text style={styles.optionLabel} numberOfLines={1}>
                                    {pondLabel(pond)}
                                </Text>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    selectedWrap: {
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    selected: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        borderWidth: 1.5,
        borderColor: theme.roles.light.primaryHover,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2.5],
        minHeight: 44,
    },
    selectedName: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    selectedMeta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },

    list: { borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        minHeight: 44,
    },
    optionLabel: { ...theme.typeScale.bodyLarge, flex: 1, minWidth: 0, color: theme.roles.light.textPrimary },
    empty: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
});

export default PondPicker;
