import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateLeaveRequestDto {
  @ApiProperty()
  @IsUUID()
  leaveTypeId: string;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-08-12' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectLeaveRequestDto {
  @ApiProperty()
  @IsString()
  rejectionReason: string;
}

export class SetLeaveBalanceDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsUUID()
  leaveTypeId: string;

  @ApiProperty({ example: 2026 })
  @IsNumber()
  year: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  allocated: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carriedForward?: number;
}
