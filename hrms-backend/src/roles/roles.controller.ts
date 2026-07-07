import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, AssignPermissionsDto, AssignRoleToUserDto } from './dto/role.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  @Permissions('role.read')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get()
  @Permissions('role.read')
  findAll(@TenantId() companyId: string) {
    return this.rolesService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('role.read')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.rolesService.findOne(companyId, id);
  }

  @Post()
  @Permissions('role.create')
  create(@TenantId() companyId: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(companyId, dto);
  }

  @Put(':id/permissions')
  @Permissions('role.update')
  setPermissions(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rolesService.setPermissions(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('role.delete')
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.rolesService.remove(companyId, id);
  }

  @Post('assign')
  @Permissions('role.assign')
  assign(@TenantId() companyId: string, @Body() dto: AssignRoleToUserDto) {
    return this.rolesService.assignRoleToUser(companyId, dto.userId, dto.roleId);
  }

  @Post('revoke')
  @Permissions('role.assign')
  revoke(@TenantId() companyId: string, @Body() dto: AssignRoleToUserDto) {
    return this.rolesService.revokeRoleFromUser(companyId, dto.userId, dto.roleId);
  }
}
