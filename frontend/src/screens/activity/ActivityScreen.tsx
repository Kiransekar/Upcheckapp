/**
 * Activity — "who did what, and when".
 *
 * The app writes fourteen different log tables and, until now, the only way to
 * answer "what happened on this farm last week" was to open fourteen history
 * screens and read them side by side. There is no audit table behind this: the
 * server unions the log tables it already has, so every row here is a real
 * record somebody saved, with the actor it was saved by.
 *
 * Grouped by DAY, because that is the unit the question is asked in. Today
 * comes first and says "Today" rather than a date — on a phone at the pond,
 * "is this from this morning or last Tuesday" is the whole question.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Share,
    Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SummaryRow } from '../../components/ui/SummaryRow';
import { ChipGroup, type ChipOption } from '../../components/ui/ChipGroup';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { activityApi, type ActivityItem, type ActivityKind } from '../../api/activity';
import { usePermissions } from '../../hooks/usePermissions';
import { toCsv, type CsvCell } from '../../utils/csv';
import { capture, EVENTS } from '../../features/analytics';
import { formatTime, formatWeekday } from '../../utils/formatDate';
import { toLocalISODate, todayLocalISODate } from '../../utils/localDate';
import { ACTIVITY_ICON, activityKindKey, visibleActivityKinds } from './activityKinds';

const c = theme.roles.light;

/** 50 is the server's own default, and about three screens on a 360dp phone. */
const PAGE_SIZE = 50;

export type ActivityScope = 'all' | 'farm' | 'pond';

export interface ActivitySection {
    /** Local calendar day, YYYY-MM-DD. */
    day: string;
    data: ActivityItem[];
}

/**
 * One section per calendar day, in the order the server sent (newest first).
 *
 * The server orders by `at` descending, so a single pass over consecutive items
 * is enough — no map, no re-sort, and the sections stay stable as later pages
 * append to the end.
 */
export const groupByDay = (items: ActivityItem[]): ActivitySection[] => {
    const sections: ActivitySection[] = [];
    for (const item of items) {
        const d = new Date(item.at);
        const day = Number.isNaN(d.getTime()) ? '' : toLocalISODate(d);
        const last = sections[sections.length - 1];
        if (last && last.day === day) last.data.push(item);
        else sections.push({ day, data: [item] });
    }
    return sections;
};

/**
 * The rows as CSV cells. `at` stays ISO so a spreadsheet parses it as a real
 * instant; the localised rendering on screen is for reading, not accounting.
 */
export const activityCsvRows = (
    items: ActivityItem[],
    kindLabel: (kind: ActivityKind) => string,
): CsvCell[][] =>
    items.map((i) => [i.at, kindLabel(i.kind), i.actorName, i.summary]);

