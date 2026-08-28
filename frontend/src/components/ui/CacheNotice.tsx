import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { theme } from '../../theme';
import { useSyncStore } from '../../store/syncStore';
import { formatTime, formatDate } from '../../utils/formatDate';

const c = theme.roles.light;

/**
 * "Showing saved data · as of 14:32".
 *
 * A screen that renders its cached copy must SAY it is a cached copy. A farmer
 * deciding whether to run the aerators off a dissolved-oxygen reading has to be
 * able to see that the reading is six hours old — a stale number presented as a
 * live one is worse than no number at all.
 *
 * Renders nothing when there is nothing to caveat: no cached timestamp, or a
 * fetch that just succeeded while connected.
 */
export interface CacheNoticeProps {
    /** `dataUpdatedAt` from the query — when this data actually came back. */
    updatedAt?: number;
    /** The latest refetch failed, so what is on screen is the old copy. */
    stale?: boolean;
}

export const CacheNotice: React.FC<CacheNoticeProps> = ({ updatedAt, stale }) => {
    const { t } = useTranslation();
    const isConnected = useSyncStore((s) => s.isConnected);

    // Offline counts as stale even before the refetch has failed — the farmer
    // should not have to wait out a timeout to learn what they are looking at.
    if (!updatedAt || (!stale && isConnected)) return null;

    const when = new Date(updatedAt);
    const sameDay = when.toDateString() === new Date().toDateString();

    return (
        <View style={styles.row}>
            <Icon name="schedule" size={16} color={c.warningText} />
            <Text style={styles.text}>
                {t('common.cachedAsOf', {
                    when: sameDay ? formatTime(when) : `${formatDate(when)} ${formatTime(when)}`,
                })}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2],
        backgroundColor: c.warningBg,
        borderBottomWidth: 1,
        borderBottomColor: c.borderDefault,
    },
    text: {
        ...theme.typeScale.bodySmall,
        color: c.warningText,
        flex: 1,
    },
});
