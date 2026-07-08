import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum RegularizationStatusDto {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Employee submits a regularization request for a specific date. */
export class CreateRegularizationDto {
  @ApiProperty({ example: '2026-07-06' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attendanceId?: string;

  @ApiProperty({ example: 'I was stuck in traffic due to heavy rain.' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ example: '2026-07-06T09:15:00Z' })
  @IsOptional()
  @IsDateString()
  requestedCheckIn?: string;

  @ApiPropertyOptional({ example: '2026-07-06T18:10:00Z' })
  @IsOptional()
  @IsDateString()
  requestedCheckOut?: string;

  @ApiPropertyOptional({ example: 'PRESENT' })
  @IsOptional()
  @IsString()
  requestedStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/** HR rejection with reason. */
export class RejectRegularizationDto {
  @ApiProperty({ example: 'The provided reason does not match recorded geo-location data.' })
  @IsString()
  rejectionReason: string;
}
