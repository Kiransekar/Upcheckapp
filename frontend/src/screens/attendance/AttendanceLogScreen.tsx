/**
 * Attendance log — the manager's view of a whole month.
 *
 * The Attendance screen answers "who is in RIGHT NOW". That is the worker's
 * question and it is deliberately one day deep. It left a manager with no way
 * to answer anything else: how many days did this person work, who was absent
 * on the 14th, how many hours went into last month, and — the one that
 * actually gets asked at the end of a month — can I get this out of the app to
 * pay someone.
 *
 * So: a month calendar you can tap a day in, a filter for whose records you
 * are looking at, a sort, and a CSV export through the share sheet.
 *
 * The whole month arrives in ONE request (`from`/`to`), not thirty-one. Every
 * figure below is computed from that same array, so the calendar, the summary
 * and the rows can never disagree with each other.
 */
import { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Share,
    Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { attendanceApi, type AttendanceRecord } from '../../api/attendance';
import { farmMembersApi, type FarmMember } from '../../api/farmMembers';
import { personName } from '../../utils/personName';
import { formatDate, formatTime } from '../../utils/formatDate';
import { toLocalISODate } from '../../utils/localDate';
import { toCsv, type CsvCell } from '../../utils/csv';

const c = theme.roles.light;

export type SortKey = 'latest' | 'name' | 'hours';

/** Sort options, in the order the button cycles through them. */
const SORTS: SortKey[] = ['latest', 'name', 'hours'];

/** A record with everything the list, the sort and the export all need. */
export interface LogRow {
    record: AttendanceRecord;
    name: string;
    /** Local calendar day, YYYY-MM-DD. */
    day: string;
    /** Worked hours, or null while the shift is still open. */
    hours: number | null;
}

/** Hours between check-in and check-out, or null for an open shift. */
export const shiftHours = (record: AttendanceRecord): number | null => {
    if (!record.checkOutAt) return null;
    const ms = Date.parse(record.checkOutAt) - Date.parse(record.checkInAt);
    if (Number.isNaN(ms) || ms < 0) return null;
    return ms / 3_600_000;
};

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString();

/** First and last day of the month `anchor` falls in, as YYYY-MM-DD. */
export const monthBounds = (anchor: Date): { from: string; to: string } => ({
    from: toLocalISODate(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    to: toLocalISODate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
});

/**
 * The month laid out as calendar weeks, Sunday-first, padded with nulls so
 * every row has seven cells and the columns line up under their weekday.
 */
export const monthGrid = (anchor: Date): Array<Array<number | null>> => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const cells: Array<number | null> = [
        ...Array(first.getDay()).fill(null),
        ...Array.from({ length: days }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: Array<Array<number | null>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
};

/**
 * Exactly the rows on screen, as CSV cells.
 *
 * Exporting the unfiltered month would be a different, silent answer to "give
 * me this" — what a manager wants out is what they just narrowed down to.
 * Dates and times stay ISO so a spreadsheet parses them; the localised
 * rendering is for reading, not for accounting. The quoting itself lives in
 * utils/csv, shared with the activity export.
 */
export const csvRows = (rows: LogRow[]): CsvCell[][] =>
    rows.map((row) => [
        row.day,
        row.name,
        row.record.checkInAt,
        row.record.checkOutAt ?? '',
        row.hours == null ? '' : oneDecimal(row.hours),
    ]);

export const AttendanceLogScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params ?? {};

    // Anchor is any date inside the month being shown; only its year+month
    // are ever read.
    const [anchor, setAnchor] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [personId, setPersonId] = useState<string | null>(null);
    const [openOnly, setOpenOnly] = useState(false);
    const [sort, setSort] = useState<SortKey>('latest');

    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [members, setMembers] = useState<FarmMember[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const { from, to } = useMemo(() => monthBounds(anchor), [anchor]);

    const load = useCallback(async () => {
        const [recordsRes, membersRes] = await Promise.all([
            attendanceApi.getAll(farmId, undefined, from, to).then(
                (r) => r.data,
                () => null,
            ),
            farmMembersApi.listMembers(farmId).catch(() => ({ data: [] as FarmMember[] })),
        ]);
        // A failed read is not an empty month. Saying "nobody came in" when we
        // simply could not ask is the same lie that had a farmer checking in
        // over and over on the other screen.
        setLoadError(recordsRes === null);
        setRecords(recordsRes ?? []);
        setMembers(membersRes.data);
        setRefreshing(false);
    }, [farmId, from, to]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    /** Display name per user id, roster first so absentees have names too. */
    const nameOf = useMemo(() => {
        const map = new Map<string, string>();
        for (const m of members) map.set(m.userId, personName(m.user, t('attendance.unknownPerson')));
        for (const r of records) {
            if (!map.has(r.userId)) map.set(r.userId, personName(r.user, t('attendance.unknownPerson')));
        }
        return map;
    }, [members, records, t]);

    const allRows: LogRow[] = useMemo(
        () =>
            records.map((record) => ({
                record,
                name: nameOf.get(record.userId) ?? t('attendance.unknownPerson'),
                day: toLocalISODate(new Date(record.checkInAt)),
                hours: shiftHours(record),
            })),
        [records, nameOf, t],
    );

    /** How many distinct people were in on each day — the calendar's density. */
    const presentByDay = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const row of allRows) {
            const set = map.get(row.day) ?? new Set<string>();
            set.add(row.record.userId);
            map.set(row.day, set);
        }
        return map;
    }, [allRows]);

    const rows = useMemo(() => {
        let out = allRows;
        if (selectedDay) out = out.filter((r) => r.day === selectedDay);
        if (personId) out = out.filter((r) => r.record.userId === personId);
        if (openOnly) out = out.filter((r) => !r.record.checkOutAt);

        const sorted = [...out];
        if (sort === 'name') {
            sorted.sort((a, b) => a.name.localeCompare(b.name) || a.record.checkInAt.localeCompare(b.record.checkInAt));
        } else if (sort === 'hours') {
            // An open shift has no total yet, so it sorts last rather than
            // pretending to be zero hours.
            sorted.sort((a, b) => (b.hours ?? -1) - (a.hours ?? -1));
        } else {
            sorted.sort((a, b) => b.record.checkInAt.localeCompare(a.record.checkInAt));
        }
        return sorted;
    }, [allRows, selectedDay, personId, openOnly, sort]);

    /** Totals for what is on screen, not for the raw month. */
    const totals = useMemo(() => {
        const people = new Set(rows.map((r) => r.record.userId));
        const days = new Set(rows.map((r) => r.day));
        const hours = rows.reduce((a, r) => a + (r.hours ?? 0), 0);
        return { people: people.size, days: days.size, hours };
    }, [rows]);

    /**
     * Who has no record on the selected day. Only meaningful for ONE day — over
     * a month "absent" is a person-by-day matrix, which is a spreadsheet, not
     * a phone screen. That is what export is for.
     */
    const absentees = useMemo(() => {
        if (!selectedDay) return [];
        const present = presentByDay.get(selectedDay) ?? new Set<string>();
        return members
            .filter((m) => !present.has(m.userId))
            .map((m) => ({ userId: m.userId, name: nameOf.get(m.userId) ?? t('attendance.unknownPerson') }));
    }, [selectedDay, presentByDay, members, nameOf, t]);

    const shiftMonth = (delta: number) => {
        setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1));
        // The 14th of one month is not the 14th of the next — a day selection
        // cannot survive the move.
        setSelectedDay(null);
    };

    const exportCsv = async () => {
        if (rows.length === 0) {
            Alert.alert(t('attendance.exportEmptyTitle'), t('attendance.exportEmptySub'));
            return;
        }
        const csv = toCsv(csvRows(rows), [
            t('attendance.csvDate'),
            t('attendance.csvName'),
            t('attendance.csvIn'),
            t('attendance.csvOut'),
            t('attendance.csvHours'),
        ]);
        try {
            await Share.share({
                title: t('attendance.exportTitle', { farm: farmName ?? '' }),
                message: csv,
            });
        } catch {
            // The user dismissing the share sheet is not an error worth an alert.
        }
    };

    const monthLabel = formatDate(anchor, { month: 'long', year: 'numeric' });

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={farmName ?? null}
                title={t('attendance.logTitle')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
                actionLabel={t('attendance.export')}
                onAction={exportCsv}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
                }
            >
                {loadError && (
                    <View style={styles.loadError}>
                        <Icon name="warning" size={20} color={c.dangerText} />
                        <Text style={styles.loadErrorText}>{t('attendance.loadFailed')}</Text>
                        <TouchableOpacity onPress={load} accessibilityRole="button">
                            <Text style={styles.retry}>{t('common.retry')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.monthBar}>
                    <TouchableOpacity
                        onPress={() => shiftMonth(-1)}
                        style={styles.monthNav}
                        accessibilityRole="button"
                        accessibilityLabel={t('attendance.prevMonth')}
                    >
                        <Icon name="chevron_left" size={24} color={c.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.monthLabel}>{monthLabel}</Text>
                    <TouchableOpacity
                        onPress={() => shiftMonth(1)}
                        style={styles.monthNav}
                        accessibilityRole="button"
                        accessibilityLabel={t('attendance.nextMonth')}
                    >
                        <Icon name="chevron_right" size={24} color={c.textPrimary} />
                    </TouchableOpacity>
                </View>

                <Calendar
                    anchor={anchor}
                    presentByDay={presentByDay}
                    selectedDay={selectedDay}
                    onSelectDay={(day) => setSelectedDay((prev) => (prev === day ? null : day))}
                />

                {/*
                  * Summary of what the filters currently show. "3 people · 12
                  * days · 84.5 h" is the sentence a manager is trying to build
                  * by hand when they scroll a list of shifts.
                  */}
                <View style={styles.totals} testID="attendance-totals">
                    <Total value={String(totals.people)} label={t('attendance.totalPeople')} />
                    <Total value={String(totals.days)} label={t('attendance.totalDays')} />
                    <Total value={`${oneDecimal(totals.hours)}h`} label={t('attendance.totalHours')} />
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                >
                    <Chip
                        label={t('attendance.everyone')}
                        active={personId === null}
                        onPress={() => setPersonId(null)}
                    />
                    {members.map((m) => (
                        <Chip
                            key={m.userId}
                            label={nameOf.get(m.userId) ?? t('attendance.unknownPerson')}
                            active={personId === m.userId}
                            onPress={() => setPersonId((prev) => (prev === m.userId ? null : m.userId))}
                        />
                    ))}
                </ScrollView>

                <View style={styles.toolbar}>
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => setSort((s) => SORTS[(SORTS.indexOf(s) + 1) % SORTS.length])}
                        accessibilityRole="button"
                    >
                        <Icon name="sort" size={18} color={c.textPrimary} />
                        <Text style={styles.toolLabel}>{t(`attendance.sort_${sort}`)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toolBtn, openOnly && styles.toolBtnActive]}
                        onPress={() => setOpenOnly((v) => !v)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: openOnly }}
                    >
                        <Icon name="schedule" size={18} color={openOnly ? c.infoText : c.textPrimary} />
                        <Text style={[styles.toolLabel, openOnly && styles.toolLabelActive]}>
                            {t('attendance.stillInOnly')}
                        </Text>
                    </TouchableOpacity>
                </View>

                <SectionHeader
                    label={
                        selectedDay
                            ? formatDate(selectedDay, { weekday: 'long', day: 'numeric', month: 'short' })
                            : t('attendance.wholeMonth')
                    }
                    trailing={t('attendance.shiftCount', { pl: rows.length })}
                />

                {rows.length === 0 ? (
                    <Text style={styles.empty}>{t('attendance.noShifts')}</Text>
                ) : (
                    <>
                        <View style={styles.heads}>
                            <Text style={[styles.head, styles.colName]}>{t('attendance.colWho')}</Text>
                            <Text style={[styles.head, styles.colTime]}>{t('attendance.colIn')}</Text>
                            <Text style={[styles.head, styles.colTime]}>{t('attendance.colOut')}</Text>
                            <Text style={[styles.head, styles.colHours]}>{t('attendance.colHours')}</Text>
                        </View>
                        {rows.map((row) => (
                            <View key={row.record.id} style={styles.row}>
                                <View style={styles.colName}>
                                    <Text style={styles.name} numberOfLines={1}>
                                        {row.name}
                                    </Text>
                                    {/* The date only earns a line when the list
                                        spans more than one day. */}
                                    {!selectedDay && (
                                        <Text style={styles.rowDay} numberOfLines={1}>
                                            {formatDate(row.record.checkInAt)}
                                        </Text>
                                    )}
                                </View>
                                <Text style={[styles.cell, styles.colTime]}>
                                    {formatTime(row.record.checkInAt)}
                                </Text>
                                <Text
                                    style={[
                                        styles.cell,
                                        styles.colTime,
                                        !row.record.checkOutAt && styles.stillIn,
                                    ]}
                                >
                                    {row.record.checkOutAt
                                        ? formatTime(row.record.checkOutAt)
                                        : t('attendance.stillInShort')}
                                </Text>
                                <Text style={[styles.cell, styles.colHours]}>
                                    {row.hours == null ? '—' : `${oneDecimal(row.hours)}h`}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {!!selectedDay && absentees.length > 0 && (
                    <>
                        <SectionHeader
                            label={t('attendance.absentTitle')}
                            trailing={String(absentees.length)}
                        />
                        {absentees.map((person) => (
                            <View key={person.userId} style={styles.row}>
                                <Text style={[styles.name, styles.absent]} numberOfLines={1}>
                                    {person.name}
                                </Text>
                                <Text style={styles.noRecord}>{t('attendance.noRecordThatDay')}</Text>
                            </View>
                        ))}
                    </>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

/** 2024-01-07 was a Sunday — the reference week the column heads come from. */
const WEEKDAY_REF = new Date(2024, 0, 7);

const Calendar: React.FC<{
    anchor: Date;
    presentByDay: Map<string, Set<string>>;
    selectedDay: string | null;
    onSelectDay: (day: string) => void;
}> = ({ anchor, presentByDay, selectedDay, onSelectDay }) => {
    const weeks = useMemo(() => monthGrid(anchor), [anchor]);
    const today = toLocalISODate(new Date());
    const heads = useMemo(
        () =>
            Array.from({ length: 7 }, (_, i) =>
                formatDate(new Date(2024, 0, WEEKDAY_REF.getDate() + i), { weekday: 'short' }),
            ),
        [],
    );

    return (
        <View style={styles.calendar}>
            <View style={styles.week}>
                {heads.map((head, i) => (
                    <Text key={i} style={styles.weekHead} numberOfLines={1}>
                        {head}
                    </Text>
                ))}
            </View>
            {weeks.map((week, wi) => (
                <View key={wi} style={styles.week}>
                    {week.map((dayNum, di) => {
                        if (dayNum == null) return <View key={di} style={styles.day} />;
                        const iso = toLocalISODate(
                            new Date(anchor.getFullYear(), anchor.getMonth(), dayNum),
                        );
                        const count = presentByDay.get(iso)?.size ?? 0;
                        const selected = selectedDay === iso;
                        return (
                            <TouchableOpacity
                                key={di}
                                style={[
                                    styles.day,
                                    iso === today && styles.dayToday,
                                    selected && styles.daySelected,
                                ]}
                                onPress={() => onSelectDay(iso)}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                            >
                                <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>
                                    {dayNum}
                                </Text>
                                {/* How many people were in. A dot alone would
                                    make a one-person day look like a full one. */}
                                <Text
                                    style={[styles.dayCount, selected && styles.dayCountSelected]}
                                    numberOfLines={1}
                                >
                                    {count > 0 ? count : ''}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );
};

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({
    label,
    active,
    onPress,
}) => (
    <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
            {label}
        </Text>
    </TouchableOpacity>
);

const Total: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <View style={styles.total}>
        <Text style={styles.totalValue} numberOfLines={1}>
            {value}
        </Text>
        <Text style={styles.totalLabel} numberOfLines={1}>
            {label}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    content: { paddingBottom: theme.spacing[16], backgroundColor: c.surface },

    loadError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        backgroundColor: c.dangerBg,
        borderBottomWidth: 1,
        borderBottomColor: c.dangerBorder,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    loadErrorText: { ...theme.typeScale.bodyMedium, flex: 1, color: c.dangerText },
    retry: { ...theme.typeScale.labelLarge, color: c.dangerText },

    monthBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing[3],
        paddingTop: theme.spacing[2],
    },
    monthNav: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    monthLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textPrimary },

    calendar: { paddingHorizontal: theme.spacing[3], paddingBottom: theme.spacing[2] },
    week: { flexDirection: 'row' },
    weekHead: {
        ...theme.typeScale.labelSmall,
        flex: 1,
        fontSize: 10,
        textAlign: 'center',
        textTransform: 'uppercase',
        color: c.textDisabled,
        paddingBottom: theme.spacing[1],
    },
    day: {
        flex: 1,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 1,
        borderRadius: theme.radius.xs,
    },
    dayToday: { borderWidth: 1.5, borderColor: c.borderStrong },
    daySelected: { backgroundColor: c.primaryHover },
    dayNum: { ...theme.typeScale.bodyMedium, fontSize: 13, color: c.textPrimary },
    dayNumSelected: { color: c.textInverse },
    dayCount: { fontFamily: 'DMMono-Regular', fontSize: 10, lineHeight: 12, color: c.infoText },
    dayCountSelected: { color: c.textInverse },

    totals: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.borderDefault,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    total: { flex: 1, minWidth: 0 },
    totalValue: { fontFamily: 'DMMono-Medium', fontSize: 18, color: c.textPrimary },
    totalLabel: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textSecondary },

    chips: {
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
    },
    chip: {
        borderWidth: 1.5,
        borderColor: c.borderDefault,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        justifyContent: 'center',
        minHeight: 36,
    },
    chipActive: { borderColor: c.borderStrong, backgroundColor: c.surfaceVariant },
    chipLabel: { ...theme.typeScale.labelMedium, color: c.textSecondary },
    chipLabelActive: { color: c.textPrimary },

    toolbar: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[2],
    },
    toolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        borderWidth: 1.5,
        borderColor: c.borderDefault,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        minHeight: 40,
    },
    toolBtnActive: { borderColor: c.infoText, backgroundColor: c.infoBg },
    toolLabel: { ...theme.typeScale.labelMedium, color: c.textPrimary },
    toolLabelActive: { color: c.infoText },

    heads: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: theme.spacing[5],
        paddingBottom: theme.spacing[1],
    },
    head: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.textDisabled,
        textAlign: 'right',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        minHeight: 44,
    },
    colName: { flex: 1, minWidth: 0 },
    colTime: { width: 68 },
    colHours: { width: 52 },
    name: { ...theme.typeScale.labelLarge, color: c.textPrimary },
    rowDay: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textTertiary },
    absent: { flex: 1, color: c.textDisabled },
    noRecord: { ...theme.typeScale.bodySmall, color: c.textDisabled },
    cell: {
        fontFamily: 'DMMono-Regular',
        fontSize: 14,
        color: c.textSecondary,
        textAlign: 'right',
    },
    stillIn: { ...theme.typeScale.bodySmall, color: c.infoText },

    empty: {
        ...theme.typeScale.bodyMedium,
        color: c.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
});

export default AttendanceLogScreen;
