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
import { AttendanceRegularizationService } from './attendance-regularization.service';
import { CreateRegularizationDto, RejectRegularizationDto } from './dto/attendance-regularization.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Attendance Regularization')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('attendance-regularization')
export class AttendanceRegularizationController {
  constructor(
    private readonly regularizationService: AttendanceRegularizationService,
  ) {}

  // ---- Self-service (any authenticated employee) ----

  @Post()
  @Permissions('attendance.create')
  create(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRegularizationDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.regularizationService.create(companyId, user.employeeId!, dto);
  }

  @Get('me')
  @Permissions('attendance.read')
  myRequests(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    this.assertHasEmployeeProfile(user);
    return this.regularizationService.myRequests(user.employeeId!, query);
  }

  // ---- HR / management ----

  @Get()
  @Permissions('attendance.approve')
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default 20, max 100)' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (PENDING, APPROVED, REJECTED)' })
  findAll(
    @TenantId() companyId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const query = new PaginationQueryDto();
    query.page = p;
    query.limit = l;
    return this.regularizationService.findAll(companyId, query, { employeeId, status });
  }

  @Get(':id')
  @Permissions('attendance.approve')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.regularizationService.findOne(companyId, id);
  }

  @Post(':id/approve')
  @Permissions('attendance.approve')
  approve(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.regularizationService.approve(companyId, id, user.employeeId ?? undefined);
  }

  @Post(':id/reject')
  @Permissions('attendance.approve')
  reject(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectRegularizationDto,
  ) {
    return this.regularizationService.reject(companyId, id, dto, user.employeeId ?? undefined);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
