/**
 * Attendance — artboard 3b.
 *
 * Three changes, all about answering a question the old screen left open:
 *
 *  - "Your shift" now says how long you have been in ("6h 27m so far"), not
 *    just that you are. Elapsed time is what a worker checks before deciding
 *    whether to knock off.
 *  - The team roster shows NAMES and includes people with no record at all
 *    ("No record today"). A list of only those who came tells a manager
 *    nothing about who did not.
 *  - In and Out are columns. The old cards put the check-out time in a
 *    subtitle, which made two shifts impossible to compare.
 *
 * Check-in still goes through the offline sync queue like every other field
 * log; check-out is a direct call, because a shift that is ending was started
 * on this device and is not a fresh offline capture.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { saveRecord } from '../../sync/recordSync';
import { attendanceApi, type AttendanceRecord } from '../../api/attendance';
import { farmMembersApi, type FarmMember } from '../../api/farmMembers';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { todayLocalISODate } from '../../utils/localDate';
import { personName } from '../../utils/personName';

/** Days of own history before "Show earlier days". */
const HISTORY_DAYS = 6;

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const formatDay = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** "6h 27m" — how long the open shift has been running. */
const elapsedSince = (iso: string): string => {
    const ms = Date.now() - Date.parse(iso);
    if (Number.isNaN(ms) || ms < 0) return '0m';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

interface TeamRow {
    userId: string;
    name: string;
    /** Every shift today, oldest first. Empty means they have not come in. */
    shifts: AttendanceRecord[];
}

export const AttendanceScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { farmId, farmName } = route.params ?? {};
    const { user } = useAuthStore();
    const perms = usePermissions(farmId);

    const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
    const [teamToday, setTeamToday] = useState<AttendanceRecord[]>([]);
    const [members, setMembers] = useState<FarmMember[]>([]);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState<any>(null);

    const load = useCallback(async () => {
        try {
            const { data } = await attendanceApi.mine(farmId);
            setMyRecords(data);
            setLoadError(null);
        } catch (e) {
            // Do NOT fall through to "you haven't checked in today". A failed
            // read is not an absence, and rendering it as one told the farmer
            // their check-in had not happened when it had — the same mistake
            // C5 fixed for the members list.
            setMyRecords([]);
            setLoadError(e);
        }
        if (perms.canManageOperations) {
            // The roster is what turns "who came" into "who did not" — without
            // it an absent worker is simply invisible.
            const [todayRes, membersRes] = await Promise.all([
                attendanceApi.getAll(farmId, todayLocalISODate()).catch(() => ({ data: [] as AttendanceRecord[] })),
                farmMembersApi.listMembers(farmId).catch(() => ({ data: [] as FarmMember[] })),
            ]);
            setTeamToday(todayRes.data);
            setMembers(membersRes.data);
        }
        setRefreshing(false);
    }, [farmId, perms.canManageOperations]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const openRecord = myRecords.find((r) => !r.checkOutAt) ?? null;

    /**
     * Everyone on the farm, whether or not they turned up, with ALL of today's
     * shifts each — not just the latest. Someone who works a morning and an
     * evening shift was previously collapsed to one row by a Map keyed on user
     * id, so half their hours simply vanished from the roster.
     */
    const teamRows: TeamRow[] = useMemo(() => {
        const byUser = new Map<string, AttendanceRecord[]>();
        // Server sends newest first; reverse so a day reads in the order it
        // happened.
        for (const r of [...teamToday].reverse()) {
            const list = byUser.get(r.userId) ?? [];
            list.push(r);
            byUser.set(r.userId, list);
        }
        if (members.length) {
            return members.map((m) => ({
                userId: m.userId,
                name: personName(m.user, t('attendance.unknownPerson')),
                shifts: byUser.get(m.userId) ?? [],
            }));
        }
        // Roster unavailable: fall back to whoever did check in. The records now
        // carry their own user, so this still shows names rather than ids.
        return [...byUser.entries()].map(([userId, shifts]) => ({
            userId,
            name: personName(shifts[0]?.user, t('attendance.unknownPerson')),
            shifts,
        }));
    }, [members, teamToday, t]);

    const presentCount = teamRows.filter((r) => r.shifts.length > 0).length;

    const history = showAllHistory ? myRecords : myRecords.slice(0, HISTORY_DAYS);
    const hiddenDays = myRecords.length - history.length;

    const checkIn = async () => {
        setBusy(true);
        try {
            const res = await saveRecord({
                entity: 'attendance',
                endpoint: '/attendance/check-in',
                payload: { farmId },
            });
            Alert.alert(
                t('attendance.checkedInTitle'),
                res.queued ? t('common.savedOffline', 'Saved — will sync when online') : t('attendance.checkedInSub'),
            );
            load();
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('attendance.checkInError'));
        } finally {
            setBusy(false);
        }
    };

    const checkOut = async () => {
        if (!openRecord) return;
        setBusy(true);
        try {
            await attendanceApi.checkOut(openRecord.id);
            Alert.alert(t('attendance.checkedOutTitle'), t('attendance.checkedOutSub'));
            load();
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.response?.data?.message ?? t('attendance.checkOutError'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <ScreenHeader
                eyebrow={farmName ?? null}
                title={t('attendance.title')}
                onBack={() => navigation.goBack()}
                accessibilityBackLabel={t('common.back')}
                trailing={formatDay(new Date().toISOString())}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
                }
            >
                {/*
                  * A failed read must never be shown as an absence. Without
                  * this the screen said "You haven't checked in today" whenever
                  * the request failed — indistinguishable from the truth, and
                  * the reason a farmer checked in repeatedly.
                  */}
                {!!loadError && (
                    <View style={styles.loadError}>
                        <Icon name="warning" size={20} color={c.dangerText} />
                        <Text style={styles.loadErrorText}>{t('attendance.loadFailed')}</Text>
                        <TouchableOpacity onPress={load} accessibilityRole="button">
                            <Text style={styles.retry}>{t('common.retry')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.shift}>
                    <Text style={styles.shiftLabel}>{t('attendance.yourShift')}</Text>
                    <Text style={styles.shiftValue}>
                        {openRecord
                            ? t('attendance.checkInAt', { time: formatTime(openRecord.checkInAt) })
                            : t('attendance.notCheckedIn')}
                    </Text>
                    {!!openRecord && (
                        <Text style={styles.shiftMeta}>
                            {t('attendance.stillInFor', { elapsed: elapsedSince(openRecord.checkInAt) })}
                        </Text>
                    )}
                    <TouchableOpacity
                        style={[styles.shiftBtn, busy && styles.shiftBtnBusy]}
                        onPress={openRecord ? checkOut : checkIn}
                        disabled={busy}
                        accessibilityRole="button"
                    >
                        <Text style={styles.shiftBtnLabel}>
                            {openRecord ? t('attendance.checkOutCta') : t('attendance.checkInCta')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {perms.canManageOperations && (
                    <>
                        <SectionHeader
                            label={t('attendance.teamTodayTitle')}
                            trailing={t('attendance.presentOf', {
                                present: presentCount,
                                total: teamRows.length,
                            })}
                        />
                        {teamRows.length === 0 ? (
                            <Text style={styles.empty}>{t('attendance.teamTodayEmpty')}</Text>
                        ) : (
                            <>
                                <ColumnHeads />
                                {teamRows.map((row) => {
                                    const label =
                                        row.userId === user?.id ? t('attendance.you') : row.name;
                                    if (row.shifts.length === 0) {
                                        return (
                                            <View key={row.userId} style={styles.row}>
                                                <Text style={[styles.name, styles.absent]} numberOfLines={1}>
                                                    {label}
                                                </Text>
                                                <Text style={styles.noRecord} numberOfLines={1}>
                                                    {t('attendance.noRecordToday')}
                                                </Text>
                                            </View>
                                        );
                                    }
                                    // One row PER SHIFT. The name is printed on the
                                    // first only, so a second shift reads as another
                                    // stint by the same person rather than a
                                    // duplicate of them.
                                    return row.shifts.map((shift, i) => (
                                        <View key={shift.id} style={styles.row}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {i === 0 ? label : ''}
                                            </Text>
                                            <Text style={[styles.cell, styles.colIn]}>
                                                {formatTime(shift.checkInAt)}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.cell,
                                                    styles.colOut,
                                                    !shift.checkOutAt && styles.stillIn,
                                                ]}
                                            >
                                                {shift.checkOutAt
                                                    ? formatTime(shift.checkOutAt)
                                                    : t('attendance.stillInShort')}
                                            </Text>
                                        </View>
                                    ));
                                })}
                            </>
                        )}
                    </>
                )}

                <SectionHeader label={t('attendance.myHistoryTitle')} />
                {history.length === 0 ? (
                    <Text style={styles.empty}>{t('attendance.noHistory')}</Text>
                ) : (
                    <>
                        <ColumnHeads />
                        {history.map((record) => (
                            <View key={record.id} style={styles.row}>
                                <Text style={styles.name} numberOfLines={1}>
                                    {formatDay(record.checkInAt)}
                                </Text>
                                <Text style={[styles.cell, styles.colIn]}>{formatTime(record.checkInAt)}</Text>
                                <Text
                                    style={[styles.cell, styles.colOut, !record.checkOutAt && styles.stillIn]}
                                >
                                    {record.checkOutAt ? formatTime(record.checkOutAt) : t('attendance.stillInShort')}
                                </Text>
                            </View>
                        ))}
                        {hiddenDays > 0 && (
                            <TouchableOpacity
                                style={styles.showMore}
                                onPress={() => setShowAllHistory(true)}
                                accessibilityRole="button"
                            >
                                <Text style={styles.showMoreLabel}>{t('attendance.showEarlier')}</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const ColumnHeads = () => {
    const { t } = useTranslation();
    return (
        <View style={styles.heads}>
            <View style={{ flex: 1 }} />
            <Text style={[styles.head, styles.colIn]}>{t('attendance.colIn')}</Text>
            <Text style={[styles.head, styles.colOut]}>{t('attendance.colOut')}</Text>
        </View>
    );
};

const c = theme.roles.light;

const styles = StyleSheet.create({
    loadError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        backgroundColor: theme.roles.light.dangerBg,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.dangerBorder,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    loadErrorText: { ...theme.typeScale.bodyMedium, flex: 1, color: theme.roles.light.dangerText },
    retry: { ...theme.typeScale.labelLarge, color: theme.roles.light.dangerText },
    content: { paddingBottom: theme.spacing[16], backgroundColor: theme.roles.light.surface },

    shift: {
        backgroundColor: theme.roles.light.infoBg,
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.primaryHover,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
        paddingLeft: 17,
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[4],
        gap: theme.spacing[1],
    },
    shiftLabel: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: theme.roles.light.infoText,
    },
    shiftValue: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary },
    shiftMeta: { ...theme.typeScale.bodySmall, color: theme.roles.light.infoText },
    shiftBtn: {
        marginTop: theme.spacing[3],
        backgroundColor: theme.roles.light.primaryHover,
        borderRadius: theme.radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    shiftBtnBusy: { opacity: 0.6 },
    shiftBtnLabel: { ...theme.typeScale.labelLarge, fontSize: 15, color: theme.roles.light.textInverse },

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
        color: theme.roles.light.textDisabled,
        textAlign: 'right',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        minHeight: 44,
    },
    name: { ...theme.typeScale.labelLarge, flex: 1, minWidth: 0, color: theme.roles.light.textPrimary },
    absent: { color: theme.roles.light.textDisabled },
    noRecord: { ...theme.typeScale.bodySmall, color: theme.roles.light.textDisabled },
    cell: {
        fontFamily: 'DMMono-Regular',
        fontSize: 14,
        color: theme.roles.light.textSecondary,
        textAlign: 'right',
    },
    stillIn: { ...theme.typeScale.bodySmall, color: theme.roles.light.infoText },
    colIn: { width: 78 },
    colOut: { width: 78 },

    empty: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    showMore: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        paddingHorizontal: theme.spacing[5],
        minHeight: 44,
        justifyContent: 'center',
    },
    showMoreLabel: { ...theme.typeScale.labelLarge, color: theme.roles.light.textLink },
});

export default AttendanceScreen;
