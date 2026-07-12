import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import {
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  CreateEmployeeSalaryDto,
  UpdateEmployeeSalaryDto,
  CreatePayrollRunDto,
  UpdatePayslipStatusDto,
  RecalculatePayrollRunDto,
  CreateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  CreateReimbursementCategoryDto,
  UpdateReimbursementCategoryDto,
  CreateReimbursementDto,
  ApproveReimbursementDto,
} from './dto/payroll.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ======================================================================
  // Dashboard
  // ======================================================================
  @Get('dashboard')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  getDashboard(@TenantId() companyId: string) {
    return this.payrollService.getDashboard(companyId);
  }

  // ======================================================================
  // Salary Structures
  // ======================================================================
  @Post('salary-structures')
  @Permissions('payroll.create')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  createStructure(@TenantId() companyId: string, @Body() dto: CreateSalaryStructureDto) {
    return this.payrollService.createStructure(companyId, dto);
  }

  @Get('salary-structures')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findAllStructures(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllStructures(companyId, query);
  }

  @Get('salary-structures/:id')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findOneStructure(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.findOneStructure(companyId, id);
  }

  @Patch('salary-structures/:id')
  @Permissions('payroll.update')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  updateStructure(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateSalaryStructureDto) {
    return this.payrollService.updateStructure(companyId, id, dto);
  }

  @Delete('salary-structures/:id')
  @Permissions('payroll.delete')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  removeStructure(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.removeStructure(companyId, id);
  }

  // ======================================================================
  // Employee Salaries
  // ======================================================================
  @Post('employee-salaries')
  @Permissions('payroll.create')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  createEmployeeSalary(@TenantId() companyId: string, @Body() dto: CreateEmployeeSalaryDto) {
    return this.payrollService.createEmployeeSalary(companyId, dto);
  }

  @Get('employee-salaries')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findAllEmployeeSalaries(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllEmployeeSalaries(companyId, query);
  }

  @Get('employee-salaries/:id')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findOneEmployeeSalary(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.findOneEmployeeSalary(companyId, id);
  }

  @Patch('employee-salaries/:id')
  @Permissions('payroll.update')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  updateEmployeeSalary(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateEmployeeSalaryDto) {
    return this.payrollService.updateEmployeeSalary(companyId, id, dto);
  }

  // ======================================================================
  // Payroll Runs
  // ======================================================================
  @Post('runs')
  @Permissions('payroll.create')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  createRun(@TenantId() companyId: string, @Body() dto: CreatePayrollRunDto) {
    return this.payrollService.createRun(companyId, dto);
  }

  @Get('runs')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findAllRuns(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllRuns(companyId, query);
  }

  @Get('runs/:id')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findOneRun(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.findOneRun(companyId, id);
  }

  @Post('runs/:id/process')
  @Permissions('payroll.run')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  processRun(@TenantId() companyId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.payrollService.processRun(companyId, id, userId);
  }

  @Post('runs/:id/submit-for-approval')
  @Permissions('payroll.run')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  submitForApproval(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.submitForApproval(companyId, id);
  }

  @Post('runs/:id/approve-run')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  approveRun(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body('notes') notes?: string,
  ) {
    return this.payrollService.approveRun(companyId, id, userId, notes);
  }

  @Post('runs/:id/reject-run')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  rejectRun(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason: string,
  ) {
    return this.payrollService.rejectRun(companyId, id, rejectionReason);
  }

  @Post('runs/:id/complete')
  @Permissions('payroll.run')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  completeRun(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.completeRun(companyId, id);
  }

  @Post('runs/:id/cancel')
  @Permissions('payroll.run')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  cancelRun(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.cancelRun(companyId, id);
  }

  @Post('runs/:id/recalculate')
  @Permissions('payroll.run')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  recalculateRun(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: RecalculatePayrollRunDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.payrollService.recalculateRun(companyId, id, dto, userId);
  }

  @Get('runs/:id/versions')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findRunVersions(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.findRunVersions(companyId, id);
  }

  @Get('payslips/:id/compare')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  comparePayslip(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.comparePayslip(companyId, id);
  }

  // ======================================================================
  // Payslips
  // ======================================================================
  @Get('runs/:runId/payslips')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findPayslipsByRun(@TenantId() companyId: string, @Param('runId') runId: string) {
    return this.payrollService.findPayslipsByRun(companyId, runId);
  }

  @Patch('payslips/:id/status')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  updatePayslipStatus(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdatePayslipStatusDto) {
    return this.payrollService.updatePayslipStatus(companyId, id, dto);
  }

  @Get('me/payslips')
  myPayslips(@CurrentUser('employeeId') employeeId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findMyPayslips(employeeId, query);
  }

  // ======================================================================
  // Loans
  // ======================================================================
  @Post('loans')
  @Permissions('payroll.create')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  createLoan(@TenantId() companyId: string, @Body() dto: CreateLoanDto) {
    return this.payrollService.createLoan(companyId, dto);
  }

  @Get('loans')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findAllLoans(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllLoans(companyId, query);
  }

  @Get('me/loans')
  myLoans(@CurrentUser('employeeId') employeeId: string) {
    return this.payrollService.findMyLoans(employeeId);
  }

  @Post('loans/:id/approve')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  approveLoan(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: ApproveLoanDto, @CurrentUser('userId') userId: string) {
    return this.payrollService.approveLoan(companyId, id, dto, userId);
  }

  @Post('loans/:id/reject')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  rejectLoan(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: RejectLoanDto) {
    return this.payrollService.rejectLoan(companyId, id, dto);
  }

  // ======================================================================
  // Reimbursement Categories
  // ======================================================================
  @Post('reimbursement-categories')
  @Permissions('payroll.create')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  createCategory(@TenantId() companyId: string, @Body() dto: CreateReimbursementCategoryDto) {
    return this.payrollService.createCategory(companyId, dto);
  }

  @Get('reimbursement-categories')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findAllCategories(@TenantId() companyId: string) {
    return this.payrollService.findAllCategories(companyId);
  }

  @Patch('reimbursement-categories/:id')
  @Permissions('payroll.update')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  updateCategory(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateReimbursementCategoryDto) {
    return this.payrollService.updateCategory(companyId, id, dto);
  }

  // ======================================================================
  // Reimbursements
  // ======================================================================
  @Post('reimbursements')
  @Permissions('payroll.create')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.COMPANY_OWNER)
  createReimbursement(@TenantId() companyId: string, @Body() dto: CreateReimbursementDto) {
    return this.payrollService.createReimbursement(companyId, dto);
  }

  @Get('reimbursements')
  @Permissions('payroll.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  findAllReimbursements(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllReimbursements(companyId, query);
  }

  @Get('me/reimbursements')
  myReimbursements(@CurrentUser('employeeId') employeeId: string) {
    return this.payrollService.findMyReimbursements(employeeId);
  }

  @Post('reimbursements/:id/approve')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  approveReimbursement(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: ApproveReimbursementDto, @CurrentUser('userId') userId: string) {
    return this.payrollService.approveReimbursement(companyId, id, dto, userId);
  }

  @Post('reimbursements/:id/reject')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  rejectReimbursement(@TenantId() companyId: string, @Param('id') id: string, @Body('reason') reason: string) {
    return this.payrollService.rejectReimbursement(companyId, id, reason);
  }

  @Post('reimbursements/:id/paid')
  @Permissions('payroll.approve')
  @Roles(SystemRole.PAYROLL_MANAGER, SystemRole.FINANCE, SystemRole.COMPANY_OWNER)
  markReimbursementPaid(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.markReimbursementPaid(companyId, id);
  }
}
