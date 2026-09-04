import apiClient from './client';
import { farmsApi } from './farms';
import { attendanceApi } from './attendance';
import { leaveRequestsApi } from './leaveRequests';
import { tasksApi } from './tasks';
import { farmMembersApi } from './farmMembers';
import type { AttendanceRecord } from './attendance';
import type { LeaveRequest } from './leaveRequests';
import type { Task } from './tasks';
import type { FarmMember, FarmRole } from './farmMembers';
import { ROLE_RANK } from '../permissions/capabilities';
import { personName } from '../utils/personName';

/**
 * The Team tab in ONE request.
 *
 * It used to assemble itself on the phone: one call for the farm list, then
 * five per farm (my attendance, farm attendance, pending leave, tasks,
 * members). For an owner with five farms that is 26 requests.
 *
 * That was the load time. Measured from Chennai, a request to the backend in
 * Oregon costs ~265ms of pure network before the server does anything —
 * `/api/liveness`, which does no work, takes that long — and Android caps
 * concurrent connections per host, so 26 requests queue into waves. No amount
 * of backend tuning touches that; the only fix is to stop making the trips.
 *
 * `GET /team/overview` does the same fan-out server-side, where each hop is
 * cheaper and runs against a pool of 20. Access is unchanged: the endpoint
 * calls the same services, so every per-farm capability check still runs.
 */
export interface TeamOverview {
    farms: any[];
    myAttendance: AttendanceRecord | null;
    allAttendance: AttendanceRecord[];
    pendingLeave: LeaveRequest[];
    tasks: Task[];
    members: FarmMember[];
    /**
     * Memberships waiting to be let in, summed over the farms in scope.
     * Owner/manager-only by construction — the backend's per-farm call needs
     * MANAGE_WORKERS and settles to 0 for a worker rather than erroring.
     * Optional: an older backend does not send it (see the fallback below).
     */
    pendingJoins?: number;
    /** The CALLER's own still-pending leave requests. A count, not rows. */
    myPendingLeave?: number;
}

/**
 * The app ships as an OTA update and the backend deploys separately, so a
 * phone WILL run this against an API that has never heard of /team/overview.
 * Without the fallback that window is a broken Team tab.
 *
 * Only a missing ENDPOINT falls back. A 500 is the endpoint existing and
 * failing, and quietly serving the slow path would hide a broken deploy behind
 * a working screen.
 */
const isMissingEndpoint = (err: any): boolean => {
    const status = err?.response?.status;
    return status === 404 || status === 501;
};

const ALL = 'all';

export async function fetchTeamOverview(scope: string): Promise<TeamOverview> {
    try {
        const { data } = await apiClient.get('/team/overview', {
            params: scope !== ALL ? { farmId: scope } : undefined,
        });
        return data;
    } catch (err) {
        if (!isMissingEndpoint(err)) throw err;
        return legacyFanOut(scope);
    }
}

/** The pre-batching path: 1 + 5×N requests. Kept only for old backends. */
async function legacyFanOut(scope: string): Promise<TeamOverview> {
    const list = (await farmsApi.getAll()).data ?? [];
    const inScope =
        scope !== ALL && list.some((f: any) => f.id === scope)
            ? list.filter((f: any) => f.id === scope)
            : list;

    const per = await Promise.all(
        inScope.map(async (farm: any) => {
            const [mine, all, leave, taskList, memberList] = await Promise.allSettled([
                attendanceApi.mine(farm.id),
                attendanceApi.getAll(farm.id),
                leaveRequestsApi.getAll(farm.id, 'pending'),
                tasksApi.getAll(farm.id),
                farmMembersApi.listMembers(farm.id),
            ]);
            const val = <T,>(r: PromiseSettledResult<{ data: T }>, fallback: T): T =>
                r.status === 'fulfilled' ? r.value.data : fallback;
            return {
                mine: val(mine, [] as AttendanceRecord[]),
                all: val(all, [] as AttendanceRecord[]),
                leave: val(leave, [] as LeaveRequest[]),
                tasks: val(taskList, [] as Task[]),
                members: val(memberList, [] as FarmMember[]),
            };
        }),
    );

    return {
        farms: list,
        myAttendance:
            per
                .flatMap((p) => p.mine)
                .filter((r) => !r.checkOutAt)
                .sort((a, b) => a.checkInAt.localeCompare(b.checkInAt))[0] ?? null,
        allAttendance: per.flatMap((p) => p.all),
        pendingLeave: per.flatMap((p) => p.leave),
        tasks: per.flatMap((p) => p.tasks),
        members: per.flatMap((p) => p.members),
        // Deliberately absent: the badge counts need the server's own scoping,
        // and a backend this old has no way to give it. No badge beats a wrong
        // one, and this path only exists for the deploy window.
    };
}

