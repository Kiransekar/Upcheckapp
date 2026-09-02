export const tokens = {
    // ── Button ──────────────────────────────────────────────
    button: {
        heightSm: 36,
        heightMd: 48,
        heightLg: 56,
        paddingH: 24,
        paddingHSm: 16,
        font: 'DMSans-SemiBold',
        fontSizeMd: 15,
        fontSizeSm: 13,
        fontSizeLg: 16,
        radiusPrimary: 9999, // pill
        radiusSecondary: 9999, // pill
        radiusText: 0,
        // Primary gradient: brandGradient
        // Shadow on primary: shadows.brandGlow
    },

    // ── Input ───────────────────────────────────────────────
    input: {
        height: 52,
        paddingH: 14,
        paddingV: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E0E8EC',
        borderColorFocus: '#0D84D6',
        borderColorError: '#E03535',
        bgDefault: '#F5F8FA',
        bgFocused: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'DMSans-Regular',
        labelFontFamily: 'DMSans-SemiBold',
        labelFontSize: 12,
        labelColor: '#3E5163',
        // Placeholders carry the worked example of magnitude and unit, so they are
        // informational text and owe WCAG AA 4.5:1 — not the disabled-grey budget
        // they used to borrow from textDisabled. 4.70:1 on #EEF2F5 (QA BUG-006).
        placeholderColor: '#586E82',
        textColor: '#1A222B',
        helperFontSize: 11,
        // Hints at 11px have no large-text exemption; #7A909F was 3.32:1 on a
        // white card (QA BUG-014). 5.21:1.
        helperColor: '#5C6F7E',
        errorColor: '#A41B1B',
        iconColor: '#7A909F',
        iconColorFocus: '#0D84D6',
        // Focus ring: 2px border of primary-600
    },

    // ── Card ────────────────────────────────────────────────
    card: {
        bgDefault: '#FFFFFF',
        bgTinted: '#F5F8FA',
        bgBrand: 'transparent', // use gradient
        paddingH: 16,
        paddingV: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E0E8EC',
        // shadow: shadows.sm
    },

    // ── Chip / Badge ────────────────────────────────────────
    chip: {
        height: 26,
        paddingH: 10,
        borderRadius: 9999,
        fontSize: 11,
        fontFamily: 'DMSans-SemiBold',
        letterSpacing: 0.4,
        // Variants styled by status color tokens
    },

    // ── Bottom Tab Bar ──────────────────────────────────────
    tabBar: {
        height: 64,
        bgColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E8EC',
        activeColor: '#0D84D6',
        inactiveColor: '#A3B5BF',
        labelFontSize: 10,
        labelFontFamily: 'DMSans-SemiBold',
        iconSize: 22,
        // Active tab: icon + label in primary-600
        // Active indicator: 3px rounded bar above icon
    },

    // ── List Item ───────────────────────────────────────────
    listItem: {
        minHeight: 56,
        paddingH: 16,
        paddingV: 12,
        separatorColor: '#EEF2F5',
        separatorInset: 16,
    },

    // ── Section Header ──────────────────────────────────────
    sectionHeader: {
        paddingH: 16,
        paddingV: 8,
        bgColor: '#F5F8FA',
        fontSize: 11,
        fontFamily: 'DMSans-SemiBold',
        // #7A909F was 3.32:1 on white, failing WCAG AA at 11px (QA BUG-014).
        // 5.21:1.
        color: '#5C6F7E',
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
    },

    // ── Alert Banner ────────────────────────────────────────
    alertBanner: {
        paddingH: 14,
        paddingV: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        fontSize: 13,
        fontFamily: 'DMSans-Medium',
    },
};
