import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FarmMembersService } from './farm-members.service';
import { FarmMember } from '../farm-access/farm-member.entity';
import { User } from '../auth/user.entity';
import { Farm } from '../farms/farm.entity';
import { Pond } from '../ponds/pond.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';

/**
 * Live-incident regression: "Add Worker" 500'd because every usersRepo
 * lookup in this service used a bare findOne(), which selects EVERY mapped
 * User column by default — including backup_codes, added by a migration
 * that was written but never applied in production (the same root cause
 * that took down login once already). Scoping the select to only the
 * fields toPublicUser() actually reads means this code never depends on
 * whether the rest of User's columns are migrated yet.
 */
describe('FarmMembersService — user lookups never select unused columns', () => {
  let service: FarmMembersService;
  let usersRepo: { findOne: jest.Mock; find?: jest.Mock };
  let membersRepo: { findOne: jest.Mock; find?: jest.Mock; create?: jest.Mock; save?: jest.Mock };
  let farmsRepo: { findOne: jest.Mock };
  let farmAccess: Record<string, jest.Mock>;

  const PUBLIC_USER_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    username: true,
    avatarUrl: true,
  };

  beforeEach(async () => {
    usersRepo = { findOne: jest.fn() };
    membersRepo = { findOne: jest.fn() };
    farmsRepo = { findOne: jest.fn() };
    farmAccess = {
      // listMembers batches pond scopes for the roster.
      getPondScopesForMembers: jest.fn().mockResolvedValue(new Map()),
      assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
      getRoleOnFarm: jest.fn().mockResolvedValue('owner'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmMembersService,
        { provide: getRepositoryToken(FarmMember), useValue: membersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Farm), useValue: farmsRepo },
        { provide: getRepositoryToken(Pond), useValue: { find: jest.fn() } },
        { provide: FarmAccessService, useValue: farmAccess },
      ],
    }).compile();

    service = module.get(FarmMembersService);
  });

  it('lookupUser scopes the select when resolving by userId', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1', firstName: 'A', lastName: 'B', username: 'ab', avatarUrl: null,
    });
    await service.lookupUser({ userId: 'u1' });
    expect(usersRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: PUBLIC_USER_SELECT,
    });
  });

  it('lookupUser scopes the select when resolving by phone', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1', firstName: 'A', lastName: 'B', username: 'ab', avatarUrl: null,
    });
    await service.lookupUser({ phone: '+911234567890' });
    expect(usersRepo.findOne).toHaveBeenCalledWith({
      where: { phone: '+911234567890' },
      select: PUBLIC_USER_SELECT,
    });
  });

  it('lookupUser scopes the select when resolving by email', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1', firstName: 'A', lastName: 'B', username: 'ab', avatarUrl: null,
    });
    await service.lookupUser({ email: 'a@b.com' });
    expect(usersRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
      select: PUBLIC_USER_SELECT,
    });
  });

  it('addMember scopes the select for the target user lookup', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u2', firstName: 'C', lastName: 'D', username: 'cd', avatarUrl: null,
    });
    farmsRepo.findOne.mockResolvedValue({ id: 'farm-1', userId: 'owner-1' });
    membersRepo.findOne.mockResolvedValue(null);
    membersRepo.create = jest.fn((x) => x);
    membersRepo.save = jest.fn().mockResolvedValue(undefined);

    await service.addMember('farm-1', 'owner-1', { userId: 'u2' });

    expect(usersRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'u2' },
      select: PUBLIC_USER_SELECT,
    });
  });

  /**
   * Live-incident regression: listMembers() used `relations: ['user']` — an
   * eager join selects every column of the joined User entity with no way
   * to scope it, same underlying issue as the bare findOne() calls above,
   * just via a different TypeORM API. The failure was worse here: caught by
   * the screen's try/catch and silently rendered as "no workers" instead of
   * a visible error, right after a successful "Add Worker" success message.
   */
  it('listMembers never uses relations:["user"] and scopes the batched user select', async () => {
    membersRepo.find = jest.fn().mockResolvedValue([
      { id: 'm1', farmId: 'farm-1', userId: 'u1', role: 'worker', createdAt: new Date() },
    ]);
    usersRepo.find = jest.fn().mockResolvedValue([
      { id: 'u1', firstName: 'A', lastName: 'B', username: 'ab', avatarUrl: null },
    ]);

    const result = await service.listMembers('farm-1', 'owner-1');

    expect(membersRepo.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ relations: expect.anything() }),
    );
    expect(usersRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ select: PUBLIC_USER_SELECT }),
    );
    expect(result[0].user).toEqual({
      id: 'u1', firstName: 'A', lastName: 'B', username: 'ab', avatarUrl: null,
    });
  });

  it('listMembers does not query users at all when the farm has no members', async () => {
    membersRepo.find = jest.fn().mockResolvedValue([]);
    usersRepo.find = jest.fn();

    const result = await service.listMembers('farm-1', 'owner-1');

    expect(usersRepo.find).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
