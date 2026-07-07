import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Permissions('department.create')
  create(@TenantId() companyId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(companyId, dto);
  }

  @Get()
  @Permissions('department.read')
  findAll(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.departmentsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('department.read')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.departmentsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('department.update')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('department.delete')
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.departmentsService.remove(companyId, id);
  }
}
