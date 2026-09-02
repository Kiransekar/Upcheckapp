import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from './attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

/**
 * Authorization is enforced via the global FarmAccessService (see
 * farm-access.module.ts's @Global()) — no explicit import needed here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  // Exported so TeamOverviewModule can batch the Team tab's reads through the
  // SAME service — and therefore the same per-farm capability checks.
  exports: [AttendanceService],
})
export class AttendanceModule {}
