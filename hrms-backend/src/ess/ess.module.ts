import { Module } from '@nestjs/common';
import { EssService } from './ess.service';
import { EssController } from './ess.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { AttendanceRegularizationModule } from '../attendance-regularization/attendance-regularization.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';

@Module({
  imports: [AttendanceModule, LeaveModule, HolidaysModule, AttendanceRegularizationModule, DocumentTemplatesModule],
  controllers: [EssController],
  providers: [EssService],
})
export class EssModule {}
