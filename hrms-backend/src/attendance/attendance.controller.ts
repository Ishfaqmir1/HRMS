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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  ClockInDto,
  ClockOutDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  StartBreakDto,
  EndBreakDto,
} from './dto/attendance.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
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

  @Get(':id')
  @Permissions('attendance.approve')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.attendanceService.findOne(companyId, id);
  }

  @Post()
  @Permissions('attendance.approve')
  createManual(@TenantId() companyId: string, @Body() dto: CreateAttendanceDto) {
    return this.attendanceService.createManual(companyId, dto);
  }

  @Patch(':id')
  @Permissions('attendance.approve')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('attendance.approve')
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.attendanceService.remove(companyId, id);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
