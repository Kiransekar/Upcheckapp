import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

/**
 * A curated shelf of MaterialCommunityIcons, not all 7448 of them: a farmer
 * picking a picture for "Starter feed" wants the eight that could plausibly be
 * feed, not a scroll through every glyph the font ships. Grouped by what the
 * thing IS, searchable by its English name for anyone who knows what they want.
 *
 * Every name here is asserted to exist in the MCI glyphmap by
 * __tests__/IconPicker.test.tsx — a typo renders as a blank square with no
 * error, which is exactly the kind of bug nobody reports.
 */
export const ICON_GROUPS: { key: string; labelKey: string; icons: string[] }[] = [
    {
        key: 'feed',
        labelKey: 'inventory.iconGroupFeed',
        icons: [
            'corn', 'grain', 'silo', 'sack', 'barley', 'rice', 'fish', 'fishbowl',
            'food-drumstick', 'food-variant', 'bowl', 'basket', 'sprout', 'leaf',
            'grass', 'cow', 'shaker', 'noodles',
        ],
    },
    {
        key: 'chemicals',
        labelKey: 'inventory.iconGroupChemicals',
        icons: [
            'flask', 'flask-outline', 'flask-empty', 'test-tube', 'beaker', 'beaker-outline',
            'molecule', 'atom', 'ph', 'water', 'water-percent', 'water-opacity',
            'spray', 'spray-bottle', 'eyedropper', 'eyedropper-variant', 'gas-cylinder',
            'chemical-weapon', 'chart-bubble', 'oil',
        ],
    },
    {
        key: 'medicine',
        labelKey: 'inventory.iconGroupMedicine',
        icons: [
            'pill', 'medical-bag', 'needle', 'bandage', 'bottle-tonic', 'bottle-tonic-plus',
            'bottle-tonic-skull', 'hospital-box', 'heart-pulse', 'thermometer', 'iv-bag',
            'blood-bag', 'virus', 'bacteria', 'stethoscope', 'clipboard-pulse', 'hospital',
            'medication', 'pill-multiple', 'medical-cotton-swab',
        ],
    },
    {
        key: 'equipment',
        labelKey: 'inventory.iconGroupEquipment',
        icons: [
            'engine', 'engine-outline', 'pump', 'water-pump', 'fan', 'air-filter',
            'turbine', 'generator-stationary', 'electric-switch', 'power-plug',
            'battery', 'battery-charging', 'solar-panel', 'pipe', 'pipe-valve', 'valve',
            'car-battery', 'lightbulb', 'flashlight', 'cog', 'hydro-power', 'wind-turbine',
        ],
    },
    {
        key: 'tools',
        labelKey: 'inventory.iconGroupTools',
        icons: [
            'tools', 'wrench', 'wrench-outline', 'screwdriver', 'hammer', 'hammer-wrench',
            'saw-blade', 'tape-measure', 'ruler', 'ruler-square', 'toolbox', 'toolbox-outline',
            'screw-flat-top', 'nail', 'ladder', 'shovel', 'axe', 'knife', 'scissors-cutting',
            'pliers', 'razor-double-edge', 'broom',
        ],
    },
    {
        key: 'packaging',
        labelKey: 'inventory.iconGroupPackaging',
        icons: [
            'package-variant', 'package-variant-closed', 'package', 'cube', 'cube-outline',
            'archive', 'archive-outline', 'barrel', 'bucket', 'bucket-outline', 'bottle-wine',
            'tray', 'tray-full', 'dolly', 'truck', 'truck-delivery', 'forklift', 'warehouse',
            'cart', 'basket-outline', 'bag-personal', 'crop-square',
        ],
    },
    {
        key: 'safety',
        labelKey: 'inventory.iconGroupSafety',
        icons: [
            'shield-check', 'shield-outline', 'hard-hat', 'safety-goggles', 'biohazard',
            'fire-extinguisher', 'radioactive', 'lifebuoy', 'alert', 'alert-octagon',
            'hand-wash', 'glasses', 'skull-crossbones', 'fire', 'flash-alert',
        ],
    },
    {
        key: 'misc',
        labelKey: 'inventory.iconGroupMisc',
        icons: [
            'tag', 'tag-outline', 'label', 'calendar', 'clock-outline', 'note-text',
            'star', 'bookmark', 'key', 'lock', 'magnify', 'map-marker', 'cash',
            'currency-inr', 'receipt', 'scale', 'scale-balance', 'counter',
            'format-list-bulleted', 'cellphone', 'thermometer-lines', 'weather-sunny',
            'database', 'clipboard-text',
        ],
    },
];

/** Flat list of every curated glyph, for the search path and the parity test. */
export const ALL_ICONS: string[] = ICON_GROUPS.flatMap((g) => g.icons);

export interface IconPickerProps {
    visible: boolean;
    /** Currently chosen glyph, or null/undefined for none. */
    value?: string | null;
    onSelect: (icon: string) => void;
    onClose: () => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ visible, value, onSelect, onClose }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return ICON_GROUPS;
        return ICON_GROUPS.map((g) => ({ ...g, icons: g.icons.filter((i) => i.includes(q)) })).filter(
            (g) => g.icons.length > 0,
        );
    }, [query]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('inventory.pickIcon')}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                            <MaterialCommunityIcons name="close" size={24} color={theme.roles.light.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchBox}>
                        <MaterialCommunityIcons name="magnify" size={20} color={theme.roles.light.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t('inventory.searchIcons')}
                            placeholderTextColor={theme.roles.light.textTertiary}
                            autoCorrect={false}
                            autoCapitalize="none"
                            accessibilityLabel={t('inventory.searchIcons')}
                        />
                    </View>

                    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
                        {groups.length === 0 ? (
                            <Text style={styles.empty}>{t('inventory.noIconsMatch')}</Text>
                        ) : (
                            groups.map((g) => (
                                <View key={g.key} style={styles.group}>
                                    <Text style={styles.groupLabel}>{t(g.labelKey)}</Text>
                                    <View style={styles.grid}>
                                        {g.icons.map((icon) => {
                                            const active = icon === value;
                                            return (
                                                <TouchableOpacity
                                                    key={icon}
                                                    style={[styles.cell, active && styles.cellActive]}
                                                    onPress={() => {
                                                        onSelect(icon);
                                                        onClose();
                                                    }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={icon}
                                                    accessibilityState={{ selected: active }}
                                                >
                                                    <MaterialCommunityIcons
                                                        name={icon as any}
                                                        size={26}
                                                        color={active ? theme.roles.light.primary : theme.roles.light.textPrimary}
                                                    />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: theme.roles.light.surface,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[6],
        maxHeight: '85%',
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing[3] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing[3],
        minHeight: 44,
        marginBottom: theme.spacing[3],
    },
    searchInput: { flex: 1, ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, paddingVertical: 0 },
    scroll: { maxHeight: 420 },
    group: { marginBottom: theme.spacing[4] },
    groupLabel: { ...theme.typeScale.overline, color: theme.roles.light.textTertiary, marginBottom: theme.spacing[2] },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
    cell: {
        width: 48,
        height: 48,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cellActive: { borderColor: theme.roles.light.primary, borderWidth: 2, backgroundColor: theme.roles.light.surfaceOverlay },
    empty: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, paddingVertical: theme.spacing[4] },
});

export default IconPicker;
