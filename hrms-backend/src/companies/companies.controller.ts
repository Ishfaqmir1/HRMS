import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto, AdminUpdateCompanyDto } from './dto/update-company.dto';
import {
  ResetPasswordDto, SendAnnouncementDto, UpdateCompanyPlanDto,
  UpdateCompanyLimitsDto, CompanyQueryDto, RejectCompanyDto,
} from './dto/company-actions.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // ====================================================================
  // Tenant self-service
  // ====================================================================

  @Get('me')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getMyCompany(@TenantId() companyId: string) {
    return this.companiesService.getMyCompany(companyId);
  }

  @Patch('me')
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updateMyCompany(@TenantId() companyId: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateMyCompany(companyId, dto);
  }

  // ====================================================================
  // Platform admin (Super Admin only)
  // ====================================================================

  @Get()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all companies with rich details (super admin)' })
  findAll(@Query() query: CompanyQueryDto) {
    return this.companiesService.findAll(query);
  }

  /** Specific routes must be defined before parameterized :id routes. */
  @Patch(':id/profile')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a company profile (super admin)' })
  adminUpdate(@Param('id') id: string, @Body() dto: AdminUpdateCompanyDto) {
    return this.companiesService.adminUpdate(id, dto);
  }

  @Post(':id/verification-document')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload a verification document for a company' })
  uploadVerificationDocument(
    @Param('id') id: string,
    @Body() body: { documentType: string; fileUrl: string },
  ) {
    return this.companiesService.uploadVerificationDocument(id, body.documentType, body.fileUrl);
  }

  @Get('pending/approvals')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List companies awaiting super admin approval' })
  getPendingApprovals() {
    return this.companiesService.getPendingApprovals();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single company with full detail' })
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Get(':id/users')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all users in a company with their roles' })
  getUsers(@Param('id') id: string) {
    return this.companiesService.getCompanyUsers(id);
  }

  @Get(':id/audit')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs for a company' })
  getAuditLogs(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.companiesService.getCompanyAuditLogs(id, limit ? parseInt(limit, 10) : 50);
  }

  // ---- Status management ----

  @Patch(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend a company' })
  suspend(@Param('id') id: string) {
    return this.companiesService.setStatus(id, 'SUSPENDED');
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate a suspended company' })
  activate(@Param('id') id: string) {
    return this.companiesService.setStatus(id, 'ACTIVE');
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel/disable a company' })
  cancel(@Param('id') id: string) {
    return this.companiesService.setStatus(id, 'CANCELLED');
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a company' })
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }

  // ---- Actions ----

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Reset the company owner's password" })
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.companiesService.resetPassword(id, dto);
  }

  @Post(':id/impersonate')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate an impersonation token to log in as the company owner' })
  impersonate(@Param('id') id: string) {
    return this.companiesService.impersonate(id);
  }

  @Post(':id/announcement')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send an announcement to all users in a company' })
  sendAnnouncement(@Param('id') id: string, @Body() dto: SendAnnouncementDto) {
    return this.companiesService.sendAnnouncement(id, dto);
  }

  @Patch(':id/plan')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Change a company's billing plan" })
  updatePlan(@Param('id') id: string, @Body() dto: UpdateCompanyPlanDto) {
    return this.companiesService.updatePlan(id, dto);
  }

  @Patch(':id/limits')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Override a company's employee or storage limits" })
  updateLimits(@Param('id') id: string, @Body() dto: UpdateCompanyLimitsDto) {
    return this.companiesService.updateLimits(id, dto);
  }

  // ---- Verification Workflow ----

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a company (moves from PENDING_APPROVAL to ACTIVE)' })
  approve(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.companiesService.approve(id, userId);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a company with a reason' })
  reject(@Param('id') id: string, @Body() dto: RejectCompanyDto, @CurrentUser('userId') userId: string) {
    return this.companiesService.reject(id, dto, userId);
  }

}
