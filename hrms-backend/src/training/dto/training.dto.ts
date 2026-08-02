import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTrainingDto {
  @ApiProperty({ example: 'AWS Cloud Practitioner Certification' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Comprehensive training on AWS cloud services' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Amazon Web Services' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ example: '8 hours' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ example: 'ONLINE' })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;
}

export class UpdateTrainingDto extends PartialType(CreateTrainingDto) {}
