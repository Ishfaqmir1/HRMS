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
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ======================================================================
  // Dashboard
  // ======================================================================
  @Get('dashboard')
  @Permissions('payroll.read')
  getDashboard(@TenantId() companyId: string) {
    return this.payrollService.getDashboard(companyId);
  }

  // ======================================================================
  // Salary Structures
  // ======================================================================
  @Post('salary-structures')
  @Permissions('payroll.create')
  createStructure(@TenantId() companyId: string, @Body() dto: CreateSalaryStructureDto) {
    return this.payrollService.createStructure(companyId, dto);
  }

  @Get('salary-structures')
  @Permissions('payroll.read')
  findAllStructures(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllStructures(companyId, query);
  }

  @Get('salary-structures/:id')
  @Permissions('payroll.read')
  findOneStructure(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.findOneStructure(companyId, id);
  }

  @Patch('salary-structures/:id')
  @Permissions('payroll.update')
  updateStructure(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateSalaryStructureDto) {
    return this.payrollService.updateStructure(companyId, id, dto);
  }

  @Delete('salary-structures/:id')
  @Permissions('payroll.delete')
  removeStructure(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.removeStructure(companyId, id);
  }

  // ======================================================================
  // Employee Salaries
  // ======================================================================
  @Post('employee-salaries')
  @Permissions('payroll.create')
  createEmployeeSalary(@TenantId() companyId: string, @Body() dto: CreateEmployeeSalaryDto) {
    return this.payrollService.createEmployeeSalary(companyId, dto);
  }

  @Get('employee-salaries')
  @Permissions('payroll.read')
  findAllEmployeeSalaries(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllEmployeeSalaries(companyId, query);
  }

  @Get('employee-salaries/:id')
  @Permissions('payroll.read')
  findOneEmployeeSalary(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.findOneEmployeeSalary(companyId, id);
  }

  @Patch('employee-salaries/:id')
  @Permissions('payroll.update')
  updateEmployeeSalary(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateEmployeeSalaryDto) {
    return this.payrollService.updateEmployeeSalary(companyId, id, dto);
  }

  // ======================================================================
  // Payroll Runs
  // ======================================================================
  @Post('runs')
  @Permissions('payroll.create')
  createRun(@TenantId() companyId: string, @Body() dto: CreatePayrollRunDto) {
    return this.payrollService.createRun(companyId, dto);
  }

  @Get('runs')
  @Permissions('payroll.read')
  findAllRuns(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllRuns(companyId, query);
  }

  @Get('runs/:id')
  @Permissions('payroll.read')
  findOneRun(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.findOneRun(companyId, id);
  }

  @Post('runs/:id/process')
  @Permissions('payroll.run')
  processRun(@TenantId() companyId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.payrollService.processRun(companyId, id, userId);
  }

  @Post('runs/:id/complete')
  @Permissions('payroll.run')
  completeRun(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.completeRun(companyId, id);
  }

  @Post('runs/:id/cancel')
  @Permissions('payroll.run')
  cancelRun(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.cancelRun(companyId, id);
  }

  // ======================================================================
  // Payslips
  // ======================================================================
  @Get('runs/:runId/payslips')
  @Permissions('payroll.read')
  findPayslipsByRun(@TenantId() companyId: string, @Param('runId') runId: string) {
    return this.payrollService.findPayslipsByRun(companyId, runId);
  }

  @Patch('payslips/:id/status')
  @Permissions('payroll.approve')
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
  createLoan(@TenantId() companyId: string, @Body() dto: CreateLoanDto) {
    return this.payrollService.createLoan(companyId, dto);
  }

  @Get('loans')
  @Permissions('payroll.read')
  findAllLoans(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllLoans(companyId, query);
  }

  @Get('me/loans')
  myLoans(@CurrentUser('employeeId') employeeId: string) {
    return this.payrollService.findMyLoans(employeeId);
  }

  @Post('loans/:id/approve')
  @Permissions('payroll.approve')
  approveLoan(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: ApproveLoanDto, @CurrentUser('userId') userId: string) {
    return this.payrollService.approveLoan(companyId, id, dto, userId);
  }

  @Post('loans/:id/reject')
  @Permissions('payroll.approve')
  rejectLoan(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: RejectLoanDto) {
    return this.payrollService.rejectLoan(companyId, id, dto);
  }

  // ======================================================================
  // Reimbursement Categories
  // ======================================================================
  @Post('reimbursement-categories')
  @Permissions('payroll.create')
  createCategory(@TenantId() companyId: string, @Body() dto: CreateReimbursementCategoryDto) {
    return this.payrollService.createCategory(companyId, dto);
  }

  @Get('reimbursement-categories')
  @Permissions('payroll.read')
  findAllCategories(@TenantId() companyId: string) {
    return this.payrollService.findAllCategories(companyId);
  }

  @Patch('reimbursement-categories/:id')
  @Permissions('payroll.update')
  updateCategory(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateReimbursementCategoryDto) {
    return this.payrollService.updateCategory(companyId, id, dto);
  }

  // ======================================================================
  // Reimbursements
  // ======================================================================
  @Post('reimbursements')
  @Permissions('payroll.create')
  createReimbursement(@TenantId() companyId: string, @Body() dto: CreateReimbursementDto) {
    return this.payrollService.createReimbursement(companyId, dto);
  }

  @Get('reimbursements')
  @Permissions('payroll.read')
  findAllReimbursements(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.payrollService.findAllReimbursements(companyId, query);
  }

  @Get('me/reimbursements')
  myReimbursements(@CurrentUser('employeeId') employeeId: string) {
    return this.payrollService.findMyReimbursements(employeeId);
  }

  @Post('reimbursements/:id/approve')
  @Permissions('payroll.approve')
  approveReimbursement(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: ApproveReimbursementDto, @CurrentUser('userId') userId: string) {
    return this.payrollService.approveReimbursement(companyId, id, dto, userId);
  }

  @Post('reimbursements/:id/reject')
  @Permissions('payroll.approve')
  rejectReimbursement(@TenantId() companyId: string, @Param('id') id: string, @Body('reason') reason: string) {
    return this.payrollService.rejectReimbursement(companyId, id, reason);
  }

  @Post('reimbursements/:id/paid')
  @Permissions('payroll.approve')
  markReimbursementPaid(@TenantId() companyId: string, @Param('id') id: string) {
    return this.payrollService.markReimbursementPaid(companyId, id);
  }
}
