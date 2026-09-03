import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { tasksApi, Task } from '../../api/tasks';
import { apiErrorMessage } from '../../api/errors';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/authStore';

const c = theme.roles.light;

// Tapping a task advances its status: open → in_progress → done.
// 'done' is terminal for the worker; a manager then verifies it.
const NEXT_STATUS: Record<string, string> = {
    open: 'in_progress',
    in_progress: 'done',
};

/**
 * Where a long press sends a task BACK.
 *
 * Tapping is one gesture away from the wrong row, and until now that was
 * permanent: a mis-tapped task went to done and could never be moved, so the
 * board lied about what had actually been finished. Verified is the exception
 * — that is a manager's decision about someone else's work, and undoing it is
 * an approval question, not a typo.
 */
const PREV_STATUS: Record<string, string> = {
    in_progress: 'open',
    done: 'in_progress',
};

export const TaskListScreen = ({ route, navigation }: any) => {
    const { farmId, farmName, assignedToId } = route.params;
    const { t } = useTranslation();
    const perms = usePermissions(farmId);
    const userId = useAuthStore((s) => s.user?.id);

    const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
        open: { label: t('content.tasks.statusOpen'), color: c.textSecondary, icon: 'checkbox-blank-circle-outline' },
        in_progress: { label: t('content.tasks.statusInProgress'), color: c.warningText, icon: 'progress-clock' },
        done: { label: t('content.tasks.statusDone'), color: c.successText, icon: 'check-circle' },
        verified: { label: t('content.tasks.statusVerified', 'Verified'), color: c.successText, icon: 'check-decagram' },
        cancelled: { label: t('content.tasks.statusCancelled', 'Cancelled'), color: c.textTertiary, icon: 'close-circle-outline' },
    };
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);
    const [newTitle, setNewTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const fetchTasks = useCallback(async () => {
        setError(null);
        try {
            const { data } = await tasksApi.getAll(farmId, assignedToId ? { assignedToId } : undefined);
            const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
            setTasks(list);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [farmId, assignedToId]);

    useFocusEffect(
        useCallback(() => {
            fetchTasks();
        }, [fetchTasks]),
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchTasks();
    }, [fetchTasks]);

    const handleAdd = async () => {
        const title = newTitle.trim();
        if (!title) return;
        setIsSaving(true);
        try {
            // Assign it to whoever is adding it. A task with no assignee is
            // nobody's work: it never reached Today (which asks for tasks
            // assigned to you) and showed a blank name on the Team board, so
            // adding one here looked like it had done nothing. Reassigning is
            // a manager's job on the board; having an owner is the default.
            await tasksApi.create({ farmId, title, assignedToId: assignedToId ?? userId });
            setNewTitle('');
            await fetchTasks();
        } catch (err: any) {
            Alert.alert(t('content.tasks.errorAddTitle'), apiErrorMessage(err, t('content.tasks.errorAddFallback')));
        } finally {
            setIsSaving(false);
        }
    };

    const advanceStatus = async (task: Task) => {
        // Terminal states aren't advanced by tapping (manager verifies a done task).
        if (['done', 'verified', 'cancelled'].includes(task.status)) return;
        const next = NEXT_STATUS[task.status] ?? 'in_progress';
        // Optimistic update for snappy UX; reconcile on failure.
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
        try {
            // Completing routes through the assignee-enforced endpoint.
            if (next === 'done') await tasksApi.complete(task.id);
            else await tasksApi.update(task.id, { status: next });
        } catch {
            fetchTasks();
        }
    };

    /** Long press: step a task back, for the tap that hit the wrong row. */
    const revertStatus = async (task: Task) => {
        const prev = PREV_STATUS[task.status];
        if (!prev) return;
        setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, status: prev } : t)));
        try {
            await tasksApi.update(task.id, { status: prev });
        } catch {
            fetchTasks();
        }
    };

    const verifyTask = async (task: Task) => {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'verified' } : t)));
        try {
            await tasksApi.verify(task.id);
        } catch {
            fetchTasks();
        }
    };

    const handleDelete = (task: Task) => {
        Alert.alert(t('content.tasks.deleteAlertTitle'), t('content.tasks.deleteAlertMessage', { title: task.title }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    setTasks((prev) => prev.filter((t) => t.id !== task.id));
                    try {
                        await tasksApi.delete(task.id);
                    } catch {
                        fetchTasks();
                    }
                },
            },
        ]);
    };

    const renderItem = ({ item }: { item: Task }) => {
        const meta = STATUS_META[item.status] ?? STATUS_META.open;
        const done = item.status === 'done' || item.status === 'verified';
        return (
            <Card style={styles.card}>
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => advanceStatus(item)}
                    onLongPress={() => revertStatus(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityHint={
                        PREV_STATUS[item.status] ? t('content.tasks.revertHint') : undefined
                    }
                >
                    <MaterialCommunityIcons name={meta.icon as any} size={24} color={meta.color} />
                    <View style={styles.body}>
                        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text style={[styles.statusText, { color: meta.color }]}>
                            {meta.label}
                            {item.dueDate ? `  ·  ${t('content.tasks.dueDate', { date: item.dueDate })}` : ''}
                        </Text>
                    </View>
                    <View style={styles.rowActions}>
                        {item.status === 'done' && perms.canManageOperations && (
                            <TouchableOpacity onPress={() => verifyTask(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('content.tasks.verify', 'Verify')}>
                                <MaterialCommunityIcons name="check-decagram-outline" size={20} color={c.primary} />
                            </TouchableOpacity>
                        )}
                        {perms.canOwnerActions && (
                            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <MaterialCommunityIcons name="trash-can-outline" size={20} color={c.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Card>
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={c.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {assignedToId
                        ? (farmName
                            ? t('content.tasks.headerMyTasksWithFarm', { farmName })
                            : t('content.tasks.headerMyTasks'))
                        : (farmName
                            ? t('content.tasks.headerWithFarm', { farmName })
                            : t('content.tasks.headerTitle'))}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Creating/assigning tasks is owner/manager only (blueprint §28). */}
            {perms.canCreateTask && (
                <View style={styles.addRow}>
                    <TextInput
                        style={styles.input}
                        value={newTitle}
                        onChangeText={setNewTitle}
                        placeholder={t('content.tasks.addPlaceholder')}
                        placeholderTextColor={c.textTertiary}
                        onSubmitEditing={handleAdd}
                        returnKeyType="done"
                        editable={!isSaving}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={isSaving || !newTitle.trim()}>
                        {isSaving ? (
                            <ActivityIndicator size="small" color={c.textInverse} />
                        ) : (
                            <MaterialCommunityIcons name="plus" size={22} color={c.textInverse} />
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={c.primary} />
                </View>
            ) : error && tasks.length === 0 ? (
                <ErrorState title={t('content.tasks.errorLoad')} error={error} onRetry={fetchTasks} />
            ) : (
                <FlatList
                    data={tasks}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[c.primary]} tintColor={c.primary} />
                    }
                    ListEmptyComponent={
                        <EmptyState
                            icon="clipboard-check-outline"
                            title={t('content.tasks.emptyTitle')}
                            subtitle={t('content.tasks.emptySubtitle')}
                        />
                    }
                />
            )}
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
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        padding: theme.spacing[4],
    },
    input: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: c.borderDefault,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing[3],
        ...theme.typeScale.bodyMedium,
        color: c.textPrimary,
        backgroundColor: c.surface,
    },
    addBtn: {
        width: 44,
        height: 44,
        borderRadius: theme.radius.md,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: { padding: theme.spacing[4], paddingBottom: 100 },
    card: { marginBottom: theme.spacing[3], padding: theme.spacing[3] },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
    body: { flex: 1 },
    title: { ...theme.typeScale.bodyLarge, color: c.textPrimary },
    titleDone: { textDecorationLine: 'line-through', color: c.textTertiary },
    statusText: { ...theme.typeScale.caption, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default TaskListScreen;
