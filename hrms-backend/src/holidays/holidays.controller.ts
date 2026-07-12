import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SystemRole } from '../common/enums/role.enum';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, RolesGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @Permissions('holiday.create')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  create(@TenantId() companyId: string, @Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(companyId, dto);
  }

  @Get()
  @Permissions('holiday.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  @ApiQuery({ name: 'year', required: false, type: Number })
  findAll(@TenantId() companyId: string, @Query('year') year?: string) {
    return this.holidaysService.findAll(companyId, year ? parseInt(year, 10) : undefined);
  }

  @Get(':id')
  @Permissions('holiday.read')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.holidaysService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('holiday.update')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateHolidayDto) {
    return this.holidaysService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('holiday.delete')
  @Roles(SystemRole.HR_MANAGER, SystemRole.COMPANY_OWNER)
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.holidaysService.remove(companyId, id);
  }
}
