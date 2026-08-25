import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmMember } from './farm-member.entity';
import { FarmMemberPond } from './farm-member-pond.entity';
import { Farm } from '../farms/farm.entity';
import { Pond } from '../ponds/pond.entity';
import { FarmAccessService } from './farm-access.service';

/**
 * Provides the farm membership / authorization layer. Global so the
 * OwnershipGuard (instantiated per-controller via @UseGuards) and any service
 * can inject FarmAccessService without each module importing this explicitly.
 * Registers only the repositories it reads — no service-level deps — to stay
 * free of circular module references.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FarmMember, FarmMemberPond, Farm, Pond])],
  providers: [FarmAccessService],
  exports: [FarmAccessService, TypeOrmModule],
})
export class FarmAccessModule {}
