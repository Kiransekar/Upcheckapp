import { FindOperator } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { roleSatisfies } from '../farm-access/farm-capability';
import { isoDate, shiftDate } from './recurrence';

/**
 * These tests run against an in-memory row store whose `find()` actually
 * EVALUATES the TypeORM where-clause the service builds (In / IsNull /
 * LessThanOrEqual / equality). That matters: the point of most of this file is
 * that a pond-scoped worker cannot see another pond's tasks, and asserting
 * "the service passed a clause that mentions pond_id" proves nothing. Filtering
 * for real means deleting the pond branch makes the test go red.
 */
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond instanceof FindOperator) {
      if (cond.type === 'in') return (cond.value as any[]).includes(value);
      if (cond.type === 'isNull') return value === null || value === undefined;
      if (cond.type === 'lessThanOrEqual') return value <= (cond.value as any);
      throw new Error(`test store cannot evaluate FindOperator ${cond.type}`);
    }
    return value === cond;
  });
}

interface World {
  /** userId -> role on the farm */
  roles?: Record<string, string>;
  /** farmId -> every pond on it */
  ponds?: Record<string, string[]>;
  /** userId -> farmId -> the ponds that user is scoped to */
  scope?: Record<string, Record<string, string[]>>;
  rows?: any[];
  farmIds?: string[];
}

function makeWorld(w: World = {}) {
  const roles = w.roles ?? {};
  const ponds = w.ponds ?? {};
  const scope = w.scope ?? {};
  const rows: any[] = (w.rows ?? []).map((r) => ({
    id: r.id,
    farmId: 'f1',
    pondId: null,
    cropId: null,
    title: 't',
    description: null,
    type: 'OTHER',
    status: 'open',
    priority: 'medium',
    scope: 'farm',
    dueDate: null,
    timeWindowStart: null,
    timeWindowEnd: null,
    isTemplate: false,
    recurrenceRule: null,
    recurrenceUntil: null,
    parentTaskId: null,
    createdById: null,
    completedAt: null,
    verifiedAt: null,
    verifiedById: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    assignees: [],
    ...r,
  }));

  let seq = 0;
  const copy = (r: any) => ({ ...r, assignees: [...(r.assignees ?? [])] });
  const select = (where: any) => {
    const clauses = Array.isArray(where) ? where : [where];
    return rows.filter((r) => clauses.some((c) => matches(r, c)));
  };

  const tasksRepo = {
    find: jest.fn(async ({ where }: any) => select(where).map(copy)),
    findOne: jest.fn(async ({ where }: any) => {
      const hit = rows.find((r) => matches(r, where));
      return hit ? copy(hit) : null;
    }),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (d: any) => {
      const existing = d.id && rows.find((r) => r.id === d.id);
      if (existing) {
        Object.assign(existing, d);
        return copy(existing);
      }
      const row = {
        status: 'open',
        assignees: [],
        pondId: null,
        parentTaskId: null,
        isTemplate: false,
        scope: 'farm',
        dueDate: null,
        createdAt: new Date(),
        ...d,
        id: `new-${++seq}`,
      };
      rows.push(row);
      return copy(row);
    }),
    update: jest.fn(async (criteria: any, patch: any) => {
      const where = typeof criteria === 'string' ? { id: criteria } : criteria;
      for (const r of rows) if (matches(r, where)) Object.assign(r, patch);
      return { affected: 1 };
    }),
    delete: jest.fn(async (criteria: any) => {
      const where = typeof criteria === 'string' ? { id: criteria } : criteria;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], where)) rows.splice(i, 1);
      }
      return { affected: 1 };
    }),
  };

  const assigneesRepo = {
    delete: jest.fn(async ({ taskId }: any) => {
      const row = rows.find((r) => r.id === taskId);
      if (row) row.assignees = [];
      return { affected: 1 };
    }),
    insert: jest.fn(async (entries: any[]) => {
      for (const e of entries) {
        const row = rows.find((r) => r.id === e.taskId);
        if (row) row.assignees.push({ taskId: e.taskId, userId: e.userId });
      }
      return { identifiers: [] };
    }),
  };

  const pondsOf = (userId: string, farmId: string) =>
    scope[userId]?.[farmId] ?? ponds[farmId] ?? [];

  const farmAccess = {
    getAccessibleFarmIds: jest.fn(async () => w.farmIds ?? ['f1']),
    getAccessiblePondIds: jest.fn(async (userId: string, farmId: string) =>
      pondsOf(userId, farmId),
    ),
    getRoleOnFarm: jest.fn(async (userId: string) => roles[userId] ?? null),
    assertCanAccessFarm: jest.fn(
      async (userId: string, farmId: string, capability: any) => {
        if (!roleSatisfies((roles[userId] ?? null) as any, capability)) {
          throw new ForbiddenException('no capability on this farm');
        }
        return { id: farmId, userId: 'owner' };
      },
    ),
    assertCanAccessPond: jest.fn(
      async (userId: string, pondId: string, capability: any) => {
        if (!roleSatisfies((roles[userId] ?? null) as any, capability)) {
          throw new ForbiddenException('no capability on this farm');
        }
        if (!pondsOf(userId, 'f1').includes(pondId)) {
          throw new ForbiddenException('pond out of scope');
        }
        return { id: pondId, farmId: 'f1' };
      },
    ),
  };

  const service = new TasksService(
    tasksRepo as any,
    assigneesRepo as any,
    farmAccess as any,
  );
  return { service, rows, tasksRepo, assigneesRepo, farmAccess };
}

