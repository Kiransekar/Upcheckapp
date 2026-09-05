import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { SectionHeader } from '../ui/SectionHeader';
import type { Task } from '../../api/tasks';
import { isOverdue, myTaskMeta } from '../../screens/tasks/taskLabels';

/**
 * "My tasks" — what is assigned to ME, across every farm.
 *
 * The split with the Team tab is the point: Team shows the WHOLE team's work,
 * Home shows only yours. Both read the same tasks API; the difference is the
 * assignee filter.
 *
 * Each row ends in a button whose LABEL is the action — "Verify" for something
 * a worker has finished and is waiting on you, "Open" for everything else. The
 * design does that deliberately: a farmer scanning this list should be able to
 * tell what a row wants from them without reading the title.
 */

export interface MyTasksListProps {
    tasks: Task[];
    /** Resolve a task's farm for the meta line — Home spans every farm. */
    farmNameForTask?: (task: Task) => string | undefined;
    onOpen: (task: Task) => void;
    /**
     * Opens the whole team's task board. Present even with nothing assigned:
     * an owner who has assigned all the work to other people has an EMPTY "my
     * tasks" and still needs to see whether any of it is happening, and with
     * the section hidden entirely there was no route to it from Today at all.
     */
    onSeeAll?: () => void;
    /** How many to show before the list is cut off. */
    limit?: number;
    /**
     * Whose list this is. It decides the third word on every row — "You set
     * this" vs "Assigned to you" — which is the distinction the farmer asked
     * for and which nothing else on Today makes.
     */
    userId?: string | null;
}

/** A task someone has completed and is waiting on a verifier is the urgent kind. */
const needsVerify = (task: Task) => task.status === 'done';

export const MyTasksList: React.FC<MyTasksListProps> = ({
    tasks,
    farmNameForTask,
    onOpen,
    onSeeAll,
    limit = 4,
    userId,
}) => {
    const { t } = useTranslation();

    if (tasks.length === 0) {
        // Nothing assigned to you is not nothing to say — it is "the work is
        // elsewhere", and the way to check on it is one tap.
        if (!onSeeAll) return null;
        return (
            <>
                <SectionHeader
                    label={t('home.myTasks')}
                    actionLabel={t('home.viewAll')}
                    onAction={onSeeAll}
                />
                <Text style={styles.empty}>{t('home.noTasksAssigned')}</Text>
            </>
        );
    }

    // Anything waiting on a verification decision comes first — it is blocking
    // somebody else's work, which nothing further down this list is.
    // …and after that, whatever is already late. Today only shows four rows, so
    // which four it picks is the whole design.
    const ordered = [...tasks].sort(
        (a, b) =>
            Number(needsVerify(b)) - Number(needsVerify(a)) ||
            Number(isOverdue(b)) - Number(isOverdue(a)),
    );
    const visible = ordered.slice(0, limit);
    // "N open" counts what still needs DOING. A task you have already finished
    // and handed on for verification is not open work for you, even though it
    // still appears below with a Verify button for whoever checks it.
    const openCount = tasks.filter(
        (task) => task.status !== 'done' && task.status !== 'verified',
    ).length;

    return (
        <>
            <SectionHeader
                label={t('home.myTasks')}
                trailing={openCount > 0 ? t('home.openCount', { count: openCount }) : undefined}
                actionLabel={onSeeAll ? t('home.viewAll') : undefined}
                onAction={onSeeAll}
            />
            {visible.map((task) => {
                const farm = farmNameForTask?.(task);
                const verify = needsVerify(task);
                // Due, then routine-or-one-off, then who set it. Farm name last
                // — on a one-farm account it is noise, and the row has one line.
                const meta = [...myTaskMeta(t, task, userId), farm]
                    .filter(Boolean)
                    .join(' · ');
                const late = isOverdue(task);
                return (
                    <View key={task.id} style={styles.row}>
                        <View style={styles.text}>
                            <Text style={styles.title} numberOfLines={1}>
                                {task.title}
                            </Text>
                            {!!meta && (
                                <Text style={[styles.meta, late && styles.metaLate]} numberOfLines={1}>
                                    {meta}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            style={styles.action}
                            onPress={() => onOpen(task)}
                            accessibilityRole="button"
                        >
                            <Text style={styles.actionLabel}>
                                {verify ? t('home.verify') : t('home.open')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        backgroundColor: theme.roles.light.surface,
        minHeight: 56,
    },
    text: { flex: 1, minWidth: 0 },
    title: { ...theme.typeScale.labelLarge, fontSize: 15, color: theme.roles.light.textPrimary },
    meta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    metaLate: { color: theme.roles.light.dangerText },
    empty: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textTertiary,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
    },
    action: {
        borderWidth: 1.5,
        borderColor: theme.roles.light.borderStrong,
        borderRadius: theme.radius.xs,
        paddingHorizontal: theme.spacing[3],
        minHeight: 44,
        justifyContent: 'center',
    },
    actionLabel: { ...theme.typeScale.labelMedium, color: theme.roles.light.textPrimary },
});

export default MyTasksList;
