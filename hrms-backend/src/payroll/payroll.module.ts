import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { StatutoryComplianceModule } from '../statutory-compliance/statutory-compliance.module';

@Module({
  imports: [StatutoryComplianceModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
