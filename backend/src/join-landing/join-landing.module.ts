import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JoinLandingController } from './join-landing.controller';
import { FarmInvite } from '../farm-members/farm-invite.entity';
import { Farm } from '../farms/farm.entity';

/**
 * The public invite landing page (W4-A). Repositories only, no services: this
 * reads two rows and renders a string, and must not be able to change anything.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FarmInvite, Farm])],
  controllers: [JoinLandingController],
})
export class JoinLandingModule {}
