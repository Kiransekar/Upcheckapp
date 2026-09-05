/**
 * The regression this pins: reportError used to be console-only, so every
 * error the app CAUGHT — including every ErrorBoundary render crash — never
 * reached Sentry, and the first build with Sentry in it reported nothing.
 */
jest.mock('../sentry', () => ({ captureError: jest.fn() }));

import { reportError } from '../reportError';
import { captureError } from '../sentry';

describe('reportError', () => {
    const mockedCapture = captureError as jest.Mock;
    let spy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => spy.mockRestore());

    it('forwards a caught error to the crash reporter', () => {
        const err = new Error('render blew up');
        reportError(err);
        expect(mockedCapture).toHaveBeenCalledWith(err, undefined);
    });

    it('passes context through, so a componentStack survives', () => {
        const err = new Error('boom');
        reportError(err, { componentStack: '<PondCard>' });
        expect(mockedCapture).toHaveBeenCalledWith(err, { componentStack: '<PondCard>' });
    });

    it('still logs to the console — on a device with reporting off that is the only record', () => {
        reportError(new Error('x'));
        expect(spy).toHaveBeenCalled();
    });
});
