import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min,
} from 'class-validator';

// ============================================================================
// Job Postings
// ============================================================================
export class CreateJobPostingDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional({ enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'PROBATION'] })
  @IsOptional() @IsEnum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'PROBATION'] as const) employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'PROBATION';
  @ApiPropertyOptional() @IsOptional() @IsNumber() minSalary?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxSalary?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() requirements?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibilities?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) openings?: number;
  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED'] })
  @IsOptional() @IsEnum(['DRAFT', 'PUBLISHED'] as const) status?: 'DRAFT' | 'PUBLISHED';
}

export class UpdateJobPostingDto extends PartialType(CreateJobPostingDto) {}

export class UpdateJobStatusDto {
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'CLOSED', 'ON_HOLD'] })
  @IsEnum(['DRAFT', 'PUBLISHED', 'CLOSED', 'ON_HOLD'] as const) status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ON_HOLD';
}

// ============================================================================
// Job Applications
// ============================================================================
export class CreateApplicationDto {
  @ApiProperty() @IsUUID() jobPostingId: string;
  @ApiProperty() @IsString() candidateName: string;
  @ApiProperty() @IsEmail() candidateEmail: string;
  @ApiPropertyOptional() @IsOptional() @IsString() candidatePhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resumeUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() coverLetter?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'] })
  @IsEnum(['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'] as const)
  status: 'NEW' | 'SCREENING' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFERED' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateApplicationRatingDto {
  @ApiProperty() @IsInt() @Min(1) @Max(5) rating: number;
}

// ============================================================================
// Interviews
// ============================================================================
export class CreateInterviewDto {
  @ApiProperty() @IsUUID() applicationId: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiProperty() @IsDateString() scheduledAt: string;
  @ApiPropertyOptional({ default: 60 }) @IsOptional() @IsInt() @Min(15) @Max(480) durationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString({ each: true }) interviewerIds?: string[];
}

export class UpdateInterviewDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(15) @Max(480) durationMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString({ each: true }) interviewerIds?: string[];
  @ApiPropertyOptional({ enum: ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'] })
  @IsOptional() @IsEnum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'] as const) status?: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  @ApiPropertyOptional() @IsOptional() @IsString() feedback?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
}
