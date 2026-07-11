import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttendancePolicyService } from './attendance-policy.service';
import { UpdateAttendancePolicyDto } from './dto/attendance-policy.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Attendance Policy')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('attendance-policy')
export class AttendancePolicyController {
  constructor(private readonly policyService: AttendancePolicyService) {}

  @Get()
  @Permissions('company.read')
  getPolicy(@TenantId() companyId: string) {
    return this.policyService.getPolicy(companyId);
  }

  @Patch()
  @Permissions('company.update')
  updatePolicy(@TenantId() companyId: string, @Body() dto: UpdateAttendancePolicyDto) {
    return this.policyService.updatePolicy(companyId, dto);
  }
}
