import { mark, recordedMarks } from '../startupTrace';

describe('startupTrace', () => {
    it('collects marks and prints exactly one summary line at nav-ready', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

        mark('module-eval');
        mark('auth-bootstrap');
        expect(log).not.toHaveBeenCalled(); // nothing printed before the finish line
        expect(recordedMarks()).toHaveLength(2);

        mark('nav-ready');
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0][0]).toMatch(
            /^\[startup\] module-eval=\d+ms auth-bootstrap=\d+ms nav-ready=\d+ms /,
        );

        // A late mark still reports, on its own line, and never re-prints the summary.
        mark('fonts');
        expect(log).toHaveBeenCalledTimes(2);
        expect(log.mock.calls[1][0]).toMatch(/^\[startup\] \+\d+ms fonts$/);

        log.mockRestore();
    });
});
