// RootNavigator supplies ~110 screens through `getComponent={() => require(...).X}`
// so their modules stay off the startup path. The failure mode that buys is a
// silent one: a wrong export name returns `undefined`, TypeScript cannot see it
// (require is untyped), and the route renders a blank screen — only for whoever
// happens to visit that route in production.
//
// So: parse the navigator source, and actually resolve every one of them.
import fs from 'fs';
import path from 'path';

jest.setTimeout(300000); // ~110 real screen modules get evaluated below.

// src/lib/supabase.ts calls createClient() at module scope and throws without
// EXPO_PUBLIC_SUPABASE_URL. That is an env concern, not an export-shape one.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'RootNavigator.tsx'), 'utf8');

// getComponent={() => require('../screens/foo/BarScreen').BarScreen}
const GET_COMPONENT = /getComponent=\{\(\) => require\('([^']+)'\)\.(\w+)\}/g;
// component={Foo} — the deliberately eager ones.
const COMPONENT = /component=\{(\w+)\}/g;

const deferred = [...SOURCE.matchAll(GET_COMPONENT)].map(([, spec, exportName]) => ({ spec, exportName }));
const eager = [...SOURCE.matchAll(COMPONENT)].map(([, name]) => name);

const isComponent = (v: unknown) => typeof v === 'function' || (typeof v === 'object' && v !== null);

describe('RootNavigator screen wiring', () => {
    it('defers the bulk of the stack', () => {
        // Guards against a future edit quietly reverting screens to static
        // imports; the whole point of the change is that this stays large.
        expect(deferred.length).toBeGreaterThan(100);
    });

    it('keeps only the first-paint screens eager', () => {
        expect(eager.sort()).toEqual(['LanguageScreen', 'MainNavigator', 'WelcomeScreen']);
    });

    it.each(deferred.map((d) => [`${d.spec} -> ${d.exportName}`, d.spec, d.exportName]))(
        'resolves %s',
        (_label, spec, exportName) => {
            // spec is relative to src/navigation; this test sits one level deeper.
            const mod = require('../' + spec);
            expect(mod[exportName as string]).toBeDefined();
            expect(isComponent(mod[exportName as string])).toBe(true);
        },
    );

    it('has no duplicate require path with a mismatched export name', () => {
        // Same module referenced from both the auth and the authed stack must
        // name the same export both times.
        const byPath = new Map<string, Set<string>>();
        for (const { spec, exportName } of deferred) {
            if (!byPath.has(spec)) byPath.set(spec, new Set());
            byPath.get(spec)!.add(exportName);
        }
        const mismatched = [...byPath.entries()].filter(([, names]) => names.size > 1);
        expect(mismatched).toEqual([]);
    });
});
