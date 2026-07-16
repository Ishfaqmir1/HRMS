import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminUsersService } from './admin-users.service';
import { AdminRolesService } from './admin-roles.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminDashboardService,
    AdminAuditService,
    AdminSettingsService,
    AdminAnalyticsService,
    AdminBillingService,
    AdminUsersService,
    AdminRolesService,
  ],
  exports: [
    AdminDashboardService,
    AdminAuditService,
    AdminSettingsService,
    AdminAnalyticsService,
    AdminBillingService,
    AdminUsersService,
    AdminRolesService,
  ],
})
export class AdminModule {}