/**
 * The number on the Team tab.
 *
 * Owner/manager: the queue they are expected to clear — joins waiting to be let
 * in plus leave waiting on a decision. Everyone else: their OWN leave still
 * waiting on someone. Two different questions, one number, because they are
 * never both true for the same person.
 */
/**
 * Who may approve or decline a join request or a leave request.
 *
 * The BARE role, deliberately — not `roleCan('MANAGE_WORKERS')`. Phase 1 took
 * MANAGE_WORKERS out of the grantable set precisely because every
 * member-management endpoint re-checks owner/manager on its own, so an
 * override could only ever produce a button that 403s.
 */
export const canDecideOnTeam = (role: FarmRole | null | undefined): boolean =>
    role === 'owner' || role === 'manager';

export const teamBadgeCount = (
    overview: TeamOverview | undefined,
    canApprove: boolean,
): number => {
    if (!overview) return 0;
    return canApprove
        ? (overview.pendingJoins ?? 0) + (overview.pendingLeave?.length ?? 0)
        : (overview.myPendingLeave ?? 0);
};

// ── Roster ────────────────────────────────────────────────────────
// The cross-farm team list, derived from the SAME overview read the tab
// already has. Pure so the grouping is testable without a renderer.

/** Where someone is on their shift today. */
export type AttendanceState = 'in' | 'out' | 'absent';

export interface RosterEntry {
    /** Membership id — unique across farms, so it keys the list directly. */
    key: string;
    farmId: string;
    userId: string;
    name: string;
    role: FarmRole;
    /** Membership is waiting to be approved; they hold nothing yet. */
    pendingJoin: boolean;
    attendance: AttendanceState;
    /** Their open leave request on this farm, when the caller may see it. */
    leave: LeaveRequest | null;
    isSelf: boolean;
}

export interface RosterSection {
    farmId: string;
    farmName: string;
    data: RosterEntry[];
}

const sameLocalDay = (iso: string, ref: Date): boolean => {
    const d = new Date(iso);
    return (
        d.getFullYear() === ref.getFullYear() &&
        d.getMonth() === ref.getMonth() &&
        d.getDate() === ref.getDate()
    );
};

/**
 * `allAttendance` is the farm's whole history (the endpoint takes no date when
 * called from the overview), so today has to be picked out here. An open record
 * beats a closed one: someone who checked out for lunch and back in is IN.
 */
export const attendanceStateFor = (
    records: AttendanceRecord[],
    userId: string,
    farmId: string,
    now: Date = new Date(),
): AttendanceState => {
    const today = records.filter(
        (r) => r.userId === userId && r.farmId === farmId && sameLocalDay(r.checkInAt, now),
    );
    if (today.length === 0) return 'absent';
    return today.some((r) => !r.checkOutAt) ? 'in' : 'out';
};

/** Pending joins first — they are the only rows with an action on them. */
const compareEntries = (a: RosterEntry, b: RosterEntry): number =>
    Number(b.pendingJoin) - Number(a.pendingJoin) ||
    ROLE_RANK[b.role] - ROLE_RANK[a.role] ||
    a.name.localeCompare(b.name);

export function buildRoster(
    overview: TeamOverview | undefined,
    opts: { selfUserId?: string; unknownLabel?: string; now?: Date } = {},
): RosterSection[] {
    if (!overview) return [];
    const { selfUserId, unknownLabel = 'Unknown', now = new Date() } = opts;
    const attendance = overview.allAttendance ?? [];
    const leave = overview.pendingLeave ?? [];

    const byFarm = new Map<string, RosterEntry[]>();
    for (const m of overview.members ?? []) {
        const isSelf = !!selfUserId && m.userId === selfUserId;
        let state = attendanceStateFor(attendance, m.userId, m.farmId, now);
        // A worker cannot read the farm-wide attendance list (WRITE_MANAGEMENT),
        // so their own row would say "not in" while they are standing on the
        // farm. `myAttendance` is the one record they CAN always see.
        if (isSelf && state === 'absent' && overview.myAttendance?.farmId === m.farmId) {
            state = 'in';
        }
        const entry: RosterEntry = {
            key: m.id,
            farmId: m.farmId,
            userId: m.userId,
            name: personName(m.user, unknownLabel),
            role: m.role,
            pendingJoin: m.status === 'pending',
            attendance: state,
            leave: leave.find((l) => l.userId === m.userId && l.farmId === m.farmId) ?? null,
            isSelf,
        };
        const list = byFarm.get(m.farmId);
        if (list) list.push(entry);
        else byFarm.set(m.farmId, [entry]);
    }

    const farmName = (id: string) =>
        overview.farms?.find((f: any) => f.id === id)?.name ?? '';

    return Array.from(byFarm, ([farmId, data]) => ({
        farmId,
        farmName: farmName(farmId),
        data: data.sort(compareEntries),
    })).sort((a, b) => a.farmName.localeCompare(b.farmName));
}
