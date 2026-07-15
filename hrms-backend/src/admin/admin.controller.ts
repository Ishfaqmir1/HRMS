import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide admin dashboard with aggregate metrics (super admin only)' })
  getDashboard() {
    return this.adminDashboardService.getDashboard();
  }
}
