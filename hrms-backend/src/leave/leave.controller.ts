import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto, RejectLeaveRequestDto, SetLeaveBalanceDto } from './dto/leave-request.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, RolesGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // ---- Self-service ----

  @Post('requests')
  @Permissions('leave.create')
  createRequest(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.leaveService.createRequest(companyId, user.employeeId!, dto);
  }

  @Get('requests/me')
  @Permissions('leave.read')
  myRequests(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.leaveService.myRequests(user.employeeId!, query);
  }

  @Post('requests/:id/cancel')
  @Permissions('leave.create')
  cancelMyRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.assertHasEmployeeProfile(user);
    return this.leaveService.cancelMyRequest(user.employeeId!, id);
  }

  @Get('balances/me')
  @Permissions('leave.read')
  @ApiQuery({ name: 'year', required: false, type: Number })
  myBalances(@CurrentUser() user: AuthenticatedUser, @Query('year') year?: string) {
    this.assertHasEmployeeProfile(user);
    return this.leaveService.myBalances(user.employeeId!, year ? parseInt(year, 10) : undefined);
  }

  // ---- HR / management ----

  @Get('requests')
  @Permissions('leave.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @TenantId() companyId: string,
    @Query() query: PaginationQueryDto,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.leaveService.findAll(companyId, query, { employeeId, status });
  }

  @Post('requests/:id/approve')
  @Permissions('leave.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  approve(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leaveService.approve(companyId, id, user.employeeId ?? undefined);
  }

  @Post('requests/:id/reject')
  @Permissions('leave.approve')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  reject(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
  ) {
    return this.leaveService.reject(companyId, id, dto, user.employeeId ?? undefined);
  }

  @Post('balances')
  @Permissions('leavebalance.update')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  setBalance(@TenantId() companyId: string, @Body() dto: SetLeaveBalanceDto) {
    return this.leaveService.setBalance(companyId, dto);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
