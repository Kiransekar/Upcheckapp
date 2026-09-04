/**
 * A glyph name that does not exist in the MCI font renders as a blank square
 * with no warning, so a typo in the curated list is invisible until a farmer
 * picks it. Check the whole list against the real glyphmap.
 */
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { ALL_ICONS, ICON_GROUPS } from '../IconPicker';
import { CATEGORY_ICON } from '../../../api/inventory';

describe('curated icon list', () => {
    it('contains only glyphs that exist in MaterialCommunityIcons', () => {
        const missing = ALL_ICONS.filter((n) => !(n in (glyphMap as Record<string, number>)));
        expect(missing).toEqual([]);
    });

    it('has no duplicates within a group and covers every group', () => {
        expect(ICON_GROUPS.length).toBe(8);
        for (const g of ICON_GROUPS) {
            expect(new Set(g.icons).size).toBe(g.icons.length);
            expect(g.icons.length).toBeGreaterThan(0);
        }
    });

    it('offers enough to choose from without being the whole font', () => {
        expect(ALL_ICONS.length).toBeGreaterThan(120);
        expect(ALL_ICONS.length).toBeLessThan(250);
    });

    it('every category default icon is a real glyph too', () => {
        for (const icon of Object.values(CATEGORY_ICON)) {
            expect(icon in (glyphMap as Record<string, number>)).toBe(true);
        }
    });
});
