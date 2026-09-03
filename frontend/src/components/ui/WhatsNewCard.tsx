import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { Icon } from './Icon';
import { StatusBadge, StatusType } from './StatusBadge';
import { Button } from './Button';
import { LANGUAGES } from '../../i18n/languages';
import { announcementsApi, Announcement } from '../../api/announcements';

const CATEGORY_STATUS: Record<string, StatusType> = {
    feature: 'active',
    fix: 'warning',
    change: 'info',
};

/**
 * "What's New" — undismissed announcements the farmer hasn't seen yet.
 *
 * Multiple cards are shown ONE AT A TIME with a small "X of Y" counter
 * rather than a stack or a swipeable pager: a farmer skimming this on a
 * cracked screen in bright sun should never have to figure out a gesture,
 * and one clear message at a time reads better than several competing for
 * attention. "Got it" dismisses the current card (server-side, via
 * POST /announcements/:id/dismiss) and advances to the next.
 *
 * Fetches once per mount (i.e. once per app open, per where this is
 * rendered in App.tsx). A failed fetch is swallowed — this is a
 * nice-to-have surface and must never block or degrade app start.
 */
export const WhatsNewCard: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [cards, setCards] = useState<Announcement[] | null>(null);
    const [index, setIndex] = useState(0);
    // In-card language override. Independent of the app's own language —
    // switching here only changes which translation of THIS payload is
    // shown, and reads straight from the map already fetched (no refetch).
    const [viewLocale, setViewLocale] = useState(i18n.language);

    useEffect(() => {
        let cancelled = false;
        announcementsApi
            .getAll(i18n.language)
            .then((res) => {
                if (!cancelled) setCards(res.data ?? []);
            })
            .catch(() => {
                if (!cancelled) setCards([]);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!cards || cards.length === 0 || index >= cards.length) return null;

    const card = cards[index];
    const localized = card.translations[viewLocale] ?? card.translations.en;
    const status = CATEGORY_STATUS[card.category] ?? 'info';

    const dismiss = () => {
        announcementsApi.dismiss(card.id).catch(() => {
            /* idempotent; a dropped response just means it reappears next open */
        });
        setIndex((i) => i + 1);
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
            <View style={styles.overlay}>
                <View style={styles.card} testID="whats-new-card">
                    <View style={styles.header}>
                        <StatusBadge
                            status={status}
                            label={t(`whatsNew.category_${card.category}`, card.category)}
                        />
                        <TouchableOpacity
                            onPress={dismiss}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.close')}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={styles.closeBtn}
                        >
                            <Icon name="close" size={20} color={theme.roles.light.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.title}>{localized.title}</Text>
                    <Text style={styles.body}>{localized.body}</Text>

                    <View style={styles.langRow}>
                        {LANGUAGES.map((lang) => {
                            const active = lang.code === viewLocale;
                            return (
                                <TouchableOpacity
                                    key={lang.code}
                                    onPress={() => setViewLocale(lang.code)}
                                    style={[styles.langChip, active && styles.langChipActive]}
                                    accessibilityRole="button"
                                    accessibilityLabel={lang.nativeLabel}
                                    accessibilityState={{ selected: active }}
                                >
                                    <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                                        {lang.nativeLabel}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.footer}>
                        {cards.length > 1 && (
                            <Text style={styles.counter}>
                                {t('whatsNew.counter', { current: index + 1, total: cards.length })}
                            </Text>
                        )}
                        <Button title={t('whatsNew.gotIt')} onPress={dismiss} style={styles.gotItButton} />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: theme.spacing[5],
    },
    card: {
        backgroundColor: theme.roles.light.surface,
        borderRadius: theme.radius.xl,
        padding: theme.spacing[5],
        gap: theme.spacing[3],
        ...theme.shadows.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    closeBtn: {
        minWidth: 48,
        minHeight: 48,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    title: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
    },
    body: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textSecondary,
    },
    langRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
    },
    langChip: {
        minHeight: 48,
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        alignItems: 'center',
        justifyContent: 'center',
    },
    langChipActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surfaceOverlay,
    },
    langChipText: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
    },
    langChipTextActive: {
        color: theme.roles.light.primary,
        fontWeight: '700',
    },
    footer: {
        gap: theme.spacing[2],
    },
    counter: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
    },
    gotItButton: {
        alignSelf: 'stretch',
    },
});

export default WhatsNewCard;
