import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmMember } from '../farm-access/farm-member.entity';
import { User } from '../auth/user.entity';
import { Farm } from '../farms/farm.entity';
import { Pond } from '../ponds/pond.entity';
import { FarmInvite } from './farm-invite.entity';
import { FarmMembersController } from './farm-members.controller';
import { FarmMembersService } from './farm-members.service';
import { FarmInvitesService } from './farm-invites.service';
import { FarmRecoveryService } from './farm-recovery.service';

/**
 * Team-membership API: look up users, add/remove farm workers, list members,
 * and list the farms the caller belongs to. Authorization is enforced via the
 * global FarmAccessService (owner-only for add/remove). Auth itself is untouched.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FarmMember, User, Farm, FarmInvite, Pond])],
  controllers: [FarmMembersController],
  providers: [FarmMembersService, FarmInvitesService, FarmRecoveryService],
  exports: [FarmMembersService, FarmInvitesService, FarmRecoveryService],
})
export class FarmMembersModule {}
