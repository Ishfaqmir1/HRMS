import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from './admin.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminUsersService } from './admin-users.service';
import { AdminRolesService } from './admin-roles.service';
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
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminBillingService: AdminBillingService,
    private readonly adminUsersService: AdminUsersService,
    private readonly adminRolesService: AdminRolesService,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform-wide admin dashboard with aggregate metrics (super admin only)' })
  getDashboard() {
    return this.adminDashboardService.getDashboard();
  }

  // ── Analytics (Platform-Wide) ──────────────────────────────

  @Get('analytics')
  @ApiOperation({ summary: 'Platform-wide analytics dashboard for super admin' })
  getAnalytics() {
    return this.adminAnalyticsService.getDashboard();
  }

  // ── Billing Overview ───────────────────────────────────────

  @Get('billing/overview')
  @ApiOperation({ summary: 'Platform-wide billing overview for super admin (MRR, invoices, subscriptions)' })
  getBillingOverview() {
    return this.adminBillingService.getBillingOverview();
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

  // ════════════════════════════════════════════════════════════════
  // Platform Users (Super Admin)
  // ════════════════════════════════════════════════════════════════

  @Get('users')
  @ApiOperation({ summary: 'List all platform users (super admins)' })
  getUsers() {
    return this.adminUsersService.findAll();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get a single platform user' })
  getUser(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new platform user (super admin)' })
  createUser(@Body() dto: { email: string; password: string; roleId?: string }) {
    return this.adminUsersService.create(dto);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activate or suspend a platform user' })
  updateUserStatus(@Param('id') id: string, @Body() dto: { status: 'ACTIVE' | 'SUSPENDED' }) {
    return this.adminUsersService.updateStatus(id, dto.status);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft-delete a platform user' })
  removeUser(@Param('id') id: string) {
    return this.adminUsersService.remove(id);
  }

  @Post('users/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Assign a platform role to a user' })
  assignUserRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    return this.adminUsersService.assignRole(userId, roleId);
  }

  @Delete('users/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Revoke a platform role from a user' })
  revokeUserRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    return this.adminUsersService.revokeRole(userId, roleId);
  }

  // ════════════════════════════════════════════════════════════════
  // Platform Roles (System Roles)
  // ════════════════════════════════════════════════════════════════

  @Get('roles')
  @ApiOperation({ summary: 'List all platform roles (system roles)' })
  getRoles() {
    return this.adminRolesService.findAll();
  }

  @Get('roles/permissions')
  @ApiOperation({ summary: 'List all permissions grouped by module' })
  getPermissions() {
    return this.adminRolesService.listPermissions();
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get a single platform role with permissions' })
  getRole(@Param('id') id: string) {
    return this.adminRolesService.findOne(id);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a new platform role' })
  createRole(@Body() dto: { name: string; slug: string; description?: string; permissionCodes?: string[] }) {
    return this.adminRolesService.create(dto);
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update a platform role metadata' })
  updateRole(@Param('id') id: string, @Body() dto: { name?: string; description?: string }) {
    return this.adminRolesService.update(id, dto);
  }

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: 'Set permissions for a platform role' })
  setRolePermissions(@Param('id') id: string, @Body() dto: { permissionCodes: string[] }) {
    return this.adminRolesService.setPermissions(id, dto.permissionCodes);
  }

  @Delete('roles/:id')
  @ApiOperation({ summary: 'Delete a platform role (must have no assigned users)' })
  removeRole(@Param('id') id: string) {
    return this.adminRolesService.remove(id);
  }
}
