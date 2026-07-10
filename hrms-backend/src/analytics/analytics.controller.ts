import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions('employee.read')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    // Use user.companyId instead of @TenantId() so super admin
    // (who has companyId: null) can still access empty analytics.
    // The service handles null/empty companyId by returning empty data.
    return this.analyticsService.getDashboard(user.companyId ?? '');
  }
}
