import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from './admin.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminSettingsService } from './admin-settings.service';
import { UpdatePlatformSettingsDto, AuditLogQueryDto } from './dto/admin-settings.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(SystemRole.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminSettingsService: AdminSettingsService,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform-wide admin dashboard with aggregate metrics (super admin only)' })
  getDashboard() {
    return this.adminDashboardService.getDashboard();
  }

  // ── Audit Logs ─────────────────────────────────────────────

  @Get('audit-logs')
  @ApiOperation({ summary: 'List all platform-wide audit logs with search, filter, and pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminAuditService.getAuditLogs(query);
  }

  @Get('audit-logs/stats')
  @ApiOperation({ summary: 'Audit log statistics (action counts, daily trends)' })
  getAuditLogStats() {
    return this.adminAuditService.getAuditLogStats();
  }

  @Get('audit-logs/actions')
  @ApiOperation({ summary: 'List all unique audit log action types' })
  getAuditLogActions() {
    return this.adminAuditService.getDistinctActions();
  }

  // ── Settings / Platform Configuration ──────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get platform-wide settings (branding, maintenance mode, defaults)' })
  getSettings() {
    return this.adminSettingsService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update platform-wide settings' })
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminSettingsService.updateSettings(dto);
  }

  // ── Maintenance Mode ───────────────────────────────────────

  @Post('settings/maintenance')
  @ApiOperation({ summary: 'Toggle maintenance mode on/off' })
  toggleMaintenance(@Body() dto: { enabled: boolean; message?: string }) {
    return this.adminSettingsService.toggleMaintenance(dto.enabled, dto.message);
  }
}
