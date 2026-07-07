import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBillingPlanDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() minMonthlyFee?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() pricePerEmployee?: number;
  @ApiPropertyOptional({ default: 25 }) @IsOptional() @IsInt() includedEmployees?: number;
  @ApiPropertyOptional({ default: 25 }) @IsOptional() @IsInt() maxEmployees?: number;
  @ApiPropertyOptional({ default: 15 }) @IsOptional() @IsInt() annualDiscountPercent?: number;
  @ApiPropertyOptional({ default: 5 }) @IsOptional() @IsInt() maxStorageGB?: number;
  @ApiPropertyOptional({ default: 'INR' }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() features?: any;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateBillingPlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minMonthlyFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pricePerEmployee?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() includedEmployees?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() maxEmployees?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() annualDiscountPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() maxStorageGB?: number;
  @ApiPropertyOptional() @IsOptional() features?: any;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateCompanySubscriptionDto {
  @ApiProperty() @IsString() billingPlanId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingCycle?: 'MONTHLY' | 'YEARLY';
}

export class CreateFeatureFlagDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isGlobal?: boolean;
}

export class ToggleFeatureFlagDto {
  @ApiProperty() @IsBoolean() isEnabled: boolean;
}

export class UpdateCompanyBrandingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secondaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accentColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() faviconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customDomain?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emailFooter?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
}
