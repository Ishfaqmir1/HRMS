import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 3, description: 'Hierarchy level (lower = more junior)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;
}

export class UpdateDesignationDto extends PartialType(CreateDesignationDto) {}
