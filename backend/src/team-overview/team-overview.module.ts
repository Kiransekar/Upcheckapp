import { Module } from '@nestjs/common';
import { TeamOverviewService } from './team-overview.service';
import { TeamOverviewController } from './team-overview.controller';
import { FarmsModule } from '../farms/farms.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveRequestsModule } from '../leave-requests/leave-requests.module';
import { TasksModule } from '../tasks/tasks.module';
import { FarmMembersModule } from '../farm-members/farm-members.module';

/**
 * Batching layer for the Team tab — see TeamOverviewService for why.
 *
 * Imports the feature modules rather than their repositories on purpose: the
 * point is to reuse the services WITH their access checks, not to reach past
 * them to the tables.
 */
@Module({
  imports: [
    FarmsModule,
    AttendanceModule,
    LeaveRequestsModule,
    TasksModule,
    FarmMembersModule,
  ],
  controllers: [TeamOverviewController],
  providers: [TeamOverviewService],
})
export class TeamOverviewModule {}
