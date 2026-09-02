import { Injectable } from '@nestjs/common';
import { FarmsService } from '../farms/farms.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveRequestsService } from '../leave-requests/leave-requests.service';
import { TasksService } from '../tasks/tasks.service';
import { FarmMembersService } from '../farm-members/farm-members.service';
import { FarmAccessService } from '../farm-access/farm-access.service';

/**
 * Everything the Team tab renders, in ONE request.
 *
 * The tab used to assemble itself client-side: one call for the farm list,
 * then five per farm (my attendance, farm attendance, pending leave, tasks,
 * members). For an owner with five farms that is 26 requests from the phone.
 *
 * Measured from a phone in Chennai, a request to the backend in Oregon costs
 * ~265ms of pure network before the server does anything — `/api/liveness`,
 * which does no work at all, takes that long. Android also caps concurrent
 * connections per host, so those 26 requests queue into waves. That network
 * cost dwarfed everything happening on the server, and no amount of backend
 * tuning could touch it: the only fix is to stop making the round trips.
 *
 * Server-side the same fan-out costs far less — the backend sits ~180ms from
 * the database instead of ~265ms from the farmer, and runs the calls in
 * parallel across a pool of 20.
 *
 * ACCESS IS UNCHANGED. This deliberately calls the same services the
 * individual endpoints call, so every per-farm capability check still runs
 * exactly as before. It is a batching layer, not a new data path — nothing
 * here queries a table directly or skips a guard.
 */
@Injectable()
export class TeamOverviewService {
  constructor(
    private readonly farms: FarmsService,
    private readonly attendance: AttendanceService,
    private readonly leaveRequests: LeaveRequestsService,
    private readonly tasks: TasksService,
    private readonly members: FarmMembersService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async forUser(userId: string, scopeFarmId?: string) {
    const farms = await this.farms.findAll(userId);

    // Scope to one farm only if the caller can actually see it — an id they do
    // not hold falls back to their full set rather than throwing, matching the
    // client's own behaviour when a stale filter points at a farm they left.
    const visible = farms.map((f: { id: string }) => f.id);
    const farmIds =
      scopeFarmId && visible.includes(scopeFarmId) ? [scopeFarmId] : visible;

    // Tasks already resolve every accessible farm in a single query
    // (TasksService.findMine → getAccessibleFarmIds), so it is asked once
    // rather than per farm.
    const [tasks, perFarm] = await Promise.all([
      this.tasks.findMine(userId).catch(() => []),
      Promise.all(farmIds.map((farmId) => this.forFarm(userId, farmId))),
    ]);

    const allAttendance = perFarm.flatMap((f) => f.all);
    const mine = perFarm.flatMap((f) => f.mine);

    return {
      farms,
      // The open record is the one with no check-out. In practice you can only
      // be checked in to one farm at a time; if somehow two, the earliest is
      // the one you have been on longest. Same rule the client applied.
      myAttendance:
        mine
          .filter((r: { checkOutAt?: unknown }) => !r.checkOutAt)
          .sort((a: { checkInAt: string }, b: { checkInAt: string }) =>
            a.checkInAt.localeCompare(b.checkInAt),
          )[0] ?? null,
      allAttendance,
      pendingLeave: perFarm.flatMap((f) => f.leave),
      tasks,
      members: perFarm.flatMap((f) => f.members),
    };
  }

  /**
   * One farm's slice. Every call is settled independently: a worker is allowed
   * to read attendance but NOT the leave queue (WRITE_MANAGEMENT), so a 403
   * there is an expected outcome for a legitimate user, not an error. Letting
   * it reject would blank the whole tab for exactly the people who use it most.
   */
  private async forFarm(userId: string, farmId: string) {
    const [mine, all, leave, members] = await Promise.allSettled([
      this.attendance.findMine(userId, farmId),
      this.attendance.findAllForFarm(userId, farmId),
      this.leaveRequests.findAllForFarm(userId, farmId, 'pending'),
      this.members.listMembers(farmId, userId),
    ]);

    const val = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === 'fulfilled' ? r.value : fallback;

    return {
      mine: val(mine, [] as any[]),
      all: val(all, [] as any[]),
      leave: val(leave, [] as any[]),
      members: val(members, [] as any[]),
    };
  }
}
