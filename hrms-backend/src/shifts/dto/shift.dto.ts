import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateShiftDto {
  @ApiProperty({ example: 'General Shift' })
  @IsString()
  name: string;

  @ApiProperty({ example: '09:00', description: '24h HH:mm' })
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ example: '18:00', description: '24h HH:mm' })
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodMinutes?: number;

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: 'Working weekdays, 0=Sunday .. 6=Saturday',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workingDays: number[];
}

export class UpdateShiftDto extends PartialType(CreateShiftDto) {}

export class AssignShiftDto {
  @ApiProperty({ type: [String], description: 'Employee IDs to assign this shift to' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  employeeIds: string[];
}
