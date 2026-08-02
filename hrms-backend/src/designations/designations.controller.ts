import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DesignationsService } from './designations.service';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/create-designation.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Designations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, RolesGuard)
@Controller('designations')
export class DesignationsController {
  constructor(private readonly designationsService: DesignationsService) {}

  @Post()
  @Permissions('employee.update')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  create(@TenantId() companyId: string, @Body() dto: CreateDesignationDto) {
    return this.designationsService.create(companyId, dto);
  }

  @Get()
  @Permissions('employee.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  findAll(@TenantId() companyId: string) {
    return this.designationsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('employee.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.designationsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('employee.update')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateDesignationDto) {
    return this.designationsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('employee.delete')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.designationsService.remove(companyId, id);
  }
}
