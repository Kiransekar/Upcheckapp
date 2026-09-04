import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Icon } from './Icon';
import { SectionHeader } from './SectionHeader';
import { pondsApi, type Pond } from '../../api/ponds';
import { farmsApi } from '../../api/farms';
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

/** Case-insensitive match on the label a farmer actually sees. */
export const filterPonds = (ponds: Pond[], query: string): Pond[] => {
    const q = query.trim().toLowerCase();
    if (!q) return ponds;
    return ponds.filter((p) => pondLabel(p).toLowerCase().includes(q));
};

/**
 * One section per farm, in first-appearance order. A farmer with one farm gets
 * a single section with no title — naming the only farm you have is noise.
 */
export const groupPondsByFarm = (
    ponds: Pond[],
    farmNames: Record<string, string>,
): { farmId: string; title: string; ponds: Pond[] }[] => {
    const ids = [...new Set(ponds.map((p) => p.farmId))];
    if (ids.length <= 1) {
        return ponds.length ? [{ farmId: ids[0] ?? '', title: '', ponds }] : [];
    }
    return ids.map((id) => ({
        farmId: id,
        title: farmNames[id] ?? '',
        ponds: ponds.filter((p) => p.farmId === id),
    }));
};

/** Above this many ponds, scanning the list beats reading it — offer search. */
const SEARCH_THRESHOLD = 8;

export interface PondPickerProps {
    /** Currently chosen pond, or null to start unchosen. */
    pondId: string | null;
    /**
     * Fires on choice AND when the chosen pond's context arrives, so a caller
     * can prefill. `context` is null while it is still loading, if the pond has
     * no snapshot yet, or whenever `fetchContext` is false.
     */
    onChange: (pondId: string, context: PondContext | null) => void;
    /** Only offer ponds with a cycle running — calculators need stock figures. */
    stockedOnly?: boolean;
    /**
     * Fetch the chosen pond's snapshot. The calculators need it to prefill;
     * a screen that only routes somewhere (QuickLog) does not, and the extra
     * request costs a rural farmer a visible wait for nothing.
     */
    fetchContext?: boolean;
}

export const PondPicker: React.FC<PondPickerProps> = ({
    pondId,
    onChange,
    stockedOnly = false,
    fetchContext = true,
}) => {
    const { t } = useTranslation();
    const [ponds, setPonds] = useState<Pond[]>([]);
    const [farmNames, setFarmNames] = useState<Record<string, string>>({});
    const [context, setContext] = useState<PondContext | null>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        pondsApi
            .getMine()
            .then(async ({ data }) => {
                setPonds(data);
                // Farm captions only once there are two farms to tell apart.
                if (new Set(data.map((p) => p.farmId)).size > 1) {
                    try {
                        const { data: farms } = await farmsApi.getAll();
                        setFarmNames(Object.fromEntries(farms.map((f) => [f.id, f.name])));
                    } catch {
                        // A missing caption is not worth failing the picker over.
                    }
                }
            })
            .catch(() => setPonds([]));
    }, []);

    const options = useMemo(() => {
        // /ponds/mine already excludes archived ponds; belt and braces, because
        // logging against an archived pond is a record nothing ever reads.
        let list = ponds.filter((p) => p.status !== 'archived');
        if (stockedOnly) list = list.filter((p) => p.activeCycleId);
        return list;
    }, [ponds, stockedOnly]);

    const showSearch = options.length > SEARCH_THRESHOLD;
    const sections = useMemo(
        () => groupPondsByFarm(showSearch ? filterPonds(options, query) : options, farmNames),
        [options, query, showSearch, farmNames],
    );

    const selected = options.find((p) => p.id === pondId) ?? ponds.find((p) => p.id === pondId) ?? null;

    // Fetch the chosen pond's snapshot and hand it up. A pond with nothing
    // logged yet resolves to null rather than an error — the calculator simply
    // has nothing to prefill.
    useEffect(() => {
        if (!pondId || !fetchContext) {
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

    /**
     * "Delta Farm · Day 62 · MBW 18.4 g · 412 kg" — the farm name only once
     * there are two to tell apart, then whatever the calculator will prefill
     * from. With no context fetched this is just the farm name, or nothing.
     */
    const meta = useMemo(() => {
        const farmName = selected && Object.keys(farmNames).length > 1 ? farmNames[selected.farmId] : null;
        return [
            farmName ?? null,
            context?.doc != null ? t('calculators.pondDay', { day: context.doc }) : null,
            context?.abwG != null ? t('calculators.pondMbw', { mbw: context.abwG.toFixed(1) }) : null,
            context?.biomassKg != null
                ? t('calculators.pondBiomass', { kg: Math.round(context.biomassKg).toLocaleString('en-IN') })
                : null,
        ]
            .filter(Boolean)
            .join(' · ');
    }, [context, t, selected, farmNames]);

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
                            {/* "No data yet" is only true when a snapshot was
                                actually asked for; without one it is a lie. */}
                            {(meta || fetchContext) ? (
                                <Text style={styles.selectedMeta} numberOfLines={1}>
                                    {meta || t('calculators.pondNoData')}
                                </Text>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {(open || !selected) && (
                <View style={styles.list}>
                    {showSearch && (
                        <View style={styles.searchBox}>
                            {/* MCI, not the Icon ligature set — that union has no
                                magnifier and Icon.tsx is not this component's to edit. */}
                            <MaterialCommunityIcons name="magnify" size={20} color={theme.roles.light.textTertiary} />
                            <TextInput
                                style={styles.searchInput}
                                value={query}
                                onChangeText={setQuery}
                                placeholder={t('common.search')}
                                placeholderTextColor={theme.roles.light.textTertiary}
                                autoCorrect={false}
                                accessibilityLabel={t('common.search')}
                            />
                        </View>
                    )}

                    {sections.length === 0 ? (
                        <Text style={styles.empty}>{t('calculators.noPonds')}</Text>
                    ) : (
                        sections.map((section) => (
                            <View key={section.farmId || 'all'}>
                                {section.title ? (
                                    <Text style={styles.sectionTitle}>{section.title}</Text>
                                ) : null}
                                {section.ponds.map((pond) => (
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
                                ))}
                            </View>
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
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        marginHorizontal: theme.spacing[5],
        marginVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.xs,
        minHeight: 44,
    },
    searchInput: {
        flex: 1,
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        paddingVertical: 0,
    },
    sectionTitle: {
        ...theme.typeScale.overline,
        color: theme.roles.light.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
        paddingBottom: theme.spacing[1],
    },
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
