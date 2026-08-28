import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from './leave-request.entity';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestsController } from './leave-requests.controller';

/**
 * Authorization is enforced via the global FarmAccessService (see
 * farm-access.module.ts's @Global()) — no explicit import needed here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LeaveRequest])],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
  // See AttendanceModule — exported for TeamOverviewModule's batching layer.
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
