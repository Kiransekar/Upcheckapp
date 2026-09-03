import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FarmMembersService } from './farm-members.service';

/**
 * Two things the client cannot work around:
 *
 *  1. `GET /farm-members/mine` used to return PENDING rows with no status, so
 *     someone still waiting to be let in got a full worker role client-side and
 *     every tap came back 403. It also omitted the financial grant entirely, so
 *     the Money tab stayed hidden after an owner switched it on.
 *  2. Who may record a harvest / see the books is now a stored object. It is
 *     owner-settable only, and only over capabilities that are meant to be.
 */
function makeService(opts: {
  members?: any[];
  ownedFarms?: any[];
  member?: any;
  assertThrows?: Error;
} = {}) {
  const membersRepo = {
    find: jest.fn().mockResolvedValue(opts.members ?? []),
    findOne: jest.fn().mockResolvedValue(opts.member ?? null),
    save: jest.fn(async (m: any) => m),
  };
  const farmsRepo = {
    find: jest.fn().mockResolvedValue(opts.ownedFarms ?? []),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const farmAccess = {
    assertCanAccessFarm: jest.fn(async () => {
      if (opts.assertThrows) throw opts.assertThrows;
      return {};
    }),
    getPondScopesForMembers: jest.fn().mockResolvedValue(new Map()),
  };
  const svc = new FarmMembersService(
    membersRepo as any,
    { find: jest.fn().mockResolvedValue([]) } as any,
    farmsRepo as any,
    { find: jest.fn() } as any,
    farmAccess as any,
  );
  return { svc, membersRepo, farmsRepo, farmAccess };
}

const farm = (over: any = {}) => ({
  id: 'f1',
  name: 'Farm One',
  farmCode: 'ABCD1234',
  deletedAt: null,
  rolePolicy: null,
  ...over,
});

describe('FarmMembersService.listMine', () => {
  it('asks the database for active rows only', async () => {
    const { svc, membersRepo } = makeService();

    await svc.listMine('u1');

    expect(membersRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', status: 'active' },
      }),
    );
  });

  it('projects the status and both grant layers', async () => {
    const { svc } = makeService({
      members: [
        {
          farmId: 'f1',
          role: 'worker',
          status: 'active',
          capabilityOverrides: { VIEW_FINANCIALS: true },
          farm: farm({ rolePolicy: { worker: { RECORD_HARVEST: true } } }),
        },
      ],
    });

    await expect(svc.listMine('u1')).resolves.toEqual([
      {
        farmId: 'f1',
        role: 'worker',
        status: 'active',
        capabilityOverrides: { VIEW_FINANCIALS: true },
        rolePolicy: { worker: { RECORD_HARVEST: true } },
        farm: { id: 'f1', name: 'Farm One', farmCode: 'ABCD1234' },
      },
    ]);
  });

  it('carries the farm policy onto the owner union row', async () => {
    const { svc } = makeService({
      ownedFarms: [farm({ rolePolicy: { viewer: { VIEW_FINANCIALS: true } } })],
    });

    const [row] = await svc.listMine('owner-1');

    expect(row.role).toBe('owner');
    expect(row.status).toBe('active');
    expect(row.capabilityOverrides).toBeNull();
    expect(row.rolePolicy).toEqual({ viewer: { VIEW_FINANCIALS: true } });
  });
});

describe('FarmMembersService.setCapabilities', () => {
  const member = (over: any = {}) => ({
    id: 'm1',
    farmId: 'f1',
    userId: 'u2',
    role: 'worker',
    capabilityOverrides: null,
    canViewFinancials: null,
    ...over,
  });

  it('is refused for a caller who is not the owner', async () => {
    const { svc, membersRepo } = makeService({
      member: member(),
      assertThrows: new ForbiddenException(),
    });

    await expect(
      svc.setCapabilities('f1', 'manager-1', 'u2', { RECORD_HARVEST: true }),
    ).rejects.toThrow(ForbiddenException);
    expect(membersRepo.save).not.toHaveBeenCalled();
  });

  it('refuses to override the owner, who is never reducible', async () => {
    const { svc, membersRepo } = makeService({
      member: member({ role: 'owner' }),
    });

    await expect(
      svc.setCapabilities('f1', 'owner-1', 'owner-1', {
        VIEW_FINANCIALS: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(membersRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a capability that is not grantable, without writing', async () => {
    const { svc, membersRepo } = makeService({ member: member() });

    await expect(
      svc.setCapabilities('f1', 'owner-1', 'u2', { OWNER_ONLY: true } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      svc.setCapabilities('f1', 'owner-1', 'u2', {
        RECORD_HARVEST: 'yes',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(membersRepo.save).not.toHaveBeenCalled();
  });

  it('404s for someone who is not a member of the farm', async () => {
    const { svc } = makeService({ member: null });

    await expect(
      svc.setCapabilities('f1', 'owner-1', 'stranger', {
        RECORD_HARVEST: true,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists the overrides and reports them back', async () => {
    const row = member();
    const { svc, membersRepo } = makeService({ member: row });

    await expect(
      svc.setCapabilities('f1', 'owner-1', 'u2', { RECORD_HARVEST: true }),
    ).resolves.toEqual({
      farmId: 'f1',
      userId: 'u2',
      capabilityOverrides: { RECORD_HARVEST: true },
    });
    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityOverrides: { RECORD_HARVEST: true },
      }),
    );
  });

  it('stores null for an empty object, so "cleared" reads as never decided', async () => {
    const { svc, membersRepo } = makeService({
      member: member({ capabilityOverrides: { RECORD_HARVEST: true } }),
    });

    await svc.setCapabilities('f1', 'owner-1', 'u2', null);

    expect(membersRepo.save.mock.calls[0][0].capabilityOverrides).toBeNull();
  });
});

/**
 * The old single-switch route stays for one release: an app build already on
 * farmers' phones still calls it. It must write the SAME place the new one
 * does, or a grant made from an old build would be invisible to the resolver.
 */
describe('FarmMembersService.setFinancialAccess (compatibility)', () => {
  it('writes the grant into capabilityOverrides.VIEW_FINANCIALS', async () => {
    const { svc, membersRepo } = makeService({
      member: {
        role: 'worker',
        capabilityOverrides: { RECORD_HARVEST: true },
        canViewFinancials: null,
      },
    });

    await expect(
      svc.setFinancialAccess('f1', 'owner-1', 'u2', true),
    ).resolves.toEqual({ farmId: 'f1', userId: 'u2', canViewFinancials: true });

    const saved = membersRepo.save.mock.calls[0][0];
    // Merged, not replaced — the harvest grant must survive.
    expect(saved.capabilityOverrides).toEqual({
      RECORD_HARVEST: true,
      VIEW_FINANCIALS: true,
    });
    // And the legacy column keeps agreeing, so a rollback still honours it.
    expect(saved.canViewFinancials).toBe(true);
  });

  it('null clears just that key', async () => {
    const { svc, membersRepo } = makeService({
      member: {
        role: 'worker',
        capabilityOverrides: {
          RECORD_HARVEST: true,
          VIEW_FINANCIALS: false,
        },
        canViewFinancials: false,
      },
    });

    await svc.setFinancialAccess('f1', 'owner-1', 'u2', null);

    const saved = membersRepo.save.mock.calls[0][0];
    expect(saved.capabilityOverrides).toEqual({ RECORD_HARVEST: true });
    expect(saved.canViewFinancials).toBeNull();
  });
});
