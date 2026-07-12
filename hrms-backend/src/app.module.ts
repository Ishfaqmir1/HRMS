import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';

import { AuthController } from './auth/auth.controller';
import { HealthController } from './health/health.controller';
import { BillingController } from './billing/billing.controller';

import { CompaniesModule } from './companies/companies.module';
import { BranchesModule } from './branches/branches.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { RolesModule } from './roles/roles.module';
import { HealthModule } from './health/health.module';
import { ShiftsModule } from './shifts/shifts.module';
import { HolidaysModule } from './holidays/holidays.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { EssModule } from './ess/ess.module';
import { GeoFenceModule } from './geo-fence/geo-fence.module';
import { PayrollModule } from './payroll/payroll.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { DocumentsModule } from './documents/documents.module';
import { TaxDeclarationsModule } from './tax-declarations/tax-declarations.module';
import { RedisCacheModule } from './redis/redis-cache.module';
import { AssetsModule } from './assets/assets.module';
import { TrainingModule } from './training/training.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BillingModule } from './billing/billing.module';
import { DocumentTemplatesModule } from './document-templates/document-templates.module';
import { AttendanceSecurityModule } from './attendance-security/attendance-security.module';
import { AttendanceRegularizationModule } from './attendance-regularization/attendance-regularization.module';
import { UploadModule } from './upload/upload.module';
import { AttendancePolicyModule } from './attendance-policy/attendance-policy.module';
import { StatutoryComplianceModule } from './statutory-compliance/statutory-compliance.module';
import { DesignationsModule } from './designations/designations.module';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SessionValidationGuard } from './common/guards/session-validation.guard';
import { CompanyStatusGuard } from './common/guards/company-status.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl')! * 1000,
          limit: config.get<number>('throttle.limit')!,
        },
      ],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisCacheModule,
    CommonModule,

    AuthModule,
    CompaniesModule,
    BranchesModule,
    DepartmentsModule,
    EmployeesModule,
    RolesModule,
    HealthModule,
    ShiftsModule,
    HolidaysModule,
    AttendanceModule,
    LeaveModule,
    EssModule,
    GeoFenceModule,
    PayrollModule,
    RecruitmentModule,
    DocumentsModule,
    TaxDeclarationsModule,
    AssetsModule,
    TrainingModule,
    AnalyticsModule,
    BillingModule,
    AttendancePolicyModule,
    AttendanceSecurityModule,
    DocumentTemplatesModule,
    AttendanceRegularizationModule,
    StatutoryComplianceModule,
    DesignationsModule,
    UploadModule,
  ],
  providers: [
    // ──────────────────────────────────────────────────────────────────
    // Global Guards — execution order (first = outermost)
    // ──────────────────────────────────────────────────────────────────

    // 1. Rate limiting (before auth — no point authenticating a rate-limited request)
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // 2. JWT authentication (validates token, attaches user to request)
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // 3. Session validation (user not deleted/disabled, mustChangePassword check)
    { provide: APP_GUARD, useClass: SessionValidationGuard },

    // 4. Company status validation (company active, trial not expired, not suspended)
    { provide: APP_GUARD, useClass: CompanyStatusGuard },

    // ──────────────────────────────────────────────────────────────────
    // Global pipes, filters, interceptors
    // ──────────────────────────────────────────────────────────────────

    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Middleware runs before guards — outermost first
    consumer
      .apply(RequestIdMiddleware, RequestLoggerMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes('*');

    // CSRF middleware — protects all state-changing routes
    // Uses double-submit cookie pattern (cookie + header must match)
    // Public routes excluded — middleware checks exemptedPaths internally
    consumer
      .apply(CsrfMiddleware)
      .forRoutes('*');
  }
}
