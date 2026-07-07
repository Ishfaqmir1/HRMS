import { Module } from '@nestjs/common';
import { EssService } from './ess.service';
import { EssController } from './ess.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [AttendanceModule, LeaveModule, HolidaysModule],
  controllers: [EssController],
  providers: [EssService],
})
export class EssModule {}
