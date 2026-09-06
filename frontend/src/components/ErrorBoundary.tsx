import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { reportError } from '../utils/reportError';
import { isCrashReportingActive } from '../utils/sentry';
import i18n from '../i18n';

/**
 * The crash screen speaks the farmer's language, but never depends on being
 * able to.
 *
 * This is a class component and, more to the point, it is what renders when
 * something has ALREADY gone wrong — possibly i18n itself, possibly before it
 * finished initialising. So it reads the translation defensively and falls back
 * to English rather than throwing inside the boundary that exists to catch
 * throws. An error screen that crashes leaves a farmer with a white rectangle
 * and no way out.
 */
const say = (key: string, fallback: string): string => {
    try {
        const out = i18n.t(key);
        return typeof out === 'string' && out !== key ? out : fallback;
    } catch {
        return fallback;
    }
};

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    // Bumped on reset to force a full remount of the child tree. Just clearing
    // hasError re-renders the SAME (crashed) navigation state, so a screen that
    // threw during render throws again immediately. Remounting drops the crashed
    // subtree — including the NavigationContainer, which rebuilds at its initial
    // (safe) route — which is the real "get me out of here" recovery.
    resetKey: number;
    /**
     * Did this crash ACTUALLY reach us? True only when crash reporting is
     * initialised and the farmer has not switched it off, so the reassurance
     * shown on screen is never a claim we have not honoured.
     */
    reported: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, resetKey: 0, reported: false };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        reportError(error, { componentStack: errorInfo.componentStack });
        /**
         * Whether the report ACTUALLY went anywhere, captured at the moment it
         * was sent rather than assumed.
         *
         * `isCrashReportingActive()` is true only when Sentry is initialised
         * AND the farmer has left crash reports on, so this can never tell
         * someone their crash was reported when it was not — which would be
         * both a lie and a privacy claim we had broken.
         */
        try {
            this.setState({ reported: isCrashReportingActive() });
        } catch {
            // Never let the reporting notice be the thing that crashes the
            // crash screen.
        }
    }

    handleReset = () => {
        this.setState((s) => ({ hasError: false, error: null, resetKey: s.resetKey + 1 }));
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#E03535" />
                        <Text style={styles.title}>{say('common.crashTitle', 'Something went wrong')}</Text>
                        <Text style={styles.subtitle}>
                            {say('common.crashBody', 'The app encountered an unexpected error. Please try again.')}
                        </Text>

                        {__DEV__ && this.state.error && (
                            <ScrollView style={styles.errorBox}>
                                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                            </ScrollView>
                        )}

                        <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={say('common.tryAgain', 'Try Again')}>
                            <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
                            <Text style={styles.buttonText}>{say('common.tryAgain', 'Try Again')}</Text>
                        </TouchableOpacity>

                        {/*
                          * Only when the report GENUINELY went (crash reporting
                          * initialised and not switched off). Telling a farmer
                          * who opted out that we had just collected their crash
                          * would be a lie and a broken privacy promise in the
                          * same sentence.
                          *
                          * Below the button, deliberately: getting back into
                          * the app is what they came here to do; this is
                          * reassurance, not an obstacle.
                          */}
                        {this.state.reported && (
                            <View style={styles.reportedBox}>
                                <MaterialCommunityIcons name="shield-check-outline" size={18} color="#3E5163" />
                                <Text style={styles.reportedText}>
                                    {say(
                                        'common.crashReportSent',
                                        'This has been sent to our team automatically. We will look into it and fix it — thank you for helping make the app better for everyone. You can turn this off any time in Settings.',
                                    )}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            );
        }

        return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F8FA',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        maxWidth: 320,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1A222B',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#3E5163',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    reportedBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 20,
        paddingHorizontal: 4,
    },
    reportedText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: '#3E5163',
    },
    errorBox: {
        backgroundColor: '#FDF0F0',
        borderRadius: 8,
        padding: 12,
        maxHeight: 120,
        width: '100%',
        marginBottom: 24,
    },
    errorText: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: '#A41B1B',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#0D84D6',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
