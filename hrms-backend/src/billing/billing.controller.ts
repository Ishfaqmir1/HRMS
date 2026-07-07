import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import {
  CreateBillingPlanDto, UpdateBillingPlanDto, UpdateCompanySubscriptionDto,
  CreateFeatureFlagDto, ToggleFeatureFlagDto, UpdateCompanyBrandingDto,
} from './dto/billing.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ======================================================================
  // Company Billing (tenant self-service)
  // ======================================================================

  @Get('subscription')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getSubscription(@TenantId() companyId: string) {
    return this.billingService.getCompanySubscription(companyId);
  }

  @Patch('subscription')
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updateSubscription(@TenantId() companyId: string, @Body() dto: UpdateCompanySubscriptionDto) {
    return this.billingService.updateCompanySubscription(companyId, dto);
  }

  @Get('plans')
  findAllPlans() {
    return this.billingService.findAllPlans();
  }

  @Get('invoices')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getInvoices(@TenantId() companyId: string) {
    return this.billingService.getMyInvoices(companyId);
  }

  @Get('trial')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  checkTrial(@TenantId() companyId: string) {
    return this.billingService.checkTrialStatus(companyId);
  }

  @Get('limits')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  checkLimits(@TenantId() companyId: string) {
    return this.billingService.checkEmployeeLimit(companyId);
  }

  @Get('features')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getFeatures(@TenantId() companyId: string) {
    return this.billingService.getCompanyFeatureFlags(companyId);
  }

  @Get('branding')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getBranding(@TenantId() companyId: string) {
    return this.billingService.getCompanyBranding(companyId);
  }

  @Patch('branding')
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updateBranding(@TenantId() companyId: string, @Body() dto: UpdateCompanyBrandingDto) {
    return this.billingService.updateCompanyBranding(companyId, dto);
  }

  // ======================================================================
  // Admin endpoints (Super Admin only)
  // ======================================================================

  @Post('plans')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  createPlan(@Body() dto: CreateBillingPlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Patch('plans/:id')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  updatePlan(@Param('id') id: string, @Body() dto: UpdateBillingPlanDto) {
    return this.billingService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  removePlan(@Param('id') id: string) {
    return this.billingService.removePlan(id);
  }

  @Post('feature-flags')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  createFeatureFlag(@Body() dto: CreateFeatureFlagDto) {
    return this.billingService.createFeatureFlag(dto);
  }

  @Get('feature-flags')
  findAllFeatureFlags() {
    return this.billingService.findAllFeatureFlags();
  }

  @Post('feature-flags/:id/toggle')
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  toggleFeatureFlag(
    @TenantId() companyId: string,
    @Param('id') featureFlagId: string,
    @Body() dto: ToggleFeatureFlagDto,
  ) {
    return this.billingService.toggleFeatureFlag(companyId, featureFlagId, dto);
  }

  // Stripe webhook (public, verified by Stripe signature)
  @Public()
  @Post('webhook')
  handleWebhook(@Body() event: any) {
    return this.billingService.handleStripeWebhook(event);
  }
}
