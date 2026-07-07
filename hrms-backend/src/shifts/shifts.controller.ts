import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto, AssignShiftDto } from './dto/shift.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @Permissions('shift.create')
  create(@TenantId() companyId: string, @Body() dto: CreateShiftDto) {
    return this.shiftsService.create(companyId, dto);
  }

  @Get()
  @Permissions('shift.read')
  findAll(@TenantId() companyId: string) {
    return this.shiftsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('shift.read')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.shiftsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('shift.update')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftsService.update(companyId, id, dto);
  }

  @Post(':id/assign')
  @Permissions('shift.assign')
  assign(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: AssignShiftDto) {
    return this.shiftsService.assign(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('shift.delete')
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.shiftsService.remove(companyId, id);
  }
}
