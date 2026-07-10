import { Module } from '@nestjs/common';
import { StatutoryComplianceService } from './statutory-compliance.service';
import { StatutoryComplianceController } from './statutory-compliance.controller';

@Module({
  controllers: [StatutoryComplianceController],
  providers: [StatutoryComplianceService],
  exports: [StatutoryComplianceService],
})
export class StatutoryComplianceModule {}
