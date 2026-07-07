import { Module } from '@nestjs/common';
import { TaxDeclarationsService } from './tax-declarations.service';
import { TaxDeclarationsController } from './tax-declarations.controller';

@Module({
  controllers: [TaxDeclarationsController],
  providers: [TaxDeclarationsService],
  exports: [TaxDeclarationsService],
})
export class TaxDeclarationsModule {}
