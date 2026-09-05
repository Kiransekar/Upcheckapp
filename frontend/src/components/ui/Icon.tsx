import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { theme } from '../../theme';

/**
 * Material Symbols Rounded, as used throughout the redesign.
 *
 * The designs name icons in Material Symbols terms (`edit_note`,
 * `currency_rupee`, `water_drop`). The app's existing icon set is
 * MaterialCommunityIcons, whose names and glyph shapes differ, so screens built
 * to the designs render this instead of translating each name by hand and
 * drifting from the drawing.
 *
 * Material Symbols is a LIGATURE font: you render the icon's NAME as text and
 * the font substitutes the glyph. That is why this is a `<Text>` and not an
 * `<Image>` or an SVG — it also means icons inherit colour and can be sized
 * with `fontSize` like any other text.
 *
 * MaterialCommunityIcons is NOT removed. It is still correct for every screen
 * that has not been redesigned, and mixing the two mid-migration is less
 * jarring than half-converting a screen. New redesigned screens use this.
 */

/** Icon names used by the redesign. Typed so a typo fails the build rather than rendering the literal word. */
export type IconName =
    // navigation / chrome
    | 'flag' | 'grid_view' | 'edit_note' | 'currency_rupee' | 'groups' | 'settings'
    | 'arrow_back' | 'arrow_forward' | 'chevron_left' | 'chevron_right' | 'expand_more' | 'more_vert'
    | 'menu' | 'add' | 'check' | 'cancel' | 'close' | 'newspaper' | 'open_in_new'
    // domain
    | 'water_drop' | 'grain' | 'set_meal' | 'grass' | 'agriculture' | 'science'
    | 'scale' | 'warehouse' | 'waves'
    // state / meta
    | 'schedule' | 'sort' | 'warning' | 'checklist' | 'check_circle' | 'radio_button_unchecked'
    | 'event_busy' | 'event_available' | 'insights' | 'show_chart' | 'assessment'
    | 'dashboard' | 'receipt_long' | 'account_balance' | 'account_circle'
    | 'lightbulb' | 'workspace_premium' | 'key' | 'qr_code_2' | 'share'
    | 'content_copy' | 'person_add' | 'badge' | 'delete'
    // first-run onboarding — see docs/design/onboarding/*.html
    | 'translate' | 'home_work' | 'engineering' | 'visibility' | 'location_on'
    | 'qr_code_scanner'
    // farmer feedback / issue reports
    | 'feedback' | 'add_a_photo' | 'send' | 'mark_chat_unread'
    // Phase 2 — the activity timeline, cycle history and archive lifecycle
    | 'history' | 'search' | 'archive' | 'unarchive'
    // Phase 3 polish — telling the daily chemical log and weekly chemistry
    // panel tiles apart; both used to render 'science'.
    | 'calendar_month';

export interface IconProps {
    name: IconName;
    /** Matches the design's px sizes: 20 inline, 22 nav, 24 list, 26–28 feature. */
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
    /**
     * Icons are decorative by default — a labelled row should not announce its
     * icon twice. Pass a label only when the icon IS the control.
     */
    accessibilityLabel?: string;
}

export const Icon: React.FC<IconProps> = ({
    name,
    size = 24,
    color = theme.roles.light.textPrimary,
    style,
    accessibilityLabel,
}) => (
    <Text
        // Icons must never scale with the OS font setting — a 24px glyph at
        // 200% would break every row it sits in. Text around it still scales.
        allowFontScaling={false}
        accessible={!!accessibilityLabel}
        accessibilityRole={accessibilityLabel ? 'image' : undefined}
        accessibilityLabel={accessibilityLabel}
        importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
        style={[
            {
                fontFamily: 'MaterialSymbolsRounded',
                fontSize: size,
                lineHeight: size,
                color,
            },
            style,
        ]}
    >
        {name}
    </Text>
);

export default Icon;
