import { Module } from '@nestjs/common';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendancePolicyController } from './attendance-policy.controller';

@Module({
  controllers: [AttendancePolicyController],
  providers: [AttendancePolicyService],
  exports: [AttendancePolicyService],
})
export class AttendancePolicyModule {}
