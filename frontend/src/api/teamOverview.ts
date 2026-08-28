import apiClient from './client';
import { farmsApi } from './farms';
import { attendanceApi } from './attendance';
import { leaveRequestsApi } from './leaveRequests';
import { tasksApi } from './tasks';
import { farmMembersApi } from './farmMembers';
import type { AttendanceRecord } from './attendance';
import type { LeaveRequest } from './leaveRequests';
import type { Task } from './tasks';
import type { FarmMember } from './farmMembers';

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
    };
}
