import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';
import { ReportsService } from './reports.service';
import { FinancialReportQueryDto } from '../transactions/dto/money-query.dto';
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboardSummary(
    @CurrentUser() user,
    @Query('farmId') farmId?: string,
  ) {
    return this.reportsService.getDashboardSummary(user.id, farmId);
  }

  @Get('cycle/:id/analysis')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Crop', 'id', 'pond.farm.userId', 'VIEW_FINANCIALS')
  async getCycleAnalysis(@CurrentUser() user, @Param('id') id: string) {
    return this.reportsService.getCycleAnalysis(id, user.id);
  }

  @Get('financials')
  async getFinancialReport(
    @Query() q: FinancialReportQueryDto,
    @CurrentUser() user,
  ) {
    return this.reportsService.getFinancialReport(
      q.farmId as string,
      user.id,
      q,
    );
  }
}
