import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SetupWizardService } from './setup-wizard.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Setup Wizard')
@ApiBearerAuth()
@Controller('setup')
export class SetupWizardController {
  constructor(private readonly setupWizardService: SetupWizardService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if setup wizard has been completed for the company' })
  getStatus(@TenantId() companyId: string) {
    return this.setupWizardService.getStatus(companyId);
  }

  @Post('run')
  @ApiOperation({ summary: 'Run setup wizard: auto-create default entities (branch, department, shift, leave types, etc.)' })
  runSetup(@TenantId() companyId: string, @CurrentUser('userId') userId: string) {
    return this.setupWizardService.runSetup(companyId);
  }

  @Post('skip')
  @ApiOperation({ summary: 'Skip the setup wizard' })
  skipSetup(@TenantId() companyId: string) {
    return this.setupWizardService.skipSetup(companyId);
  }
}