/** Midnight local, and the last millisecond of that day — the range the day means. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const ActivityScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName, pondId, pondName } = route.params ?? {};

    const perms = usePermissions(farmId);

    // Seeded from where the farmer came FROM: arriving from a pond means the
    // pond's timeline, not every farm they belong to.
    const [scope, setScope] = useState<ActivityScope>(
        pondId ? 'pond' : farmId ? 'farm' : 'all',
    );
    const [kinds, setKinds] = useState<ActivityKind[]>([]);
    const [from, setFrom] = useState<Date | null>(null);
    const [to, setTo] = useState<Date | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [items, setItems] = useState<ActivityItem[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);

    const kindOptions: ChipOption[] = useMemo(
        () =>
            visibleActivityKinds(perms.canViewFinancials).map((k) => ({
                value: k,
                label: t(activityKindKey(k)),
            })),
        [perms.canViewFinancials, t],
    );

    const query = useMemo(
        () => ({
            farmId: scope === 'farm' ? farmId : undefined,
            pondId: scope === 'pond' ? pondId : undefined,
            kinds: kinds.length ? kinds : undefined,
            from: from ? startOfDay(from).toISOString() : undefined,
            to: to ? endOfDay(to).toISOString() : undefined,
            limit: PAGE_SIZE,
        }),
        [scope, farmId, pondId, kinds, from, to],
    );

    /**
     * A filter change while a page is in flight must not be overwritten by the
     * answer to the question the farmer already moved on from.
     */
    const seq = useRef(0);

    const load = useCallback(
        async (nextCursor?: string) => {
            const id = ++seq.current;
            if (nextCursor) setLoadingMore(true);
            else setLoading(true);
            try {
                const { data } = await activityApi.list({ ...query, cursor: nextCursor });
                if (id !== seq.current) return;
                setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
                setCursor(data.nextCursor);
                setError(null);
            } catch (err) {
                if (id !== seq.current) return;
                // A failed page-2 keeps the page-1 rows on screen; only a failed
                // first page is worth replacing the list with an error.
                if (!nextCursor) {
                    setItems([]);
                    setCursor(null);
                    setError(err);
                }
            } finally {
                if (id === seq.current) {
                    setLoading(false);
                    setLoadingMore(false);
                    setRefreshing(false);
                }
            }
        },
        [query],
    );

    // Re-runs on focus AND whenever the filters change, which is the same
    // event as far as this list is concerned: ask again from the top.
    useFocusEffect(useCallback(() => { void load(); }, [load]));

    const sections = useMemo(() => groupByDay(items), [items]);

    const dayLabel = useCallback(
        (day: string) => {
            if (!day) return t('activity.unknownDay');
            if (day === todayLocalISODate()) return t('activity.today');
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (day === toLocalISODate(yesterday)) return t('activity.yesterday');
            return formatWeekday(`${day}T00:00:00`);
        },
        [t],
    );

    const scopeOptions: ChipOption[] = [
        { value: 'all', label: t('activity.scopeAll') },
        ...(farmId ? [{ value: 'farm', label: farmName || t('activity.scopeFarm') }] : []),
        ...(pondId ? [{ value: 'pond', label: pondName || t('activity.scopePond') }] : []),
    ];

    const filterCount = kinds.length + (from ? 1 : 0) + (to ? 1 : 0);

    const clearFilters = () => {
        setKinds([]);
        setFrom(null);
        setTo(null);
    };

    const exportCsv = async () => {
        if (items.length === 0) {
            Alert.alert(t('activity.exportEmptyTitle'), t('activity.exportEmptySub'));
            return;
        }
        const csv = toCsv(
            activityCsvRows(items, (k) => t(activityKindKey(k))),
            [
                t('activity.csvWhen'),
                t('activity.csvWhat'),
                t('activity.csvWho'),
                t('activity.csvDetails'),
            ],
        );
        try {
            await Share.share({ title: t('activity.exportTitle'), message: csv });
            // The sheet opened and returned. The CSV itself — names, notes,
            // amounts — never leaves the device by this route.
            capture(EVENTS.EXPORT_GENERATED, { kind: 'csv', feature: 'activity' });
        } catch {
            // Dismissing the share sheet is not an error worth an alert.
        }
    };

    const body = () => {
        if (loading && items.length === 0) {
            return <SkeletonList count={5} style={styles.skeleton} />;
        }
        if (error && items.length === 0) {
            return (
                <ErrorState
                    title={t('activity.loadFailed')}
                    error={error}
                    onRetry={() => void load()}
                />
            );
        }
        return (
            <SectionList
                testID="activity-list"
                sections={sections}
                keyExtractor={(item) => `${item.kind}-${item.recordId}`}
                stickySectionHeadersEnabled
                initialNumToRender={12}
                windowSize={7}
                removeClippedSubviews
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            void load();
                        }}
                        colors={[c.primary]}
                        tintColor={c.primary}
                    />
                }
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (cursor && !loadingMore && !loading) void load(cursor);
                }}
                renderSectionHeader={({ section }) => (
                    <View style={styles.dayHeader}>
                        <Text style={styles.dayLabel}>{dayLabel(section.day)}</Text>
                        <Text style={styles.dayCount}>{section.data.length}</Text>
                    </View>
                )}
                renderItem={({ item, index, section }) => (
                    <SummaryRow
                        icon={ACTIVITY_ICON[item.kind] ?? 'checklist'}
                        title={t(activityKindKey(item.kind))}
                        subtitle={
                            [item.summary, item.actorName].filter(Boolean).join(' · ') ||
                            t('activity.noDetail')
                        }
                        value={formatTime(item.at)}
                        divider={index === section.data.length - 1 ? 'strong' : 'light'}
                    />
                )}
                ListEmptyComponent={
                    <EmptyState
                        icon="history"
                        title={t('activity.emptyTitle')}
                        subtitle={
                            filterCount > 0 ? t('activity.emptyFiltered') : t('activity.emptySub')
                        }
                        actionLabel={filterCount > 0 ? t('activity.clearFilters') : undefined}
                        onAction={filterCount > 0 ? clearFilters : undefined}
                    />
                }
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator style={styles.more} color={c.primary} />
                    ) : null
                }
            />
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={pondName || farmName || null}
                title={t('activity.title')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
                actionLabel={t('activity.export')}
                onAction={exportCsv}
            />

            {scopeOptions.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scopeBar}
                >
                    <ChipGroup
                        options={scopeOptions}
                        value={scope}
                        onChange={(v: string | null) => v && setScope(v as ActivityScope)}
                    />
                </ScrollView>
            )}

            <View style={styles.filterBar}>
                <TouchableOpacity
                    style={[styles.filterBtn, filtersOpen && styles.filterBtnActive]}
                    onPress={() => setFiltersOpen((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: filtersOpen }}
                >
                    <Icon name="sort" size={18} color={filtersOpen ? c.infoText : c.textPrimary} />
                    <Text style={[styles.filterLabel, filtersOpen && styles.filterLabelActive]}>
                        {filterCount > 0
                            ? t('activity.filtersWithCount', { count: filterCount })
                            : t('activity.filters')}
                    </Text>
                </TouchableOpacity>
                {filterCount > 0 && (
                    <TouchableOpacity
                        style={styles.filterBtn}
                        onPress={clearFilters}
                        accessibilityRole="button"
                    >
                        <Icon name="close" size={18} color={c.textPrimary} />
                        <Text style={styles.filterLabel}>{t('activity.clearFilters')}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/*
              * The filters live behind a tap on purpose: fourteen kind chips and
              * two calendars is most of a 360dp screen, and the list is what the
              * farmer came for.
              */}
            {filtersOpen && (
                <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
                    <ChipGroup
                        label={t('activity.kindsLabel')}
                        options={kindOptions}
                        value={kinds}
                        onChange={(v: string[]) => setKinds(v as ActivityKind[])}
                        multiple
                    />
                    <CalendarPicker
                        label={t('activity.fromLabel')}
                        value={from ?? new Date()}
                        onChange={setFrom}
                        maxDate={to ?? new Date()}
                        helperText={from ? undefined : t('activity.anyDate')}
                    />
                    <CalendarPicker
                        label={t('activity.toLabel')}
                        value={to ?? new Date()}
                        onChange={setTo}
                        minDate={from ?? undefined}
                        maxDate={new Date()}
                        helperText={to ? undefined : t('activity.anyDate')}
                    />
                </ScrollView>
            )}

            {body()}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    scopeBar: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3] },
    // The chip row is the whole height of this strip; without a cap it stretches
    // to fill the screen and pushes the list off the bottom.
    filterBar: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        borderWidth: 1.5,
        borderColor: c.borderDefault,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        minHeight: 44,
    },
    filterBtnActive: { borderColor: c.infoText, backgroundColor: c.infoBg },
    filterLabel: { ...theme.typeScale.labelMedium, color: c.textPrimary },
    filterLabelActive: { color: c.infoText },

    panel: { maxHeight: 320, borderTopWidth: 1, borderTopColor: c.borderDefault },
    panelContent: { paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[3] },

    skeleton: { padding: theme.spacing[5] },
    listContent: { paddingBottom: theme.spacing[16], flexGrow: 1 },

    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: c.surfaceVariant,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.borderDefault,
    },
    dayLabel: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.textSecondary,
    },
    dayCount: { fontFamily: 'DMMono-Regular', fontSize: 12, color: c.textTertiary },

    more: { paddingVertical: theme.spacing[4] },
});

export default ActivityScreen;
