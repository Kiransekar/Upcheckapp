/**
 * TaskComposerScreen — the screen that actually creates a task.
 *
 * Until now the ONLY way to create one in the whole app was an inline title box
 * on the task list, which sent a title and nothing else: no due date, no type,
 * no priority, no pond, no recurrence, and an assignee that was always whoever
 * tapped it. The backend has supported all of those since it shipped; none of
 * them were reachable.
 *
 * Two modes, one form:
 *   - FARM (owner/manager): assign to everyone on the farm, or to named people.
 *   - PERSONAL (anyone): a note to yourself. No assignee picker at all, and it
 *     says in words that nobody else can see it — that is the whole promise.
 *
 * "Repeat" is one tap, not a form. Choosing it creates a TEMPLATE and the
 * server mints the daily instances, which is the "permanent daily task without
 * creating it every day" the farmer asked for.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Button } from '../../components/ui/Button';
import { CalendarPicker } from '../../components/ui/CalendarPicker';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { Input } from '../../components/ui/Input';
import { SelectField } from '../../components/ui/SelectField';
import { theme } from '../../theme';
import {
    tasksApi, toDueDate, TASK_TYPES,
    type CreateTaskDto, type TaskPriority, type TaskScope, type TaskType,
} from '../../api/tasks';
import { apiErrorMessage } from '../../api/errors';
import { fetchTeamOverview } from '../../api/teamOverview';
import { pondsApi, type Pond } from '../../api/ponds';
import type { FarmMember } from '../../api/farmMembers';
import { personName } from '../../utils/personName';
import { usePermissions } from '../../hooks/usePermissions';
import { useAppQuery } from '../../query/hooks';
import { qk } from '../../query/client';
import { capture, EVENTS } from '../../features/analytics';

const c = theme.roles.light;

/** "Everyone" is the absence of a named assignee, so it needs a sentinel here. */
export const EVERYONE = '__everyone__';

export type RepeatChoice = 'never' | 'daily' | 'weekly';

/**
 * Who the picker may offer.
 *
 * Active members of THIS farm, and — once a pond is chosen — only those who can
 * reach that pond. An empty `pondIds` means every pond (the default, and what
 * owners and managers always have; see farm_member_ponds). The server validates
 * this too and rejects rather than silently dropping, so offering someone it
 * would refuse is a guaranteed error dialog: don't offer them.
 */
export const eligibleAssignees = (
    members: FarmMember[],
    farmId: string,
    pondId?: string | null,
): FarmMember[] =>
    members
        .filter((m) => m.farmId === farmId && m.status === 'active')
        .filter((m) => !pondId || !m.pondIds?.length || m.pondIds.includes(pondId))
        .filter((m, i, all) => all.findIndex((x) => x.userId === m.userId) === i);

/** The composer's repeat choice → the API's recurrence object. */
export const recurrenceFor = (repeat: RepeatChoice, due: Date) =>
    repeat === 'never'
        ? undefined
        : repeat === 'weekly'
          ? { freq: 'weekly' as const, byWeekday: due.getDay() }
          : { freq: 'daily' as const };

const startOfToday = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const addDays = (d: Date, n: number) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** 'HH:mm' or empty. Anything else is not sent — the server takes a TIME. */
const cleanTime = (v: string): string | undefined =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim() : undefined;

