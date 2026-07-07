import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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

  // ================================================================
  // Attendance Security Fields (Layers 2–15)
  // ================================================================

  // Layer 2: Device Trust
  @ApiPropertyOptional() @IsOptional() @IsString() deviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() browserInfo?: string;

  // Layer 5: Wi-Fi
  @ApiPropertyOptional() @IsOptional() @IsString() wifiSsid?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() wifiBssid?: string;

  // Layer 6: IP
  @ApiPropertyOptional() @IsOptional() @IsString() ipAddress?: string;

  // Layer 7: QR
  @ApiPropertyOptional() @IsOptional() @IsString() qrCode?: string;

  // Layer 8 & 9: Face + Liveness
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsNumber({}, { each: true }) faceEncoding?: number[];
  @ApiPropertyOptional() @IsOptional() @IsObject() livenessResult?: { passed: boolean; score?: number; method?: string };

  // Layer 11: Location Integrity
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) locationAccuracy?: number;

  // Layer 12: VPN
  @ApiPropertyOptional() @IsOptional() @IsBoolean() vpnDetected?: boolean;

  // Layer 13: Network Change
  @ApiPropertyOptional() @IsOptional() @IsBoolean() networkChanged?: boolean;

  // Layer 15: Selfie
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
}

export class ClockOutDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  // ================================================================
  // Attendance Security Fields
  // ================================================================

  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() browserInfo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() wifiSsid?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() wifiBssid?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ipAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() qrCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsNumber({}, { each: true }) faceEncoding?: number[];
  @ApiPropertyOptional() @IsOptional() @IsObject() livenessResult?: { passed: boolean; score?: number; method?: string };
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) locationAccuracy?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() vpnDetected?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() networkChanged?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
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
