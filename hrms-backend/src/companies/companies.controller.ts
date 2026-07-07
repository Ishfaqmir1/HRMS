import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // ---- Tenant self-service ----

  @Get('me')
  @UseGuards(PermissionsGuard)
  @Permissions('company.read')
  getMyCompany(@TenantId() companyId: string) {
    return this.companiesService.getMyCompany(companyId);
  }

  @Patch('me')
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  updateMyCompany(@TenantId() companyId: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateMyCompany(companyId, dto);
  }

  // ---- Platform admin (Super Admin only) ----

  @Get()
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  findAll(@Query() query: PaginationQueryDto) {
    return this.companiesService.findAll(query);
  }

  @Patch(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  suspend(@Param('id') id: string) {
    return this.companiesService.setStatus(id, 'SUSPENDED');
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.SUPER_ADMIN)
  activate(@Param('id') id: string) {
    return this.companiesService.setStatus(id, 'ACTIVE');
  }
}
