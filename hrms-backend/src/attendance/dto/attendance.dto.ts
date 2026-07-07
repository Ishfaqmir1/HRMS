import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum AttendanceSourceDto {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  GPS = 'GPS',
  BIOMETRIC = 'BIOMETRIC',
  QR = 'QR',
  FACE = 'FACE',
  MANUAL = 'MANUAL',
}

export enum AttendanceStatusDto {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
  HOLIDAY = 'HOLIDAY',
  WEEK_OFF = 'WEEK_OFF',
  LATE = 'LATE',
}

export class ClockInDto {
  @ApiPropertyOptional({ enum: AttendanceSourceDto, default: AttendanceSourceDto.WEB })
  @IsOptional()
  @IsEnum(AttendanceSourceDto)
  source?: AttendanceSourceDto;

  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ClockOutDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

/** HR/admin manual entry or correction on behalf of an employee. */
export class CreateAttendanceDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: '2026-07-06' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() checkIn?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() checkOut?: string;

  @ApiPropertyOptional({ enum: AttendanceStatusDto, default: AttendanceStatusDto.PRESENT })
  @IsOptional()
  @IsEnum(AttendanceStatusDto)
  status?: AttendanceStatusDto;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

class UpdateAttendanceBaseDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() checkIn?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() checkOut?: string;

  @ApiPropertyOptional({ enum: AttendanceStatusDto })
  @IsOptional()
  @IsEnum(AttendanceStatusDto)
  status?: AttendanceStatusDto;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateAttendanceDto extends PartialType(UpdateAttendanceBaseDto) {}
