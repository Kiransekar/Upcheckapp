// The design asks for one "Full name" field; the API takes first + last. The
// naive split (first word / rest) loses a middle name into the surname, which
// then shows up as the person's family name everywhere in the app.
import { splitFullName } from '../RegisterScreen';

describe('splitFullName', () => {
    it('splits on the LAST space so a middle name stays with the given name', () => {
        expect(splitFullName('Ravi Kumar Reddy')).toEqual({
            firstName: 'Ravi Kumar',
            lastName: 'Reddy',
        });
    });

    it('keeps a single word as a first name with no surname', () => {
        expect(splitFullName('Ravi')).toEqual({ firstName: 'Ravi', lastName: '' });
    });

    it('tolerates stray and repeated whitespace', () => {
        expect(splitFullName('  Ravi   Reddy  ')).toEqual({
            firstName: 'Ravi',
            lastName: 'Reddy',
        });
    });

    it('returns empties for a blank name rather than throwing', () => {
        expect(splitFullName('   ')).toEqual({ firstName: '', lastName: '' });
    });
});
