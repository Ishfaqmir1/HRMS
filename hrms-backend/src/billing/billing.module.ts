import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';

@Module({
  imports: [DocumentTemplatesModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
