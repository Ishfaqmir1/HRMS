import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('me')
  myAssets(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.assetsService.findMyAssets(user.employeeId!);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
