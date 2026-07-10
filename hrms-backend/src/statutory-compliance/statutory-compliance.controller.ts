import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatutoryComplianceService } from './statutory-compliance.service';
import { UpdateComplianceConfigDto, CalculateStatutoryDeductionsDto } from './dto/statutory-compliance.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Statutory Compliance (India)')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('statutory-compliance')
export class StatutoryComplianceController {
  constructor(private readonly complianceService: StatutoryComplianceService) {}

  // ====================================================================
  // Configuration
  // ====================================================================

  @Get('config')
  @Permissions('payroll.read')
  getConfig(@TenantId() companyId: string) {
    return this.complianceService.getConfig(companyId);
  }

  @Patch('config')
  @Permissions('payroll.update')
  updateConfig(@TenantId() companyId: string, @Body() dto: UpdateComplianceConfigDto) {
    return this.complianceService.updateConfig(companyId, dto);
  }

  // ====================================================================
  // Calculation
  // ====================================================================

  @Post('calculate')
  @Permissions('payroll.read')
  calculateDeductions(@TenantId() companyId: string, @Body() dto: CalculateStatutoryDeductionsDto) {
    return this.complianceService.calculateAllDeductions(companyId, dto.grossPay);
  }

  // ====================================================================
  // Professional Tax Slabs
  // ====================================================================

  @Get('pt-slabs')
  @Permissions('payroll.read')
  getPtSlabs(@TenantId() companyId: string, @Query('state') state?: string) {
    return this.complianceService.getPtSlabs(companyId, state);
  }
}
