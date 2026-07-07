import { Module } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';

@Module({
  controllers: [LeaveTypesController, LeaveController],
  providers: [LeaveTypesService, LeaveService],
  exports: [LeaveTypesService, LeaveService],
})
export class LeaveModule {}
