import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EssService } from './ess.service';
import { UpdateMyProfileDto } from './dto/update-profile.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateRegularizationDto } from '../attendance-regularization/dto/attendance-regularization.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Employee Self-Service')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('me')
export class EssController {
  constructor(private readonly essService: EssService) {}

  // ---- Profile ----

  @Get('profile')
  @Permissions('employee.read')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.essService.getProfile(user);
  }

  @Patch('profile')
  @Permissions('employee.update')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMyProfileDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.updateProfile(user.employeeId!, dto);
  }

  // ---- Dashboard ----

  @Get('dashboard')
  @Permissions('employee.read')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    // Use user.companyId directly instead of @TenantId() so super admin
    // (who has companyId: null) can still access their mock dashboard.
    // The service handles null/empty companyId early for super admin.
    return this.essService.getDashboard(user.companyId ?? '', user);
  }

  // ---- Payslips ----

  @Get('payslips')
  @Permissions('payroll.read')
  myPayslips(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myPayslips(user.employeeId!, query);
  }

  @Get('payslips/:id')
  @Permissions('payroll.read')
  getPayslip(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.assertHasEmployeeProfile(user);
    return this.essService.getPayslip(user.employeeId!, id);
  }

  // ---- Leave History ----

  @Get('leave/history')
  @Permissions('leave.read')
  myLeaveHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myLeaveHistory(user.employeeId!, query);
  }

  @Get('leave/balances')
  @Permissions('leavebalance.read')
  myLeaveBalances(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myLeaveBalances(user.employeeId!);
  }

  // ---- Attendance Calendar ----

  @Get('attendance/calendar')
  @Permissions('attendance.read')
  myAttendanceCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myAttendanceCalendar(
      user.employeeId!,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  // ---- Expense Claims (Reimbursements) ----

  @Get('expenses')
  @Permissions('payroll.read')
  myExpenses(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myExpenses(user.employeeId!);
  }

  @Post('expenses')
  @Permissions('payroll.create')
  createExpense(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExpenseDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.essService.createExpense(companyId, user.employeeId!, dto);
  }

  // ---- Loans ----

  @Get('loans')
  @Permissions('payroll.read')
  myLoans(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myLoans(user.employeeId!);
  }

  // ---- Documents ----

  @Get('documents')
  @Permissions('employee.read')
  myDocuments(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myDocuments(user.employeeId!, query);
  }

  // ---- Tax Declarations ----

  @Get('tax-declarations')
  @Permissions('employee.read')
  myTaxDeclarations(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myTaxDeclarations(user.employeeId!);
  }

  // ---- Assets ----

  @Get('assets')
  @Permissions('employee.read')
  myAssets(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myAssets(user.employeeId!);
  }

  // ---- Attendance Regularization ----

  @Get('attendance/regularizations')
  @Permissions('attendance.read')
  myRegularizations(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myRegularizations(user.employeeId!, query);
  }

  @Post('attendance/regularizations')
  @Permissions('attendance.create')
  createRegularization(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRegularizationDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.essService.createRegularization(companyId, user.employeeId!, dto);
  }

  // ---- Training ----

  @Get('training')
  @Permissions('employee.read')
  myTraining(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myTraining(user.employeeId!);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
