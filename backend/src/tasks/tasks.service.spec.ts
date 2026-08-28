import { In } from 'typeorm';
import { TasksService } from './tasks.service';

/**
 * `GET /tasks` requires a farmId and is guarded on it, so a client wanting
 * "my tasks" called it once per farm. `findMine` replaces that loop — which
 * means the scoping the route guard used to do now has to happen here.
 */
describe('TasksService.findMine', () => {
  const build = (farmIds: string[]) => {
    const find = jest.fn().mockResolvedValue([{ id: 't1' }]);
    const farmAccess = {
      getAccessibleFarmIds: jest.fn().mockResolvedValue(farmIds),
    };
    return {
      service: new TasksService({ find } as any, farmAccess as any),
      find,
    };
  };

  it('restricts the query to the farms the caller can read', async () => {
    const { service, find } = build(['farm-1', 'farm-2']);

    await service.findMine('user-1');

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { farmId: In(['farm-1', 'farm-2']) },
      }),
    );
  });

  it('returns nothing — and queries nothing — for a user on no farms', async () => {
    const { service, find } = build([]);

    await expect(service.findMine('nobody')).resolves.toEqual([]);
    // An unscoped find() here would return every task in the database.
    expect(find).not.toHaveBeenCalled();
  });

  it('keeps the farm scope when filters are applied', async () => {
    const { service, find } = build(['farm-1']);

    await service.findMine('user-1', {
      status: 'pending',
      assignedToId: 'worker-1',
    });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          farmId: In(['farm-1']),
          status: 'pending',
          assignedToId: 'worker-1',
        },
      }),
    );
  });
});
