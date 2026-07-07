import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';

import { AuthModule } from './auth/auth.module';
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
import { AssetsModule } from './assets/assets.module';
import { TrainingModule } from './training/training.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BillingModule } from './billing/billing.module';
import { AttendanceSecurityModule } from './attendance-security/attendance-security.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
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

    // Phase 1: Foundation
    AuthModule,
    CompaniesModule,
    BranchesModule,
    DepartmentsModule,
    EmployeesModule,
    RolesModule,
    HealthModule,

    // Phase 2: Core HR
    ShiftsModule,
    HolidaysModule,
    AttendanceModule,
    LeaveModule,
    EssModule,

    // Geo-fencing
    GeoFenceModule,

    // Phase 3: Payroll
    PayrollModule,

    // Phase 4: Recruitment / ATS
    RecruitmentModule,

    // Phase 5: Employee Self-Service
    DocumentsModule,
    TaxDeclarationsModule,
    AssetsModule,
    TrainingModule,

    // Phase 6: Analytics & Dashboards
    AnalyticsModule,

    // Phase 7: SaaS Billing
    BillingModule,

    // Phase 8: Attendance Security (16 layers)
    AttendanceSecurityModule,
  ],
  providers: [
    // Order matters: auth first, then throttling, exception handling, response shaping.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
