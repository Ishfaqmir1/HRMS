import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { GeoFenceModule } from '../geo-fence/geo-fence.module';
import { AttendanceSecurityModule } from '../attendance-security/attendance-security.module';

@Module({
  imports: [GeoFenceModule, AttendanceSecurityModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
