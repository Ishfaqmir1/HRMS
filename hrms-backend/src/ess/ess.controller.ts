import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EssService } from './ess.service';
import { UpdateMyProfileDto } from './dto/update-profile.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Employee Self-Service')
@ApiBearerAuth()
@Controller('me')
export class EssController {
  constructor(private readonly essService: EssService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.getProfile(user.employeeId!);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMyProfileDto) {
    this.assertHasEmployeeProfile(user);
    return this.essService.updateProfile(user.employeeId!, dto);
  }

  @Get('dashboard')
  getDashboard(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.essService.getDashboard(companyId, user.employeeId!);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
