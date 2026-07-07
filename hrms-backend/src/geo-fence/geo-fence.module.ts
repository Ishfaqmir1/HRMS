import { Module } from '@nestjs/common';
import { GeoFenceService } from './geo-fence.service';

@Module({
  providers: [GeoFenceService],
  exports: [GeoFenceService],
})
export class GeoFenceModule {}
