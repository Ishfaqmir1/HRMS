import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum AssetTypeDto {
  LAPTOP = 'LAPTOP',
  MOBILE = 'MOBILE',
  TABLET = 'TABLET',
  VEHICLE = 'VEHICLE',
  FURNITURE = 'FURNITURE',
  ACCESS_CARD = 'ACCESS_CARD',
  SOFTWARE_LICENSE = 'SOFTWARE_LICENSE',
  OTHER = 'OTHER',
}
