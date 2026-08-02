import { Module } from '@nestjs/common';
import { SetupWizardService } from './setup-wizard.service';
import { SetupWizardController } from './setup-wizard.controller';

@Module({
  controllers: [SetupWizardController],
  providers: [SetupWizardService],
  exports: [SetupWizardService],
})
export class SetupWizardModule {}