const ids = (list: any[]) => list.map((t) => t.id).sort();

// ==================== the security fix ====================

describe('pond scoping on read', () => {
  const world = () =>
    makeWorld({
      roles: { boss: 'owner', ravi: 'worker' },
      ponds: { f1: ['p1', 'p2', 'p3'] },
      // Ravi looks after pond 1 only.
      scope: { ravi: { f1: ['p1'] } },
      rows: [
        { id: 'farmwide', pondId: null },
        { id: 'p1-task', pondId: 'p1' },
        { id: 'p2-task', pondId: 'p2' },
      ],
    });

  it('hides tasks for ponds outside a scoped worker’s scope', async () => {
    const { service } = world();

    const seen = await service.findAll('ravi', { farmId: 'f1' });

    // This is the live hole the module shipped with: pond_id existed but
    // nothing filtered on it, so Ravi was served p2-task too.
    expect(ids(seen)).toEqual(['farmwide', 'p1-task']);
  });

  it('still shows the whole farm to an unscoped member', async () => {
    const { service } = world();

    const seen = await service.findAll('boss', { farmId: 'f1' });

    expect(ids(seen)).toEqual(['farmwide', 'p1-task', 'p2-task']);
  });

  it('reads nothing at all for a scoped worker with no ponds', async () => {
    const { service } = makeWorld({
      roles: { ravi: 'worker' },
      ponds: { f1: ['p1'] },
      scope: { ravi: { f1: [] } },
      rows: [{ id: 'p1-task', pondId: 'p1' }],
    });

    // An empty scope must produce no pond branch, not `pond_id IN ()`.
    await expect(service.findAll('ravi', { farmId: 'f1' })).resolves.toEqual([]);
  });

  it('refuses a single task by id when its pond is out of scope', async () => {
    const { service } = world();

    await expect(service.findOne('p2-task', 'ravi')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.findOne('p1-task', 'ravi')).resolves.toMatchObject({
      id: 'p1-task',
    });
  });
});

