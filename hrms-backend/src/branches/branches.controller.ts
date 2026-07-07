import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { SetBranchGeoDto } from './dto/set-branch-geo.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @Permissions('branch.create')
  create(@TenantId() companyId: string, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(companyId, dto);
  }

  @Get()
  @Permissions('branch.read')
  findAll(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.branchesService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('branch.read')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.branchesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('branch.update')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(companyId, id, dto);
  }

  @Patch(':id/geo')
  @Permissions('branch.update')
  setGeoLocation(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: SetBranchGeoDto) {
    return this.branchesService.setGeoLocation(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('branch.delete')
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.branchesService.remove(companyId, id);
  }
}
