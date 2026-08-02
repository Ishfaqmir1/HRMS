import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import {
  ClockInDto,
  ClockOutDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  StartBreakDto,
  EndBreakDto,
  AttendanceTrendQueryDto,
  DepartmentSummaryQueryDto,
  AttendanceCsvQueryDto,
} from './dto/attendance.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ---- Break Tracking ----

  @Post('break/start')
  @Permissions('attendance.create')
  startBreak(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: StartBreakDto) {
    this.assertHasEmployeeProfile(user);
    return this.attendanceService.startBreak(companyId, user.employeeId!, dto);
  }

  @Post('break/end')
  @Permissions('attendance.create')
  endBreak(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: EndBreakDto) {
    this.assertHasEmployeeProfile(user);
    return this.attendanceService.endBreak(companyId, user.employeeId!, dto);
  }

  @Get('me/breaks/:recordId')
  @Permissions('attendance.read')
  getBreaks(@CurrentUser() user: AuthenticatedUser, @Param('recordId') recordId: string) {
    this.assertHasEmployeeProfile(user);
    return this.attendanceService.getBreaks(user.employeeId!, recordId);
  }

  // ---- Self-service (any authenticated employee) ----

  @Post('clock-in')
  @Permissions('attendance.create')
  clockIn(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ClockInDto) {
    this.assertHasEmployeeProfile(user);
    return this.attendanceService.clockIn(companyId, user.employeeId!, dto);
  }

  @Post('clock-out')
  @Permissions('attendance.create')
  clockOut(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ClockOutDto) {
    this.assertHasEmployeeProfile(user);
    return this.attendanceService.clockOut(companyId, user.employeeId!, dto);
  }

  @Get('me/today')
  @Permissions('attendance.read')
  myToday(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.attendanceService.myToday(user.employeeId!);
  }

  @Get('me/history')
  @Permissions('attendance.read')
  myHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.attendanceService.myHistory(user.employeeId!, query);
  }

  // ---- HR / management ----

  @Get()
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  findAll(
    @TenantId() companyId: string,
    @Query() query: PaginationQueryDto,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.findAll(companyId, query, { employeeId, departmentId, from, to });
  }

  // ==================================================================
  // Attendance Analytics & Reports
  // IMPORTANT: These must be defined BEFORE @Get(':id') to avoid
  // Express catching "reports" as an :id parameter.
  // ==================================================================

  @Get('reports/trend')
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  @ApiQuery({ name: 'from', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day', 'month'] })
  getTrendReport(
    @TenantId() companyId: string,
    @Query() query: AttendanceTrendQueryDto,
  ) {
    return this.attendanceService.getTrendReport(companyId, query);
  }

  @Get('reports/departments')
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  @ApiQuery({ name: 'from', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'YYYY-MM-DD' })
  getDepartmentSummary(
    @TenantId() companyId: string,
    @Query() query: DepartmentSummaryQueryDto,
  ) {
    return this.attendanceService.getDepartmentSummary(companyId, query);
  }

  @Get('reports/export/csv')
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  @ApiProduces('text/csv')
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['PRESENT','ABSENT','LATE','HALF_DAY','ON_LEAVE'] })
  async exportCsv(
    @TenantId() companyId: string,
    @Query() query: AttendanceCsvQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.attendanceService.exportCsv(companyId, query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(result.csv);
  }

  @Get(':id')
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.attendanceService.findOne(companyId, id);
  }

  @Post()
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  createManual(@TenantId() companyId: string, @Body() dto: CreateAttendanceDto) {
    return this.attendanceService.createManual(companyId, dto);
  }

  @Patch(':id')
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('attendance.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.attendanceService.remove(companyId, id);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