describe('personal tasks', () => {
  const world = () =>
    makeWorld({
      roles: { boss: 'owner', ravi: 'worker' },
      ponds: { f1: ['p1'] },
      rows: [
        { id: 'ravis-note', scope: 'personal', createdById: 'ravi' },
        { id: 'board', scope: 'farm' },
      ],
    });

  it('is invisible to the farm owner', async () => {
    const { service } = world();

    expect(ids(await service.findAll('boss', { farmId: 'f1' }))).toEqual([
      'board',
    ]);
    await expect(service.findOne('ravis-note', 'boss')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('is visible to its creator', async () => {
    const { service } = world();

    expect(ids(await service.findAll('ravi', { farmId: 'f1' }))).toEqual([
      'board',
      'ravis-note',
    ]);
  });

  it('can be created by a plain worker, and only for themselves', async () => {
    const { service, rows } = makeWorld({ roles: { ravi: 'worker' } });

    const made = await service.create(
      { farmId: 'f1', title: 'buy net', scope: 'personal' } as any,
      'ravi',
    );

    expect(made.assigneeIds).toEqual(['ravi']);
    expect(rows.find((r) => r.id === made.id).scope).toBe('personal');

    await expect(
      service.create(
        {
          farmId: 'f1',
          title: 'do my job',
          scope: 'personal',
          assigneeIds: ['boss'],
        } as any,
        'ravi',
      ),
    ).rejects.toThrow(/only ever be assigned to its creator/);
  });
});

describe('who may create a farm task', () => {
  const dto = { farmId: 'f1', title: 'feed pond 1' } as any;

  it('rejects a worker', async () => {
    const { service } = makeWorld({ roles: { ravi: 'worker' } });
    await expect(service.create(dto, 'ravi')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows an owner and a manager', async () => {
    const boss = makeWorld({ roles: { boss: 'owner' } });
    const mgr = makeWorld({ roles: { mgr: 'manager' } });

    await expect(boss.service.create(dto, 'boss')).resolves.toMatchObject({
      title: 'feed pond 1',
    });
    await expect(mgr.service.create(dto, 'mgr')).resolves.toMatchObject({
      title: 'feed pond 1',
    });
  });
});

describe('assignee validation', () => {
  const base = {
    roles: { boss: 'owner', ravi: 'worker', kumar: 'worker' },
    ponds: { f1: ['p1', 'p2'] },
  };

  it('rejects a non-member outright — it does not quietly drop them', async () => {
    const { service, rows } = makeWorld(base);

    await expect(
      service.create(
        { farmId: 'f1', title: 'feed', assigneeIds: ['ravi', 'stranger'] } as any,
        'boss',
      ),
    ).rejects.toThrow(/not an active member/);
    expect(rows).toHaveLength(0);
  });

  it('rejects a member who cannot reach the task’s pond', async () => {
    const { service } = makeWorld({
      ...base,
      scope: { kumar: { f1: ['p2'] } },
    });

    await expect(
      service.create(
        {
          farmId: 'f1',
          title: 'feed pond 1',
          pondId: 'p1',
          assigneeIds: ['kumar'],
        } as any,
        'boss',
      ),
    ).rejects.toThrow(/does not have access to this pond/);
  });

  it('accepts a member who can', async () => {
    const { service } = makeWorld({
      ...base,
      scope: { ravi: { f1: ['p1'] } },
    });

    const made = await service.create(
      {
        farmId: 'f1',
        title: 'feed pond 1',
        pondId: 'p1',
        assigneeIds: ['ravi'],
      } as any,
      'boss',
    );
    expect(made.assigneeIds).toEqual(['ravi']);
  });
});

describe('an empty assignee list means EVERYONE in scope', () => {
  it('shows up in every in-scope member’s /tasks/mine, and nobody else’s', async () => {
    const { service } = makeWorld({
      roles: { boss: 'owner', ravi: 'worker', kumar: 'worker' },
      ponds: { f1: ['p1', 'p2'] },
      scope: { ravi: { f1: ['p1'] }, kumar: { f1: ['p2'] } },
      rows: [
        { id: 'everyone', pondId: null, assignees: [] },
        { id: 'p1-everyone', pondId: 'p1', assignees: [] },
        { id: 'kumars', pondId: 'p2', assignees: [{ userId: 'kumar' }] },
      ],
    });

    expect(ids(await service.findMine('ravi'))).toEqual([
      'everyone',
      'p1-everyone',
    ]);
    expect(ids(await service.findMine('kumar'))).toEqual(['everyone', 'kumars']);
  });

  it('does not hand a named worker someone else’s named task', async () => {
    const { service } = makeWorld({
      roles: { ravi: 'worker', kumar: 'worker' },
      rows: [{ id: 'kumars', assignees: [{ userId: 'kumar' }] }],
    });

    expect(await service.findMine('ravi')).toEqual([]);
  });
});

// ==================== recurrence ====================

const template = (over: any = {}) => ({
  id: 'tpl',
  isTemplate: true,
  recurrenceRule: 'FREQ=DAILY',
  dueDate: isoDate(),
  title: 'morning feed',
  ...over,
});

describe('lazy materialisation', () => {
  it('creates today’s instance exactly once, however many times you read', async () => {
    const { service, rows } = makeWorld({
      roles: { boss: 'owner' },
      rows: [template()],
    });

    const first = await service.findAll('boss', { farmId: 'f1' });
    const second = await service.findAll('boss', { farmId: 'f1' });

    const instances = rows.filter((r) => r.parentTaskId === 'tpl');
    expect(instances).toHaveLength(1);
    expect(instances[0].dueDate).toBe(isoDate());
    expect(instances[0].isTemplate).toBe(false);
    // And the template itself is never served as a to-do.
    expect(ids(first)).toEqual(ids(second));
    expect(ids(first)).toEqual([instances[0].id]);
  });

  it('copies the template’s assignees onto each instance', async () => {
    const { service, rows } = makeWorld({
      roles: { boss: 'owner' },
      rows: [template({ assignees: [{ userId: 'ravi' }] })],
    });

    await service.findAll('boss', { farmId: 'f1' });

    expect(rows.find((r) => r.parentTaskId === 'tpl').assignees).toEqual([
      { taskId: expect.any(String), userId: 'ravi' },
    ]);
  });

  it('backfills the missed days, bounded by the window', async () => {
    const { service, rows } = makeWorld({
      roles: { boss: 'owner' },
      // Started a year ago: must NOT produce 365 rows.
      rows: [template({ dueDate: shiftDate(isoDate(), -365) })],
    });

    await service.findAll('boss', { farmId: 'f1' });

    const instances = rows.filter((r) => r.parentTaskId === 'tpl');
    expect(instances).toHaveLength(8); // today − 7 … today
    expect(instances.map((r) => r.dueDate).sort()).toEqual(
      [...Array(8)].map((_, i) => shiftDate(isoDate(), i - 7)).sort(),
    );
  });

  it('materialises nothing once recurrence_until has passed', async () => {
    const { service, rows } = makeWorld({
      roles: { boss: 'owner' },
      rows: [
        template({
          dueDate: shiftDate(isoDate(), -30),
          recurrenceUntil: shiftDate(isoDate(), -14),
        }),
      ],
    });

    const seen = await service.findAll('boss', { farmId: 'f1' });

    expect(rows.filter((r) => r.parentTaskId === 'tpl')).toHaveLength(0);
    expect(seen).toEqual([]);
  });

  it('only fires on the chosen weekday for a weekly rule', async () => {
    const today = isoDate();
    const wrongDay = (new Date(`${today}T00:00:00Z`).getUTCDay() + 3) % 7;
    const { service, rows } = makeWorld({
      roles: { boss: 'owner' },
      rows: [
        template({
          recurrenceRule: `FREQ=WEEKLY;BYDAY=${wrongDay}`,
          dueDate: shiftDate(today, -30),
        }),
      ],
    });

    await service.findAll('boss', { farmId: 'f1' });

    const made = rows.filter((r) => r.parentTaskId === 'tpl');
    expect(made).toHaveLength(1); // exactly one such weekday in an 8-day window
    expect(new Date(`${made[0].dueDate}T00:00:00Z`).getUTCDay()).toBe(wrongDay);
  });

  it('leaves pre-existing eagerly-generated series alone', async () => {
    // What the OLD code wrote: a parent that points at ITSELF, children that
    // point at it, a COUNT rule nothing parses, and is_template false on all
    // of them. None of it may be mistaken for a template.
    const { service, rows } = makeWorld({
      roles: { boss: 'owner' },
      rows: [
        {
          id: 'legacy-parent',
          parentTaskId: 'legacy-parent',
          isTemplate: false,
          recurrenceRule: 'FREQ=DAILY;COUNT=90',
          dueDate: shiftDate(isoDate(), -2),
        },
        {
          id: 'legacy-child',
          parentTaskId: 'legacy-parent',
          isTemplate: false,
          recurrenceRule: 'FREQ=DAILY;COUNT=90',
          dueDate: shiftDate(isoDate(), -1),
        },
      ],
    });

    const seen = await service.findAll('boss', { farmId: 'f1' });

    expect(rows).toHaveLength(2); // nothing generated
    expect(ids(seen)).toEqual(['legacy-child', 'legacy-parent']);
  });
});

describe('creating a recurring task', () => {
  it('writes ONE template row, not a pile of instances', async () => {
    const { service, rows } = makeWorld({ roles: { boss: 'owner' } });

    const made = await service.create(
      {
        farmId: 'f1',
        title: 'morning feed',
        dueDate: isoDate(),
        recurrence: { freq: 'weekly', byWeekday: 2, until: '2026-12-31' },
      } as any,
      'boss',
    );

    expect(rows).toHaveLength(1);
    expect(made.isTemplate).toBe(true);
    expect(made.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=2');
    expect(made.recurrenceUntil).toBe('2026-12-31');
  });
});

describe('deleting a series', () => {
  const world = () =>
    makeWorld({
      roles: { boss: 'owner' },
      rows: [
        template(),
        { id: 'done-day', parentTaskId: 'tpl', status: 'done' },
        { id: 'open-day', parentTaskId: 'tpl', status: 'open' },
      ],
    });

  it('takes the template and the unfinished days, and keeps the history', async () => {
    const { service, rows } = world();

    await service.remove('tpl', 'boss', true);

    expect(ids(rows)).toEqual(['done-day']);
    // Detached, so the parent_task_id CASCADE cannot reach it.
    expect(rows[0].parentTaskId).toBeNull();
  });

  it('without ?series, keeps every instance and just detaches them', async () => {
    const { service, rows } = world();

    await service.remove('tpl', 'boss', false);

    expect(ids(rows)).toEqual(['done-day', 'open-day']);
    expect(rows.every((r) => r.parentTaskId === null)).toBe(true);
  });
});

// ==================== completion / verification ====================

describe('status transitions', () => {
  const world = () =>
    makeWorld({
      roles: { boss: 'owner', ravi: 'worker', kumar: 'worker' },
      rows: [
        { id: 'ravis', assignees: [{ userId: 'ravi' }] },
        { id: 'anyones', assignees: [] },
      ],
    });

  it('update() can no longer tick off someone else’s task', async () => {
    const { service, rows } = world();

    // The hole: complete() checked the assignee, update() wrote status straight
    // through, so PATCH {status:'done'} was a way around the check.
    await expect(
      service.update('ravis', { status: 'done' } as any, 'kumar'),
    ).rejects.toThrow(/Only an assigned worker/);
    expect(rows.find((r) => r.id === 'ravis').status).toBe('open');

    await expect(
      service.update('ravis', { status: 'done' } as any, 'ravi'),
    ).resolves.toMatchObject({ status: 'done' });
  });

  it('lets anyone who can write on the farm finish an unassigned task', async () => {
    const { service } = world();

    await expect(service.complete('anyones', 'kumar')).resolves.toMatchObject({
      status: 'done',
    });
  });

  it('blocks a non-assignee from complete()', async () => {
    const { service } = world();

    await expect(service.complete('ravis', 'kumar')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('verify() checks WRITE_MANAGEMENT in the service, not just at the route', async () => {
    const { service } = world();

    await expect(service.verify('anyones', 'ravi')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.verify('anyones', 'boss')).resolves.toMatchObject({
      status: 'verified',
      verifiedById: 'boss',
    });
  });

  it('update() cannot self-verify either', async () => {
    const { service } = world();

    await expect(
      service.update('anyones', { status: 'verified' } as any, 'ravi'),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('findMine scoping', () => {
  it('returns nothing — and queries nothing — for a user on no farms', async () => {
    const { service, tasksRepo } = makeWorld({ farmIds: [] });

    await expect(service.findMine('nobody')).resolves.toEqual([]);
    // An unscoped find() here would return every task in the database.
    expect(tasksRepo.find).not.toHaveBeenCalled();
  });

  it('honours a farmId filter across several accessible farms', async () => {
    const { service } = makeWorld({
      roles: { boss: 'owner' },
      farmIds: ['f1', 'f2'],
      rows: [
        { id: 'on-f1', farmId: 'f1' },
        { id: 'on-f2', farmId: 'f2' },
      ],
    });

    expect(ids(await service.findMine('boss'))).toEqual(['on-f1', 'on-f2']);
    expect(ids(await service.findMine('boss', { farmId: 'f2' }))).toEqual([
      'on-f2',
    ]);
  });
});
