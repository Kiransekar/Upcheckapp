import { Alert } from 'react-native';
import { confirm } from '../confirm';

const options = {
    title: 'Save these changes?',
    message: 'This replaces what was saved before.',
    confirmLabel: 'Save',
    cancelLabel: 'Cancel',
};

describe('confirm', () => {
    afterEach(() => jest.restoreAllMocks());

    it('resolves true when the confirm button is pressed', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
            buttons?.[1].onPress?.();
        });
        await expect(confirm(options)).resolves.toBe(true);
    });

    it('resolves false when the cancel button is pressed', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
            buttons?.[0].onPress?.();
        });
        await expect(confirm(options)).resolves.toBe(false);
    });

    // Android's back button dismisses the dialog without pressing either
    // button. Without onDismiss the promise never settles and the caller's
    // save hangs with no way out.
    it('resolves false when the dialog is dismissed', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b, opts) => {
            opts?.onDismiss?.();
        });
        await expect(confirm(options)).resolves.toBe(false);
    });
});
