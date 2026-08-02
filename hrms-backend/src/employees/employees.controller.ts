import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ChangeEmployeeStatusDto } from './dto/change-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Permissions('employee.create')
  create(@TenantId() companyId: string, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(companyId, dto);
  }

  @Get()
  @Permissions('employee.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @TenantId() companyId: string,
    @Query() query: PaginationQueryDto,
    @Query('departmentId') departmentId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.employeesService.findAll(companyId, query, { departmentId, branchId, status });
  }

  @Get(':id')
  @Permissions('employee.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.HR, SystemRole.DEPARTMENT_HEAD, SystemRole.COMPANY_OWNER)
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.employeesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('employee.update')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(companyId, id, dto);
  }

  @Patch(':id/status')
  @Permissions('employee.update')
  changeStatus(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: ChangeEmployeeStatusDto,
  ) {
    return this.employeesService.changeStatus(companyId, id, dto);
  }

  @Post('import')
  @Permissions('employee.create')
  @ApiOperation({ summary: 'Bulk import employees from pre-validated CSV rows' })
  importEmployees(
    @TenantId() companyId: string,
    @Body() dto: { employees: CreateEmployeeDto[] },
  ) {
    return this.employeesService.importEmployees(companyId, dto.employees);
  }

  @Delete(':id')
  @Permissions('employee.delete')
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.employeesService.remove(companyId, id);
  }
}
