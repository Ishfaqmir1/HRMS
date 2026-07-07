import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum EmployeeStatusDto {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  RESIGNED = 'RESIGNED',
  TERMINATED = 'TERMINATED',
  RETIRED = 'RETIRED',
}

export class ChangeEmployeeStatusDto {
  @ApiProperty({ enum: EmployeeStatusDto })
  @IsEnum(EmployeeStatusDto)
  status: EmployeeStatusDto;

  @ApiPropertyOptional({ description: 'Set when status implies exit (RESIGNED/TERMINATED/RETIRED)' })
  @IsOptional()
  @IsDateString()
  dateOfExit?: string;
}
