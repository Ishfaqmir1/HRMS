import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateAttendancePolicyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5] }) @IsOptional() @IsArray() @IsInt({ each: true }) workingDays?: number[];
  @ApiPropertyOptional() @IsOptional() @IsString() defaultStartTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultEndTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(24) dailyWorkingHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(480) breakDurationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(120) gracePeriodMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(240) lateThresholdMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(480) veryLateThresholdMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(480) halfDayThresholdMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(60) @Max(720) minimumWorkingMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(60) @Max(1440) maximumWorkingMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableOvertime?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) overtimeStartsAfterMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) maxOvertimeMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableAutoLateDetection?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableAutoHalfDay?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableAutoAbsent?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableAutoCheckout?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() autoCheckoutTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableRemoteWork?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableFlexibleShift?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableMultiplePunch?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() crossMidnightShift?: boolean;
}
