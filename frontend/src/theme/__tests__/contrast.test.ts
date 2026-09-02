import { theme } from '../index';

/**
 * QA BUG-006 and BUG-014. Placeholder text was #A3B5BF on #EEF2F5 — 1.88:1,
 * against a WCAG AA requirement of 4.5:1 — and hint text was #7A909F on white,
 * 3.32:1 at 11px, where no large-text exemption exists.
 *
 * Neither is decorative: placeholders carry the only worked example of the
 * expected magnitude and unit (28700 for a stocking count), and hints carry the
 * clarifying guidance, including the salinity hint that BUG-002 made
 * safety-relevant. The target user is often outdoors in bright sunlight.
 *
 * The colours were borrowed from the disabled-grey family, which is a different
 * contrast budget. This pins them so the pair cannot silently regress again.
 */
const relativeLuminance = (hex: string): number => {
    const channel = (i: number) => {
        const v = parseInt(hex.substr(i, 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

export const contrastRatio = (a: string, b: string): number => {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const AA_NORMAL_TEXT = 4.5;

/** Both surfaces an Input renders against: unfocused field and surfaceVariant. */
const INPUT_BACKGROUNDS = ['#F5F8FA', '#EEF2F5'];

describe('theme contrast — WCAG 2.1 AA', () => {
    it('sanity-checks the ratio function against known pairs', () => {
        expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
        expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    });

    it.each(INPUT_BACKGROUNDS)('placeholder text clears AA on %s', (bg) => {
        expect(contrastRatio(theme.tokens.input.placeholderColor, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('hint/helper text clears AA on a white card', () => {
        expect(contrastRatio(theme.tokens.input.helperColor, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('tertiary text clears AA on a white card', () => {
        expect(contrastRatio(theme.roles.light.textTertiary, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    // Two more 11px tokens were left on the failing #7A909F after BUG-014's
    // first pass — caption text and section-header labels. Both are real
    // content, not decoration, so they owe the same AA budget as the hint
    // text above.
    it('caption text clears AA on a white card', () => {
        expect(contrastRatio(theme.typeScale.caption.color, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('section header text clears AA on a white card', () => {
        expect(contrastRatio(theme.tokens.sectionHeader.color, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
});
