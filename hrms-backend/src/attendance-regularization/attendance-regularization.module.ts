import { Module } from '@nestjs/common';
import { AttendanceRegularizationService } from './attendance-regularization.service';
import { AttendanceRegularizationController } from './attendance-regularization.controller';

@Module({
  controllers: [AttendanceRegularizationController],
  providers: [AttendanceRegularizationService],
  exports: [AttendanceRegularizationService],
})
export class AttendanceRegularizationModule {}
