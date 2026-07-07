import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum EmploymentTypeDto {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
  PROBATION = 'PROBATION',
}

export enum GenderDto {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-0042' })
  @IsString()
  employeeCode: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'john.smith@gmail.com' })
  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @ApiPropertyOptional({ example: 'john.smith@acme.com' })
  @IsOptional()
  @IsEmail()
  workEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;

  @ApiPropertyOptional({ enum: GenderDto })
  @IsOptional()
  @IsEnum(GenderDto)
  gender?: GenderDto;

  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  dateOfJoining: string;

  @ApiPropertyOptional({ enum: EmploymentTypeDto, default: EmploymentTypeDto.FULL_TIME })
  @IsOptional()
  @IsEnum(EmploymentTypeDto)
  employmentType?: EmploymentTypeDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() designationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() reportingManagerId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'If true, also creates a linked User login account using workEmail.',
  })
  @IsOptional()
  @IsBoolean()
  createLoginAccount?: boolean;

  @ApiPropertyOptional({
    description: 'Role slug to assign if createLoginAccount is true (e.g. "employee", "team-lead")',
    default: 'employee',
  })
  @IsOptional()
  @IsString()
  roleSlug?: string;
}
