import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Leave Types')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Post()
  @Permissions('leavetype.create')
  create(@TenantId() companyId: string, @Body() dto: CreateLeaveTypeDto) {
    return this.leaveTypesService.create(companyId, dto);
  }

  @Get()
  @Permissions('leavetype.read')
  findAll(@TenantId() companyId: string) {
    return this.leaveTypesService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('leavetype.read')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.leaveTypesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('leavetype.update')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leaveTypesService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('leavetype.delete')
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.leaveTypesService.remove(companyId, id);
  }
}
