import { TeamOverviewService } from './team-overview.service';

/**
 * The Team tab used to make 26 requests from the phone (1 farm list + 5 calls
 * × 5 farms). A request from Chennai to the backend in Oregon costs ~265ms of
 * pure network before the server does anything, so that fan-out — not the
 * server — was the load time. This collapses it to one request.
 *
 * These tests exist to hold two things still: the fan-out really is batched,
 * and batching did not quietly widen what a caller can see.
 */
const farm = (id: string) => ({ id, name: `Farm ${id}` });

function makeService(over: any = {}) {
  const farms = {
    findAll: jest.fn().mockResolvedValue(over.farms ?? [farm('f1'), farm('f2')]),
  };
  const attendance = {
    findMine: jest.fn().mockResolvedValue(over.mine ?? []),
    findAllForFarm: jest.fn().mockResolvedValue(over.all ?? []),
  };
  const leaveRequests = {
    findAllForFarm: jest.fn().mockResolvedValue(over.leave ?? []),
  };
  const tasks = { findMine: jest.fn().mockResolvedValue(over.tasks ?? []) };
  const members = { listMembers: jest.fn().mockResolvedValue(over.members ?? []) };
  const farmAccess = {
    getAccessibleFarmIds: jest.fn().mockResolvedValue(over.farmIds ?? ['f1', 'f2']),
  };
  const svc = new TeamOverviewService(
    farms as any,
    attendance as any,
    leaveRequests as any,
    tasks as any,
    members as any,
    farmAccess as any,
  );
  return { svc, farms, attendance, leaveRequests, tasks, members };
}

describe('TeamOverviewService', () => {
  it('covers every farm the caller can see, in one call', async () => {
    const { svc, attendance, members } = makeService();

    await svc.forUser('u');

    expect(attendance.findAllForFarm).toHaveBeenCalledTimes(2);
    expect(members.listMembers).toHaveBeenCalledTimes(2);
  });

  // Tasks already resolve every accessible farm in a single query, so asking
  // per farm would reintroduce the fan-out this class exists to remove.
  it('asks for tasks ONCE, not once per farm', async () => {
    const { svc, tasks } = makeService({
      farms: [farm('f1'), farm('f2'), farm('f3')],
    });

    await svc.forUser('u');

    expect(tasks.findMine).toHaveBeenCalledTimes(1);
  });

  it('narrows to a single farm when one is requested', async () => {
    const { svc, attendance } = makeService();

    await svc.forUser('u', 'f2');

    expect(attendance.findAllForFarm).toHaveBeenCalledTimes(1);
    expect(attendance.findAllForFarm).toHaveBeenCalledWith('u', 'f2');
  });

  /**
   * A stale filter pointing at a farm the caller has left must not become a
   * way to read that farm. It falls back to their own set.
   */
  it('ignores a scope farm the caller cannot see', async () => {
    const { svc, attendance } = makeService();

    await svc.forUser('u', 'someone-elses-farm');

    expect(attendance.findAllForFarm).toHaveBeenCalledTimes(2);
    for (const call of attendance.findAllForFarm.mock.calls) {
      expect(['f1', 'f2']).toContain(call[1]);
    }
  });

  it('returns nothing for a caller on no farms', async () => {
    const { svc, attendance } = makeService({ farms: [] });

    const out = await svc.forUser('stranger');

    expect(out.farms).toEqual([]);
    expect(out.members).toEqual([]);
    expect(attendance.findAllForFarm).not.toHaveBeenCalled();
  });

  /**
   * A worker may read attendance but NOT the leave queue, which needs
   * WRITE_MANAGEMENT. That 403 is an expected outcome for a legitimate user,
   * so it must degrade to "no leave rows" rather than blanking the tab for
   * exactly the people who use it most.
   */
  it('keeps the rest of the tab when one read is refused', async () => {
    const { svc, leaveRequests } = makeService({ members: [{ id: 'm1' }] });
    leaveRequests.findAllForFarm.mockRejectedValue(new Error('Forbidden'));

    const out = await svc.forUser('worker');

    expect(out.pendingLeave).toEqual([]);
    expect(out.members).toHaveLength(2); // one per farm, still there
  });

  it('picks the open attendance record as the current one', async () => {
    const { svc } = makeService({
      farms: [farm('f1')],
      mine: [
        { checkInAt: '2026-08-28T02:00:00Z', checkOutAt: '2026-08-28T06:00:00Z' },
        { checkInAt: '2026-08-28T07:00:00Z', checkOutAt: null },
      ],
    });

    const out = await svc.forUser('u');

    expect(out.myAttendance?.checkInAt).toBe('2026-08-28T07:00:00Z');
  });

  it('reports no open record when every shift is closed', async () => {
    const { svc } = makeService({
      farms: [farm('f1')],
      mine: [{ checkInAt: '2026-08-28T02:00:00Z', checkOutAt: '2026-08-28T06:00:00Z' }],
    });

    expect((await svc.forUser('u')).myAttendance).toBeNull();
  });
});
