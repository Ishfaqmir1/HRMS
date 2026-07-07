import { Module } from '@nestjs/common';
import { AttendanceSecurityService } from './attendance-security.service';
import { AttendanceSecurityController } from './attendance-security.controller';
import { GeoFenceModule } from '../geo-fence/geo-fence.module';

@Module({
  imports: [GeoFenceModule],
  controllers: [AttendanceSecurityController],
  providers: [AttendanceSecurityService],
  exports: [AttendanceSecurityService],
})
export class AttendanceSecurityModule {}
