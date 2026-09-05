/**
 * Filenames and the write encoding. Both are silent failures in production:
 * a bad character means a write that never happens, and a UTF-8 XLSX opens as
 * a corrupt workbook rather than as an error.
 */

const mockWrite = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();
const mockMove = jest.fn();
const mockShare = jest.fn(async () => undefined);
const mockCanShare = jest.fn(async () => true);

jest.mock('expo-file-system', () => ({
    Paths: { cache: 'file:///cache/' },
    File: jest.fn().mockImplementation((...uris: string[]) => ({
        uri: `file:///cache/${uris[uris.length - 1]}`,
        exists: false,
        create: mockCreate,
        write: mockWrite,
        delete: mockDelete,
        move: mockMove,
    })),
}));
// Dereferenced inside the arrows on purpose: a jest.mock factory runs during
// the hoisted import, before these consts are assigned, so naming them
// directly would capture `undefined`.
jest.mock('expo-sharing', () => ({
    __esModule: true,
    shareAsync: (...args: unknown[]) => mockShare(...(args as [])),
    isAvailableAsync: () => mockCanShare(),
}));

import { deliver, safeFilename } from '../deliver';

beforeEach(() => {
    jest.clearAllMocks();
    mockCanShare.mockResolvedValue(true);
});

describe('safeFilename', () => {
    it('builds a readable name', () => {
        expect(safeFilename(['Neerani', 'cycle', 'Green Acres', '2026-09-05'], 'pdf'))
            .toBe('Neerani-cycle-Green-Acres-2026-09-05.pdf');
    });

    it('cannot be talked into a path traversal', () => {
        const name = safeFilename(['Neerani', '../../etc', 'A/B Farm'], 'csv');
        expect(name).toBe('Neerani-etc-A-B-Farm.csv');
        expect(name).not.toContain('/');
        expect(name).not.toContain('..');
    });

    it('drops emoji and keeps Devanagari', () => {
        expect(safeFilename(['🐟🌾 Farm'], 'xlsx')).toBe('Farm.xlsx');
        expect(safeFilename(['हरित एकड़'], 'xlsx')).toBe('हरित-एकड़.xlsx');
    });

    it('never produces an empty stem', () => {
        expect(safeFilename(['///', '   ', null, undefined], 'csv')).toBe('report.csv');
    });
});

describe('deliver', () => {
    it('writes XLSX as base64, not UTF-8', async () => {
        await deliver({ filename: 'a.xlsx', format: 'xlsx', content: 'UEsDBA==' });
        expect(mockWrite).toHaveBeenCalledWith('UEsDBA==', { encoding: 'base64' });
    });

    it('writes CSV as UTF-8 text', async () => {
        await deliver({ filename: 'a.csv', format: 'csv', content: 'a,b' });
        expect(mockWrite).toHaveBeenCalledWith('a,b', { encoding: 'utf8' });
    });

    it('moves an already-written PDF instead of rewriting it', async () => {
        const result = await deliver({ filename: 'a.pdf', format: 'pdf', sourceUri: 'file:///tmp/uuid.pdf' });
        expect(mockMove).toHaveBeenCalled();
        expect(mockWrite).not.toHaveBeenCalled();
        expect(result.mimeType).toBe('application/pdf');
    });

    it('shares the file with a mime type and a UTI', async () => {
        const result = await deliver({ filename: 'a.csv', format: 'csv', content: 'a,b' });
        expect(mockShare).toHaveBeenCalledWith(
            result.uri,
            expect.objectContaining({ mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' }),
        );
    });

    it('still returns the written file when the device cannot share', async () => {
        mockCanShare.mockResolvedValueOnce(false);
        const result = await deliver({ filename: 'a.csv', format: 'csv', content: 'a,b' });
        expect(mockShare).not.toHaveBeenCalled();
        expect(result.uri).toContain('a.csv');
    });
});
