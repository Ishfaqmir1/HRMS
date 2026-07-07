import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ example: 'New Year\u2019s Day' })
  @IsString()
  name: string;

  @ApiProperty({ example: '2027-01-01' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Leave empty to apply company-wide' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}

export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
