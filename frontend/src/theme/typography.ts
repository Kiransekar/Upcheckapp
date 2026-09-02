export const typeScale = {
    // ── Display (Nunito, Brand contexts) ──────────────────────
    displayLarge: {
        fontFamily: 'Nunito-ExtraBold',
        fontSize: 34,
        lineHeight: 42,
        letterSpacing: -0.5,
    },
    displayMedium: {
        fontFamily: 'Nunito-Bold',
        fontSize: 28,
        lineHeight: 36,
        letterSpacing: -0.3,
    },
    displaySmall: {
        fontFamily: 'Nunito-Bold',
        fontSize: 22,
        lineHeight: 30,
        letterSpacing: -0.2,
    },

    // ── Headings (Nunito) ──────────────────────────────────────
    h1: {
        fontFamily: 'Nunito-Bold',
        fontSize: 22,
        lineHeight: 30,
        letterSpacing: -0.2,
    },
    h2: {
        fontFamily: 'Nunito-Bold',
        fontSize: 18,
        lineHeight: 26,
        letterSpacing: -0.1,
    },
    h3: {
        fontFamily: 'Nunito-SemiBold',
        fontSize: 16,
        lineHeight: 24,
    },
    h4: {
        fontFamily: 'Nunito-SemiBold',
        fontSize: 14,
        lineHeight: 20,
    },

    // ── Body (DM Sans) ─────────────────────────────────────────
    bodyLarge: {
        fontFamily: 'DMSans-Regular',
        fontSize: 16,
        lineHeight: 24,
    },
    bodyMedium: {
        fontFamily: 'DMSans-Regular',
        fontSize: 14,
        lineHeight: 20,
    },
    bodySmall: {
        fontFamily: 'DMSans-Regular',
        fontSize: 12,
        lineHeight: 18,
    },

    // ── Labels (DM Sans Medium) ────────────────────────────────
    labelLarge: {
        fontFamily: 'DMSans-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    labelMedium: {
        fontFamily: 'DMSans-SemiBold',
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.2,
    },
    labelSmall: {
        fontFamily: 'DMSans-Medium',
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.4,
        textTransform: 'uppercase' as const,
    },

    // ── Numeric / Data (DM Mono) ───────────────────────────────
    numericHero: {
        fontFamily: 'DMMono-Medium',
        fontSize: 36,
        lineHeight: 44,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'] as ('tabular-nums' | 'proportional-nums' | 'lining-nums' | 'oldstyle-nums' | 'small-caps')[],
    },
    numericLarge: {
        fontFamily: 'DMMono-Medium',
        fontSize: 24,
        lineHeight: 32,
        fontVariant: ['tabular-nums'] as ('tabular-nums' | 'proportional-nums' | 'lining-nums' | 'oldstyle-nums' | 'small-caps')[],
    },
    numericMedium: {
        fontFamily: 'DMMono-Regular',
        fontSize: 18,
        lineHeight: 24,
        fontVariant: ['tabular-nums'] as ('tabular-nums' | 'proportional-nums' | 'lining-nums' | 'oldstyle-nums' | 'small-caps')[],
    },
    numericSmall: {
        fontFamily: 'DMMono-Regular',
        fontSize: 13,
        lineHeight: 18,
        fontVariant: ['tabular-nums'] as ('tabular-nums' | 'proportional-nums' | 'lining-nums' | 'oldstyle-nums' | 'small-caps')[],
    },

    // ── Caption / Fine Print ───────────────────────────────────
    caption: {
        fontFamily: 'DMSans-Regular',
        fontSize: 11,
        lineHeight: 16,
        // #7A909F was 3.32:1 on white, failing WCAG AA at 11px (QA BUG-014).
        // 5.21:1.
        color: '#5C6F7E',
    },
    overline: {
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 1.0,
        textTransform: 'uppercase' as const,
    },
};
