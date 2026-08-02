import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateTrainingDto, UpdateTrainingDto } from './dto/training.dto';

@ApiTags('Training')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // ============ Admin CRUD ============

  @Post()
  @Permissions('company.update')
  create(@TenantId() companyId: string, @Body() dto: CreateTrainingDto) {
    return this.trainingService.create(companyId, dto);
  }

  @Get()
  @Permissions('company.update')
  findAll(@TenantId() companyId: string) {
    return this.trainingService.findAll(companyId);
  }

  // ============ Employee self-service (must be before :id routes) ============

  @Get('me')
  myTrainings(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.trainingService.findMyEnrollments(user.employeeId!);
  }

  // ============ Admin CRUD ============

  @Get(':id')
  @Permissions('company.update')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.trainingService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('company.update')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateTrainingDto) {
    return this.trainingService.update(companyId, id, dto);
  }

  @Post(':id/status')
  @Permissions('company.update')
  updateStatus(@TenantId() companyId: string, @Param('id') id: string, @Body('status') status: string) {
    return this.trainingService.updateStatus(companyId, id, status);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
