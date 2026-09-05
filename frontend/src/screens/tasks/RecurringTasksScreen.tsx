/**
 * RecurringTasksScreen — the templates behind the daily tasks.
 *
 * A repeating task mints a fresh instance every day. Without this screen the
 * only way to stop one is to delete each day's instance forever, which is
 * exactly the manual work the repeat feature exists to remove. So: one list,
 * one delete, and the delete takes the future instances with it.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { tasksApi, recurrenceLabelKey, type Task } from '../../api/tasks';
import { usePermissions } from '../../hooks/usePermissions';

const c = theme.roles.light;

export const RecurringTasksScreen = ({ route, navigation }: any) => {
    const { farmId, farmName } = route.params ?? {};
    const { t } = useTranslation();
    const perms = usePermissions(farmId);

    const [templates, setTemplates] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<any>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const { data } = await tasksApi.getTemplates(farmId);
            setTemplates(Array.isArray(data) ? data : ((data as any)?.data ?? []));
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [farmId]);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    const stop = (task: Task) => {
        Alert.alert(
            t('tasks.stopRepeatTitle'),
            t('tasks.stopRepeatBody', { title: task.title }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('tasks.stopRepeatCta'),
                    style: 'destructive',
                    onPress: async () => {
                        setTemplates((prev) => prev.filter((x) => x.id !== task.id));
                        try {
                            // `series` also clears the days it has already
                            // minted ahead — otherwise "stopped" leaves a week
                            // of ghost tasks on the board.
                            await tasksApi.delete(task.id, { series: true });
                        } catch {
                            void load();
                        }
                    },
                },
            ],
        );
    };

    const renderItem = ({ item }: { item: Task }) => {
        const freq = recurrenceLabelKey(item.recurrenceRule);
        return (
            <Card style={styles.card}>
                <MaterialCommunityIcons name="repeat" size={22} color={c.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                        {[
                            freq === 'weekly' ? t('tasks.repeatWeekly') : t('tasks.repeatDaily'),
                            item.recurrenceUntil ? t('tasks.repeatUntil', { date: item.recurrenceUntil }) : t('tasks.repeatForever'),
                        ].join(' · ')}
                    </Text>
                </View>
                {perms.canCreateTask && (
                    <TouchableOpacity
                        onPress={() => stop(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('tasks.stopRepeatCta')}
                    >
                        <MaterialCommunityIcons name="stop-circle-outline" size={22} color={c.dangerText} />
                    </TouchableOpacity>
                )}
            </Card>
        );
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel={t('common.back')}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={c.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {farmName ? t('tasks.repeatingWithFarm', { farmName }) : t('tasks.repeatingTitle')}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
            ) : error && templates.length === 0 ? (
                <ErrorState title={t('tasks.repeatingTitle')} error={error} onRetry={load} />
            ) : (
                <FlatList
                    data={templates}
                    keyExtractor={(x) => x.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); void load(); }}
                            colors={[c.primary]}
                            tintColor={c.primary}
                        />
                    }
                    ListEmptyComponent={
                        <EmptyState
                            icon="repeat-off"
                            title={t('tasks.noRepeatingTitle')}
                            subtitle={t('tasks.noRepeatingSub')}
                        />
                    }
                />
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: theme.spacing[4], paddingHorizontal: theme.spacing[2],
        backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderDefault,
    },
    backBtn: { padding: theme.spacing[2] },
    headerTitle: { ...theme.typeScale.h3, color: c.textPrimary, flex: 1, textAlign: 'center' },
    list: { padding: theme.spacing[4], paddingBottom: 100 },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],
        marginBottom: theme.spacing[3], padding: theme.spacing[3],
    },
    title: { ...theme.typeScale.bodyLarge, color: c.textPrimary },
    meta: { ...theme.typeScale.caption, color: c.textTertiary, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default RecurringTasksScreen;
