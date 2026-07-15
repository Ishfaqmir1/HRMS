import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminModule {}
