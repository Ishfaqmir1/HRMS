import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminSettingsService } from './admin-settings.service';

@Module({
  controllers: [AdminController],
  providers: [AdminDashboardService, AdminAuditService, AdminSettingsService],
  exports: [AdminDashboardService, AdminAuditService, AdminSettingsService],
})
export class AdminModule {}
