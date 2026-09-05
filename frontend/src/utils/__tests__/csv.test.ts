/**
 * The escaping is the only thing in the CSV path that can silently corrupt an
 * export: a worker called "Rao, Anita" or a note with a line break in it
 * shifts every column after it, into a spreadsheet that still looks fine.
 */
import { toCsv } from '../csv';

describe('toCsv', () => {
    it('writes the headings first, then one line per row', () => {
        expect(toCsv([['a', 'b'], ['c', 'd']], ['One', 'Two'])).toBe('One,Two\na,b\nc,d');
    });

    it('quotes a cell containing a comma', () => {
        expect(toCsv([['Rao, Anita']], ['Name'])).toBe('Name\n"Rao, Anita"');
    });

    it('doubles quotes inside a quoted cell', () => {
        expect(toCsv([['he said "no"']], ['Note'])).toBe('Note\n"he said ""no"""');
    });

    it('quotes a cell containing a newline rather than breaking the row', () => {
        const csv = toCsv([['line one\nline two', 'x']], ['Note', 'Tag']);
        expect(csv).toBe('Note,Tag\n"line one\nline two",x');
        // Four physical lines, two logical records — which is the point.
        expect(csv.split('\n')).toHaveLength(3);
    });

    it('quotes a heading that needs it too', () => {
        expect(toCsv([], ['Name, full'])).toBe('"Name, full"');
    });

    it('writes null and undefined as an empty cell, not "null"', () => {
        expect(toCsv([[null, undefined, '']], ['a', 'b', 'c'])).toBe('a,b,c\n,,');
    });

    it('keeps numbers as numbers', () => {
        expect(toCsv([[0, 6.5, -2]], ['a', 'b', 'c'])).toBe('a,b,c\n0,6.5,-2');
    });

    it('leaves a plain cell unquoted', () => {
        expect(toCsv([['2026-06-03', 'Anita']], ['Date', 'Name'])).toBe(
            'Date,Name\n2026-06-03,Anita',
        );
    });
});
