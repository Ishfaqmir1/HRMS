import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import {
  CreateBillingPlanDto, UpdateBillingPlanDto, UpdateCompanySubscriptionDto,
  CreateFeatureFlagDto, ToggleFeatureFlagDto, UpdateCompanyBrandingDto,
  CreatePlanFeatureDto, UpdatePlanFeatureDto, UpdateFeatureMappingDto,
  AddPaymentMethodDto, UpdatePaymentMethodDto, SetDefaultPaymentMethodDto,
  UpdateAutoPayDto, UpdateBillingContactDto,
} from './dto/billing.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ======================================================================
  // Company Billing (tenant self-service)
  // ======================================================================

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getSubscription(@TenantId() companyId: string) {
    return this.billingService.getCompanySubscription(companyId);
  }

  @Patch('subscription')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updateSubscription(@TenantId() companyId: string, @Body() dto: UpdateCompanySubscriptionDto) {
    return this.billingService.updateCompanySubscription(companyId, dto);
  }

  @Get('plans')
  @Public()
  findAllPlans() {
    return this.billingService.findAllPlans();
  }

  @Get('invoices')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getInvoices(@TenantId() companyId: string) {
    return this.billingService.getMyInvoices(companyId);
  }

  @Get('invoices/:id/pdf')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  async downloadInvoicePdf(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.billingService.downloadInvoicePdf(companyId, id);
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.buffer.length.toString(),
    });
    res.send(result.buffer);
  }

  @Get('trial')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  checkTrial(@TenantId() companyId: string) {
    return this.billingService.checkTrialStatus(companyId);
  }

  @Get('limits')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  checkLimits(@TenantId() companyId: string) {
    return this.billingService.checkEmployeeLimit(companyId);
  }

  @Get('features')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getFeatures(@TenantId() companyId: string) {
    return this.billingService.getCompanyFeatureFlags(companyId);
  }

  @Get('branding')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getBranding(@TenantId() companyId: string) {
    return this.billingService.getCompanyBranding(companyId);
  }

  @Patch('branding')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updateBranding(@TenantId() companyId: string, @Body() dto: UpdateCompanyBrandingDto) {
    return this.billingService.updateCompanyBranding(companyId, dto);
  }

  // ======================================================================
  // Admin endpoints (Super Admin only)
  // ======================================================================

  @Post('plans')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  createPlan(@Body() dto: CreateBillingPlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Patch('plans/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  updatePlan(@Param('id') id: string, @Body() dto: UpdateBillingPlanDto) {
    return this.billingService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  removePlan(@Param('id') id: string) {
    return this.billingService.removePlan(id);
  }

  // ======================================================================
  // Plan Feature Catalog (Super Admin)
  // ======================================================================

  @Get('features-catalog')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  findAllFeaturesCatalog() {
    return this.billingService.findAllFeaturesAdmin();
  }

  @Post('features-catalog')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  createFeature(@Body() dto: CreatePlanFeatureDto) {
    return this.billingService.createFeature(dto);
  }

  @Patch('features-catalog/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  updateFeature(@Param('id') id: string, @Body() dto: UpdatePlanFeatureDto) {
    return this.billingService.updateFeature(id, dto);
  }

  @Delete('features-catalog/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  removeFeature(@Param('id') id: string) {
    return this.billingService.removeFeature(id);
  }

  // ======================================================================
  // Plan-Feature Mappings
  // ======================================================================

  @Get('plans/:id/features')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  getPlanFeatures(@Param('id') id: string) {
    return this.billingService.getPlanFeaturesWithDefaults(id);
  }

  @Patch('plans/:planId/features/:featureId')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  updateFeatureMapping(
    @Param('planId') planId: string,
    @Param('featureId') featureId: string,
    @Body() dto: UpdateFeatureMappingDto,
  ) {
    return this.billingService.updateFeatureMapping(planId, featureId, dto);
  }

  @Post('plans/:id/features/bulk')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  bulkUpdateFeatureMappings(
    @Param('id') id: string,
    @Body() body: { mappings: Array<{ featureId: string; isEnabled: boolean }> },
  ) {
    return this.billingService.bulkUpdateFeatureMappings(id, body.mappings);
  }

  @Post('feature-flags')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  createFeatureFlag(@Body() dto: CreateFeatureFlagDto) {
    return this.billingService.createFeatureFlag(dto);
  }

  @Get('feature-flags')
  @ApiBearerAuth()
  findAllFeatureFlags() {
    return this.billingService.findAllFeatureFlags();
  }

  @Post('feature-flags/:id/toggle')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  toggleFeatureFlag(
    @TenantId() companyId: string,
    @Param('id') featureFlagId: string,
    @Body() dto: ToggleFeatureFlagDto,
  ) {
    return this.billingService.toggleFeatureFlag(companyId, featureFlagId, dto);
  }

  // ======================================================================
  // Payment Methods (tenant self-service)
  // ======================================================================

  @Get('payment-methods')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getPaymentMethods(@TenantId() companyId: string) {
    return this.billingService.getPaymentMethods(companyId);
  }

  @Post('payment-methods')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  addPaymentMethod(@TenantId() companyId: string, @Body() dto: AddPaymentMethodDto) {
    return this.billingService.addPaymentMethod(companyId, dto);
  }

  @Patch('payment-methods/:id')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updatePaymentMethod(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.billingService.updatePaymentMethod(companyId, id, dto);
  }

  @Delete('payment-methods/:id')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  deletePaymentMethod(@TenantId() companyId: string, @Param('id') id: string) {
    return this.billingService.deletePaymentMethod(companyId, id);
  }

  @Get('auto-pay')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getAutoPay(@TenantId() companyId: string) {
    return this.billingService.getAutoPayStatus(companyId);
  }

  @Post('auto-pay')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  toggleAutoPay(@TenantId() companyId: string, @Body() dto: UpdateAutoPayDto) {
    return this.billingService.toggleAutoPay(companyId, dto.autoPay);
  }

  @Get('billing-contact')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getBillingContact(@TenantId() companyId: string) {
    return this.billingService.getBillingContact(companyId);
  }

  @Patch('billing-contact')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updateBillingContact(@TenantId() companyId: string, @Body() dto: UpdateBillingContactDto) {
    return this.billingService.updateBillingContact(companyId, dto);
  }

  // Stripe webhook (public, verified by Stripe signature)
  @Public()
  @Post('webhook')
  handleWebhook(@Body() event: any) {
    return this.billingService.handleStripeWebhook(event);
  }
}
