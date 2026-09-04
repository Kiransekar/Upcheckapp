/**
 * The logic behind the Team hub (spec §4.2): the roster grouping, today's
 * attendance state, the tab badge, and who is allowed to decide on a request.
 *
 * These are pure functions on purpose — the screen renders them, it does not
 * own them, so none of this needs a renderer to be checked.
 */
import {
    attendanceStateFor,
    buildRoster,
    canDecideOnTeam,
    teamBadgeCount,
    type TeamOverview,
} from '../teamOverview';

const NOW = new Date('2026-09-04T10:00:00');
const YESTERDAY = '2026-09-03T09:00:00';

const member = (over: Partial<any> = {}): any => ({
    id: `m-${over.userId ?? 'x'}-${over.farmId ?? 'f1'}`,
    farmId: 'f1',
    userId: 'u1',
    role: 'worker',
    status: 'active',
    pondIds: [],
    canViewFinancials: null,
    capabilityOverrides: null,
    createdAt: NOW.toISOString(),
    user: { id: 'u1', firstName: 'Ravi', lastName: null, username: null, avatarUrl: null },
    ...over,
});

const attendance = (over: Partial<any> = {}): any => ({
    id: 'a1',
    farmId: 'f1',
    userId: 'u1',
    checkInAt: '2026-09-04T08:00:00',
    checkOutAt: null,
    createdAt: NOW.toISOString(),
    ...over,
});

const overview = (over: Partial<TeamOverview> = {}): TeamOverview => ({
    farms: [
        { id: 'f1', name: 'Alpha' },
        { id: 'f2', name: 'Beta' },
    ],
    myAttendance: null,
    allAttendance: [],
    pendingLeave: [],
    tasks: [],
    members: [],
    ...over,
});

describe('attendanceStateFor', () => {
    it('is "in" while a record has no check-out', () => {
        expect(attendanceStateFor([attendance()], 'u1', 'f1', NOW)).toBe('in');
    });

    it('is "out" once every one of today\'s records is closed', () => {
        const closed = attendance({ checkOutAt: '2026-09-04T09:30:00' });
        expect(attendanceStateFor([closed], 'u1', 'f1', NOW)).toBe('out');
    });

    it('is "in" when a closed record is followed by an open one', () => {
        const records = [
            attendance({ id: 'a1', checkOutAt: '2026-09-04T09:30:00' }),
            attendance({ id: 'a2', checkInAt: '2026-09-04T09:45:00' }),
        ];
        expect(attendanceStateFor(records, 'u1', 'f1', NOW)).toBe('in');
    });

    it('ignores yesterday — an unclosed shift does not carry over', () => {
        const stale = attendance({ checkInAt: YESTERDAY });
        expect(attendanceStateFor([stale], 'u1', 'f1', NOW)).toBe('absent');
    });

    it('does not read another farm\'s record', () => {
        expect(attendanceStateFor([attendance({ farmId: 'f2' })], 'u1', 'f1', NOW)).toBe('absent');
    });
});

describe('buildRoster', () => {
    it('groups by farm and names the section from the farm list', () => {
        const sections = buildRoster(
            overview({
                members: [
                    member({ userId: 'u1', farmId: 'f2' }),
                    member({ userId: 'u2', farmId: 'f1' }),
                ],
            }),
            { now: NOW },
        );
        expect(sections.map((s) => [s.farmId, s.farmName])).toEqual([
            ['f1', 'Alpha'],
            ['f2', 'Beta'],
        ]);
        expect(sections[0].data).toHaveLength(1);
    });

    it('puts pending joins first, then the senior roles, then by name', () => {
        const sections = buildRoster(
            overview({
                members: [
                    member({ userId: 'u1', role: 'worker', user: named('u1', 'Zara') }),
                    member({ userId: 'u2', role: 'owner', user: named('u2', 'Meena') }),
                    member({ userId: 'u3', role: 'worker', user: named('u3', 'Anil') }),
                    member({
                        userId: 'u4',
                        role: 'worker',
                        status: 'pending',
                        user: named('u4', 'Sunil'),
                    }),
                ],
            }),
            { now: NOW },
        );
        expect(sections[0].data.map((e) => e.name)).toEqual(['Sunil', 'Meena', 'Anil', 'Zara']);
        expect(sections[0].data[0].pendingJoin).toBe(true);
    });

    it('attaches the open leave request to the person it is about', () => {
        const leave = {
            id: 'l1',
            farmId: 'f1',
            userId: 'u2',
            startDate: '2026-09-06',
            endDate: '2026-09-08',
            reason: null,
            status: 'pending' as const,
            decidedById: null,
            decidedAt: null,
            createdAt: NOW.toISOString(),
        };
        const sections = buildRoster(
            overview({
                members: [member({ userId: 'u1' }), member({ userId: 'u2' })],
                pendingLeave: [leave],
            }),
            { now: NOW },
        );
        const byUser = Object.fromEntries(sections[0].data.map((e) => [e.userId, e.leave?.id]));
        expect(byUser).toEqual({ u1: undefined, u2: 'l1' });
    });

    it('falls back to myAttendance for the caller, who cannot read the farm list', () => {
        // A worker's `allAttendance` is empty — findAllForFarm needs
        // WRITE_MANAGEMENT — so without this their own row reads "not in"
        // while they are standing on the farm.
        const sections = buildRoster(
            overview({ members: [member({ userId: 'u1' })], myAttendance: attendance() }),
            { selfUserId: 'u1', now: NOW },
        );
        expect(sections[0].data[0]).toMatchObject({ isSelf: true, attendance: 'in' });
    });

    it('does not invent a name when the user record is missing', () => {
        const sections = buildRoster(
            overview({ members: [member({ user: null })] }),
            { unknownLabel: 'Unknown', now: NOW },
        );
        expect(sections[0].data[0].name).toBe('Unknown');
    });

    it('is empty, not thrown, with no data yet', () => {
        expect(buildRoster(undefined)).toEqual([]);
    });
});

describe('teamBadgeCount', () => {
    const withCounts = overview({
        pendingJoins: 2,
        myPendingLeave: 1,
        pendingLeave: [{ id: 'l1' } as any, { id: 'l2' } as any, { id: 'l3' } as any],
    });

    it('is the queue an owner or manager has to clear', () => {
        expect(teamBadgeCount(withCounts, true)).toBe(5);
    });

    it('is only the caller\'s own waiting leave for everyone else', () => {
        expect(teamBadgeCount(withCounts, false)).toBe(1);
    });

    it('is zero — so the badge is absent — when nothing is waiting', () => {
        expect(teamBadgeCount(overview({ pendingJoins: 0, myPendingLeave: 0 }), true)).toBe(0);
        expect(teamBadgeCount(overview(), false)).toBe(0);
    });

    it('is zero against a backend too old to send the counts', () => {
        expect(teamBadgeCount(overview(), true)).toBe(0);
    });

    it('is zero before the query resolves', () => {
        expect(teamBadgeCount(undefined, true)).toBe(0);
    });
});

describe('canDecideOnTeam', () => {
    it('lets owners and managers approve or decline', () => {
        expect(canDecideOnTeam('owner')).toBe(true);
        expect(canDecideOnTeam('manager')).toBe(true);
    });

    it('never shows the buttons to a worker or viewer', () => {
        expect(canDecideOnTeam('worker')).toBe(false);
        expect(canDecideOnTeam('viewer')).toBe(false);
        expect(canDecideOnTeam(null)).toBe(false);
    });
});

const named = (id: string, firstName: string) => ({
    id,
    firstName,
    lastName: null,
    username: null,
    avatarUrl: null,
});
