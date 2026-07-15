import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ResetPasswordDto {
  @ApiProperty({ description: 'New password for the company owner/admin account' })
  @IsString()
  newPassword: string;
}

export class SendAnnouncementDto {
  @ApiProperty({ description: 'Announcement subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Announcement body text' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Send via email as well' })
  @IsOptional()
  sendEmail?: boolean;
}

export class UpdateCompanyPlanDto {
  @ApiProperty({ description: 'Billing plan ID' })
  @IsUUID()
  planId: string;

  @ApiPropertyOptional({ description: 'Billing cycle', default: 'MONTHLY' })
  @IsOptional()
  @IsString()
  billingCycle?: 'MONTHLY' | 'YEARLY';
}

export class UpdateCompanyLimitsDto {
  @ApiPropertyOptional({ description: 'New max employee limit' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999999)
  maxEmployees?: number;

  @ApiPropertyOptional({ description: 'New max storage in GB' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999999)
  maxStorageGB?: number;
}

export class CompanyQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  search?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class RejectCompanyDto {
  @ApiProperty({ description: 'Reason for rejecting the company' })
  @IsString()
  reason: string;
}