export const TaskComposerScreen = ({ route, navigation }: any) => {
    const { farmId, farmName } = route.params ?? {};
    const { t } = useTranslation();
    const perms = usePermissions(farmId);

    // Only a manager may create farm work. Everyone else gets the personal
    // form, which is not a downgrade — it is the "helping myself" case.
    const canAssign = perms.canCreateTask;
    const [scope, setScope] = useState<TaskScope>(
        canAssign ? (route.params?.scope ?? 'farm') : 'personal',
    );
    const isPersonal = scope === 'personal';

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<TaskType>('OTHER');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [due, setDue] = useState<Date>(startOfToday());
    const [showCalendar, setShowCalendar] = useState(false);
    const [pondId, setPondId] = useState<string | null>(null);
    const [assignees, setAssignees] = useState<string[]>([]);
    const [repeat, setRepeat] = useState<RepeatChoice>('never');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [saving, setSaving] = useState(false);

    // The SAME read the Team tab uses — one cached request, no new endpoint.
    const teamQuery = useAppQuery({
        queryKey: qk.team(farmId),
        queryFn: () => fetchTeamOverview(farmId),
        enabled: !!farmId && !isPersonal,
    });

    const pondQuery = useAppQuery({
        queryKey: [...qk.ponds(), farmId, 'composer'],
        queryFn: async () => {
            const { data } = await pondsApi.getAll(farmId);
            return (Array.isArray(data) ? data : (data?.data ?? [])) as Pond[];
        },
        enabled: !!farmId && !isPersonal,
    });

    const members = useMemo(
        () => eligibleAssignees(teamQuery.data?.members ?? [], farmId, pondId),
        [teamQuery.data, farmId, pondId],
    );

    // Choosing a pond can take somebody out of scope. Dropping them silently
    // is the whole reason the server rejects rather than filtering: the form
    // must not send a person it has just stopped offering.
    const validAssignees = useMemo(
        () => assignees.filter((id) => members.some((m) => m.userId === id)),
        [assignees, members],
    );

    const dueChoice = useMemo(() => {
        const today = startOfToday();
        if (due.getTime() === today.getTime()) return 'today';
        if (due.getTime() === addDays(today, 1).getTime()) return 'tomorrow';
        return 'custom';
    }, [due]);

    const submit = useCallback(async () => {
        const trimmed = title.trim();
        if (!trimmed) return;
        setSaving(true);
        const body: CreateTaskDto = {
            farmId,
            title: trimmed,
            scope,
            type,
            priority,
            dueDate: toDueDate(due),
        };
        if (description.trim()) body.description = description.trim();
        if (!isPersonal) {
            if (pondId) body.pondId = pondId;
            // [] is meaningful: EVERYONE in scope. Always send it so the
            // server never has to guess between "everyone" and "unset".
            body.assigneeIds = validAssignees;
            const recurrence = recurrenceFor(repeat, due);
            if (recurrence) body.recurrence = recurrence;
        }
        const start = cleanTime(from);
        const end = cleanTime(to);
        if (start) body.timeWindowStart = start;
        if (end) body.timeWindowEnd = end;

        try {
            await tasksApi.create(body);
            // `kind` is the task TYPE, not the scope: which kinds of work
            // farmers actually schedule is the question that changes what we
            // build, and personal-vs-farm is already answered by who the task
            // ends up assigned to. TaskType is a closed union, so it is a
            // category and never free text the farmer typed.
            capture(EVENTS.TASK_CREATED, { kind: type });
            navigation.goBack();
        } catch (err) {
            Alert.alert(
                t('tasks.createErrorTitle'),
                apiErrorMessage(err, t('tasks.createErrorBody')),
            );
        } finally {
            setSaving(false);
        }
    }, [
        title, description, farmId, scope, isPersonal, type, priority, due,
        pondId, validAssignees, repeat, from, to, navigation, t,
    ]);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel={t('common.back')}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={c.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {farmName ? t('tasks.composeWithFarm', { farmName }) : t('tasks.composeTitle')}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                {/* A manager can write for the farm or for themselves. Everyone
                    else only ever gets the second, so the switch would be a
                    control with one option. */}
                {canAssign && (
                    <ChipGroup
                        label={t('tasks.scopeLabel')}
                        options={[
                            { value: 'farm', label: t('tasks.scopeFarm'), icon: 'account-group-outline' },
                            { value: 'personal', label: t('tasks.scopePersonal'), icon: 'account-outline' },
                        ]}
                        value={scope}
                        onChange={(v: string | null) => setScope((v as TaskScope) ?? 'farm')}
                    />
                )}

                {isPersonal && (
                    <View style={styles.privateNote} testID="personal-note">
                        <MaterialCommunityIcons name="lock-outline" size={18} color={c.textSecondary} />
                        <Text style={styles.privateText}>{t('tasks.personalOnlyYou')}</Text>
                    </View>
                )}

                <Input
                    label={t('tasks.fieldTitle')}
                    required
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('tasks.fieldTitlePlaceholder')}
                    testID="task-title"
                />

                <Input
                    label={t('tasks.fieldNotes')}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('tasks.fieldNotesPlaceholder')}
                    multiline
                    testID="task-notes"
                />

                <ChipGroup
                    label={t('tasks.fieldDue')}
                    options={[
                        { value: 'today', label: t('tasks.dueToday'), icon: 'calendar-today' },
                        { value: 'tomorrow', label: t('tasks.dueTomorrow'), icon: 'calendar-arrow-right' },
                        { value: 'custom', label: t('tasks.dueCustom'), icon: 'calendar-edit' },
                    ]}
                    value={dueChoice}
                    onChange={(v: string | null) => {
                        if (v === 'today') { setDue(startOfToday()); setShowCalendar(false); }
                        else if (v === 'tomorrow') { setDue(addDays(startOfToday(), 1)); setShowCalendar(false); }
                        else setShowCalendar(true);
                    }}
                />

                {(showCalendar || dueChoice === 'custom') && (
                    <CalendarPicker label={t('tasks.fieldDueDate')} value={due} onChange={setDue} />
                )}

                <ChipGroup
                    label={t('tasks.fieldType')}
                    options={TASK_TYPES.map((v) => ({ value: v, label: t(`tasks.type_${v}`) }))}
                    value={type}
                    onChange={(v: string | null) => setType((v as TaskType) ?? 'OTHER')}
                />

                <ChipGroup
                    label={t('tasks.fieldPriority')}
                    options={[
                        { value: 'low', label: t('tasks.priority_low') },
                        { value: 'medium', label: t('tasks.priority_medium') },
                        { value: 'high', label: t('tasks.priority_high') },
                    ]}
                    value={priority}
                    onChange={(v: string | null) => setPriority((v as TaskPriority) ?? 'medium')}
                />

                <View style={styles.timeRow}>
                    <View style={styles.timeCell}>
                        <Input
                            label={t('tasks.fieldFrom')}
                            value={from}
                            onChangeText={setFrom}
                            placeholder="06:00"
                            keyboardType="numbers-and-punctuation"
                            testID="task-from"
                        />
                    </View>
                    <View style={styles.timeCell}>
                        <Input
                            label={t('tasks.fieldTo')}
                            value={to}
                            onChangeText={setTo}
                            placeholder="07:00"
                            keyboardType="numbers-and-punctuation"
                            testID="task-to"
                        />
                    </View>
                </View>

                {!isPersonal && (
                    <>
                        <SelectField
                            label={t('tasks.fieldPond')}
                            value={pondId}
                            placeholder={t('tasks.pondAny')}
                            options={[
                                { label: t('tasks.pondAny'), value: '' },
                                ...(pondQuery.data ?? []).map((p) => ({
                                    label: p.displayName || p.name,
                                    value: p.id,
                                })),
                            ]}
                            onSelect={(v) => setPondId(v || null)}
                        />

                        <Text style={styles.sectionLabel}>{t('tasks.fieldAssignees')}</Text>
                        {teamQuery.isPending ? (
                            <ActivityIndicator color={c.primary} style={styles.loader} />
                        ) : (
                            <>
                                <ChipGroup
                                    options={[
                                        { value: EVERYONE, label: t('tasks.assignEveryone'), icon: 'account-group' },
                                    ]}
                                    value={validAssignees.length === 0 ? EVERYONE : null}
                                    onChange={() => setAssignees([])}
                                />
                                <ChipGroup
                                    multiple
                                    options={members.map((m) => ({
                                        value: m.userId,
                                        label: personName(m.user, t('team.unknownPerson')),
                                    }))}
                                    value={validAssignees}
                                    onChange={(v: string[]) => setAssignees(v)}
                                />
                                <Text style={styles.hint}>
                                    {validAssignees.length === 0
                                        ? (pondId ? t('tasks.everyoneOnPondHint') : t('tasks.everyoneOnFarmHint'))
                                        : t('tasks.assignedCount', { count: validAssignees.length })}
                                </Text>
                            </>
                        )}

                        {/* One tap, no form: this is the whole "permanent daily
                            task" feature. The server keeps the template and
                            mints the days. */}
                        <ChipGroup
                            label={t('tasks.fieldRepeat')}
                            options={[
                                { value: 'never', label: t('tasks.repeatNever') },
                                { value: 'daily', label: t('tasks.repeatDaily'), icon: 'repeat' },
                                { value: 'weekly', label: t('tasks.repeatWeekly'), icon: 'calendar-week' },
                            ]}
                            value={repeat}
                            onChange={(v: string | null) => setRepeat((v as RepeatChoice) ?? 'never')}
                        />
                        {repeat !== 'never' && (
                            <Text style={styles.hint}>{t('tasks.repeatHint')}</Text>
                        )}
                    </>
                )}

                <Button
                    title={t('tasks.createCta')}
                    onPress={submit}
                    loading={saving}
                    disabled={!title.trim()}
                    style={styles.submit}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[2],
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
    },
    backBtn: { padding: theme.spacing[2] },
    headerTitle: { ...theme.typeScale.h3, color: c.textPrimary, flex: 1, textAlign: 'center' },
    body: { padding: theme.spacing[4], paddingBottom: theme.spacing[10], gap: theme.spacing[2] },
    privateNote: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2],
        padding: theme.spacing[3], borderRadius: theme.radius.md,
        backgroundColor: c.surfaceVariant,
    },
    privateText: { ...theme.typeScale.bodySmall, color: c.textSecondary, flex: 1 },
    sectionLabel: {
        ...theme.typeScale.labelMedium, color: c.textSecondary,
        marginTop: theme.spacing[2],
    },
    hint: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    loader: { alignSelf: 'flex-start', margin: theme.spacing[2] },
    timeRow: { flexDirection: 'row', gap: theme.spacing[3] },
    timeCell: { flex: 1 },
    submit: { marginTop: theme.spacing[4] },
});

export default TaskComposerScreen;
