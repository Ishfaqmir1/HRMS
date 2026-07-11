import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { GeoFenceModule } from '../geo-fence/geo-fence.module';
import { AttendanceSecurityModule } from '../attendance-security/attendance-security.module';
import { AttendancePolicyModule } from '../attendance-policy/attendance-policy.module';

@Module({
  imports: [GeoFenceModule, AttendanceSecurityModule, AttendancePolicyModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
