import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';

import { AuditService } from './services/audit.service';
import { LoginSecurityService } from './services/login-security.service';

import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { CompanyStatusGuard } from './guards/company-status.guard';
import { SessionValidationGuard } from './guards/session-validation.guard';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    AuditService,
    LoginSecurityService,

    // Guards (used via APP_GUARD in app.module)
    FeatureFlagGuard,
    CompanyStatusGuard,
    SessionValidationGuard,
  ],
  exports: [
    AuditService,
    LoginSecurityService,
    FeatureFlagGuard,
    CompanyStatusGuard,
    SessionValidationGuard,
  ],
})
export class CommonModule {}
