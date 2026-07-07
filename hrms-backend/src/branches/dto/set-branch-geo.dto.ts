import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SetBranchGeoDto {
  @ApiProperty({ example: 40.7128, description: 'Branch latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -74.006, description: 'Branch longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ example: 500, description: 'Geo-fence radius in meters (default 500)' })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5000)
  geoFenceRadiusMeters?: number;
}
