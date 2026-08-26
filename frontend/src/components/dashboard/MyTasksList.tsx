import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { SectionHeader } from '../ui/SectionHeader';
import type { Task } from '../../api/tasks';

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
    /** How many to show before the list is cut off. */
    limit?: number;
}

/** A task someone has completed and is waiting on a verifier is the urgent kind. */
const needsVerify = (task: Task) => task.status === 'done';

export const MyTasksList: React.FC<MyTasksListProps> = ({
    tasks,
    farmNameForTask,
    onOpen,
    limit = 4,
}) => {
    const { t } = useTranslation();
    if (tasks.length === 0) return null;

    // Anything waiting on a verification decision comes first — it is blocking
    // somebody else's work, which nothing further down this list is.
    const ordered = [...tasks].sort(
        (a, b) => Number(needsVerify(b)) - Number(needsVerify(a)),
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
            />
            {visible.map((task) => {
                const farm = farmNameForTask?.(task);
                const verify = needsVerify(task);
                const meta = [farm, task.dueDate ? t('home.taskDue', { date: task.dueDate }) : null]
                    .filter(Boolean)
                    .join(' · ');
                return (
                    <View key={task.id} style={styles.row}>
                        <View style={styles.text}>
                            <Text style={styles.title} numberOfLines={1}>
                                {task.title}
                            </Text>
                            {!!meta && (
                                <Text style={styles.meta} numberOfLines={1}>
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
