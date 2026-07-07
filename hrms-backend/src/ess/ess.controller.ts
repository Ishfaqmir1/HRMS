import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EssService } from './ess.service';
import { UpdateMyProfileDto } from './dto/update-profile.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Employee Self-Service')
@ApiBearerAuth()
@Controller('me')
export class EssController {
  constructor(private readonly essService: EssService) {}

  // ---- Profile ----

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.getProfile(user.employeeId!);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMyProfileDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.updateProfile(user.employeeId!, dto);
  }

  // ---- Dashboard ----

  @Get('dashboard')
  getDashboard(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.getDashboard(companyId, user.employeeId!);
  }

  // ---- Payslips ----

  @Get('payslips')
  myPayslips(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myPayslips(user.employeeId!, query);
  }

  @Get('payslips/:id')
  getPayslip(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.assertHasEmployeeProfile(user);
    return this.essService.getPayslip(user.employeeId!, id);
  }

  // ---- Leave History ----

  @Get('leave/history')
  myLeaveHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myLeaveHistory(user.employeeId!, query);
  }

  @Get('leave/balances')
  myLeaveBalances(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myLeaveBalances(user.employeeId!);
  }

  // ---- Attendance Calendar ----

  @Get('attendance/calendar')
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
  myExpenses(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myExpenses(user.employeeId!);
  }

  @Post('expenses')
  createExpense(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: any,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.essService.createExpense(companyId, user.employeeId!, dto);
  }

  // ---- Loans ----

  @Get('loans')
  myLoans(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myLoans(user.employeeId!);
  }

  // ---- Documents ----

  @Get('documents')
  myDocuments(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myDocuments(user.employeeId!, query);
  }

  // ---- Tax Declarations ----

  @Get('tax-declarations')
  myTaxDeclarations(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myTaxDeclarations(user.employeeId!);
  }

  // ---- Assets ----

  @Get('assets')
  myAssets(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.myAssets(user.employeeId!);
  }

  // ---- Training ----

  @Get('training')
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
